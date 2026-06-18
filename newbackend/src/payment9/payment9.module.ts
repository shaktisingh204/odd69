import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Payment9Controller } from './payment9.controller';
import { Payment9Service } from './payment9.service';
import { BonusModule } from '../bonus/bonus.module';
import { UsersModule } from '../users/users.module';
import { ReferralModule } from '../referral/referral.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [
        ConfigModule,
        BonusModule,
        forwardRef(() => UsersModule),
        ReferralModule,
        EmailModule,
    ],
    controllers: [Payment9Controller],
    providers: [Payment9Service],
    exports: [Payment9Service],
})
export class Payment9Module {}
