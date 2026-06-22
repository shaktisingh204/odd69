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
import { HiloGame, HiloGameDocument } from '../schemas/hilo-game.schema';
import { GGRService } from '../ggr.service';
import { BonusService } from '../../bonus/bonus.service';
import {
  generateServerSeed,
  hmacHex,
  rollInt,
  roundCurrency,
  deductStake,
  logStakeTransaction,
  settlePayout,
} from '../originals-helpers';

const GAME_KEY = 'hilo';
const GAME_SOURCE = 'HILO';
const DEFAULT_MAX_BET = 20000;
const RTP = 0.96; // 96% RTP → 4% edge per guess

export interface StartHiloDto {
  betAmount: number;
  clientSeed?: string;
  walletType?: 'fiat' | 'crypto';
  useBonus?: boolean;
}

export interface ActionHiloDto {
  gameId: string;
  action: 'higher' | 'lower' | 'skip';
}

export interface CashoutHiloDto {
  gameId: string;
}

/** rank in 1..13 from a card id 0..51 */
function rank(card: number): number {
  return (card % 13) + 1;
}

/** probability the next (independent) card ranks >= r */
function probHigherOrEqual(r: number): number {
  return (14 - r) / 13;
}

/** probability the next (independent) card ranks <= r */
function probLowerOrEqual(r: number): number {
  return r / 13;
}

function roundTo4(v: number): number {
  return parseFloat(Number(v || 0).toFixed(4));
}

/** per-step payout multiplier for a chosen outcome with probability p */
function stepMultiplier(p: number): number {
  if (p <= 0) return 0;
  return roundTo4(RTP / p);
}

@Injectable()
export class HiloService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(HiloGame.name)
    private readonly model: Model<HiloGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
  ) {}

  /**
   * Deterministically draw the card for a given step index.
   * The schema has no `nonce` field (and we must not edit shared files), so we
   * derive a stable per-game nonce from the immutable serverSeedHash. This is
   * identical on every reload of the same game, so draws are reproducible and
   * provably fair (serverSeed + clientSeed + serverSeedHash are all revealed
   * on any terminal state, letting the player verify each `card:k`).
   */
  private gameNonce(serverSeedHash: string): number {
    return parseInt(serverSeedHash.slice(0, 8), 16);
  }

  private drawCard(
    serverSeed: string,
    clientSeed: string,
    serverSeedHash: string,
    step: number,
  ): number {
    const nonce = this.gameNonce(serverSeedHash);
    return rollInt(hmacHex(serverSeed, clientSeed, nonce, `card:${step}`), 52);
  }

  /**
   * Build the full response object the frontend reads. Reveals the serverSeed
   * only when the game has terminated (status !== 'ACTIVE').
   */
  private buildState(game: HiloGameDocument | HiloGame & { _id: any }) {
    const currentCard = game.currentCard;
    const currentRank = rank(currentCard);
    const multiplier = roundTo4(game.multiplier);

    const pHigher = probHigherOrEqual(currentRank);
    const pLower = probLowerOrEqual(currentRank);

    return {
      gameId: String((game as any)._id),
      betAmount: game.betAmount,
      currentCard,
      currentRank,
      multiplier,
      step: game.step,
      history: game.history,
      actions: game.actions,
      status: game.status,
      payout: game.payout,
      nextHigherChance: roundTo4(pHigher * 100),
      nextLowerChance: roundTo4(pLower * 100),
      nextHigherMultiplier: roundTo4(multiplier * stepMultiplier(pHigher)),
      nextLowerMultiplier: roundTo4(multiplier * stepMultiplier(pLower)),
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      serverSeed: game.status === 'ACTIVE' ? '' : game.serverSeed,
    };
  }

  async start(userId: number, dto: StartHiloDto) {
    const {
      betAmount,
      clientSeed = 'odd69',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    if (!betAmount || betAmount <= 0) {
      throw new BadRequestException('Bet amount must be positive');
    }

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

    // Reject if an active game already exists.
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

    // Provably-fair seed for the whole game instance.
    const { serverSeed, serverSeedHash } = generateServerSeed();
    const card0 = this.drawCard(serverSeed, clientSeed, serverSeedHash, 0);

    const game = await this.model.create({
      userId,
      betAmount,
      currentCard: card0,
      multiplier: 1,
      step: 0,
      history: [card0],
      actions: [],
      status: 'ACTIVE',
      payout: 0,
      serverSeed,
      clientSeed,
      serverSeedHash,
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
      'Hi-Lo bet',
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

  async action(userId: number, dto: ActionHiloDto) {
    const { gameId, action } = dto;
    if (!['higher', 'lower', 'skip'].includes(action)) {
      throw new BadRequestException('Invalid action');
    }

    const game = await this.model.findById(gameId);
    if (!game) throw new NotFoundException('Game not found');
    if (game.userId !== userId) throw new ForbiddenException('Not your game');
    if (game.status !== 'ACTIVE') {
      throw new BadRequestException(`Game is already ${game.status}`);
    }

    const nextStep = game.step + 1;
    const nextCard = this.drawCard(
      game.serverSeed,
      game.clientSeed,
      game.serverSeedHash,
      nextStep,
    );
    const nextRank = rank(nextCard);
    const curRank = rank(game.currentCard);

    if (action === 'skip') {
      // Non-terminal update; guard on status:'ACTIVE' + current step to avoid
      // lost updates from concurrent actions on the same game.
      const updated = await this.model.findOneAndUpdate(
        { _id: gameId, userId, status: 'ACTIVE', step: game.step },
        {
          $push: { history: nextCard, actions: action },
          $set: { currentCard: nextCard, step: nextStep },
          // multiplier unchanged
        },
        { new: true },
      );
      if (!updated) {
        throw new BadRequestException('Game is not active');
      }
      return this.buildState(updated);
    }

    const win =
      action === 'higher' ? nextRank >= curRank : nextRank <= curRank;

    if (win) {
      const p =
        action === 'higher'
          ? probHigherOrEqual(curRank)
          : probLowerOrEqual(curRank);
      const newMultiplier = roundTo4(game.multiplier * stepMultiplier(p));
      // Non-terminal update; guard on status:'ACTIVE' + current step to avoid
      // lost updates from concurrent actions on the same game.
      const updated = await this.model.findOneAndUpdate(
        { _id: gameId, userId, status: 'ACTIVE', step: game.step },
        {
          $push: { history: nextCard, actions: action },
          $set: {
            multiplier: newMultiplier,
            currentCard: nextCard,
            step: nextStep,
          },
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
        $push: { history: nextCard, actions: action },
        $set: {
          currentCard: nextCard,
          step: nextStep,
          status: 'LOST',
          payout: 0,
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
      0,
      claimed.walletType,
      claimed.bonusAmount || 0,
      GAME_SOURCE,
      String(claimed._id),
      'Hi-Lo win',
      'Hi-Lo loss',
    );

    await this.ggrService
      .updateSnapshot(GAME_KEY, 0, 0, false)
      .catch(() => undefined);

    return this.buildState(claimed);
  }

  async cashout(userId: number, dto: CashoutHiloDto) {
    const { gameId } = dto;

    const game = await this.model.findById(gameId);
    if (!game) throw new NotFoundException('Game not found');
    if (game.userId !== userId) throw new ForbiddenException('Not your game');
    if (game.status !== 'ACTIVE') {
      throw new BadRequestException(`Game is already ${game.status}`);
    }
    if (game.step < 1) {
      throw new BadRequestException(
        'Make at least one guess before cashing out',
      );
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
      'Hi-Lo cashout',
      'Hi-Lo loss',
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
      const currentRank = rank(g.currentCard);
      const pHigher = probHigherOrEqual(currentRank);
      const pLower = probLowerOrEqual(currentRank);
      const multiplier = roundTo4(g.multiplier);
      return {
        gameId: String(g._id),
        betAmount: g.betAmount,
        currentCard: g.currentCard,
        currentRank,
        multiplier,
        step: g.step,
        history: g.history,
        actions: g.actions,
        status: g.status,
        payout: g.payout,
        nextHigherChance: roundTo4(pHigher * 100),
        nextLowerChance: roundTo4(pLower * 100),
        nextHigherMultiplier: roundTo4(multiplier * stepMultiplier(pHigher)),
        nextLowerMultiplier: roundTo4(multiplier * stepMultiplier(pLower)),
        serverSeedHash: g.serverSeedHash,
        clientSeed: g.clientSeed,
        serverSeed: g.serverSeed,
        createdAt: g.createdAt,
      };
    });
  }
}
