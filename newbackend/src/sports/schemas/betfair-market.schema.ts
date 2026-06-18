import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// ─── Runner sub-document ──────────────────────────────────────────────────────
export class BetfairPriceSize {
    price: number;
    size:  number;
}

export class BetfairRunnerOdds {
    selectionId:      number;
    runnerName:       string;
    handicap:         number;
    status:           string;   // ACTIVE | SUSPENDED | WINNER | LOSER | REMOVED
    lastPriceTraded:  number;
    totalMatched:     number;

    // Exchange best prices (top 3 each side)
    availableToBack:  BetfairPriceSize[];
    availableToLay:   BetfairPriceSize[];
}

export type BetfairMarketDocument = BetfairMarket & Document;

@Schema({ collection: 'betfair_markets', timestamps: true })
export class BetfairMarket {
    // ── Betfair identifiers ──────────────────────────────────────────────────
    @Prop({ required: true, unique: true, index: true })
    marketId: string;         // "1.256095371"

    @Prop({ required: true, index: true })
    eventId: string;          // "35436411"

    @Prop({ required: true, index: true })
    sportId: string;          // "4"

    @Prop({ required: true, index: true })
    competitionId: string;    // "101480"

    // ── Market metadata (from events API) ───────────────────────────────────
    @Prop({ required: true })
    marketName: string;       // "Chennai Super Kings v Punjab Kings"

    @Prop({ required: true })
    marketType: string;       // "MATCH_ODDS"

    @Prop({ default: 'ODDS' })
    bettingType: string;

    @Prop({ default: '' })
    marketStartTime: string;

    @Prop({ default: false })
    bspMarket: boolean;

    // ── Live odds fields (from getmarketodds API) ────────────────────────────
    @Prop({ default: 'OPEN' })   // OPEN | SUSPENDED | CLOSED
    status: string;

    @Prop({ default: false, index: true })
    inplay: boolean;

    @Prop({ default: false })
    stopBet: boolean;

    @Prop({ default: false })
    isMarketDataDelayed: boolean;

    @Prop({ default: 0 })
    betDelay: number;

    @Prop({ default: false })
    bspReconciled: boolean;

    @Prop({ default: false })
    complete: boolean;

    @Prop({ default: 0 })
    numberOfWinners: number;

    @Prop({ default: 0 })
    numberOfRunners: number;

    @Prop({ default: 0 })
    numberOfActiveRunners: number;

    @Prop({ default: 0 })
    totalMatched: number;

    @Prop({ default: 0 })
    totalAvailable: number;

    @Prop({ default: false })
    crossMatching: boolean;

    @Prop({ default: false })
    runnersVoidable: boolean;

    @Prop({ default: 0 })
    version: number;

    @Prop({ default: null })
    lastMatchTime: string | null;

    // ── Runners with full exchange data ──────────────────────────────────────
    @Prop({
        type: [
            {
                selectionId:     { type: Number },
                runnerName:      { type: String, default: '' },
                handicap:        { type: Number, default: 0 },
                status:          { type: String, default: 'ACTIVE' },
                lastPriceTraded: { type: Number, default: 0 },
                totalMatched:    { type: Number, default: 0 },
                availableToBack: [{ price: Number, size: Number }],
                availableToLay:  [{ price: Number, size: Number }],
            },
        ],
        default: [],
    })
    runners: BetfairRunnerOdds[];

    // ── Misc ──────────────────────────────────────────────────────────────────
    @Prop({ default: true })
    isVisible: boolean;

    @Prop({ default: null })
    oddsUpdatedAt: Date | null;
}

export const BetfairMarketSchema = SchemaFactory.createForClass(BetfairMarket);
BetfairMarketSchema.index({ marketId: 1 }, { unique: true });
BetfairMarketSchema.index({ eventId: 1, status: 1 });
BetfairMarketSchema.index({ sportId: 1, inplay: 1, status: 1 });
BetfairMarketSchema.index({ competitionId: 1 });
