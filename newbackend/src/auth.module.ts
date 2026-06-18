import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './auth/constants';
import { JwtStrategy } from './auth/jwt.strategy';
import { UsersModule } from './users/users.module';
import { ReferralModule } from './referral/referral.module';
import { EmailModule } from './email/email.module';
import { SmsModule } from './sms/sms.module';
import { BruteForceGuard } from './auth/brute-force.guard';
import { RedisModule } from './redis/redis.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UserTrafficEvent, UserTrafficEventSchema } from './auth/schemas/user-traffic-event.schema';

@Module({
    imports: [
        UsersModule,
        ReferralModule,
        EmailModule,
        SmsModule,
        PassportModule,
        RedisModule,
        MongooseModule.forFeature([
            { name: UserTrafficEvent.name, schema: UserTrafficEventSchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: '24h' },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [AuthService, JwtStrategy, BruteForceGuard],
    controllers: [AuthController],
    exports: [AuthService, BruteForceGuard],
})
export class AuthModule { }
