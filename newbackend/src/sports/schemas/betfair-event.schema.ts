import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BetfairEventDocument = BetfairEvent & Document;

@Schema({ collection: 'betfair_events', timestamps: true })
export class BetfairEvent {
    // ── Betfair identifiers ──────────────────────────────────────────────────
    @Prop({ required: true, unique: true, index: true })
    eventId: string; // String(eventid) e.g. "35436411"

    @Prop({ required: true, index: true })
    sportId: string; // "4" = Cricket

    // ── Competition ──────────────────────────────────────────────────────────
    @Prop({ required: true, index: true })
    competitionId: string; // "101480"

    @Prop({ required: true })
    competitionName: string; // "Indian Premier League"

    @Prop({ default: '' })
    countryCode: string; // "GB", "IN", ""

    // ── Event / Match details ────────────────────────────────────────────────
    @Prop({ required: true })
    eventName: string; // "Chennai Super Kings v Punjab Kings"

    @Prop({ default: '' })
    homeTeam: string; // "Chennai Super Kings"

    @Prop({ default: '' })
    awayTeam: string; // "Punjab Kings"

    @Prop({ default: '' })
    marketStartTime: string; // ISO string "2026-04-03T14:00:00Z"

    // ── Status ───────────────────────────────────────────────────────────────
    @Prop({ default: false, index: true })
    inplay: boolean;

    @Prop({ default: 'OPEN' }) // OPEN | CLOSED | COMPLETED
    status: string;

    @Prop({ default: true, index: true })
    isVisible: boolean;

    // Admin-pinned events are sorted to the top on the player site
    @Prop({ default: false, index: true })
    isPinned: boolean;

    // ── Card background images (set by admin, shown on match cards) ────────
    @Prop({ default: '' })
    thumbnail: string;

    /** Background image for team 1 (home) side of the "/" split card */
    @Prop({ default: '' })
    team1Image: string;

    /** Background image for team 2 (away) side of the "/" split card */
    @Prop({ default: '' })
    team2Image: string;

    // ── Canonical market reference (MATCH_ODDS market for this event) ────────
    @Prop({ default: '' })
    primaryMarketId: string; // "1.256095371"

    @Prop({ default: 'MATCH_ODDS' })
    primaryMarketType: string;
}

export const BetfairEventSchema = SchemaFactory.createForClass(BetfairEvent);
BetfairEventSchema.index({ eventId: 1 }, { unique: true });
BetfairEventSchema.index({ sportId: 1, inplay: 1, isVisible: 1 });
BetfairEventSchema.index({ competitionId: 1 });
BetfairEventSchema.index({ marketStartTime: 1 });
