import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { BonusModule } from '../bonus/bonus.module';
import { UsersModule } from '../users/users.module';
import { ReferralModule } from '../referral/referral.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [BonusModule, forwardRef(() => UsersModule), ReferralModule, EmailModule],
    providers: [PaymentService],
    controllers: [PaymentController],
    exports: [PaymentService],
})
export class PaymentModule { }
