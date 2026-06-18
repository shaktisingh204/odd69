import { Module } from '@nestjs/common';
import { Payment6Controller } from './payment6.controller';
import { Payment6Service } from './payment6.service';
import { PrismaModule } from '../prisma.module';
import { BonusModule } from '../bonus/bonus.module';
import { UsersModule } from '../users/users.module';
import { ReferralModule } from '../referral/referral.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [PrismaModule, BonusModule, UsersModule, ReferralModule, EmailModule],
    controllers: [Payment6Controller],
    providers: [Payment6Service],
    exports: [Payment6Service],
})
export class Payment6Module { }
