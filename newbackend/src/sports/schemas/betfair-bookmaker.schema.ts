import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// ─── Bookmaker runner sub-document ───────────────────────────────────────────
export class BetfairBookmakerRunner {
    selectionId: string;   // "2954263"
    runnerName:  string;   // "Chennai Super Kings"
    back:        number;   // back price (e.g. 221 = 2.21 in centiprice)
    lay:         number;   // lay price  (e.g. 239 = 2.39 in centiprice)
    status:      string;   // BALL_RUNNING | ACTIVE | SUSPENDED
}

export type BetfairBookmakerDocument = BetfairBookmaker & Document;

@Schema({ collection: 'betfair_bookmakers', timestamps: true })
export class BetfairBookmaker {
    // ── Identifiers ──────────────────────────────────────────────────────────
    @Prop({ required: true, unique: true, index: true })
    marketId: string;       // "126033119210001"

    @Prop({ required: true, index: true })
    eventId: string;        // "35436411"

    @Prop({ default: '' })
    sportId: string;        // "4"

    // ── Market details ───────────────────────────────────────────────────────
    @Prop({ required: true })
    marketName: string;     // "BOOKMAKER" | "MINI BOOKMAKER"

    @Prop({ default: 'ACTIVE' })
    status: string;         // ACTIVE | SUSPENDED | CLOSED

    @Prop({ default: 100 })
    minStake: number;

    @Prop({ default: 10000 })
    maxStake: number;

    // ── Runners (selections) ─────────────────────────────────────────────────
    @Prop({
        type: [
            {
                selectionId: { type: String },
                runnerName:  { type: String },
                back:        { type: Number, default: 0 },
                lay:         { type: Number, default: 0 },
                status:      { type: String, default: 'ACTIVE' },
            },
        ],
        default: [],
    })
    runners: BetfairBookmakerRunner[];

    @Prop({ default: true })
    isVisible: boolean;

    @Prop({ default: null })
    oddsUpdatedAt: Date | null;
}

export const BetfairBookmakerSchema = SchemaFactory.createForClass(BetfairBookmaker);
BetfairBookmakerSchema.index({ marketId: 1 }, { unique: true });
BetfairBookmakerSchema.index({ eventId: 1, status: 1 });
