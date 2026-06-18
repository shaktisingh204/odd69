import { Module } from '@nestjs/common';
import { Payment5Controller } from './payment5.controller';
import { Payment5Service } from './payment5.service';
import { PrismaModule } from '../prisma.module';
import { BonusModule } from '../bonus/bonus.module';
import { UsersModule } from '../users/users.module';
import { ReferralModule } from '../referral/referral.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [PrismaModule, BonusModule, UsersModule, ReferralModule, EmailModule],
    controllers: [Payment5Controller],
    providers: [Payment5Service],
    exports: [Payment5Service],
})
export class Payment5Module {}
