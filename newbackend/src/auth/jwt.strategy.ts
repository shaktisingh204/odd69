import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private prisma: PrismaService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET'),
        });
    }

    async validate(payload: any) {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                username: true,
                role: true,
                isBanned: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException('Account no longer exists.');
        }

        if (user.isBanned) {
            throw new UnauthorizedException('Your account has been suspended. Please contact support.');
        }

        return {
            id: user.id,
            userId: user.id,
            username: user.username,
            role: user.role,
            isBanned: user.isBanned,
        };
    }
}
