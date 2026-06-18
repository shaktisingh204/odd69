import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bet, BetSchema } from '../bets/schemas/bet.schema';
import { WageringBackfillService } from './wagering-backfill.service';
import { WageringBackfillController } from './wagering-backfill.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Bet.name, schema: BetSchema },
        ]),
    ],
    providers: [WageringBackfillService],
    controllers: [WageringBackfillController],
    exports: [WageringBackfillService],
})
export class WageringBackfillModule { }
