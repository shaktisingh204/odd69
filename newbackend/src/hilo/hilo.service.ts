import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import {
  HiloGame,
  HiloGameDocument,
} from '../originals/schemas/hilo-game.schema';
import { BonusService } from '../bonus/bonus.service';
import {
  generateServerSeed,
  hmacHex,
  rollInt,
  deductStake,
  settlePayout,
  logStakeTransaction,
  WalletType,
} from '../originals/originals-helpers';

const HOUSE_EDGE = 0.04; // 4%

/**
 * Card encoding 0..51:
 *   rank = (card % 13) + 1   (1=Ace, 11=J, 12=Q, 13=K)
 *   suit = Math.floor(card / 13)  (0=clubs, 1=diamonds, 2=hearts, 3=spades)
 */
function rankOf(card: number): number {
  return (card % 13) + 1;
}

function drawCard(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  step: number,
): number {
  const digest = hmacHex(serverSeed, clientSeed, nonce, `hilo:${step}`);
  return rollInt(digest, 52);
}

/**
 * Probability the next card has rank ≥ current rank.
 * Aces low. Among the 13 ranks, this is (14 - rank) / 13.
 *
 * "Lower or same" probability = rank / 13.
 */
function probHigherOrSame(currentRank: number): number {
  return (14 - currentRank) / 13;
}
function probLowerOrSame(currentRank: number): number {
  return currentRank / 13;
}

function multiplierForBet(prob: number): number {
  if (prob <= 0 || prob >= 1) return 0;
  return parseFloat(((1 - HOUSE_EDGE) / prob).toFixed(4));
}

export interface StartHiloDto {
  betAmount: number;
  clientSeed?: string;
  walletType?: WalletType;
  useBonus?: boolean;
}

export interface ActionHiloDto {
  gameId: string;
  action: 'higher' | 'lower' | 'skip';
}

export interface CashoutHiloDto {
  gameId: string;
}

@Injectable()
export class HiloService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(HiloGame.name)
    private readonly hiloModel: Model<HiloGameDocument>,
    private readonly bonusService: BonusService,
  ) {}

  private summarize(game: HiloGameDocument) {
    const rank = rankOf(game.currentCard);
    const probH = probHigherOrSame(rank);
    const probL = probLowerOrSame(rank);
    return {
      gameId: String(game._id),
      betAmount: game.betAmount,
      currentCard: game.currentCard,
      currentRank: rank,
      multiplier: game.multiplier,
      step: game.step,
      history: game.history,
      actions: game.actions,
      status: game.status,
      payout: game.payout,
      nextHigherChance: parseFloat((probH * 100).toFixed(2)),
      nextLowerChance: parseFloat((probL * 100).toFixed(2)),
      nextHigherMultiplier: multiplierForBet(probH),
      nextLowerMultiplier: multiplierForBet(probL),
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
    };
  }

  async start(userId: number, dto: StartHiloDto) {
    const {
      betAmount,
      clientSeed = 'zeero',
      walletType = 'fiat',
      useBonus = false,
    } = dto;
    if (!(betAmount > 0)) throw new BadRequestException('Bet must be positive');

    // Force-close any active game so the user only ever has one in flight
    const existing = await this.hiloModel.findOne({ userId, status: 'ACTIVE' });
    if (existing) {
      existing.status = 'LOST';
      await existing.save();
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user as any,
      betAmount,
      walletType,
      useBonus,
    );

    const { serverSeed, serverSeedHash } = generateServerSeed();
    const nonce = Date.now();
    const firstCard = drawCard(serverSeed, clientSeed, nonce, 0);

    const game = await this.hiloModel.create({
      userId,
      betAmount,
      currentCard: firstCard,
      multiplier: 1,
      step: 0,
      history: [firstCard],
      actions: [],
      status: 'ACTIVE',
      serverSeed,
      clientSeed,
      serverSeedHash,
      walletType,
      usedBonus: bonusUsed > 0,
      bonusAmount: bonusUsed,
      currency: walletType === 'crypto' ? 'USD' : (user as any).currency || 'INR',
    });

    await logStakeTransaction(
      this.prisma,
      userId,
      betAmount,
      walletType,
      bonusUsed,
      'HILO',
      String(game._id),
      'Hi-Lo bet started',
    );

    return this.summarize(game);
  }

  async action(userId: number, dto: ActionHiloDto) {
    const { gameId, action } = dto;
    if (!['higher', 'lower', 'skip'].includes(action)) {
      throw new BadRequestException('Invalid action');
    }
    const game = await this.hiloModel.findOne({ _id: gameId, userId });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'ACTIVE') {
      throw new BadRequestException('Game already finished');
    }

    const stepMultiplier = (() => {
      if (action === 'skip') return 1;
      const r = rankOf(game.currentCard);
      const p =
        action === 'higher' ? probHigherOrSame(r) : probLowerOrSame(r);
      return multiplierForBet(p);
    })();

    // Skip just draws a new card without changing the multiplier and without
    // ending the game on a wrong guess (because there is no guess).
    const nextStep = game.step + 1;
    const nextCard = drawCard(
      game.serverSeed,
      game.clientSeed,
      Number(game.history[0]) || 0, // stable nonce: first card encodes nonce
      nextStep,
    );

    let won = true;
    if (action === 'higher') {
      won = rankOf(nextCard) >= rankOf(game.currentCard);
    } else if (action === 'lower') {
      won = rankOf(nextCard) <= rankOf(game.currentCard);
    }

    game.history.push(nextCard);
    game.actions.push(action);
    game.step = nextStep;
    game.currentCard = nextCard;

    if (action === 'skip') {
      // Multiplier unchanged
      await game.save();
      return this.summarize(game);
    }

    if (!won) {
      game.status = 'LOST';
      game.payout = 0;
      await game.save();
      await settlePayout(
        this.prisma,
        userId,
        game.betAmount,
        0,
        game.walletType,
        game.bonusAmount,
        'HILO',
        String(game._id),
        '',
        `Hi-Lo loss after ${nextStep} step(s)`,
      );
      await this.bonusService
        .recordWagering(
          userId,
          game.betAmount,
          'CASINO',
          game.bonusAmount > 0 ? 'fiatbonus' : 'main',
          game.bonusAmount,
        )
        .catch(() => this.bonusService.emitWalletRefresh(userId));
      return this.summarize(game);
    }

    game.multiplier = parseFloat((game.multiplier * stepMultiplier).toFixed(4));
    await game.save();
    return this.summarize(game);
  }

  async cashout(userId: number, dto: CashoutHiloDto) {
    const game = await this.hiloModel.findOne({ _id: dto.gameId, userId });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'ACTIVE')
      throw new BadRequestException('Game already finished');
    if (game.step === 0)
      throw new BadRequestException('Make at least one guess before cashing out');

    const payout = parseFloat((game.betAmount * game.multiplier).toFixed(2));
    game.status = 'CASHEDOUT';
    game.payout = payout;
    await game.save();

    await settlePayout(
      this.prisma,
      userId,
      game.betAmount,
      payout,
      game.walletType,
      game.bonusAmount,
      'HILO',
      String(game._id),
      `Hi-Lo cashout × ${game.multiplier}`,
      '',
    );
    await this.bonusService
      .recordWagering(
        userId,
        game.betAmount,
        'CASINO',
        game.bonusAmount > 0 ? 'fiatbonus' : 'main',
        game.bonusAmount,
      )
      .catch(() => this.bonusService.emitWalletRefresh(userId));

    return this.summarize(game);
  }

  async getActive(userId: number) {
    const game = await this.hiloModel.findOne({ userId, status: 'ACTIVE' });
    return game ? this.summarize(game) : null;
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.hiloModel
      .find({ userId, status: { $ne: 'ACTIVE' } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return games.map((g: any) => ({
      gameId: String(g._id),
      betAmount: g.betAmount,
      multiplier: g.multiplier,
      step: g.step,
      payout: g.payout,
      status: g.status,
      createdAt: g.createdAt,
    }));
  }
}
