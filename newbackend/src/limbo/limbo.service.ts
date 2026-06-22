import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { LimboRound, LimboRoundDocument } from './schemas/limbo-round.schema';
import { LimboBet, LimboBetDocument } from './schemas/limbo-bet.schema';
import { PrismaService } from '../prisma.service';
import { BonusService } from '../bonus/bonus.service';
import { GGRService } from '../originals/ggr.service';
import {
  deductStake,
  settlePayout,
  logStakeTransaction,
  buildAllocations,
} from '../originals/originals-helpers';

const HOUSE_EDGE = 0.01;       // 1%
const BETTING_DURATION_MS = 5000;   // 5s betting window
const TICK_INTERVAL_MS = 100;       // emit multiplier every 100ms

/**
 * Provably fair crash point generation — IDENTICAL to AviatorService.
 * Crash point = 0.99 / (1 - H)  where H ∈ [0,1) is derived from HMAC-SHA256.
 * With 1% house edge → instant crash if H < 0.01.
 */
function generateCrashPoint(serverSeed: string, roundId: number): number {
  const hmac = crypto
    .createHmac('sha256', serverSeed)
    .update(String(roundId))
    .digest('hex');

  const h = parseInt(hmac.slice(0, 8), 16) / 0xffffffff;

  if (h < HOUSE_EDGE) return 1.00;  // instant crash (house wins)
  return parseFloat(((1 - HOUSE_EDGE) / (1 - h)).toFixed(2));
}

@Injectable()
export class LimboService {
  private readonly logger = new Logger(LimboService.name);
  private roundCounter = 1;
  private _onRoundStart: ((round: any) => void) | null = null;
  private _onMultiplierTick: ((roundId: number, multiplier: number) => void) | null = null;
  private _onCrash: ((roundId: number, crashPoint: number, winners: any[]) => void) | null = null;
  private _onBettingPhase: ((round: any) => void) | null = null;

  constructor(
    @InjectModel(LimboRound.name) private readonly roundModel: Model<LimboRoundDocument>,
    @InjectModel(LimboBet.name)   private readonly betModel:   Model<LimboBetDocument>,
    private readonly prisma: PrismaService,
    private readonly bonusService: BonusService,
    private readonly ggrService: GGRService,
  ) {}

  // ── Callbacks (set by gateway) ────────────────────────────────────────────

  onRoundStart(cb: (round: any) => void)    { this._onRoundStart = cb; }
  onMultiplierTick(cb: (roundId: number, multiplier: number) => void) { this._onMultiplierTick = cb; }
  onCrash(cb: (roundId: number, crashPoint: number, winners: any[]) => void) { this._onCrash = cb; }
  onBettingPhase(cb: (round: any) => void)  { this._onBettingPhase = cb; }

  // ── Round lifecycle ───────────────────────────────────────────────────────

  async startLoop() {
    this.logger.log('Limbo round loop started');
    const latest = await this.roundModel.findOne().sort({ roundId: -1 });
    if (latest) this.roundCounter = latest.roundId + 1;
    this.runRound();
  }

  private async runRound() {
    try {
      const roundId = this.roundCounter++;
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
      const crashPoint = generateCrashPoint(serverSeed, roundId);

      // Create round in DB
      const round = await this.roundModel.create({
        roundId, serverSeed, serverSeedHash, crashPoint, status: 'BETTING',
      });

      // Announce betting phase
      const bettingPayload = { roundId, serverSeedHash, status: 'BETTING', endsIn: BETTING_DURATION_MS };
      this._onBettingPhase?.(bettingPayload);
      this.logger.debug(`Round ${roundId} — BETTING (crash @ ${crashPoint}x)`);

      // Wait for betting window
      await this.sleep(BETTING_DURATION_MS);

      // Mark as FLYING
      await this.roundModel.updateOne({ roundId }, { $set: { status: 'FLYING', startedAt: new Date() } });
      this._onRoundStart?.({ roundId, serverSeedHash, status: 'FLYING' });

      // Grow multiplier until crash
      let currentMultiplier = 1.0;
      const startTime = Date.now();

      while (currentMultiplier < crashPoint) {
        await this.sleep(TICK_INTERVAL_MS);
        const elapsed = (Date.now() - startTime) / 1000;  // seconds
        // Exponential growth exactly like Aviator
        currentMultiplier = parseFloat(Math.pow(Math.E, 0.00006 * (Date.now() - startTime)).toFixed(2));
        if (currentMultiplier >= crashPoint) break;

        // Auto-cashout for any bets with target reached
        await this.processAutoCashouts(roundId, currentMultiplier);

        this._onMultiplierTick?.(roundId, currentMultiplier);
      }

      // Crash!
      const crashedAt = new Date();
      await this.roundModel.updateOne(
        { roundId },
        { $set: { status: 'CRASHED', crashedAt, currentMultiplier: crashPoint } },
      );

      // Mark all remaining ACTIVE bets as LOST and log the loss transaction.
      const losingBets = await this.betModel.find({ roundId, status: 'ACTIVE' });
      await this.betModel.updateMany({ roundId, status: 'ACTIVE' }, { $set: { status: 'LOST', payout: 0 } });

      for (const bet of losingBets) {
        // payout = 0 → settlePayout writes a BET_LOSS row (no balance change; stake was already deducted on placeBet)
        // Keep the per-bet .catch() so one user's failure can't abort the LOST sweep.
        await settlePayout(
          this.prisma,
          bet.userId,
          bet.betAmount,
          0,
          bet.walletType,
          Number((bet as any).bonusAmount || 0),
          'LIMBO',
          String((bet as any)._id),
          `Limbo win on round #${roundId}`,
          `Limbo loss on round #${roundId}`,
        ).catch((e) => this.logger.error(`Failed to log loss for user ${bet.userId}: ${e}`));
      }

      // Gather winners for broadcast
      const winners = await this.betModel.find({ roundId, status: 'CASHEDOUT' }).lean();
      this._onCrash?.(roundId, crashPoint, winners);
      this.logger.debug(`Round ${roundId} CRASHED @ ${crashPoint}x`);
    } catch (e) {
      // Any awaited DB error here would otherwise become an unhandled rejection and
      // permanently freeze all future rounds. Log and let `finally` reschedule.
      this.logger.error('Limbo round failed', e as any);
    } finally {
      // Wait 3s between rounds, then self-heal by scheduling the next round.
      await this.sleep(3000);
      this.runRound();  // next round
    }
  }

  private async processAutoCashouts(roundId: number, multiplier: number) {
    const bets = await this.betModel.find({
      roundId, status: 'ACTIVE', autoCashoutAt: { $gt: 0, $lte: multiplier },
    });
    for (const bet of bets) {
      await this.processCashout(bet, multiplier, true);
    }
  }

  private async processCashout(bet: LimboBetDocument, multiplier: number, auto = false) {
    const payout = parseFloat((bet.betAmount * multiplier).toFixed(2));

    // Atomically claim the cashout: only the call that transitions ACTIVE→CASHEDOUT
    // proceeds to settle. This is the single source of truth that prevents the
    // auto-cashout loop (~100ms) and a concurrent manual cashOut from paying twice.
    const claimed = await this.betModel.findOneAndUpdate(
      { _id: bet._id, status: 'ACTIVE' },
      { $set: { status: 'CASHEDOUT', cashedOutMultiplier: multiplier, payout } },
      { new: true },
    );
    if (!claimed) return; // already settled by another path — never pay twice

    // Credit the payout atomically across the same wallets the stake came from
    // and write the BET_WIN transaction (originals-helpers, mirrors all originals).
    try {
      await settlePayout(
        this.prisma,
        claimed.userId,
        claimed.betAmount,
        payout,
        claimed.walletType,
        Number((claimed as any).bonusAmount || 0),
        'LIMBO',
        String((claimed as any)._id),
        `Limbo cashout on round #${claimed.roundId} at ${multiplier.toFixed(2)}x${auto ? ' (auto)' : ''}`,
        `Limbo loss on round #${claimed.roundId}`,
      );
      await this.roundModel.updateOne(
        { roundId: claimed.roundId },
        { $inc: { totalPaidOut: payout } },
      );
      this.bonusService.emitWalletRefresh(claimed.userId);
    } catch (e) {
      this.logger.error(`Failed to credit user ${claimed.userId}: ${e}`);
    }
    return { userId: claimed.userId, payout, multiplier, auto };
  }

  // ── Player actions ────────────────────────────────────────────────────────

  async placeBet(
    userId: number,
    roundId: number,
    betAmount: number,
    autoCashoutAt = 0,
    walletType = 'fiat',
    useBonus = false,
  ) {
    const round = await this.roundModel.findOne({ roundId });
    if (!round || round.status !== 'BETTING') {
      throw new BadRequestException('Betting phase is over for this round');
    }

    if (!(betAmount > 0)) throw new BadRequestException('Bet must be positive');

    // Enforce min/max bet + maintenance from the GGR admin config.
    const config = await this.ggrService.getConfig('limbo');
    if (config) {
      if (config.maintenanceMode) {
        throw new BadRequestException(config.maintenanceMessage || 'Limbo is under maintenance');
      }
      if (config.isActive === false) {
        throw new BadRequestException('Limbo is currently disabled');
      }
      if (typeof config.minBet === 'number' && betAmount < config.minBet) {
        throw new BadRequestException(`Minimum bet is ${config.minBet}`);
      }
      if (typeof config.maxBet === 'number' && betAmount > config.maxBet) {
        throw new BadRequestException(`Maximum bet is ${config.maxBet}`);
      }
    }

    // Check existing bet this round
    const existing = await this.betModel.findOne({ roundId, userId });
    if (existing) throw new BadRequestException('Already placed a bet this round');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Atomic stake deduction (shared originals-helper).
    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user as any,
      betAmount,
      walletType,
      useBonus,
    );

    // The stake debit has now COMMITTED. If creating the bet doc (or its BET_PLACE
    // log) throws afterwards, the stake would be lost with no bet record. Since this
    // spans two databases (Postgres wallet + Mongo bet) we cannot wrap it in one
    // transaction — so compensate by re-crediting the exact wallets we just debited.
    let bet: LimboBetDocument;
    try {
      bet = await this.betModel.create({
        roundId, userId, betAmount, autoCashoutAt, walletType,
        usedBonus: bonusUsed > 0,
        bonusAmount: bonusUsed,
        currency: walletType === 'crypto' ? 'USD' : (user as any).currency || 'INR',
      });

      // Record the BET_PLACE log entry (no balance change — stake already deducted).
      await logStakeTransaction(
        this.prisma,
        userId,
        betAmount,
        walletType,
        bonusUsed,
        'LIMBO',
        String((bet as any)._id),
        `Limbo bet placed on round #${roundId}`,
      );
    } catch (err) {
      // Compensate the committed debit: mirror the original wallet allocation and
      // increment those same wallet fields back to the user.
      try {
        const refundAllocations = buildAllocations(
          walletType,
          bonusUsed,
          betAmount,
          betAmount,
        );
        const refundData = refundAllocations.reduce<Record<string, any>>((acc, a) => {
          acc[a.walletField] = { increment: a.amount };
          return acc;
        }, {});
        if (Object.keys(refundData).length > 0) {
          await this.prisma.user.update({ where: { id: userId }, data: refundData });
        }
        this.bonusService.emitWalletRefresh(userId);
        this.logger.warn(
          `Compensated Limbo stake refund for user ${userId} (round #${roundId}, amount ${betAmount}) after bet-create failure`,
        );
      } catch (refundErr) {
        // Last-resort alert: stake was debited but neither bet nor refund persisted.
        this.logger.error(
          `ALERT: Limbo stake DEBITED but bet-create AND compensation FAILED for user ${userId} (round #${roundId}, amount ${betAmount}). Manual reconciliation required. createErr=${err} refundErr=${refundErr}`,
        );
      }
      throw err;
    }

    await this.roundModel.updateOne({ roundId }, { $inc: { totalWagered: betAmount } });
    await this.bonusService
      .recordWagering(
        userId,
        betAmount,
        'CASINO',
        walletType === 'crypto' ? 'crypto' : bonusUsed > 0 ? 'fiatbonus' : 'main',
        bonusUsed,
      )
      .catch(() => {
        this.bonusService.emitWalletRefresh(userId);
      });
    return { betId: String(bet._id), roundId, betAmount, autoCashoutAt };
  }

  async cashOut(userId: number, roundId: number, currentMultiplier: number) {
    const round = await this.roundModel.findOne({ roundId });
    if (!round || round.status !== 'FLYING') {
      throw new BadRequestException('Round is not in flying phase');
    }

    // Clamp the client/gateway-cached multiplier to the server-authoritative
    // crash point so a stale/too-high tick can never pay above the real ceiling.
    let multiplier = currentMultiplier;
    if (multiplier > round.crashPoint) multiplier = round.crashPoint;

    const bet = await this.betModel.findOne({ roundId, userId, status: 'ACTIVE' });
    if (!bet) throw new BadRequestException('No active bet found for this round');

    // processCashout recomputes payout server-side from the clamped multiplier.
    return this.processCashout(bet, multiplier);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getCurrentRound() {
    return this.roundModel.findOne({ status: { $in: ['BETTING', 'FLYING'] } }).sort({ roundId: -1 });
  }

  async getRoundHistory(limit = 20) {
    const rounds = await this.roundModel
      .find({ status: 'CRASHED' })
      .sort({ roundId: -1 })
      .limit(limit)
      .lean();
    return rounds.map((r) => ({
      roundId: r.roundId,
      crashPoint: r.crashPoint,
      serverSeedHash: r.serverSeedHash,
      serverSeed: r.serverSeed,  // revealed after crash for fairness
      crashedAt: r.crashedAt,
    }));
  }

  async getUserBetHistory(userId: number, limit = 20) {
    const bets = await this.betModel.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
    return bets.map((b) => ({ ...b, betId: String((b as any)._id) }));
  }

  async getRoundBets(roundId: number) {
    return this.betModel.find({ roundId }).sort({ createdAt: -1 }).lean();
  }

  private sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
}
