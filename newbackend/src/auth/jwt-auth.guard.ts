import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        // Skip JWT validation when x-admin-token is present —
        // SecurityTokenGuard will handle authentication for admin endpoints.
        const request = context.switchToHttp().getRequest();
        if (request.headers?.['x-admin-token']) {
            return true;
        }

        // Run the standard JWT validation first
        const canActivate = await (super.canActivate(context) as Promise<boolean>);
        if (!canActivate) return false;

        if (request.user?.isBanned) {
            throw new UnauthorizedException('Your account has been suspended. Please contact support.');
        }

        return true;
    }
}
