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
import {
  CoinflipGame,
  CoinflipGameDocument,
} from '../schemas/coinflip-game.schema';
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

/** RTP 98% / 2% house edge: a fair coin pays 2.0, we pay 1.96. */
const COINFLIP_MULT = 1.96;
const DEFAULT_MAX_BET = 20000;

export interface PlayCoinflipDto {
  betAmount: number;
  pick: 'heads' | 'tails';
  walletType?: 'fiat' | 'crypto';
  useBonus?: boolean;
  clientSeed?: string;
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
  ) {}

  async play(userId: number, dto: PlayCoinflipDto) {
    const {
      betAmount,
      pick,
      walletType = 'fiat',
      useBonus = false,
      clientSeed = 'odd69',
    } = dto;

    // 1. validate inputs
    if (!betAmount || betAmount <= 0) {
      throw new BadRequestException('Bet amount must be positive');
    }
    if (pick !== 'heads' && pick !== 'tails') {
      throw new BadRequestException('Pick must be "heads" or "tails"');
    }

    // 2. enforce GGR config (active / maintenance / bet limits)
    const config = await this.ggrService.getConfig('coinflip');
    if (config && !config.isActive) {
      throw new BadRequestException('Coinflip is currently unavailable');
    }
    if (config?.maintenanceMode) {
      throw new BadRequestException(
        config.maintenanceMessage || 'Under maintenance',
      );
    }
    if (betAmount < (config?.minBet ?? 10)) {
      throw new BadRequestException(
        `Minimum bet is ${config?.minBet ?? 10}`,
      );
    }
    if (betAmount > (config?.maxBet ?? DEFAULT_MAX_BET)) {
      throw new BadRequestException(
        `Maximum bet is ${config?.maxBet ?? DEFAULT_MAX_BET}`,
      );
    }

    // 3. load user
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 4. atomic stake debit
    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user,
      betAmount,
      walletType,
      useBonus,
    );

    // 5. provably-fair outcome
    const { serverSeed, serverSeedHash } = generateServerSeed();
    const nonce = Date.now();
    const digest = hmacHex(serverSeed, clientSeed, nonce);
    const r = rollInt(digest, 2);
    const result: 'heads' | 'tails' = r === 0 ? 'heads' : 'tails';
    const won = pick === result;

    // 6. multiplier + payout (cap at maxWin if configured)
    const multiplier = COINFLIP_MULT;
    let payout = won ? roundCurrency(betAmount * multiplier) : 0;
    if (won && config?.maxWin && payout > config.maxWin) {
      payout = config.maxWin;
    }
    const status: 'WON' | 'LOST' = won ? 'WON' : 'LOST';

    // 7. persist the round
    const game = await this.model.create({
      userId,
      betAmount,
      pick,
      result,
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

    // 8. BET_PLACE log
    await logStakeTransaction(
      this.prisma,
      userId,
      betAmount,
      walletType,
      bonusUsed,
      'COINFLIP',
      String(game._id),
      `Coinflip bet: ${pick}`,
    );

    // 9. settle payout (credit + BET_WIN, or BET_LOSS when payout=0)
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      'COINFLIP',
      String(game._id),
      `Coinflip win: ${result}`,
      `Coinflip loss: ${result}`,
    );

    // 10. GGR snapshot
    await this.ggrService
      .updateSnapshot('coinflip', 0, 0, status === 'WON')
      .catch(() => undefined);

    // 11. wagering progress
    await this.bonusService
      .recordWagering(
        userId,
        betAmount,
        'CASINO',
        bonusUsed > 0 ? 'fiatbonus' : 'main',
        bonusUsed,
      )
      .catch(() => this.bonusService.emitWalletRefresh(userId));

    // 12. result (every field the frontend reads)
    return {
      gameId: String(game._id),
      pick,
      result,
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
    const games = await this.model
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return games.map((g: any) => ({
      gameId: String(g._id),
      pick: g.pick,
      result: g.result,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      createdAt: g.createdAt,
    }));
  }
}
