import { Module } from '@nestjs/common';
import { Payment1Controller } from './payment1.controller';
import { Payment1Service } from './payment1.service';
import { PrismaModule } from '../prisma.module';
import { BonusModule } from '../bonus/bonus.module';
import { UsersModule } from '../users/users.module';
import { ReferralModule } from '../referral/referral.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [PrismaModule, BonusModule, UsersModule, ReferralModule, EmailModule],
    controllers: [Payment1Controller],
    providers: [Payment1Service],
    exports: [Payment1Service],
})
export class Payment1Module { }
