import { Module, forwardRef } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { ReferralModule } from '../referral/referral.module';
import { BonusModule } from '../bonus/bonus.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [ReferralModule, forwardRef(() => BonusModule), EmailModule],
    controllers: [TransactionsController],
    providers: [TransactionsService],
    exports: [TransactionsService],
})
export class TransactionsModule { }
