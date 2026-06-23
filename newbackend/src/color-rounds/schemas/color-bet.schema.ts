import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ColorRoom } from './color-round.schema';

export type ColorBetDocument = ColorBet & Document;
export type ColorBetType = 'color' | 'number' | 'bigsmall';
export type ColorBetStatus = 'PENDING' | 'WON' | 'LOST';

/**
 * A single player bet placed into one open color round.
 *  - betType 'color'    → selection one of 'green' | 'red' | 'violet'
 *  - betType 'number'   → selection '0'..'9'
 *  - betType 'bigsmall' → selection 'big' | 'small'
 * Multiple bets per (room, period, user) are allowed and accumulate.
 */
@Schema({ collection: 'color_bets', timestamps: true })
export class ColorBet {
  @Prop({ required: true }) room: ColorRoom;
  @Prop({ required: true }) period: number;
  @Prop({ required: true }) userId: number;

  @Prop({ required: true }) betType: ColorBetType;
  @Prop({ required: true }) selection: string;
  @Prop({ required: true }) amount: number;

  @Prop({ default: 'fiat' }) walletType: string;
  @Prop({ default: false }) usedBonus: boolean;
  @Prop({ default: 0 }) bonusAmount: number;
  @Prop({ default: 'INR' }) currency: string;

  @Prop({ default: 'PENDING' }) status: ColorBetStatus;
  @Prop({ default: 0 }) payout: number;
  @Prop({ default: 0 }) multiplier: number;
}

export const ColorBetSchema = SchemaFactory.createForClass(ColorBet);
ColorBetSchema.index({ room: 1, period: 1 });
ColorBetSchema.index({ userId: 1, createdAt: -1 });
