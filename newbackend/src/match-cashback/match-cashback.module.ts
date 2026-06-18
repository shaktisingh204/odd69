import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bet, BetSchema } from '../bets/schemas/bet.schema';
import { Event, EventSchema } from '../sports/schemas/event.schema';
import { AdminMatchCashbackPromotionsController } from './controllers/admin-match-cashback-promotions.controller';
import { MatchSettlementController } from './controllers/match-settlement.controller';
import { PublicMatchCashbackPromotionsController } from './controllers/public-match-cashback-promotions.controller';
import { MatchCashbackPromotionRepository } from './repositories/match-cashback-promotion.repository';
import { MatchCashbackRefundRepository } from './repositories/match-cashback-refund.repository';
import { BetRepository } from './repositories/bet.repository';
import { MatchRepository } from './repositories/match.repository';
import { MatchCashbackTransactionRepository } from './repositories/transaction.repository';
import { WalletRepository } from './repositories/wallet.repository';
import { MatchCashbackPromotion, MatchCashbackPromotionSchema } from './schemas/match-cashback-promotion.schema';
import { MatchCashbackRefund, MatchCashbackRefundSchema } from './schemas/match-cashback-refund.schema';
import { Match, MatchSchema } from './schemas/match.schema';
import { MatchCashbackPromotionsService } from './services/match-cashback-promotions.service';
import { MatchCashbackRefundService } from './services/match-cashback-refund.service';
import { MatchSettlementService } from './services/match-settlement.service';
import { WalletCreditService } from './services/wallet-credit.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Match.name, schema: MatchSchema },
            { name: MatchCashbackPromotion.name, schema: MatchCashbackPromotionSchema },
            { name: MatchCashbackRefund.name, schema: MatchCashbackRefundSchema },
            { name: Bet.name, schema: BetSchema },
            { name: Event.name, schema: EventSchema },
        ]),
    ],
    controllers: [
        AdminMatchCashbackPromotionsController,
        MatchSettlementController,
        PublicMatchCashbackPromotionsController,
    ],
    providers: [
        MatchRepository,
        MatchCashbackPromotionRepository,
        MatchCashbackRefundRepository,
        BetRepository,
        WalletRepository,
        MatchCashbackTransactionRepository,
        WalletCreditService,
        MatchCashbackPromotionsService,
        MatchCashbackRefundService,
        MatchSettlementService,
    ],
    exports: [MatchCashbackRefundService, MatchSettlementService],
})
export class MatchCashbackModule { }
