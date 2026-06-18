import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BetfairFancyDocument = BetfairFancy & Document;

@Schema({ collection: 'betfair_fancy', timestamps: true })
export class BetfairFancy {
    // ── Identifiers ──────────────────────────────────────────────────────────
    @Prop({ required: true, unique: true, index: true })
    id: string;             // "226040115530081"

    @Prop({ required: true, index: true })
    eventId: string;        // "35436411"

    @Prop({ default: '' })
    sportId: string;        // "4"

    // ── Fancy details ────────────────────────────────────────────────────────
    @Prop({ required: true })
    name: string;           // "Only 13 Over Runs PBKS"

    @Prop({ default: 'ACTIVE' })
    status: string;         // BALL_RUNNING | ACTIVE | SUSPENDED | CLOSED

    @Prop({ default: 'SESSION' })
    type: string;           // SESSION | OTHERS | W/P MARKET

    @Prop({ default: 0 })
    subid: number;          // sub-market identifier

    // ── YES side ───────────────────────────────────────────────────────────
    @Prop({
        type: {
            runodd: { type: Number, default: 0 },
            betodd: { type: Number, default: 100 },
        },
        default: () => ({ runodd: 0, betodd: 100 }),
    })
    yes: { runodd: number; betodd: number };

    // ── NO side ────────────────────────────────────────────────────────────
    @Prop({
        type: {
            runodd: { type: Number, default: 0 },
            betodd: { type: Number, default: 100 },
        },
        default: () => ({ runodd: 0, betodd: 100 }),
    })
    no: { runodd: number; betodd: number };

    // ── Stake limits ─────────────────────────────────────────────────────────
    @Prop({ default: 100 })
    minstake: number;

    @Prop({ default: 10000 })
    maxstake: number;

    @Prop({ default: true })
    isVisible: boolean;
}

export const BetfairFancySchema = SchemaFactory.createForClass(BetfairFancy);
BetfairFancySchema.index({ id: 1 }, { unique: true });
BetfairFancySchema.index({ eventId: 1, status: 1 });
BetfairFancySchema.index({ eventId: 1, type: 1 });
