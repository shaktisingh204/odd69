import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { BonusService } from '../bonus/bonus.service';
import { PlinkoGame, PlinkoGameDocument } from '../originals/schemas/plinko-game.schema';

export type PlinkoRisk = 'low' | 'medium' | 'high';
export type PlinkoRows = 8 | 12 | 16;

type PlinkoWalletField = 'balance' | 'cryptoBalance' | 'casinoBonus';
type PlinkoAllocation = {
  walletField: PlinkoWalletField;
  walletLabel: string;
  amount: number;
};

export const PLINKO_MULTIPLIERS: Record<PlinkoRows, Record<PlinkoRisk, number[]>> = {
  8: {
    low:    [5.6, 2.0, 1.1, 1.0, 0.4, 1.0, 1.1, 2.0, 5.6],
    medium: [13, 3.0, 1.3, 0.7, 0.3, 0.7, 1.3, 3.0, 13],
    high:   [29, 4.0, 1.5, 0.3, 0.1, 0.3, 1.5, 4.0, 29],
  },
  12: {
    low:    [9.0, 2.9, 1.6, 1.3, 1.1, 0.9, 0.6, 0.9, 1.1, 1.3, 1.6, 2.9, 9.0],
    medium: [20, 6.0, 3.0, 1.8, 1.2, 0.7, 0.3, 0.7, 1.2, 1.8, 3.0, 6.0, 20],
    high:   [45, 11, 4.0, 2.5, 1.0, 0.5, 0.2, 0.5, 1.0, 2.5, 4.0, 11, 45],
  },
  16: {
    low:    [12, 6.0, 3.0, 1.8, 1.4, 1.1, 1.0, 0.9, 0.7, 0.9, 1.0, 1.1, 1.4, 1.8, 3.0, 6.0, 12],
    medium: [18, 8.0, 4.0, 2.2, 1.6, 1.4, 1.1, 0.8, 0.45, 0.8, 1.1, 1.4, 1.6, 2.2, 4.0, 8.0, 18],
    high:   [1000, 162, 38, 9, 3, 1.5, 0.5, 0.2, 0.1, 0.2, 0.5, 1.5, 3, 9, 38, 162, 1000],
  },
};

function isValidRows(rows: number): rows is PlinkoRows {
  return rows === 8 || rows === 12 || rows === 16;
}

function isValidRisk(risk: string): risk is PlinkoRisk {
  return risk === 'low' || risk === 'medium' || risk === 'high';
}

function generatePath(serverSeed: string, clientSeed: string, nonce: number, rows: PlinkoRows): number[] {
  const digest = crypto
    .createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}:plinko`)
    .digest('hex');

  const bits = digest
    .split('')
    .flatMap((char) => parseInt(char, 16).toString(2).padStart(4, '0').split('').map(Number));

  return bits.slice(0, rows);
}

@Injectable()
export class PlinkoService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(PlinkoGame.name)
    private readonly plinkoGameModel: Model<PlinkoGameDocument>,
    @Inject(forwardRef(() => BonusService))
    private readonly bonusService: BonusService,
  ) {}

  private roundCurrency(value: number) {
    return parseFloat(Number(value || 0).toFixed(2));
  }

  private getWalletFieldLabel(walletField: PlinkoWalletField) {
    if (walletField === 'casinoBonus') return 'Casino Bonus Wallet';
    return walletField === 'cryptoBalance' ? 'Crypto Wallet' : 'Main Wallet';
  }

  private getPrimaryWalletField(walletType: 'fiat' | 'crypto' | string): PlinkoWalletField {
    return walletType === 'crypto' ? 'cryptoBalance' : 'balance';
  }

  private mapWalletFieldToPaymentMethod(walletField: PlinkoWalletField) {
    if (walletField === 'casinoBonus') return 'BONUS_WALLET';
    return walletField === 'cryptoBalance' ? 'CRYPTO_WALLET' : 'MAIN_WALLET';
  }

  private buildAllocations(
    walletType: 'fiat' | 'crypto' | string,
    bonusAmount: number,
    betAmount: number,
    amount: number,
  ): PlinkoAllocation[] {
    const normalizedAmount = this.roundCurrency(amount);
    if (normalizedAmount <= 0) return [];

    const primaryWalletField = this.getPrimaryWalletField(walletType);
    if (walletType === 'crypto') {
      return [{
        walletField: 'cryptoBalance',
        walletLabel: this.getWalletFieldLabel('cryptoBalance'),
        amount: normalizedAmount,
      }];
    }

    const normalizedBetAmount = this.roundCurrency(betAmount);
    const normalizedBonusAmount = this.roundCurrency(
      Math.min(normalizedBetAmount, Math.max(0, bonusAmount)),
    );
    const mainStakeAmount = this.roundCurrency(
      Math.max(0, normalizedBetAmount - normalizedBonusAmount),
    );

    if (normalizedBonusAmount <= 0 || normalizedBetAmount <= 0) {
      return [{
        walletField: primaryWalletField,
        walletLabel: this.getWalletFieldLabel(primaryWalletField),
        amount: normalizedAmount,
      }];
    }

    if (mainStakeAmount <= 0) {
      return [{
        walletField: 'casinoBonus',
        walletLabel: this.getWalletFieldLabel('casinoBonus'),
        amount: normalizedAmount,
      }];
    }

    const bonusPayout = this.roundCurrency(
      (normalizedAmount * normalizedBonusAmount) / normalizedBetAmount,
    );
    const mainPayout = this.roundCurrency(normalizedAmount - bonusPayout);

    const allocations: PlinkoAllocation[] = [
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

  async playPlinko(
    userId: number,
    dto: {
      betAmount: number;
      rows: number;
      risk: string;
      clientSeed?: string;
      walletType?: 'fiat' | 'crypto';
      useBonus?: boolean;
    },
  ) {
    const {
      betAmount,
      rows,
      risk,
      clientSeed = 'zeero-plinko',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    if (!isValidRows(rows)) {
      throw new BadRequestException('Rows must be 8, 12, or 16');
    }
    if (!isValidRisk(risk)) {
      throw new BadRequestException('Risk must be low, medium, or high');
    }
    if (betAmount <= 0) {
      throw new BadRequestException('Bet must be positive');
    }

    const table = PLINKO_MULTIPLIERS[rows][risk];
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let bonusUsed = 0;

    await this.prisma.$transaction(async (tx) => {
      if (walletType === 'crypto') {
        if (user.cryptoBalance < betAmount) {
          throw new BadRequestException('Insufficient crypto balance');
        }
        await tx.user.update({
          where: { id: userId },
          data: { cryptoBalance: { decrement: betAmount } },
        });
        return;
      }

      if (useBonus && user.casinoBonus > 0) {
        bonusUsed = Math.min(user.casinoBonus, betAmount);
        const actualBet = Math.max(0, betAmount - bonusUsed);
        if (user.balance < actualBet) {
          throw new BadRequestException('Insufficient balance');
        }
        await tx.user.update({
          where: { id: userId },
          data: {
            balance: { decrement: actualBet },
            casinoBonus: { decrement: bonusUsed },
          },
        });
        return;
      }

      if (user.balance < betAmount) {
        throw new BadRequestException('Insufficient balance');
      }
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: betAmount } },
      });
    });

    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const nonce = Date.now();
    const path = generatePath(serverSeed, clientSeed, nonce, rows);
    const slotIndex = path.reduce((sum, step) => sum + step, 0);
    const multiplier = table[slotIndex];
    const payout = this.roundCurrency(betAmount * multiplier);
    const status = multiplier >= 1 ? 'WON' : 'LOST';

    const game = await this.plinkoGameModel.create({
      userId,
      betAmount,
      rows,
      risk,
      path,
      slotIndex,
      multiplier,
      payout,
      status,
      serverSeed,
      clientSeed,
      serverSeedHash,
      walletType,
      usedBonus: bonusUsed > 0,
      bonusAmount: bonusUsed,
      currency: walletType === 'crypto' ? 'USD' : user.currency || 'INR',
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
          source: 'PLINKO',
          gameId: String(game._id),
          rows,
          risk,
          allocations: stakeAllocations,
        },
        remarks: `Plinko bet: ${rows} rows / ${risk}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const payoutAllocations = this.buildAllocations(
      walletType,
      bonusUsed,
      betAmount,
      payout,
    );
    const payoutPrimaryAllocation = payoutAllocations[0];
    const payoutPaymentMethod =
      payoutAllocations.length === 1 && payoutPrimaryAllocation
        ? this.mapWalletFieldToPaymentMethod(payoutPrimaryAllocation.walletField)
        : 'MULTI_WALLET';

    await this.prisma.$transaction(async (tx) => {
      if (payout > 0) {
        const updateData: Record<string, any> = {};
        for (const allocation of payoutAllocations) {
          updateData[allocation.walletField] = { increment: allocation.amount };
        }

        await tx.user.update({
          where: { id: userId },
          data: updateData,
        });

        await tx.transaction.create({
          data: {
            userId,
            amount: payout,
            type: 'BET_WIN',
            status: 'COMPLETED',
            paymentMethod: payoutPaymentMethod,
            paymentDetails: {
              source: 'PLINKO',
              gameId: String(game._id),
              rows,
              risk,
              allocations: payoutAllocations,
            },
            remarks: `Plinko payout: ${multiplier}x on ${rows} rows / ${risk}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        return;
      }

      await tx.transaction.create({
        data: {
          userId,
          amount: betAmount,
          type: 'BET_LOSS',
          status: 'COMPLETED',
          paymentDetails: {
            source: 'PLINKO',
            gameId: String(game._id),
            rows,
            risk,
          },
          remarks: `Plinko loss: ${rows} rows / ${risk}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
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
      rows,
      risk,
      path,
      slotIndex,
      multiplier,
      payout,
      status,
      betAmount,
      serverSeed,
      serverSeedHash,
      clientSeed,
    };
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.plinkoGameModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return games.map((game: any) => ({
      gameId: String(game._id),
      rows: game.rows,
      risk: game.risk,
      path: game.path,
      slotIndex: game.slotIndex,
      multiplier: game.multiplier,
      payout: game.payout,
      status: game.status,
      betAmount: game.betAmount,
      createdAt: game.createdAt,
    }));
  }
}
