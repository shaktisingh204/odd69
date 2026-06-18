import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BetsService } from './bets.service';
import { BetsController } from './bets.controller';
import { DiamondPostQueueService } from './diamond-post-queue.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Bet, BetSchema } from './schemas/bet.schema';
import { BookedBet, BookedBetSchema } from './schemas/booked-bet.schema';
import { Event, EventSchema } from '../sports/schemas/event.schema';
import { ReferralModule } from '../referral/referral.module';
import { SportsModule } from '../sports/sports.module';
import { Market, MarketSchema } from '../sports/schemas/market.schema';
import { BonusModule } from '../bonus/bonus.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    HttpModule,
    ReferralModule,
    SportsModule,
    forwardRef(() => BonusModule),
    forwardRef(() => UsersModule),
    MongooseModule.forFeature([
      { name: Bet.name, schema: BetSchema },
      { name: BookedBet.name, schema: BookedBetSchema },
      { name: Market.name, schema: MarketSchema },
      { name: Event.name, schema: EventSchema },
    ])
  ],
  providers: [BetsService, DiamondPostQueueService],
  controllers: [BetsController]
})
export class BetsModule { }
