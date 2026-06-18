import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Payment3Controller } from './payment3.controller';
import { Payment3Service } from './payment3.service';
import { BonusModule } from '../bonus/bonus.module';
import { UsersModule } from '../users/users.module';
import { ReferralModule } from '../referral/referral.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [ConfigModule, BonusModule, forwardRef(() => UsersModule), ReferralModule, EmailModule],
    controllers: [Payment3Controller],
    providers: [Payment3Service],
    exports: [Payment3Service],
})
export class Payment3Module { }
