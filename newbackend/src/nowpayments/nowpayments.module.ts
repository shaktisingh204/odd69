import { Module } from '@nestjs/common';
import { NowpaymentsService } from './nowpayments.service';
import { NowpaymentsController } from './nowpayments.controller';
import { ReferralModule } from '../referral/referral.module';
import { BonusModule } from '../bonus/bonus.module';

@Module({
    imports: [ReferralModule, BonusModule],
    controllers: [NowpaymentsController],
    providers: [NowpaymentsService],
    exports: [NowpaymentsService],
})
export class NowpaymentsModule { }
