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
import { WheelGame, WheelGameDocument } from '../schemas/wheel-game.schema';
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

const GAME_KEY = 'wheel';
const GAME_SOURCE = 'WHEEL';
const DEFAULT_MAX_BET = 25000;
const TARGET_RTP = 0.952; // 95.2% RTP — house edge lives ONLY here in the payout math

type Risk = 'low' | 'medium' | 'high';

const VALID_RISKS: Risk[] = ['low', 'medium', 'high'];
const VALID_SEGMENTS = [10, 20, 30, 40, 50];
const DEFAULT_RISK: Risk = 'medium';
const DEFAULT_SEGMENTS = 30;

export interface PlayWheelDto {
  betAmount: number;
  risk?: Risk | string;
  segments?: number;
  clientSeed?: string;
  walletType?: 'fiat' | 'crypto';
  useBonus?: boolean;
}

@Injectable()
export class WheelService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(WheelGame.name)
    private readonly model: Model<WheelGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
  ) {}

  /** Memoized wheels keyed by `${risk}:${segments}`. */
  private readonly wheelCache = new Map<string, number[]>();

  private normalizeRisk(risk?: Risk | string): Risk {
    return VALID_RISKS.includes(risk as Risk) ? (risk as Risk) : DEFAULT_RISK;
  }

  private normalizeSegments(segments?: number): number {
    const s = Number(segments);
    return VALID_SEGMENTS.includes(s) ? s : DEFAULT_SEGMENTS;
  }

  /**
   * Build (and memoize) the payout wheel for a given risk + segment count.
   * Raw weights are scaled so mean(wheel) === TARGET_RTP → RTP exactly 95.2%.
   */
  private buildWheel(risk: Risk, segments: number): number[] {
    const cacheKey = `${risk}:${segments}`;
    const cached = this.wheelCache.get(cacheKey);
    if (cached) return cached;

    const raw: number[] = new Array(segments).fill(0);

    if (risk === 'low') {
      for (let i = 0; i < segments; i++) {
        raw[i] = i % 5 === 4 ? 0 : i % 2 === 0 ? 1.5 : 1.2;
      }
    } else if (risk === 'medium') {
      for (let i = 0; i < segments; i++) {
        raw[i] = i % 2 === 1 ? 1.7 : 0;
      }
      raw[segments - 1] = Math.max(2, segments / 8);
    } else {
      // high
      raw.fill(0);
      raw[segments - 1] = 1;
    }

    const sum = raw.reduce((a, b) => a + b, 0);
    const k = sum > 0 ? (segments * TARGET_RTP) / sum : 0;
    const wheel = raw.map((v) => (v === 0 ? 0 : roundCurrency(v * k)));

    this.wheelCache.set(cacheKey, wheel);
    return wheel;
  }

  /**
   * Public, no-auth preview of a wheel layout (used by the frontend to render
   * the segments before the player spins). Returns the full wheel + the sorted
   * set of unique multipliers.
   */
  preview(risk?: Risk | string, segments?: number) {
    const r = this.normalizeRisk(risk);
    const s = this.normalizeSegments(segments);
    const wheel = this.buildWheel(r, s);
    return {
      risk: r,
      segments: s,
      wheel,
      uniqueMultipliers: [...new Set(wheel)].sort((a, b) => a - b),
    };
  }

  async play(userId: number, dto: PlayWheelDto) {
    const {
      betAmount,
      clientSeed = 'odd69',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    // 1. Validate inputs
    if (!betAmount || betAmount <= 0) {
      throw new BadRequestException('Bet amount must be positive');
    }
    if (dto.risk !== undefined && !VALID_RISKS.includes(dto.risk as Risk)) {
      throw new BadRequestException('Risk must be low, medium or high');
    }
    if (
      dto.segments !== undefined &&
      !VALID_SEGMENTS.includes(Number(dto.segments))
    ) {
      throw new BadRequestException('Segments must be one of 10, 20, 30, 40, 50');
    }
    const risk = this.normalizeRisk(dto.risk);
    const segments = this.normalizeSegments(dto.segments);

    // 2. Enforce game config
    const config = await this.ggrService.getConfig(GAME_KEY);
    if (config && !config.isActive) {
      throw new BadRequestException('Game is currently unavailable');
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

    // 4. Atomic stake deduction
    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user,
      betAmount,
      walletType,
      useBonus,
    );

    // 5. Provably-fair outcome
    const { serverSeed, serverSeedHash } = generateServerSeed();
    const nonce = Date.now();
    const wheel = this.buildWheel(risk, segments);
    const digest = hmacHex(
      serverSeed,
      clientSeed,
      nonce,
      `wheel:${risk}:${segments}`,
    );
    const slot = rollInt(digest, segments);

    // 6. Multiplier + payout (capped at maxWin if configured)
    const multiplier = wheel[slot];
    let payout = roundCurrency(betAmount * multiplier);
    if (config?.maxWin && payout > config.maxWin) {
      payout = roundCurrency(config.maxWin);
    }
    const status = multiplier > 0 ? 'WON' : 'LOST';

    // 7. Persist game doc (MongoDB)
    const game = await this.model.create({
      userId,
      betAmount,
      risk,
      segments,
      slot,
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

    // 8. Log the stake (BET_PLACE)
    await logStakeTransaction(
      this.prisma,
      userId,
      betAmount,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      String(game._id),
      `Wheel bet: ${risk} ${segments} segments`,
    );

    // 9. Settle payout (BET_WIN / BET_LOSS)
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      String(game._id),
      `Wheel win: ×${multiplier} on slot ${slot}`,
      `Wheel loss: slot ${slot}`,
    );

    // 10. GGR snapshot
    await this.ggrService
      .updateSnapshot(GAME_KEY, 0, 0, status === 'WON')
      .catch(() => undefined);

    // 11. Record wagering progress
    await this.bonusService
      .recordWagering(
        userId,
        betAmount,
        'CASINO',
        bonusUsed > 0 ? 'fiatbonus' : 'main',
        bonusUsed,
      )
      .catch(() => this.bonusService.emitWalletRefresh(userId));

    // 12. Result (every field the frontend reads)
    return {
      gameId: String(game._id),
      risk,
      slot,
      segments,
      multiplier,
      payout,
      status,
      betAmount,
      wheelMultipliers: wheel,
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
      risk: g.risk,
      slot: g.slot,
      segments: g.segments,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      walletType: g.walletType,
      currency: g.currency,
      createdAt: g.createdAt,
    }));
  }
}
