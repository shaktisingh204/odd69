import { Module, forwardRef } from '@nestjs/common';
import { SportsService } from './sports.service';
import { SportsController } from './sports.controller';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { Sport, SportSchema } from './schemas/sport.schema';
import { Competition, CompetitionSchema } from './schemas/competition.schema';
import { Event, EventSchema } from './schemas/event.schema';
import { Market, MarketSchema } from './schemas/market.schema';
import { MarketOdd, MarketOddSchema } from './schemas/market-odd.schema';
import { Session, SessionSchema } from './schemas/session.schema';
import { Fancy, FancySchema } from './schemas/fancy.schema';
import { Bet, BetSchema } from '../bets/schemas/bet.schema';
import { Order, OrderSchema } from './schemas/order.schema';
import { Trade, TradeSchema } from './schemas/trade.schema';
import { Navigation, NavigationSchema } from './schemas/navigation.schema';
import { TopEvent, TopEventSchema } from './schemas/top-event.schema';
import { HomeEvent, HomeEventSchema } from './schemas/home-event.schema';
import { TeamIcon, TeamIconSchema } from './schemas/team-icon.schema';
// ─── Betfair native schemas (new collections) ────────────────────────────────
import { BetfairSport, BetfairSportSchema } from './schemas/betfair-sport.schema';
import { BetfairEvent, BetfairEventSchema } from './schemas/betfair-event.schema';
import { BetfairMarket, BetfairMarketSchema } from './schemas/betfair-market.schema';
import { BetfairFancy, BetfairFancySchema } from './schemas/betfair-fancy.schema';
import { BetfairBookmaker, BetfairBookmakerSchema } from './schemas/betfair-bookmaker.schema';
import { SportLeague, SportLeagueSchema } from './schemas/sport-league.schema';

import { SportsSocketService } from './sports.socket.service';
import { SportradarService } from './sportradar.service';
import { SportradarPubsubService } from './sportradar-pubsub.service';
import { PrismaService } from '../prisma.service';
import { SportsGateway } from './sports.gateway';

import { UsersModule } from '../users/users.module';
@Module({
    imports: [
        HttpModule,
        ScheduleModule.forRoot(),
        UsersModule,
        MongooseModule.forFeature([
            { name: Sport.name, schema: SportSchema },
            { name: Competition.name, schema: CompetitionSchema },
            { name: Event.name, schema: EventSchema },
            { name: Market.name, schema: MarketSchema },
            { name: MarketOdd.name, schema: MarketOddSchema },
            { name: Session.name, schema: SessionSchema },
            { name: Fancy.name, schema: FancySchema },
            { name: Bet.name, schema: BetSchema },
            { name: Order.name, schema: OrderSchema },
            { name: Trade.name, schema: TradeSchema },
            { name: Navigation.name, schema: NavigationSchema },
            { name: TopEvent.name, schema: TopEventSchema },
            { name: HomeEvent.name, schema: HomeEventSchema },
            { name: TeamIcon.name, schema: TeamIconSchema },
            // ─── Betfair native collections ───────────────────────────────
            { name: BetfairSport.name,      schema: BetfairSportSchema      },
            { name: BetfairEvent.name,      schema: BetfairEventSchema      },
            { name: BetfairMarket.name,     schema: BetfairMarketSchema     },
            { name: BetfairFancy.name,      schema: BetfairFancySchema      },
            { name: BetfairBookmaker.name,  schema: BetfairBookmakerSchema  },
            { name: SportLeague.name,       schema: SportLeagueSchema       },
        ])
    ],
    controllers: [SportsController],
    providers: [SportsService, SportsSocketService, PrismaService, SportradarService, SportradarPubsubService, SportsGateway],
    exports: [SportsService, SportsSocketService, SportradarService, SportsGateway]
})
export class SportsModule { }
