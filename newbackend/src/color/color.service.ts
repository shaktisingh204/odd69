import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import {
  ColorGame,
  ColorGameDocument,
} from '../originals/schemas/color-game.schema';
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

/**
 * Wingo color rules:
 *   0       → red + violet  (rare)
 *   5       → green + violet (rare)
 *   1,3,7,9 → green
 *   2,4,6,8 → red
 *
 * Pay table (multipliers, including stake):
 *   green / red       → 2x  (raw P=0.5 → edge 4%)  ⇒ apply 2x – tweak via house edge below
 *   violet            → 4.5x (raw P=0.2 → edge 10% via 4.5 vs 5)
 *   number 0..9       → 9x  (raw P=0.1 → edge 10% via 9 vs 10)
 */

const HOUSE_EDGE = 0.04;

function colorsForNumber(n: number): string[] {
  if (n === 0) return ['red', 'violet'];
  if (n === 5) return ['green', 'violet'];
  if (n % 2 === 1) return ['green'];
  return ['red'];
}

export interface PlayColorDto {
  betAmount: number;
  pick: 'red' | 'green' | 'violet' | 'number';
  pickNumber?: number; // 0..9 when pick === 'number'
  clientSeed?: string;
  walletType?: WalletType;
  useBonus?: boolean;
}

@Injectable()
export class ColorService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(ColorGame.name)
    private readonly colorModel: Model<ColorGameDocument>,
    private readonly bonusService: BonusService,
  ) {}

  async play(userId: number, dto: PlayColorDto) {
    const {
      betAmount,
      pick,
      pickNumber,
      clientSeed = 'zeero',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    if (!(betAmount > 0)) throw new BadRequestException('Bet must be positive');
    if (!['red', 'green', 'violet', 'number'].includes(pick))
      throw new BadRequestException('Invalid pick');
    if (pick === 'number') {
      if (
        pickNumber === undefined ||
        !Number.isInteger(pickNumber) ||
        pickNumber < 0 ||
        pickNumber > 9
      )
        throw new BadRequestException('pickNumber must be 0..9');
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
    const digest = hmacHex(serverSeed, clientSeed, nonce, 'color');
    const result = rollInt(digest, 10); // 0..9
    const resultColors = colorsForNumber(result);

    let multiplier = 0;
    if (pick === 'number') {
      multiplier = result === pickNumber ? parseFloat((9 * (1 - HOUSE_EDGE)).toFixed(4)) : 0;
    } else if (pick === 'violet') {
      multiplier = resultColors.includes('violet')
        ? parseFloat((4.5 * (1 - HOUSE_EDGE)).toFixed(4))
        : 0;
    } else {
      // red or green
      multiplier = resultColors.includes(pick) ? parseFloat((2 * (1 - HOUSE_EDGE)).toFixed(4)) : 0;
    }

    const payout = parseFloat((betAmount * multiplier).toFixed(2));
    const status = payout > 0 ? 'WON' : 'LOST';

    const game = await this.colorModel.create({
      userId,
      betAmount,
      pick,
      pickNumber: pick === 'number' ? pickNumber : undefined,
      result,
      resultColors,
      multiplier,
      payout,
      status,
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
      'COLOR',
      String(game._id),
      `Color bet: ${pick}${pick === 'number' ? ` ${pickNumber}` : ''}`,
    );
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      'COLOR',
      String(game._id),
      `Color win: ${result} (${resultColors.join('+')})`,
      `Color loss: ${result} (${resultColors.join('+')})`,
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

    return {
      gameId: String(game._id),
      pick,
      pickNumber,
      result,
      resultColors,
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
    const games = await this.colorModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return games.map((g: any) => ({
      gameId: String(g._id),
      pick: g.pick,
      pickNumber: g.pickNumber,
      result: g.result,
      resultColors: g.resultColors,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      createdAt: g.createdAt,
    }));
  }
}
