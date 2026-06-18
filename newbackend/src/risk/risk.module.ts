import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { Bet, BetSchema } from '../bets/schemas/bet.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Bet.name, schema: BetSchema }])
    ],
    controllers: [RiskController],
    providers: [RiskService]
})
export class RiskModule { }
