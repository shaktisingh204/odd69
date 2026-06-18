import {
    Controller, Post, Delete, UseInterceptors, UploadedFile,
    BadRequestException, UseGuards, Logger, Param, NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityTokenGuard } from '../auth/security-token.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
    private readonly logger = new Logger(UploadController.name);

    constructor(
        private readonly uploadService: UploadService,
        private readonly configService: ConfigService
    ) { }

    /** Existing: save to local disk (used by older parts of the system) */
    @UseGuards(SecurityTokenGuard)
    @Post()
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null)
                    .map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                // Normalize extension from MIME type to avoid trusting
                // user-supplied filename. Accepted MIME types are gated below.
                const extFromMime: Record<string, string> = {
                    'image/jpeg': '.jpg',
                    'image/png': '.png',
                    'image/gif': '.gif',
                    'image/webp': '.webp',
                };
                const ext = extFromMime[file.mimetype] || '.bin';
                return cb(null, `${randomName}${ext}`);
            },
        }),
        limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
        fileFilter: (req, file, cb) => {
            // SECURITY: validate by MIME type, not filename extension.
            // Attackers can set arbitrary filenames like `pwn.php.jpg`.
            if (!/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) {
                return cb(new BadRequestException('Only image files are allowed!'), false);
            }
            cb(null, true);
        }
    }))
    uploadFile(@UploadedFile() file: any) {
        if (!file) throw new BadRequestException('File upload failed or invalid file type');
        const backendUrl = this.configService.get<string>('BACKEND_PUBLIC_URL') || 'http://localhost:9828/api';
        return { url: `${backendUrl}/uploads/${file.filename}` };
    }

    /**
     * User-accessible screenshot upload for manual payment proof.
     * POST /upload/screenshot
     * Auth: JWT Bearer token (any logged-in user)
     * Body: multipart/form-data  { file: <image> }
     * Returns: { url: string }
     */
    @UseGuards(JwtAuthGuard)
    @Post('screenshot')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null)
                    .map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                const extFromMime: Record<string, string> = {
                    'image/jpeg': '.jpg',
                    'image/png': '.png',
                    'image/gif': '.gif',
                    'image/webp': '.webp',
                };
                const ext = extFromMime[file.mimetype] || '.bin';
                return cb(null, `screenshot_${randomName}${ext}`);
            },
        }),
        limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
        fileFilter: (req, file, cb) => {
            // SECURITY: MIME-type based validation.
            if (!/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) {
                return cb(new BadRequestException('Only image files are allowed!'), false);
            }
            cb(null, true);
        }
    }))
    uploadScreenshot(@UploadedFile() file: any) {
        if (!file) throw new BadRequestException('File upload failed or invalid file type');
        const backendUrl = this.configService.get<string>('BACKEND_PUBLIC_URL') || 'http://localhost:9828/api';
        return { url: `${backendUrl}/uploads/${file.filename}` };
    }

    /**
     * Upload image to Cloudflare Images — used by admin panel.
     * POST /upload/cloudflare
     * Auth: JWT Bearer token (admin must be logged in)
     * Body: multipart/form-data  { file: <image> }
     * Returns: { url: string, imageId: string }
     * Env vars: CF_ACCOUNT_ID, CF_IMAGES_TOKEN
     */
    @UseGuards(JwtAuthGuard)
    @Post('cloudflare')
    @UseInterceptors(FileInterceptor('file', {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },   // 10 MB
        fileFilter: (req, file, cb) => {
            if (!file.mimetype.match(/^image\/(jpeg|png|webp|gif)$/)) {
                return cb(new BadRequestException('Only JPEG, PNG, WebP or GIF allowed'), false);
            }
            cb(null, true);
        }
    }))
    async uploadToCloudflare(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('No file provided');

        const accountId = this.configService.get<string>('CF_ACCOUNT_ID');
        const token = this.configService.get<string>('CF_IMAGES_TOKEN');

        if (!accountId || !token) {
            throw new BadRequestException(
                'Cloudflare Images not configured. Add CF_ACCOUNT_ID and CF_IMAGES_TOKEN to .env'
            );
        }

        try {
            const FormData = (await import('form-data')).default;
            const form = new FormData();
            form.append('file', file.buffer, {
                filename: file.originalname || 'upload.jpg',
                contentType: file.mimetype,
            });

            const cfApiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;
            const res = await fetch(cfApiUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...form.getHeaders(),
                },
                body: form.getBuffer() as any,
            });

            const json = (await res.json()) as any;
            if (!json.success) {
                this.logger.error(`CF upload failed: ${JSON.stringify(json.errors)}`);
                throw new BadRequestException(
                    `Cloudflare upload failed: ${json.errors?.[0]?.message ?? 'Unknown error'}`
                );
            }

            const imageId: string = json.result.id;
            // variants: 'public' is the default delivery variant
            const url = json.result.variants?.[0] ?? `https://imagedelivery.net/${accountId}/${imageId}/public`;
            this.logger.log(`Uploaded to Cloudflare Images: ${imageId} → ${url}`);
            return { success: true, url, imageId };

        } catch (err: any) {
            if (err instanceof BadRequestException) throw err;
            throw new BadRequestException(`Upload error: ${err.message}`);
        }
    }

    /**
     * Delete an image from Cloudflare Images.
     * DELETE /upload/cloudflare/:imageId
     * Auth: JWT Bearer token
     */
    @UseGuards(JwtAuthGuard)
    @Delete('cloudflare/:imageId')
    async deleteFromCloudflare(@Param('imageId') imageId: string) {
        const accountId = this.configService.get<string>('CF_ACCOUNT_ID');
        const token = this.configService.get<string>('CF_IMAGES_TOKEN');

        if (!accountId || !token) {
            throw new BadRequestException('Cloudflare Images not configured');
        }

        try {
            const cfApiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`;
            const res = await fetch(cfApiUrl, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = (await res.json()) as any;

            if (res.status === 404) {
                throw new NotFoundException(`Image ${imageId} not found in Cloudflare`);
            }
            if (!json.success) {
                throw new BadRequestException(
                    `Cloudflare delete failed: ${json.errors?.[0]?.message ?? 'Unknown'}`
                );
            }

            this.logger.log(`Deleted from Cloudflare Images: ${imageId}`);
            return { success: true, imageId };

        } catch (err: any) {
            if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
            throw new BadRequestException(`Delete error: ${err.message}`);
        }
    }
}
