import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import {
  OriginalsFairSeed,
  OriginalsFairSeedDocument,
} from './schemas/originals-fair-seed.schema';

export interface ConsumedSeed {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface FairState {
  serverSeedHash: string;
  nextServerSeedHash: string;
  clientSeed: string;
  nonce: number;
  previousServerSeed?: string;
  previousServerSeedHash?: string;
  previousClientSeed?: string;
  previousNonce?: number;
}

export interface RotateResult {
  revealedServerSeed: string;
  revealedServerSeedHash: string;
  previousClientSeed: string;
  previousNonce: number;
  serverSeedHash: string;
  nextServerSeedHash: string;
  clientSeed: string;
  nonce: number;
}

/**
 * Persistent provably-fair seed-pair lifecycle (one document per user).
 *
 * Game services call `consume(userId)` to obtain the active (serverSeed,
 * serverSeedHash, clientSeed, nonce) for a bet — the nonce is incremented
 * atomically so concurrent bets cannot collide. The raw serverSeed is the
 * committed secret and is only disclosed via `rotate()`.
 */
@Injectable()
export class FairnessService {
  constructor(
    @InjectModel(OriginalsFairSeed.name)
    private readonly model: Model<OriginalsFairSeedDocument>,
  ) {}

  private gen(): { seed: string; hash: string } {
    const seed = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    return { seed, hash };
  }

  /**
   * Return the user's seed document, creating it on first use. Uses an
   * upsert keyed on userId so two concurrent first-bets cannot create two docs.
   */
  private async getOrCreate(
    userId: number,
  ): Promise<OriginalsFairSeedDocument> {
    const existing = await this.model.findOne({ userId });
    if (existing) return existing;

    const active = this.gen();
    const next = this.gen();
    const clientSeed = crypto.randomBytes(8).toString('hex');

    // upsert with $setOnInsert: if a concurrent request already inserted, this
    // is a no-op and we return the existing (already-seeded) document.
    await this.model.updateOne(
      { userId },
      {
        $setOnInsert: {
          userId,
          clientSeed,
          activeServerSeed: active.seed,
          activeServerSeedHash: active.hash,
          nextServerSeed: next.seed,
          nextServerSeedHash: next.hash,
          nonce: 0,
        },
      },
      { upsert: true },
    );

    const doc = await this.model.findOne({ userId });
    if (!doc) throw new BadRequestException('Failed to initialize fair seed');
    return doc;
  }

  /**
   * Atomically consume one nonce for a bet. Returns the ACTIVE server seed (the
   * committed secret — callers must NOT echo it back to the player), its public
   * hash, the client seed, and the post-increment nonce (first bet => 1).
   */
  async consume(userId: number): Promise<ConsumedSeed> {
    await this.getOrCreate(userId);
    const doc = await this.model.findOneAndUpdate(
      { userId },
      { $inc: { nonce: 1 } },
      { new: true },
    );
    if (!doc) throw new BadRequestException('Fair seed not found');
    return {
      serverSeed: doc.activeServerSeed,
      serverSeedHash: doc.activeServerSeedHash,
      clientSeed: doc.clientSeed,
      nonce: doc.nonce,
    };
  }

  /** Public, player-facing fairness state. Never exposes the active/next raw seed. */
  async getState(userId: number): Promise<FairState> {
    const doc = await this.getOrCreate(userId);
    return {
      serverSeedHash: doc.activeServerSeedHash,
      nextServerSeedHash: doc.nextServerSeedHash,
      clientSeed: doc.clientSeed,
      nonce: doc.nonce,
      previousServerSeed: doc.previousServerSeed,
      previousServerSeedHash: doc.previousServerSeedHash,
      previousClientSeed: doc.previousClientSeed,
      previousNonce: doc.previousNonce,
    };
  }

  /**
   * Rotate the seed pair: reveal the (retired) active server seed, promote the
   * next pair to active, generate a fresh next pair, reset the nonce. Optionally
   * set a new client seed at the same time.
   */
  async rotate(userId: number, newClientSeed?: string): Promise<RotateResult> {
    const doc = await this.getOrCreate(userId);

    const revealedServerSeed = doc.activeServerSeed;
    const revealedServerSeedHash = doc.activeServerSeedHash;
    const previousClientSeed = doc.clientSeed;
    const previousNonce = doc.nonce;

    const fresh = this.gen();
    let clientSeed = doc.clientSeed;
    if (typeof newClientSeed === 'string') {
      const cs = newClientSeed.trim();
      if (!cs || cs.length > 256) {
        throw new BadRequestException('Client seed must be 1–256 characters');
      }
      clientSeed = cs;
    }

    doc.previousServerSeed = revealedServerSeed;
    doc.previousServerSeedHash = revealedServerSeedHash;
    doc.previousClientSeed = previousClientSeed;
    doc.previousNonce = previousNonce;
    doc.activeServerSeed = doc.nextServerSeed;
    doc.activeServerSeedHash = doc.nextServerSeedHash;
    doc.nextServerSeed = fresh.seed;
    doc.nextServerSeedHash = fresh.hash;
    doc.clientSeed = clientSeed;
    doc.nonce = 0;
    await doc.save();

    return {
      revealedServerSeed,
      revealedServerSeedHash,
      previousClientSeed,
      previousNonce,
      serverSeedHash: doc.activeServerSeedHash,
      nextServerSeedHash: doc.nextServerSeedHash,
      clientSeed: doc.clientSeed,
      nonce: 0,
    };
  }

  /** Change the client seed without rotating the server seed. */
  async setClientSeed(userId: number, clientSeed: string): Promise<FairState> {
    const cs = (clientSeed ?? '').trim();
    if (!cs || cs.length > 256) {
      throw new BadRequestException('Client seed must be 1–256 characters');
    }
    await this.getOrCreate(userId);
    await this.model.updateOne({ userId }, { $set: { clientSeed: cs } });
    return this.getState(userId);
  }
}
