import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class SecurityTokenGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const token = request.headers['x-admin-token'];
        const validToken = process.env.ADMIN_API_TOKEN;

        if (!validToken) {
            console.warn('ADMIN_API_TOKEN is not set in environment variables');
            return false;
        }

        if (typeof token !== 'string' || token.length !== validToken.length) {
            throw new UnauthorizedException('Invalid security token');
        }

        // Constant-time comparison to prevent timing attacks.
        let equal: boolean;
        try {
            equal = crypto.timingSafeEqual(
                Buffer.from(token, 'utf8'),
                Buffer.from(validToken, 'utf8'),
            );
        } catch {
            equal = false;
        }

        if (!equal) {
            throw new UnauthorizedException('Invalid security token');
        }

        return true;
    }
}
