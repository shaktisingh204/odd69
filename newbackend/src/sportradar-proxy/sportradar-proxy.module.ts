import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SportradarProxyController } from './sportradar-proxy.controller';
import {
  BetfairSport,
  BetfairSportSchema,
} from '../sports/schemas/betfair-sport.schema';
import {
  BetfairEvent,
  BetfairEventSchema,
} from '../sports/schemas/betfair-event.schema';
import {
  BetfairMarket,
  BetfairMarketSchema,
} from '../sports/schemas/betfair-market.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BetfairSport.name, schema: BetfairSportSchema },
      { name: BetfairEvent.name, schema: BetfairEventSchema },
      { name: BetfairMarket.name, schema: BetfairMarketSchema },
    ]),
  ],
  controllers: [SportradarProxyController],
})
export class SportradarProxyModule {}
