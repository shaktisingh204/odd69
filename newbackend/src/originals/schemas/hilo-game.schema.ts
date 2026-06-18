import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HiloGameDocument = HiloGame & Document;

/**
 * Each card is encoded as 0..51:
 *   rank = (card % 13) + 1   (1=Ace, 11=J, 12=Q, 13=K)
 *   suit = Math.floor(card / 13)  (0♣ 1♦ 2♥ 3♠)
 *
 * The provably-fair next-card is derived from
 * HMAC(serverSeed:clientSeed:nonce:step) → uniform [0,52).
 */
@Schema({ collection: 'hilo_games', timestamps: true })
export class HiloGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ required: true }) currentCard: number;
  @Prop({ default: 1 }) multiplier: number;
  @Prop({ default: 0 }) step: number;
  @Prop({ type: [Number], default: [] }) history: number[]; // cards drawn so far
  @Prop({ type: [String], default: [] }) actions: string[]; // 'higher' | 'lower' | 'skip'
  @Prop({ default: 'ACTIVE' }) status: string; // ACTIVE | CASHEDOUT | LOST
  @Prop({ default: 0 }) payout: number;
  @Prop({ required: true }) serverSeed: string;
  @Prop() clientSeed: string;
  @Prop({ required: true }) serverSeedHash: string;
  @Prop({ default: 'fiat' }) walletType: string;
  @Prop({ default: false }) usedBonus: boolean;
  @Prop({ default: 0 }) bonusAmount: number;
  @Prop({ default: 'INR' }) currency: string;
}

export const HiloGameSchema = SchemaFactory.createForClass(HiloGame);
HiloGameSchema.index({ userId: 1, status: 1 });
HiloGameSchema.index({ userId: 1, createdAt: -1 });
