import {
  Injectable, BadRequestException, ForbiddenException,
  NotFoundException, Inject, forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import { MinesGame, MinesGameDocument } from '../originals/schemas/mines-game.schema';
import { StartMinesDto } from './dto/start-mines.dto';
import { RevealTileDto } from './dto/reveal-tile.dto';
import { CashoutDto } from './dto/cashout.dto';
import * as crypto from 'crypto';
import { GGRService } from '../originals/ggr.service';
import { BonusService } from '../bonus/bonus.service';

const TOTAL_TILES = 25;
const DEFAULT_HOUSE_EDGE = 0.01;

type MinesWalletField = 'balance' | 'cryptoBalance' | 'casinoBonus';
type MinesAllocation = {
  walletField: MinesWalletField;
  walletLabel: string;
  amount: number;
};

function generateMinePositions(serverSeed: string, clientSeed: string, nonce: number, mineCount: number): number[] {
  const tiles = Array.from({ length: TOTAL_TILES }, (_, i) => i);
  const key = `${serverSeed}:${clientSeed}:${nonce}`;
  for (let i = TOTAL_TILES - 1; i > 0; i--) {
    const hmac = crypto.createHmac('sha256', key).update(String(i)).digest('hex');
    const j = parseInt(hmac.slice(0, 8), 16) % (i + 1);
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles.slice(0, mineCount);
}

function calcMultiplier(mineCount: number, revealCount: number, houseEdge = DEFAULT_HOUSE_EDGE): number {
  const safeTiles = TOTAL_TILES - mineCount;
  let mult = 1;
  for (let k = 0; k < revealCount; k++) {
    mult *= (TOTAL_TILES - k) / (safeTiles - k);
  }
  return parseFloat((mult * (1 - houseEdge)).toFixed(4));
}

@Injectable()
export class MinesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(MinesGame.name)
    private readonly minesGameModel: Model<MinesGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
  ) {}

  private roundCurrency(value: number) {
    return parseFloat(Number(value || 0).toFixed(2));
  }

  private getPrimaryWalletField(walletType: 'fiat' | 'crypto' | string): MinesWalletField {
    return walletType === 'crypto' ? 'cryptoBalance' : 'balance';
  }

  private getWalletFieldLabel(walletField: MinesWalletField) {
    if (walletField === 'casinoBonus') return 'Casino Bonus Wallet';
    return walletField === 'cryptoBalance' ? 'Crypto Wallet' : 'Main Wallet';
  }

  private mapWalletFieldToPaymentMethod(walletField: MinesWalletField) {
    if (walletField === 'casinoBonus') return 'BONUS_WALLET';
    return walletField === 'cryptoBalance' ? 'CRYPTO_WALLET' : 'MAIN_WALLET';
  }

  private buildAllocations(
    walletType: 'fiat' | 'crypto' | string,
    bonusAmount: number,
    betAmount: number,
    amount: number,
  ): MinesAllocation[] {
    const normalizedAmount = this.roundCurrency(amount);
    if (normalizedAmount <= 0) return [];

    const primaryWalletField = this.getPrimaryWalletField(walletType);
    if (walletType === 'crypto') {
      const allocations: MinesAllocation[] = [{
        walletField: 'cryptoBalance',
        walletLabel: this.getWalletFieldLabel('cryptoBalance'),
        amount: normalizedAmount,
      }];
      return allocations;
    }

    const normalizedBetAmount = this.roundCurrency(betAmount);
    const normalizedBonusAmount = this.roundCurrency(
      Math.min(normalizedBetAmount, Math.max(0, bonusAmount)),
    );
    const mainStakeAmount = this.roundCurrency(
      Math.max(0, normalizedBetAmount - normalizedBonusAmount),
    );

    if (normalizedBonusAmount <= 0 || normalizedBetAmount <= 0) {
      const allocations: MinesAllocation[] = [{
        walletField: primaryWalletField,
        walletLabel: this.getWalletFieldLabel(primaryWalletField),
        amount: normalizedAmount,
      }];
      return allocations;
    }

    if (mainStakeAmount <= 0) {
      const allocations: MinesAllocation[] = [{
        walletField: 'casinoBonus',
        walletLabel: this.getWalletFieldLabel('casinoBonus'),
        amount: normalizedAmount,
      }];
      return allocations;
    }

    const bonusPayout = this.roundCurrency(
      (normalizedAmount * normalizedBonusAmount) / normalizedBetAmount,
    );
    const mainPayout = this.roundCurrency(normalizedAmount - bonusPayout);

    const allocations: MinesAllocation[] = [
      {
        walletField: 'casinoBonus',
        walletLabel: this.getWalletFieldLabel('casinoBonus'),
        amount: bonusPayout,
      },
      {
        walletField: primaryWalletField,
        walletLabel: this.getWalletFieldLabel(primaryWalletField),
        amount: mainPayout,
      },
    ];

    return allocations.filter((allocation) => allocation.amount > 0);
  }

  async startGame(userId: number, dto: StartMinesDto) {
    const { betAmount, mineCount, clientSeed = 'zeero', walletType = 'fiat', useBonus = false } = dto;

    if (mineCount < 1 || mineCount > 24) throw new BadRequestException('Mine count must be 1–24');
    if (betAmount <= 0) throw new BadRequestException('Bet amount must be positive');

    // Check existing active game (MongoDB)
    const existing = await this.minesGameModel.findOne({ userId, status: 'ACTIVE' });
    if (existing) throw new BadRequestException('You already have an active game. Cashout or finish it first.');

    // Get user (Prisma — must stay for balance check/deduction)
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // GGR bias
    const ggrResult = await this.ggrService.computeBias('mines', userId, mineCount).catch(() => ({
      biasWeight: 0, houseEdge: DEFAULT_HOUSE_EDGE, targetGgr: 5, actualGgr: 0,
    }));

    // Deduct balance (Prisma — atomic)
    let bonusUsed = 0;
    let actualBet = betAmount;

    await this.prisma.$transaction(async (tx) => {
      if (walletType === 'crypto') {
        if (user.cryptoBalance < betAmount) throw new BadRequestException('Insufficient crypto balance');
        await tx.user.update({ where: { id: userId }, data: { cryptoBalance: { decrement: betAmount } } });
      } else {
        if (useBonus && user.casinoBonus > 0) {
          bonusUsed = Math.min(user.casinoBonus, betAmount);
          actualBet = Math.max(0, betAmount - bonusUsed);
          if (user.balance < actualBet) throw new BadRequestException('Insufficient balance');
          await tx.user.update({
            where: { id: userId },
            data: { balance: { decrement: actualBet }, casinoBonus: { decrement: bonusUsed } },
          });
        } else {
          if (user.balance < betAmount) throw new BadRequestException('Insufficient balance');
          await tx.user.update({ where: { id: userId }, data: { balance: { decrement: betAmount } } });
        }
      }
    });

    // Generate provably fair seeds
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    let mines = generateMinePositions(serverSeed, clientSeed, 0, mineCount);
    mines = this.ggrService.applyBiasToMines(mines, ggrResult.biasWeight, mineCount);

    // Create game doc in MongoDB
    const game = await this.minesGameModel.create({
      userId, betAmount, mineCount, serverSeed, serverSeedHash, clientSeed,
      minePositions: mines, revealedTiles: [], multiplier: 1.0,
      walletType, usedBonus: bonusUsed > 0, bonusAmount: bonusUsed,
      currency: walletType === 'crypto' ? 'USD' : user.currency || 'INR',
      biasWeight: ggrResult.biasWeight,
    });
    const stakeAllocations = this.buildAllocations(
      walletType,
      bonusUsed,
      betAmount,
      betAmount,
    );
    const stakePrimaryAllocation = stakeAllocations[0];
    const placePaymentMethod =
      stakeAllocations.length === 1 && stakePrimaryAllocation
        ? this.mapWalletFieldToPaymentMethod(stakePrimaryAllocation.walletField)
        : 'MULTI_WALLET';

    await this.prisma.transaction.create({
      data: {
        userId,
        amount: betAmount,
        type: 'BET_PLACE',
        status: 'COMPLETED',
        paymentMethod: placePaymentMethod,
        paymentDetails: {
          source: 'MINES',
          gameId: String(game._id),
          walletField:
            stakeAllocations.length === 1 && stakePrimaryAllocation
              ? stakePrimaryAllocation.walletField
              : null,
          walletLabel:
            stakeAllocations.length === 1 && stakePrimaryAllocation
              ? stakePrimaryAllocation.walletLabel
              : stakeAllocations.map((allocation) => allocation.walletLabel).join(' + '),
          allocations: stakeAllocations,
        },
        remarks: `Mines bet: ${mineCount} mines`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.bonusService.recordWagering(
      userId,
      betAmount,
      'CASINO',
      bonusUsed > 0 ? 'fiatbonus' : 'main',
      bonusUsed,
    ).catch(() => {
      this.bonusService.emitWalletRefresh(userId);
    });

    return {
      gameId: String(game._id),
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      betAmount: game.betAmount,
      mineCount: game.mineCount,
      walletType: game.walletType,
      revealedTiles: [],
      multiplier: 1.0,
      status: 'ACTIVE',
    };
  }

  async revealTile(userId: number, dto: RevealTileDto) {
    const { gameId, tileIndex } = dto;

    const game = await this.minesGameModel.findById(gameId);
    if (!game) throw new NotFoundException('Game not found');
    if (game.userId !== userId) throw new ForbiddenException('Not your game');
    if (game.status !== 'ACTIVE') throw new BadRequestException(`Game is already ${game.status}`);
    if (tileIndex < 0 || tileIndex > 24) throw new BadRequestException('Invalid tile index');
    if (game.revealedTiles.includes(tileIndex)) throw new BadRequestException('Tile already revealed');

    const hitMine = game.minePositions.includes(tileIndex);

    if (hitMine) {
      game.status = 'LOST';
      game.revealedTiles = [...game.revealedTiles, tileIndex];
      game.payout = 0;
      await game.save();

      await this.prisma.transaction.create({
        data: {
          userId,
          amount: game.betAmount,
          type: 'BET_LOSS',
          status: 'COMPLETED',
          paymentDetails: {
            source: 'MINES',
            gameId: String(game._id),
          },
          remarks: `Mines loss: hit mine on tile ${tileIndex}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return {
        hit: true, gameId: String(game._id), status: 'LOST',
        minePositions: game.minePositions,
        serverSeed: game.serverSeed,
        revealedTiles: game.revealedTiles,
        payout: 0,
      };
    }

    const newRevealed = [...game.revealedTiles, tileIndex];
    const newMultiplier = calcMultiplier(game.mineCount, newRevealed.length);
    const potentialPayout = parseFloat((game.betAmount * newMultiplier).toFixed(2));

    game.revealedTiles = newRevealed;
    game.multiplier = newMultiplier;
    await game.save();

    return {
      hit: false, gameId: String(game._id), status: 'ACTIVE',
      tileIndex, revealedTiles: newRevealed, multiplier: newMultiplier, potentialPayout,
    };
  }

  async cashout(userId: number, dto: CashoutDto) {
    const { gameId } = dto;

    const game = await this.minesGameModel.findById(gameId);
    if (!game) throw new NotFoundException('Game not found');
    if (game.userId !== userId) throw new ForbiddenException('Not your game');
    if (game.status !== 'ACTIVE') throw new BadRequestException(`Game is already ${game.status}`);
    if (game.revealedTiles.length === 0) throw new BadRequestException('Reveal at least one tile before cashing out');

    const multiplier = calcMultiplier(game.mineCount, game.revealedTiles.length);
    const payout = parseFloat((game.betAmount * multiplier).toFixed(2));

    // Update game in MongoDB
    game.status = 'CASHEDOUT';
    game.multiplier = multiplier;
    game.payout = payout;
    await game.save();

    // Credit payout (Prisma — stays in PostgreSQL)
    const payoutAllocations = this.buildAllocations(
      game.walletType,
      game.bonusAmount || 0,
      game.betAmount,
      payout,
    );
    const payoutPrimaryAllocation = payoutAllocations[0];
    const payoutPaymentMethod =
      payoutAllocations.length === 1 && payoutPrimaryAllocation
        ? this.mapWalletFieldToPaymentMethod(payoutPrimaryAllocation.walletField)
        : 'MULTI_WALLET';

    await this.prisma.$transaction(async (tx) => {
      const updateData: Record<string, any> = {};
      for (const allocation of payoutAllocations) {
        updateData[allocation.walletField] = { increment: allocation.amount };
      }

      await tx.user.update({ where: { id: userId }, data: updateData });

      await tx.transaction.create({
        data: {
          userId,
          amount: payout,
          type: 'BET_CASHOUT',
          status: 'COMPLETED',
          paymentMethod: payoutPaymentMethod,
          paymentDetails: {
            source: 'MINES',
            gameId: String(game._id),
            walletField:
              payoutAllocations.length === 1 && payoutPrimaryAllocation
                ? payoutPrimaryAllocation.walletField
                : null,
            walletLabel:
              payoutAllocations.length === 1 && payoutPrimaryAllocation
                ? payoutPrimaryAllocation.walletLabel
                : payoutAllocations.map((allocation) => allocation.walletLabel).join(' + '),
            allocations: payoutAllocations,
          },
          remarks: `Mines cashout after ${game.revealedTiles.length} safe tiles`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    this.bonusService.emitWalletRefresh(userId);

    return {
      gameId: String(game._id),
      status: 'CASHEDOUT',
      multiplier,
      payout,
      potentialPayout: payout,
      betAmount: game.betAmount,
      minePositions: game.minePositions,
      serverSeed: game.serverSeed,
      clientSeed: game.clientSeed,
      revealedTiles: game.revealedTiles,
    };
  }

  async getActiveGame(userId: number) {
    const game = await this.minesGameModel.findOne({ userId, status: 'ACTIVE' });
    if (!game) return null;

    const multiplier = game.revealedTiles.length > 0
      ? calcMultiplier(game.mineCount, game.revealedTiles.length) : 1.0;

    return {
      gameId: String(game._id),
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      betAmount: game.betAmount,
      mineCount: game.mineCount,
      walletType: game.walletType,
      revealedTiles: game.revealedTiles,
      multiplier,
      potentialPayout: parseFloat((game.betAmount * multiplier).toFixed(2)),
      status: 'ACTIVE',
    };
  }

  async getHistory(userId: number) {
    const games = await this.minesGameModel
      .find({ userId, status: { $ne: 'ACTIVE' } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return games.map((g) => ({
      gameId: String(g._id),
      betAmount: g.betAmount,
      mineCount: g.mineCount,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      tilesRevealed: g.revealedTiles.length,
      walletType: g.walletType,
      currency: g.currency,
      createdAt: (g as any).createdAt,
    }));
  }
}
