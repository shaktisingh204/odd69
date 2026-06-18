import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';
import * as https from 'https';

// ─── LAAFFIC Credentials (static) ───────────────────────────────────────────
const LAAFFIC_API_KEY = 'wM25FduG';
const LAAFFIC_API_SECRET = 'NU2GHjX0';
const LAAFFIC_APP_ID = 'y0Oqot98';
const LAAFFIC_SENDER_ID = '';         // optional branded sender name

const OTP_TTL_MINUTES = 2;
const MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60; // prevent spam: only 1 OTP per phone per minute

@Injectable()
export class SmsService {
    private readonly logger = new Logger(SmsService.name);

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    // ─── Signature Generation ───────────────────────────────────────────────────
    private buildHeaders(): { sign: string; timestamp: string; apiKey: string } {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const sign = crypto
            .createHash('md5')
            .update(LAAFFIC_API_KEY + LAAFFIC_API_SECRET + timestamp)
            .digest('hex');
        return { sign, timestamp, apiKey: LAAFFIC_API_KEY };
    }

    // ─── HTTP POST helper (native https — no extra deps) ────────────────────────
    private post<T>(url: string, body: object, extraHeaders: Record<string, string> = {}): Promise<T> {
        return new Promise((resolve, reject) => {
            const payload = JSON.stringify(body);
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                    'Content-Length': Buffer.byteLength(payload),
                    ...extraHeaders,
                },
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data) as T);
                    } catch {
                        reject(new Error(`LAAFFIC: Invalid JSON response — ${data}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    }

    // ─── OTP Generation ─────────────────────────────────────────────────────────
    private generateCode(): string {
        return String(Math.floor(100000 + Math.random() * 900000));
    }

    // ─── Send OTP ───────────────────────────────────────────────────────────────
    /**
     * Generate and deliver an OTP to `phoneNumber`.
     * `purpose`: "REGISTER" | "FORGOT_PASSWORD"
     */
    async sendOtp(phoneNumber: string, purpose: string): Promise<{ message: string }> {
        // Rate-limit: refuse if an un-expired OTP was created within the cooldown window
        const cooldownCutoff = new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000);
        const recent = await this.prisma.phoneOtp.findFirst({
            where: {
                phoneNumber,
                purpose,
                used: false,
                createdAt: { gt: cooldownCutoff },
            },
        });
        if (recent) {
            throw new BadRequestException(
                `Please wait ${OTP_COOLDOWN_SECONDS} seconds before requesting a new OTP.`,
            );
        }

        // Generate OTP and store it
        const code = this.generateCode();
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

        await this.prisma.phoneOtp.create({
            data: { phoneNumber, code, purpose, expiresAt },
        });

        // Safety guard — skip delivery if credentials not set
        if (!LAAFFIC_APP_ID) {
            this.logger.warn(`[SmsService] LAAFFIC_APP_ID not set — OTP for ${phoneNumber}: ${code}`);
            return { message: 'OTP sent to your phone number.' };
        }

        // Determine platform name for SMS body
        let platformName = 'Platform';
        try {
            const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'PLATFORM_NAME' } });
            if (cfg?.value) platformName = cfg.value;
        } catch { /* ignore */ }

        const content = `Your ${platformName} OTP is ${code}. Valid for ${OTP_TTL_MINUTES} minutes. Do not share it with anyone.`;

        const { sign, timestamp, apiKey } = this.buildHeaders();

        try {
            const resp: any = await this.post(
                'https://api.laaffic.com/v3/sendSms',
                {
                    appId: LAAFFIC_APP_ID,
                    numbers: phoneNumber,
                    content,
                    ...(LAAFFIC_SENDER_ID ? { senderId: LAAFFIC_SENDER_ID } : {}),
                },
                { Sign: sign, Timestamp: timestamp, 'Api-Key': apiKey },
            );

            if (resp.status !== '0') {
                this.logger.error(`LAAFFIC error for ${phoneNumber}: status=${resp.status} reason=${resp.reason}`);
                // Still return success so we don't reveal internal errors; OTP is stored.
            } else {
                this.logger.log(`OTP delivered to ${phoneNumber} via LAAFFIC (msgId=${resp.array?.[0]?.msgId})`);
            }
        } catch (err) {
            this.logger.error(`LAAFFIC HTTP error for ${phoneNumber}`, err?.message);
            // OTP is stored — don't propagate; client can still verify if they received it
        }

        return { message: 'OTP sent to your phone number.' };
    }

    // ─── Verify OTP ─────────────────────────────────────────────────────────────
    /**
     * Check that `code` matches the latest valid OTP for `phoneNumber` + `purpose`.
     * Returns `true` on success, throws `BadRequestException` on failure.
     */
    async verifyOtp(phoneNumber: string, code: string, purpose: string): Promise<boolean> {
        const otp = await this.prisma.phoneOtp.findFirst({
            where: {
                phoneNumber,
                purpose,
                used: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!otp) {
            throw new BadRequestException('OTP has expired or does not exist. Please request a new one.');
        }

        if (otp.attempts >= MAX_ATTEMPTS) {
            throw new BadRequestException('Too many failed attempts. Please request a new OTP.');
        }

        if (otp.code !== code) {
            // Increment attempt counter
            await this.prisma.phoneOtp.update({
                where: { id: otp.id },
                data: { attempts: { increment: 1 } },
            });
            const remaining = MAX_ATTEMPTS - otp.attempts - 1;
            throw new BadRequestException(
                remaining > 0
                    ? `Incorrect OTP. ${remaining} attempt(s) remaining.`
                    : 'Too many failed attempts. Please request a new OTP.',
            );
        }

        // Mark as used
        await this.prisma.phoneOtp.update({
            where: { id: otp.id },
            data: { used: true },
        });

        return true;
    }
}
