import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CoinflipGameDocument = CoinflipGame & Document;

/**
 * Streak / chain coin-flip (Stake "Flip" model).
 *
 * A game is a CHAIN of up to 20 coin flips. After each correct call the running
 * multiplier doubles (0.98 × 2^N: flip1=1.96, flip2=3.92, flip3=7.84 ...), RTP
 * 98%. The player may CASH OUT after any winning flip, or FLIP AGAIN to extend
 * the chain; a single wrong call busts the whole chain.
 *
 * Each flip k is derived from
 *   HMAC(serverSeed:clientSeed:nonce:flip:k) → rollInt(2)  (0=heads, 1=tails)
 * so every flip in the chain is independently and reproducibly verifiable.
 */
@Schema({ collection: 'coinflip_games', timestamps: true })
export class CoinflipGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ type: [String], default: [] }) picks: string[]; // 'heads' | 'tails' per flip
  @Prop({ type: [String], default: [] }) results: string[]; // 'heads' | 'tails' per flip
  @Prop({ default: 0 }) step: number; // number of correct flips locked in
  @Prop({ default: 0 }) multiplier: number; // running multiplier (0 before first win)
  @Prop({ default: 0 }) payout: number;
  @Prop({ default: 'ACTIVE' }) status: string; // ACTIVE | CASHEDOUT | LOST
  @Prop({ required: true }) serverSeed: string;
  @Prop() clientSeed: string;
  @Prop({ required: true }) serverSeedHash: string;
  @Prop({ default: 0 }) nonce: number;
  @Prop({ default: 'fiat' }) walletType: string;
  @Prop({ default: false }) usedBonus: boolean;
  @Prop({ default: 0 }) bonusAmount: number;
  @Prop({ default: 'INR' }) currency: string;
}

export const CoinflipGameSchema = SchemaFactory.createForClass(CoinflipGame);
CoinflipGameSchema.index({ userId: 1, status: 1 });
CoinflipGameSchema.index({ userId: 1, createdAt: -1 });
