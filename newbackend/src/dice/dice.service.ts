import {
  Injectable, BadRequestException, NotFoundException,
  Inject, forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import { DiceGame, DiceGameDocument } from '../originals/schemas/dice-game.schema';
import { GGRService } from '../originals/ggr.service';
import * as crypto from 'crypto';
import { BonusService } from '../bonus/bonus.service';
import { FairnessService } from '../originals/fairness.service';

const DEFAULT_HOUSE_EDGE = 1; // 1% house edge
const GAME_KEY = 'dice';
const DEFAULT_MIN_BET = 10;
const DEFAULT_MAX_BET = 25000;

/**
 * Provably-fair roll:  HMAC-SHA256(serverSeed:clientSeed:nonce)
 * → take first 8 hex chars → parseInt base 16 → mod 10000 → divide by 100
 * Result range: 0.00 – 99.99
 */
function generateRoll(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = crypto.createHmac('sha256', `${serverSeed}:${clientSeed}:${nonce}`).digest('hex');
  const raw = parseInt(hmac.slice(0, 8), 16) % 10000;
  return raw / 100; // 0.00 – 99.99
}

function calcMultiplier(winChance: number, houseEdge = DEFAULT_HOUSE_EDGE): number {
  if (winChance <= 0 || winChance >= 100) return 0;
  return parseFloat(((100 - houseEdge) / winChance).toFixed(4));
}

function calcWinChance(target: number, direction: 'over' | 'under'): number {
  // "over" means roll > target  →  winChance = 99.99 - target  (convert to %)
  // "under" means roll < target →  winChance = target
  if (direction === 'over') return parseFloat((99.99 - target).toFixed(2));
  return parseFloat(target.toFixed(2));
}

export interface PlayDiceDto {
  betAmount: number;
  target: number;
  direction: 'over' | 'under';
  clientSeed?: string;
  walletType?: 'fiat' | 'crypto';
  useBonus?: boolean;
}

type DiceWalletField = 'balance' | 'cryptoBalance' | 'casinoBonus';
type DiceAllocation = {
  walletField: DiceWalletField;
  walletLabel: string;
  amount: number;
};

@Injectable()
export class DiceService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(DiceGame.name)
    private readonly diceGameModel: Model<DiceGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
    @Inject(forwardRef(() => FairnessService))
    private readonly fairness: FairnessService,
  ) {}

  private roundCurrency(value: number) {
    return parseFloat(Number(value || 0).toFixed(2));
  }

  private getWalletFieldLabel(walletField: DiceWalletField) {
    if (walletField === 'casinoBonus') return 'Casino Bonus Wallet';
    return walletField === 'cryptoBalance' ? 'Crypto Wallet' : 'Main Wallet';
  }

  private getPrimaryWalletField(walletType: 'fiat' | 'crypto' | string): DiceWalletField {
    return walletType === 'crypto' ? 'cryptoBalance' : 'balance';
  }

  private mapWalletFieldToPaymentMethod(walletField: DiceWalletField) {
    if (walletField === 'casinoBonus') return 'BONUS_WALLET';
    return walletField === 'cryptoBalance' ? 'CRYPTO_WALLET' : 'MAIN_WALLET';
  }

  private buildAllocations(
    walletType: 'fiat' | 'crypto' | string,
    bonusAmount: number,
    betAmount: number,
    amount: number,
  ): DiceAllocation[] {
    const normalizedAmount = this.roundCurrency(amount);
    if (normalizedAmount <= 0) return [];

    const primaryWalletField = this.getPrimaryWalletField(walletType);
    if (walletType === 'crypto') {
      const allocations: DiceAllocation[] = [{
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
      const allocations: DiceAllocation[] = [{
        walletField: primaryWalletField,
        walletLabel: this.getWalletFieldLabel(primaryWalletField),
        amount: normalizedAmount,
      }];
      return allocations;
    }

    if (mainStakeAmount <= 0) {
      const allocations: DiceAllocation[] = [{
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

    const allocations: DiceAllocation[] = [
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

  async playDice(userId: number, dto: PlayDiceDto) {
    const {
      betAmount,
      target,
      direction,
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    // Validation
    if (!target || target < 1 || target > 98) throw new BadRequestException('Target must be 1–98');
    if (!['over', 'under'].includes(direction)) throw new BadRequestException('Direction must be "over" or "under"');
    if (betAmount <= 0) throw new BadRequestException('Bet must be positive');

    const winChance = calcWinChance(target, direction);
    if (winChance <= 0 || winChance >= 100) throw new BadRequestException('Invalid win chance');
    const mult = calcMultiplier(winChance);

    // GGR config gating (active / maintenance / min-max bet)
    const config = await this.ggrService.getConfig(GAME_KEY).catch(() => null);
    if (config && !config.isActive) {
      throw new BadRequestException('Dice is currently unavailable');
    }
    if (config?.maintenanceMode) {
      throw new BadRequestException(config.maintenanceMessage || 'Under maintenance');
    }
    if (betAmount < (config?.minBet ?? DEFAULT_MIN_BET)) {
      throw new BadRequestException(`Minimum bet is ${config?.minBet ?? DEFAULT_MIN_BET}`);
    }
    if (betAmount > (config?.maxBet ?? DEFAULT_MAX_BET)) {
      throw new BadRequestException(`Maximum bet is ${config?.maxBet ?? DEFAULT_MAX_BET}`);
    }

    // Get user
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Deduct balance (Prisma — atomic)
    let bonusUsed = 0;
    let actualBet = betAmount;

    await this.prisma.$transaction(async (tx) => {
      if (walletType === 'crypto') {
        const r = await tx.user.updateMany({
          where: { id: userId, cryptoBalance: { gte: betAmount } },
          data: { cryptoBalance: { decrement: betAmount } },
        });
        if (!r.count) throw new BadRequestException('Insufficient crypto balance');
      } else if (useBonus && user.casinoBonus > 0) {
        bonusUsed = Math.min(user.casinoBonus, betAmount);
        actualBet = Math.max(0, betAmount - bonusUsed);
        const r = await tx.user.updateMany({
          where: {
            id: userId,
            casinoBonus: { gte: bonusUsed },
            balance: { gte: actualBet },
          },
          data: {
            balance: { decrement: actualBet },
            casinoBonus: { decrement: bonusUsed },
          },
        });
        if (!r.count) throw new BadRequestException('Insufficient balance');
      } else {
        const r = await tx.user.updateMany({
          where: { id: userId, balance: { gte: betAmount } },
          data: { balance: { decrement: betAmount } },
        });
        if (!r.count) throw new BadRequestException('Insufficient balance');
      }
    });

    // Provably-fair roll from the user's persistent seed pair (atomic nonce)
    const { serverSeed, serverSeedHash, clientSeed, nonce } =
      await this.fairness.consume(userId);
    const roll = generateRoll(serverSeed, clientSeed, nonce);

    // Determine win/loss
    const won = direction === 'over' ? roll > target : roll < target;
    let payout = won ? parseFloat((betAmount * mult).toFixed(2)) : 0;
    if (config?.maxWin && payout > config.maxWin) payout = this.roundCurrency(config.maxWin);
    const status = won ? 'WON' : 'LOST';

    // Save game (MongoDB)
    const game = await this.diceGameModel.create({
      userId, betAmount, target, direction, roll, multiplier: mult,
      payout, status, winChance,
      serverSeed, clientSeed, serverSeedHash, nonce,
      walletType, usedBonus: bonusUsed > 0, bonusAmount: bonusUsed,
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
          source: 'DICE',
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
        remarks: `Dice bet: ${direction} ${target}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Credit payout if won (Prisma — atomic)
    const payoutAllocations = won
      ? this.buildAllocations(walletType, bonusUsed, betAmount, payout)
      : [];
    const payoutPrimaryAllocation = payoutAllocations[0];
    const payoutPaymentMethod =
      payoutAllocations.length === 1 && payoutPrimaryAllocation
        ? this.mapWalletFieldToPaymentMethod(payoutPrimaryAllocation.walletField)
        : 'MULTI_WALLET';

    await this.prisma.$transaction(async (tx) => {
      if (won) {
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
              source: 'DICE',
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
            remarks: `Dice win: ${direction} ${target}`,
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
            source: 'DICE',
            gameId: String(game._id),
          },
          remarks: `Dice loss: ${direction} ${target}`,
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
      roll, target, direction, multiplier: mult, winChance,
      payout, status, betAmount,
      serverSeedHash, clientSeed, nonce,
    };
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.diceGameModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return games.map((g: any) => ({
      gameId: String(g._id),
      roll: g.roll, target: g.target, direction: g.direction,
      multiplier: g.multiplier, winChance: g.winChance,
      payout: g.payout, status: g.status, betAmount: g.betAmount,
      createdAt: g.createdAt,
    }));
  }
}
