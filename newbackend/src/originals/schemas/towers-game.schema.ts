import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TowersGameDocument = TowersGame & Document;

/**
 * Towers (a.k.a. Stairs / Lava). The board is fixed at 8 floors.
 * `difficulty` controls how many tiles per floor and how many are safe:
 *   easy   → 4 tiles, 3 safe (1 trap)
 *   medium → 3 tiles, 2 safe (1 trap)
 *   hard   → 3 tiles, 1 safe (2 traps)
 *   expert → 2 tiles, 1 safe (1 trap)
 *
 * `floorTraps[i]` is the trap-tile index for floor i (precomputed at start
 * via provably-fair shuffle so the player's picks are deterministic).
 */
@Schema({ collection: 'towers_games', timestamps: true })
export class TowersGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ required: true }) difficulty: string;
  @Prop({ required: true }) tilesPerFloor: number;
  @Prop({ required: true }) safePerFloor: number;
  @Prop({ default: 8 }) totalFloors: number;
  @Prop({ type: [[Number]], required: true }) floorTraps: number[][]; // trap tile indices per floor
  @Prop({ type: [Number], default: [] }) picks: number[]; // player's picks per floor
  @Prop({ default: 0 }) currentFloor: number;
  @Prop({ default: 1 }) multiplier: number;
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

export const TowersGameSchema = SchemaFactory.createForClass(TowersGame);
TowersGameSchema.index({ userId: 1, status: 1 });
TowersGameSchema.index({ userId: 1, createdAt: -1 });
