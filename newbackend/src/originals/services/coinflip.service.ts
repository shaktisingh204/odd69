import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma.service';
import {
  CoinflipGame,
  CoinflipGameDocument,
} from '../schemas/coinflip-game.schema';
import { GGRService } from '../ggr.service';
import { BonusService } from '../../bonus/bonus.service';
import { FairnessService } from '../fairness.service';
import {
  hmacHex,
  rollInt,
  roundCurrency,
  deductStake,
  logStakeTransaction,
  settlePayout,
  WalletType,
} from '../originals-helpers';

const GAME_KEY = 'coinflip';
const GAME_SOURCE = 'COINFLIP';
const DEFAULT_MAX_BET = 20000;

/** RTP 98% / 2% house edge: a fair coin pays 2.0, we pay 0.98 × 2^N. */
const RTP = 0.98;
/** Chain is capped at 20 flips → max multiplier 0.98 × 2^20 = 1,027,604.48x. */
const MAX_FLIPS = 20;

type Side = 'heads' | 'tails';

export interface StartCoinflipDto {
  betAmount: number;
  pick: Side;
  walletType?: WalletType;
  useBonus?: boolean;
}

export interface FlipCoinflipDto {
  gameId: string;
  pick: Side;
}

export interface CashoutCoinflipDto {
  gameId: string;
}

/** multiplier after N consecutive correct flips: 0.98 × 2^N (N>=1). */
function multiplierForStep(step: number): number {
  if (step <= 0) return 0;
  return roundCurrency(RTP * Math.pow(2, step));
}

@Injectable()
export class CoinflipService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(CoinflipGame.name)
    private readonly model: Model<CoinflipGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
    @Inject(forwardRef(() => FairnessService))
    private readonly fairness: FairnessService,
  ) {}

  /**
   * Deterministically derive the side for flip number k (1-based) in the chain.
   * HMAC(serverSeed:clientSeed:nonce:flip:k) → rollInt(2): 0=heads, 1=tails.
   */
  private flipSide(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    k: number,
  ): Side {
    const r = rollInt(hmacHex(serverSeed, clientSeed, nonce, `flip:${k}`), 2);
    return r === 0 ? 'heads' : 'tails';
  }

  /**
   * Build the full response object every method returns. Reveals the raw
   * serverSeed only once the chain has terminated (status !== 'ACTIVE');
   * while ACTIVE it stays hidden so future flips can't be precomputed.
   */
  private buildState(game: CoinflipGameDocument | (CoinflipGame & { _id: any })) {
    const step = game.step;
    const multiplier = roundCurrency(game.multiplier);
    const results = game.results || [];
    const currentResult = results.length ? results[results.length - 1] : null;
    const atCap = step >= MAX_FLIPS;
    const nextMultiplier = atCap ? null : multiplierForStep(step + 1);

    return {
      gameId: String((game as any)._id),
      betAmount: game.betAmount,
      status: game.status,
      step,
      multiplier,
      picks: game.picks || [],
      results,
      currentResult,
      payout: game.payout,
      nextMultiplier,
      maxFlips: MAX_FLIPS,
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
    };
  }

  private assertSide(pick: any): asserts pick is Side {
    if (pick !== 'heads' && pick !== 'tails') {
      throw new BadRequestException('Pick must be "heads" or "tails"');
    }
  }

  async start(userId: number, dto: StartCoinflipDto) {
    const { betAmount, pick, walletType = 'fiat', useBonus = false } = dto;

    this.assertSide(pick);
    if (typeof betAmount !== 'number' || !isFinite(betAmount) || betAmount <= 0) {
      throw new BadRequestException('Bet amount must be positive');
    }
    if (walletType !== 'fiat' && walletType !== 'crypto') {
      throw new BadRequestException('Invalid wallet type');
    }

    const config = await this.ggrService.getConfig(GAME_KEY);
    if (config && !config.isActive) {
      throw new BadRequestException('Coinflip is currently unavailable');
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

    // Single ACTIVE game per user — reject if one is already in flight.
    const existing = await this.model.findOne({ userId, status: 'ACTIVE' });
    if (existing) {
      throw new BadRequestException(
        'You already have an active game. Finish it first.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user,
      betAmount,
      walletType,
      useBonus,
    );

    // One seed pair (atomic nonce) drives the whole chain; flip k uses tag flip:k.
    const { serverSeed, serverSeedHash, clientSeed, nonce } =
      await this.fairness.consume(userId);

    // Resolve flip #1 immediately.
    const result = this.flipSide(serverSeed, clientSeed, nonce, 1);
    const won = pick === result;

    if (won) {
      const multiplier = multiplierForStep(1);
      const game = await this.model.create({
        userId,
        betAmount,
        picks: [pick],
        results: [result],
        step: 1,
        multiplier,
        payout: 0,
        status: 'ACTIVE',
        serverSeed,
        clientSeed,
        serverSeedHash,
        nonce,
        walletType,
        usedBonus: bonusUsed > 0,
        bonusAmount: bonusUsed,
        currency: walletType === 'crypto' ? 'USD' : user.currency || 'INR',
      } as any);

      await logStakeTransaction(
        this.prisma,
        userId,
        betAmount,
        walletType,
        bonusUsed,
        GAME_SOURCE,
        String(game._id),
        `Coinflip bet: ${pick}`,
      );

      await this.bonusService
        .recordWagering(
          userId,
          betAmount,
          'CASINO',
          bonusUsed > 0 ? 'fiatbonus' : 'main',
          bonusUsed,
        )
        .catch(() => this.bonusService.emitWalletRefresh(userId));

      return this.buildState(game);
    }

    // First flip lost → terminal LOST round, payout 0.
    const game = await this.model.create({
      userId,
      betAmount,
      picks: [pick],
      results: [result],
      step: 0,
      multiplier: 0,
      payout: 0,
      status: 'LOST',
      serverSeed,
      clientSeed,
      serverSeedHash,
      nonce,
      walletType,
      usedBonus: bonusUsed > 0,
      bonusAmount: bonusUsed,
      currency: walletType === 'crypto' ? 'USD' : user.currency || 'INR',
    } as any);

    await logStakeTransaction(
      this.prisma,
      userId,
      betAmount,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      String(game._id),
      `Coinflip bet: ${pick}`,
    );

    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      0,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      String(game._id),
      `Coinflip win`,
      `Coinflip loss: ${result}`,
    );

    await this.ggrService
      .updateSnapshot(GAME_KEY, 0, 0, false)
      .catch(() => undefined);

    await this.bonusService
      .recordWagering(
        userId,
        betAmount,
        'CASINO',
        bonusUsed > 0 ? 'fiatbonus' : 'main',
        bonusUsed,
      )
      .catch(() => this.bonusService.emitWalletRefresh(userId));

    return this.buildState(game);
  }

  async flip(userId: number, dto: FlipCoinflipDto) {
    const { gameId, pick } = dto;
    this.assertSide(pick);

    const game = await this.model.findById(gameId);
    if (!game) throw new NotFoundException('Game not found');
    if (game.userId !== userId) throw new ForbiddenException('Not your game');
    if (game.status !== 'ACTIVE') {
      throw new BadRequestException(`Game is already ${game.status}`);
    }
    if (game.step >= MAX_FLIPS) {
      throw new BadRequestException('Chain is already at the maximum length');
    }

    const nextStep = game.step + 1;
    const result = this.flipSide(
      game.serverSeed,
      game.clientSeed,
      game.nonce,
      nextStep,
    );
    const won = pick === result;

    if (won) {
      const newMultiplier = multiplierForStep(nextStep);
      const reachedCap = nextStep >= MAX_FLIPS;

      if (reachedCap) {
        // Auto-cashout at the cap. Atomic ACTIVE→CASHEDOUT claim so the payout
        // runs exactly once per stake (prevents TOCTOU double-spend).
        const config = await this.ggrService.getConfig(GAME_KEY);
        let payout = roundCurrency(game.betAmount * newMultiplier);
        if (config?.maxWin && payout > config.maxWin) {
          payout = roundCurrency(config.maxWin);
        }

        const claimed = await this.model.findOneAndUpdate(
          { _id: gameId, userId, status: 'ACTIVE' },
          {
            $push: { picks: pick, results: result },
            $set: {
              step: nextStep,
              multiplier: newMultiplier,
              status: 'CASHEDOUT',
              payout,
            },
          },
          { new: true },
        );
        if (!claimed) {
          throw new BadRequestException('Game is not active');
        }

        await settlePayout(
          this.prisma,
          userId,
          claimed.betAmount,
          payout,
          claimed.walletType,
          claimed.bonusAmount || 0,
          GAME_SOURCE,
          String(claimed._id),
          `Coinflip win x${newMultiplier}`,
          `Coinflip loss`,
        );

        await this.ggrService
          .updateSnapshot(GAME_KEY, 0, 0, true)
          .catch(() => undefined);

        return this.buildState(claimed);
      }

      // Non-terminal win: extend the chain. Guard on status + current step to
      // avoid lost updates from concurrent flips on the same game.
      const updated = await this.model.findOneAndUpdate(
        { _id: gameId, userId, status: 'ACTIVE', step: game.step },
        {
          $push: { picks: pick, results: result },
          $set: { step: nextStep, multiplier: newMultiplier },
        },
        { new: true },
      );
      if (!updated) {
        throw new BadRequestException('Game is not active');
      }
      return this.buildState(updated);
    }

    // Loss → terminal. Atomic ACTIVE→LOST claim so settlePayout runs exactly
    // once per stake (prevents TOCTOU double-spend).
    const claimed = await this.model.findOneAndUpdate(
      { _id: gameId, userId, status: 'ACTIVE' },
      {
        $push: { picks: pick, results: result },
        $set: { step: nextStep, status: 'LOST', payout: 0 },
      },
      { new: true },
    );
    if (!claimed) {
      throw new BadRequestException('Game is not active');
    }

    await settlePayout(
      this.prisma,
      userId,
      claimed.betAmount,
      0,
      claimed.walletType,
      claimed.bonusAmount || 0,
      GAME_SOURCE,
      String(claimed._id),
      `Coinflip win`,
      `Coinflip loss: ${result}`,
    );

    await this.ggrService
      .updateSnapshot(GAME_KEY, 0, 0, false)
      .catch(() => undefined);

    return this.buildState(claimed);
  }

  async cashout(userId: number, dto: CashoutCoinflipDto) {
    const { gameId } = dto;

    const game = await this.model.findById(gameId);
    if (!game) throw new NotFoundException('Game not found');
    if (game.userId !== userId) throw new ForbiddenException('Not your game');
    if (game.status !== 'ACTIVE') {
      throw new BadRequestException(`Game is already ${game.status}`);
    }
    if (game.step < 1) {
      throw new BadRequestException('Win at least one flip before cashing out');
    }

    const config = await this.ggrService.getConfig(GAME_KEY);
    let payout = roundCurrency(game.betAmount * game.multiplier);
    if (config?.maxWin && payout > config.maxWin) {
      payout = roundCurrency(config.maxWin);
    }

    // Atomic ACTIVE→CASHEDOUT claim: only one concurrent caller can win this,
    // so settlePayout runs exactly once per stake (prevents TOCTOU double-spend).
    const claimed = await this.model.findOneAndUpdate(
      { _id: gameId, userId, status: 'ACTIVE', step: { $gte: 1 } },
      { $set: { status: 'CASHEDOUT', payout } },
      { new: true },
    );
    if (!claimed) {
      throw new BadRequestException('Game is not active or cannot cash out');
    }

    await settlePayout(
      this.prisma,
      userId,
      claimed.betAmount,
      payout,
      claimed.walletType,
      claimed.bonusAmount || 0,
      GAME_SOURCE,
      String(claimed._id),
      `Coinflip cashout x${claimed.multiplier}`,
      `Coinflip loss`,
    );

    await this.ggrService
      .updateSnapshot(GAME_KEY, 0, 0, true)
      .catch(() => undefined);

    return this.buildState(claimed);
  }

  async getActive(userId: number) {
    const game = await this.model.findOne({ userId, status: 'ACTIVE' });
    if (!game) return { gameId: null };
    return this.buildState(game);
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.model
      .find({ userId, status: { $ne: 'ACTIVE' } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return games.map((g: any) => {
      const step = g.step || 0;
      const atCap = step >= MAX_FLIPS;
      return {
        gameId: String(g._id),
        betAmount: g.betAmount,
        status: g.status,
        step,
        multiplier: roundCurrency(g.multiplier),
        picks: g.picks || [],
        results: g.results || [],
        currentResult:
          (g.results || []).length ? g.results[g.results.length - 1] : null,
        payout: g.payout,
        nextMultiplier: atCap ? null : multiplierForStep(step + 1),
        maxFlips: MAX_FLIPS,
        serverSeed: g.serverSeed,
        serverSeedHash: g.serverSeedHash,
        clientSeed: g.clientSeed,
        nonce: g.nonce,
        createdAt: g.createdAt,
      };
    });
  }
}
