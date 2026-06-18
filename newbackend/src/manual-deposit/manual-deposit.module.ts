import { Module } from '@nestjs/common';
import { ManualDepositController } from './manual-deposit.controller';

@Module({
    controllers: [ManualDepositController],
    providers: [],
})
export class ManualDepositModule {}
