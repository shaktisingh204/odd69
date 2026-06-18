import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyPromocodeDocument = FantasyPromocode & Document;

@Schema({ timestamps: true, collection: 'fantasy_promocodes' })
export class FantasyPromocode {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  code: string;

  @Prop({ default: '' })
  description: string;

  /** percent (0-100) OR flat amount — set exactly one */
  @Prop({ default: 0 })
  discountPercent: number;

  @Prop({ default: 0 })
  flatOff: number;

  /** Cap the percent discount in absolute terms */
  @Prop({ default: 0 })
  maxDiscount: number;

  @Prop({ default: 0 })
  minEntryFee: number;

  @Prop({ default: 0 })
  maxUsesTotal: number;  // 0 = unlimited

  @Prop({ default: 1 })
  maxUsesPerUser: number;

  @Prop({ default: 0 })
  usesSoFar: number;

  /** Restrict scope */
  @Prop({ type: [Number], default: [] })
  allowedMatches: number[];  // externalMatchId list (empty = all)

  @Prop({ type: [String], default: [] })
  allowedContestTypes: string[]; // empty = all

  @Prop({ type: [Number], default: [] })
  userSegment: number[];  // specific user ids; empty = all users

  @Prop({ type: Date })
  validFrom: Date;

  @Prop({ type: Date })
  validTo: Date;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: false })
  firstTimeUserOnly: boolean;
}

export const FantasyPromocodeSchema = SchemaFactory.createForClass(FantasyPromocode);

// --- Per-user usage tracking ---
export type FantasyPromoUsageDocument = FantasyPromoUsage & Document;

@Schema({ timestamps: true, collection: 'fantasy_promo_usage' })
export class FantasyPromoUsage {
  @Prop({ required: true, index: true })
  userId: number;

  @Prop({ required: true, uppercase: true, index: true })
  code: string;

  @Prop({ default: 0 })
  count: number;

  @Prop()
  lastUsedAt: Date;
}

export const FantasyPromoUsageSchema = SchemaFactory.createForClass(FantasyPromoUsage);
FantasyPromoUsageSchema.index({ userId: 1, code: 1 }, { unique: true });
