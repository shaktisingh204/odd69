import { Module } from '@nestjs/common';
import { Payment0Controller } from './payment0.controller';
import { Payment0Service } from './payment0.service';
import { ConfigModule } from '@nestjs/config';
import { BonusModule } from '../bonus/bonus.module';
import { UsersModule } from '../users/users.module';
import { ReferralModule } from '../referral/referral.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [ConfigModule, BonusModule, UsersModule, ReferralModule, EmailModule],
    controllers: [Payment0Controller],
    providers: [Payment0Service],
    exports: [Payment0Service],
})
export class Payment0Module { }
