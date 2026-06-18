import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Bet, BetSchema } from '../bets/schemas/bet.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Bet.name, schema: BetSchema }])
    ],
    controllers: [DashboardController],
    providers: [DashboardService]
})
export class DashboardModule { }
