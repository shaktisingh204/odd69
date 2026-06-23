import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OriginalsFairSeedDocument = OriginalsFairSeed & Document;

/**
 * Persistent provably-fair seed pair for one user (Stake-style lifecycle).
 *
 * The ACTIVE server seed is the committed secret: only its hash is ever shown
 * to the player. The NEXT server seed's hash is shown too so the player can
 * verify continuity across a rotation. The raw active/next server seeds are
 * NEVER returned by the API until the pair is rotated, at which point the
 * (now-retired) seed is revealed as `previousServerSeed` for verification.
 *
 * `nonce` is a per-user counter that increments atomically on every bet, so two
 * concurrent bets can never share a nonce (and therefore never share an outcome).
 */
@Schema({ collection: 'originals_fair_seeds', timestamps: true })
export class OriginalsFairSeed {
  @Prop({ required: true, unique: true, index: true }) userId: number;

  @Prop({ required: true }) clientSeed: string;

  @Prop({ required: true }) activeServerSeed: string;
  @Prop({ required: true }) activeServerSeedHash: string;

  @Prop({ required: true }) nextServerSeed: string;
  @Prop({ required: true }) nextServerSeedHash: string;

  @Prop({ default: 0 }) nonce: number;

  // Revealed details of the most-recently-rotated (retired) pair.
  @Prop() previousServerSeed?: string;
  @Prop() previousServerSeedHash?: string;
  @Prop() previousClientSeed?: string;
  @Prop({ default: 0 }) previousNonce?: number;
}

export const OriginalsFairSeedSchema =
  SchemaFactory.createForClass(OriginalsFairSeed);
OriginalsFairSeedSchema.index({ userId: 1 }, { unique: true });
