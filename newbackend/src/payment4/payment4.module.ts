import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Payment4Controller } from './payment4.controller';
import { Payment4Service } from './payment4.service';
import { BonusModule } from '../bonus/bonus.module';
import { UsersModule } from '../users/users.module';
import { ReferralModule } from '../referral/referral.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [ConfigModule, BonusModule, forwardRef(() => UsersModule), ReferralModule, EmailModule],
    controllers: [Payment4Controller],
    providers: [Payment4Service],
    exports: [Payment4Service],
})
export class Payment4Module { }
