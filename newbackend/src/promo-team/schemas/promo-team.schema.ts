import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PromoTeamDocument = PromoTeam & Document;

@Schema({ timestamps: true })
export class PromoTeam {
    // ── Event Selection ───────────────────────────────────────────────────────

    @Prop({ required: true, index: true })
    eventId: string; // gmid from Diamond API (e.g. "12345")

    @Prop()
    eventName: string; // Human-readable label (e.g. "India vs Australia")

    @Prop()
    matchDate: Date; // Match start time (for display on card)

    @Prop()
    sportId: string; // sport_id from Diamond API (e.g. "4" for cricket)

    @Prop({ type: [String], default: [] })
    teams: string[]; // Both team names e.g. ["India", "Australia"]

    // ── Promo Match Refund ────────────────────────────────────────────────────

    /** Optional display label — no longer used for bet matching (match-based now) */
    @Prop({ required: false })
    teamName: string; // e.g. "India vs Australia" — kept for legacy display only

    @Prop({ required: true, min: 0, max: 100 })
    refundPercentage: number;

    @Prop({ default: 'fiat', enum: ['fiat', 'crypto'] })
    walletTarget: string;

    // ── Promo Card Display (shown on website promotions page) ─────────────────

    @Prop()
    cardTitle: string; // e.g. "Back India — Get 10% Back!"

    @Prop()
    cardDescription: string;

    @Prop({ default: 'linear-gradient(135deg, rgba(16,185,129,0.7), rgba(6,78,59,0.3))' })
    cardGradient: string;

    @Prop()
    cardBgImage: string; // Cloudflare Images URL

    @Prop()
    cardBadge: string; // e.g. "SPORTS PROMO"

    @Prop({ default: true })
    showOnPromotionsPage: boolean;

    // ── State ─────────────────────────────────────────────────────────────────

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: false })
    refundIssued: boolean;

    @Prop()
    refundIssuedAt: Date;

    @Prop({ default: 0 })
    refundedBetCount: number;

    @Prop({ default: 0 })
    totalRefundedAmount: number;

    @Prop({ default: 0 })
    order: number;
}

export const PromoTeamSchema = SchemaFactory.createForClass(PromoTeam);
PromoTeamSchema.index({ eventId: 1, isActive: 1 });
PromoTeamSchema.index({ showOnPromotionsPage: 1, isActive: 1 });
