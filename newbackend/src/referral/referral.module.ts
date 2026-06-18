import { Module } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ReferralController } from './referral.controller';

@Module({
    controllers: [ReferralController],
    providers: [ReferralService], // Check if  is global
    exports: [ReferralService],
})
export class ReferralModule { }
