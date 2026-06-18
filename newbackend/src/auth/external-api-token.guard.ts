import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';

/**
 * ExternalApiTokenGuard
 * ---------------------
 * Protects external-facing sports data endpoints.
 * Reads the static `x-api-token` header and compares it
 * against the EXTERNAL_API_TOKEN environment variable.
 *
 * Usage:
 *   @UseGuards(ExternalApiTokenGuard)
 *   on any controller or route that should be accessible
 *   to external/partner websites only.
 */
@Injectable()
export class ExternalApiTokenGuard implements CanActivate {
    private readonly logger = new Logger(ExternalApiTokenGuard.name);

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();

        // Accept token from header (primary), turnkey alias, or query string
        const token: string =
            (request.headers['x-api-token'] as string) ||
            (request.headers['x-turnkeyxgaming-key'] as string) ||
            (request.query?.api_token as string) ||
            '';

        const validToken = process.env.EXTERNAL_API_TOKEN;

        if (!validToken) {
            this.logger.error('EXTERNAL_API_TOKEN is not set in environment variables');
            throw new UnauthorizedException('External API is not configured');
        }

        if (!token || token !== validToken) {
            this.logger.warn(`External API: invalid token attempt from ${request.ip}`);
            throw new UnauthorizedException('Invalid or missing API token');
        }

        return true;
    }
}
