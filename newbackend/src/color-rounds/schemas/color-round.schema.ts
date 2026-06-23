import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ColorRoundDocument = ColorRound & Document;
export type ColorRoom = '30s' | '1m' | '3m' | '5m';
export type ColorRoundStatus = 'BETTING' | 'LOCKED' | 'SETTLED';

/**
 * One shared timed round for a single Wingo-style room.
 *
 * Provably fair (commit-reveal, per ROUND — the result is shared by every
 * player in the room): when the round OPENS we generate a fresh `serverSeed`
 * and publish only its `serverSeedHash`. At lock+0 we draw the digit with
 * HMAC-SHA256(serverSeed, period) → rollInt(10) and SETTLE. The raw
 * `serverSeed` is revealed in the `color:result` broadcast afterwards.
 */
@Schema({ collection: 'color_rounds', timestamps: true })
export class ColorRound {
  @Prop({ required: true, index: true }) room: ColorRoom;
  @Prop({ required: true }) period: number;        // sequential, date-stamped period id

  @Prop({ required: true }) serverSeed: string;      // hidden until SETTLED, then revealed
  @Prop({ required: true }) serverSeedHash: string;  // committed when the round opens
  @Prop({ default: -1 }) result: number;             // winning digit 0–9 (-1 until drawn)
  @Prop({ type: [String], default: [] }) resultColors: string[]; // e.g. ['red','violet']
  @Prop({ default: '' }) size: string;               // 'Big' | 'Small' | ''

  @Prop({ default: 'BETTING' }) status: ColorRoundStatus;

  @Prop() openedAt: Date;
  @Prop() lockedAt: Date;
  @Prop() settledAt: Date;

  @Prop({ default: 0 }) totalWagered: number;
  @Prop({ default: 0 }) totalPaidOut: number;
}

export const ColorRoundSchema = SchemaFactory.createForClass(ColorRound);
ColorRoundSchema.index({ room: 1, period: -1 }, { unique: true });
ColorRoundSchema.index({ room: 1, status: 1 });
