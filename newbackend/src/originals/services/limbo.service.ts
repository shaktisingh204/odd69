import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma.service';
import { LimboGame, LimboGameDocument } from '../schemas/limbo-game.schema';
import { GGRService } from '../ggr.service';
import { BonusService } from '../../bonus/bonus.service';
import { FairnessService } from '../fairness.service';
import {
  hmacHex,
  roundCurrency,
  deductStake,
  logStakeTransaction,
  settlePayout,
  WalletType,
} from '../originals-helpers';

const GAME_KEY = 'limbo';
const GAME_SOURCE = 'LIMBO';
const DEFAULT_MAX_BET = 25000;

const HOUSE_EDGE_PERCENT = 99; // 1% house edge → 99% RTP
const MIN_TARGET = 1.01;
const MAX_TARGET = 1_000_000;
const MIN_RESULT = 1.0;
const MAX_RESULT = 1_000_000;

/**
 * Provably-fair result multiplier (the "crash point") for an instant Limbo roll.
 *
 * Take a 24-bit integer `n` from the first 6 hex (3 bytes) of the HMAC digest,
 * map to r = n / 2^24 ∈ [0,1), then result = (0.99 / (1 - r)), floored to 2
 * decimals, clamped to [1.00, 1,000,000.00]. The 0.99 factor bakes in the 1%
 * house edge so the displayed win-chance (99/target) is exact.
 */
function resolveResult(digest: string): number {
  const n = parseInt(digest.slice(0, 6), 16); // 24-bit int in [0, 2^24-1]
  const r = n / 0x1000000; // [0, 1)
  const raw = (HOUSE_EDGE_PERCENT / 100) / (1 - r);
  const floored = Math.floor(raw * 100) / 100;
  return Math.min(MAX_RESULT, Math.max(MIN_RESULT, floored));
}

export interface PlayLimboDto {
  betAmount: number;
  target: number;
  walletType?: WalletType;
  useBonus?: boolean;
}

@Injectable()
export class LimboService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(LimboGame.name)
    private readonly model: Model<LimboGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
    @Inject(forwardRef(() => FairnessService))
    private readonly fairness: FairnessService,
  ) {}

  async play(userId: number, dto: PlayLimboDto) {
    const { betAmount, target, walletType = 'fiat', useBonus = false } = dto;

    // 1. Validate inputs
    if (
      typeof betAmount !== 'number' ||
      !isFinite(betAmount) ||
      betAmount <= 0
    ) {
      throw new BadRequestException('Bet must be positive');
    }
    if (typeof target !== 'number' || !isFinite(target)) {
      throw new BadRequestException('Invalid target multiplier');
    }
    if (target < MIN_TARGET || target > MAX_TARGET) {
      throw new BadRequestException(
        `Target must be between ${MIN_TARGET} and ${MAX_TARGET}`,
      );
    }
    if (walletType !== 'fiat' && walletType !== 'crypto') {
      throw new BadRequestException('Invalid wallet type');
    }

    // Normalise target to 2 decimals (matches the UI granularity / win-chance math).
    const normTarget = Math.floor(target * 100) / 100;

    // 2. Enforce GGR config gates
    const config = await this.ggrService.getConfig(GAME_KEY);
    if (config && !config.isActive) {
      throw new BadRequestException('Game is currently disabled');
    }
    if (config?.maintenanceMode) {
      throw new BadRequestException(
        config.maintenanceMessage || 'Under maintenance',
      );
    }
    if (betAmount < (config?.minBet ?? 10)) {
      throw new BadRequestException(`Minimum bet is ${config?.minBet ?? 10}`);
    }
    if (betAmount > (config?.maxBet ?? DEFAULT_MAX_BET)) {
      throw new BadRequestException(
        `Maximum bet is ${config?.maxBet ?? DEFAULT_MAX_BET}`,
      );
    }

    // 3. Load user
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 4. Atomic stake debit
    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user,
      betAmount,
      walletType,
      useBonus,
    );

    // 5. Provably-fair outcome (atomic nonce consume)
    const { serverSeed, serverSeedHash, clientSeed, nonce } =
      await this.fairness.consume(userId);
    const result = resolveResult(hmacHex(serverSeed, clientSeed, nonce));

    // 6. Settle: WIN if result >= target → paid the TARGET (not the result).
    const won = result >= normTarget;
    let payout = won ? roundCurrency(betAmount * normTarget) : 0;
    if (won && config?.maxWin && payout > config.maxWin) {
      payout = roundCurrency(config.maxWin);
    }
    const status = won ? 'WON' : 'LOST';
    const winChance = roundCurrency(HOUSE_EDGE_PERCENT / normTarget); // 99 / target

    // 7. Persist game doc
    const game = await this.model.create({
      userId,
      betAmount,
      target: normTarget,
      result,
      multiplier: normTarget,
      payout,
      status,
      serverSeed,
      clientSeed,
      serverSeedHash,
      nonce,
      walletType,
      usedBonus: bonusUsed > 0,
      bonusAmount: bonusUsed,
      currency: walletType === 'crypto' ? 'USD' : user.currency || 'INR',
    });

    // 8. Stake log
    await logStakeTransaction(
      this.prisma,
      userId,
      betAmount,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      String(game._id),
      'Limbo bet',
    );

    // 9. Settle payout (credit + BET_WIN, or BET_LOSS when payout=0)
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      String(game._id),
      `Limbo win: ${result.toFixed(2)}x >= ${normTarget}x`,
      `Limbo loss: ${result.toFixed(2)}x < ${normTarget}x`,
    );

    // 10. GGR snapshot
    await this.ggrService
      .updateSnapshot(GAME_KEY, 0, 0, status === 'WON')
      .catch(() => undefined);

    // 11. Wagering progress
    await this.bonusService
      .recordWagering(
        userId,
        betAmount,
        'CASINO',
        walletType === 'crypto'
          ? 'crypto'
          : bonusUsed > 0
            ? 'fiatbonus'
            : 'main',
        bonusUsed,
      )
      .catch(() => this.bonusService.emitWalletRefresh(userId));

    // 12. Result (every field the frontend reads)
    return {
      gameId: String(game._id),
      target: normTarget,
      result,
      multiplier: normTarget,
      payout,
      status,
      betAmount,
      winChance,
      serverSeedHash,
      clientSeed,
      nonce,
    };
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.model
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return games.map((g: any) => ({
      gameId: String(g._id),
      target: g.target,
      result: g.result,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      winChance: roundCurrency(HOUSE_EDGE_PERCENT / g.target),
      serverSeedHash: g.serverSeedHash,
      clientSeed: g.clientSeed,
      nonce: g.nonce,
      createdAt: g.createdAt,
    }));
  }
}
