import {
  Injectable, BadRequestException, ForbiddenException,
  NotFoundException, Inject, forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma.service';
import { TowersGame, TowersGameDocument } from '../schemas/towers-game.schema';
import { GGRService } from '../ggr.service';
import { BonusService } from '../../bonus/bonus.service';
import { FairnessService } from '../fairness.service';
import {
  generateServerSeed,
  shuffle,
  roundCurrency,
  deductStake,
  logStakeTransaction,
  settlePayout,
} from '../originals-helpers';

const TOTAL_FLOORS = 8;
const HOUSE_RTP = 0.96; // 4% house edge, lives ONLY here in the payout math
const DEFAULT_MAX_BET = 20000;
const GAME_KEY = 'towers';
const GAME_SOURCE = 'TOWERS';

interface DifficultyConfig {
  tilesPerFloor: number;
  safePerFloor: number;
}

const DIFFICULTIES: Record<string, DifficultyConfig> = {
  easy: { tilesPerFloor: 4, safePerFloor: 3 },
  medium: { tilesPerFloor: 3, safePerFloor: 2 },
  hard: { tilesPerFloor: 3, safePerFloor: 1 },
  expert: { tilesPerFloor: 2, safePerFloor: 1 },
};

interface StartTowersDto {
  betAmount: number;
  difficulty?: string;
  walletType?: 'fiat' | 'crypto';
  useBonus?: boolean;
  clientSeed?: string;
}

interface PickTowersDto {
  gameId: string;
  tile: number;
}

interface CashoutTowersDto {
  gameId: string;
}

function roundTo4(value: number): number {
  return parseFloat(value.toFixed(4));
}

/**
 * Multiplier for a given climbed floor count.
 * floor 0 → 1 (no climb). For f >= 1:
 *   mult(f) = roundTo4( (1/probSafe)^f * 0.96 )  where probSafe = safePerFloor/tilesPerFloor.
 */
function multForFloor(floor: number, tilesPerFloor: number, safePerFloor: number): number {
  if (floor <= 0) return 1;
  const probSafe = safePerFloor / tilesPerFloor;
  return roundTo4(Math.pow(1 / probSafe, floor) * HOUSE_RTP);
}

@Injectable()
export class TowersService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(TowersGame.name)
    private readonly model: Model<TowersGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
    @Inject(forwardRef(() => FairnessService))
    private readonly fairness: FairnessService,
  ) {}

  async start(userId: number, dto: StartTowersDto) {
    const {
      betAmount,
      difficulty = 'medium',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    // 1. Validate inputs
    if (!betAmount || betAmount <= 0) {
      throw new BadRequestException('Bet amount must be positive');
    }
    const diffConfig = DIFFICULTIES[difficulty];
    if (!diffConfig) {
      throw new BadRequestException('Invalid difficulty');
    }
    const { tilesPerFloor, safePerFloor } = diffConfig;

    // 2. Config / maintenance / bet-limit enforcement
    const config = await this.ggrService.getConfig(GAME_KEY);
    if (config && !config.isActive) {
      throw new BadRequestException('Game is currently disabled');
    }
    if (config?.maintenanceMode) {
      throw new BadRequestException(config.maintenanceMessage || 'Under maintenance');
    }
    if (betAmount < (config?.minBet ?? 10)) {
      throw new BadRequestException(`Minimum bet is ${config?.minBet ?? 10}`);
    }
    if (betAmount > (config?.maxBet ?? DEFAULT_MAX_BET)) {
      throw new BadRequestException(`Maximum bet is ${config?.maxBet ?? DEFAULT_MAX_BET}`);
    }

    // 3. Reject if user already has an ACTIVE game
    const existing = await this.model.findOne({ userId, status: 'ACTIVE' });
    if (existing) {
      throw new BadRequestException('You already have an active game. Finish it first.');
    }

    // User (Prisma)
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 4. Deduct stake (atomic)
    const { bonusUsed } = await deductStake(
      this.prisma, userId, user, betAmount, walletType, useBonus,
    );

    // 5. Pre-generate the full provably-fair layout (server seed per game-instance)
    const { serverSeed, serverSeedHash, clientSeed, nonce } =
      await this.fairness.consume(userId);
    const trapsPerFloor = tilesPerFloor - safePerFloor;
    const floorTraps: number[][] = [];
    for (let fl = 0; fl < TOTAL_FLOORS; fl++) {
      const tiles = Array.from({ length: tilesPerFloor }, (_, i) => i);
      const shuffled = shuffle(tiles, serverSeed, clientSeed, nonce + fl);
      const traps = shuffled.slice(0, trapsPerFloor).sort((a, b) => a - b);
      floorTraps.push(traps);
    }

    // 6. Persist ACTIVE doc
    const game = await this.model.create({
      userId,
      betAmount,
      difficulty,
      tilesPerFloor,
      safePerFloor,
      totalFloors: TOTAL_FLOORS,
      floorTraps,
      picks: [],
      currentFloor: 0,
      multiplier: 1,
      status: 'ACTIVE',
      payout: 0,
      serverSeed,
      clientSeed,
      serverSeedHash,
      nonce,
      walletType,
      usedBonus: bonusUsed > 0,
      bonusAmount: bonusUsed,
      currency: walletType === 'crypto' ? 'USD' : user.currency || 'INR',
    });

    // 7. Log stake + record wagering at START
    await logStakeTransaction(
      this.prisma, userId, betAmount, walletType, bonusUsed,
      GAME_SOURCE, String(game._id), `Towers bet: ${difficulty}`,
    );

    await this.bonusService.recordWagering(
      userId, betAmount, 'CASINO', bonusUsed > 0 ? 'fiatbonus' : 'main', bonusUsed,
    ).catch(() => this.bonusService.emitWalletRefresh(userId));

    return this.buildState(game, {
      revealLayout: false,
      nextMultiplier: multForFloor(1, tilesPerFloor, safePerFloor),
    });
  }

  async pick(userId: number, dto: PickTowersDto) {
    const { gameId, tile } = dto;

    const game = await this.model.findById(gameId);
    if (!game) throw new NotFoundException('Game not found');
    if (game.userId !== userId) throw new ForbiddenException('Not your game');
    if (game.status !== 'ACTIVE') {
      throw new BadRequestException(`Game is already ${game.status}`);
    }
    if (tile < 0 || tile >= game.tilesPerFloor || !Number.isInteger(tile)) {
      throw new BadRequestException('Invalid tile');
    }

    const isTrap = game.floorTraps[game.currentFloor].includes(tile);
    const picks = [...game.picks, tile];
    game.picks = picks;

    if (isTrap) {
      // Loss — settle 0, terminal state, reveal layout.
      // Atomic claim: only one writer may flip ACTIVE → LOST.
      const claimed = await this.model.findOneAndUpdate(
        { _id: gameId, userId, status: 'ACTIVE' },
        { $set: { status: 'LOST', payout: 0, picks } },
        { new: true },
      );
      if (!claimed) {
        throw new BadRequestException(`Game is already ${game.status}`);
      }

      await settlePayout(
        this.prisma, userId, claimed.betAmount, 0, claimed.walletType,
        claimed.bonusAmount || 0, GAME_SOURCE, String(claimed._id),
        'Towers cashout', `Towers loss: trap on floor ${claimed.currentFloor + 1}`,
      );
      await this.ggrService.updateSnapshot(GAME_KEY, 0, 0, false).catch(() => undefined);

      return this.buildState(claimed, {
        revealLayout: true,
        nextMultiplier: null,
        pickedTile: tile,
        isTrap: true,
      });
    }

    // Safe — advance one floor
    const currentFloor = game.currentFloor + 1;
    const multiplier = multForFloor(currentFloor, game.tilesPerFloor, game.safePerFloor);
    game.currentFloor = currentFloor;
    game.multiplier = multiplier;

    if (currentFloor === TOTAL_FLOORS) {
      // Reached the top — auto cashout
      const payout = roundCurrency(game.betAmount * multiplier);
      const cappedPayout = await this.capPayout(payout);

      // Atomic claim: only one writer may flip ACTIVE → CASHEDOUT and persist
      // the final floor/multiplier/payout/picks.
      const claimed = await this.model.findOneAndUpdate(
        { _id: gameId, userId, status: 'ACTIVE' },
        {
          $set: {
            status: 'CASHEDOUT',
            currentFloor,
            multiplier,
            payout: cappedPayout,
            picks,
          },
        },
        { new: true },
      );
      if (!claimed) {
        throw new BadRequestException(`Game is already ${game.status}`);
      }

      await settlePayout(
        this.prisma, userId, claimed.betAmount, cappedPayout, claimed.walletType,
        claimed.bonusAmount || 0, GAME_SOURCE, String(claimed._id),
        'Towers cashout: tower complete', 'Towers loss',
      );
      await this.ggrService.updateSnapshot(GAME_KEY, 0, 0, true).catch(() => undefined);

      return this.buildState(claimed, {
        revealLayout: true,
        nextMultiplier: null,
        pickedTile: tile,
        isTrap: false,
      });
    }

    // Still climbing — guarded advance: only mutate while the doc is ACTIVE.
    const advanced = await this.model.findOneAndUpdate(
      { _id: gameId, userId, status: 'ACTIVE' },
      { $set: { currentFloor, multiplier, picks } },
      { new: true },
    );
    if (!advanced) {
      throw new BadRequestException(`Game is already ${game.status}`);
    }
    return this.buildState(advanced, {
      revealLayout: false,
      nextMultiplier: multForFloor(currentFloor + 1, advanced.tilesPerFloor, advanced.safePerFloor),
      pickedTile: tile,
      isTrap: false,
    });
  }

  async cashout(userId: number, dto: CashoutTowersDto) {
    const { gameId } = dto;

    const game = await this.model.findById(gameId);
    if (!game) throw new NotFoundException('Game not found');
    if (game.userId !== userId) throw new ForbiddenException('Not your game');
    if (game.status !== 'ACTIVE') {
      throw new BadRequestException(`Game is already ${game.status}`);
    }
    if (game.currentFloor < 1) {
      throw new BadRequestException('Climb at least one floor before cashing out');
    }

    const payout = await this.capPayout(roundCurrency(game.betAmount * game.multiplier));

    // Atomic claim: only one writer may flip ACTIVE → CASHEDOUT. A concurrent
    // request that loses the race gets null and bails before settling.
    const claimed = await this.model.findOneAndUpdate(
      { _id: gameId, userId, status: 'ACTIVE', currentFloor: { $gte: 1 } },
      { $set: { status: 'CASHEDOUT', payout } },
      { new: true },
    );
    if (!claimed) {
      throw new BadRequestException('Game is not active or cannot cash out');
    }

    await settlePayout(
      this.prisma, userId, claimed.betAmount, payout, claimed.walletType,
      claimed.bonusAmount || 0, GAME_SOURCE, String(claimed._id),
      `Towers cashout after ${claimed.currentFloor} floors`, 'Towers loss',
    );
    await this.ggrService.updateSnapshot(GAME_KEY, 0, 0, true).catch(() => undefined);

    return this.buildState(claimed, { revealLayout: true, nextMultiplier: null });
  }

  async getActive(userId: number) {
    const game = await this.model.findOne({ userId, status: 'ACTIVE' });
    if (!game) return null;
    const nextMultiplier =
      game.currentFloor < TOTAL_FLOORS
        ? multForFloor(game.currentFloor + 1, game.tilesPerFloor, game.safePerFloor)
        : null;
    return this.buildState(game, { revealLayout: false, nextMultiplier });
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.model
      .find({ userId, status: { $ne: 'ACTIVE' } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return games.map((g: any) => ({
      gameId: String(g._id),
      betAmount: g.betAmount,
      difficulty: g.difficulty,
      tilesPerFloor: g.tilesPerFloor,
      safePerFloor: g.safePerFloor,
      totalFloors: g.totalFloors,
      currentFloor: g.currentFloor,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      walletType: g.walletType,
      currency: g.currency,
      createdAt: g.createdAt,
    }));
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Clamp payout to config.maxWin when set. */
  private async capPayout(payout: number): Promise<number> {
    const config = await this.ggrService.getConfig(GAME_KEY).catch(() => null);
    const maxWin = config?.maxWin;
    if (maxWin && payout > maxWin) return roundCurrency(maxWin);
    return payout;
  }

  /**
   * Build the response object the frontend reads. While ACTIVE we expose only
   * serverSeedHash + clientSeed (never serverSeed or floorTraps). On any
   * terminal state we reveal serverSeed + floorTraps.
   */
  private buildState(
    game: TowersGameDocument,
    opts: {
      revealLayout: boolean;
      nextMultiplier: number | null;
      pickedTile?: number;
      isTrap?: boolean;
    },
  ) {
    const base: Record<string, any> = {
      gameId: String(game._id),
      betAmount: game.betAmount,
      difficulty: game.difficulty,
      tilesPerFloor: game.tilesPerFloor,
      safePerFloor: game.safePerFloor,
      totalFloors: game.totalFloors,
      currentFloor: game.currentFloor,
      multiplier: game.multiplier,
      picks: game.picks,
      status: game.status,
      payout: game.payout,
      nextMultiplier: opts.nextMultiplier,
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
    };

    if (opts.pickedTile !== undefined) {
      base.pickedTile = opts.pickedTile;
      base.isTrap = !!opts.isTrap;
    }

    if (opts.revealLayout) {
      // Reveal the trap layout (the outcome) but NOT the raw serverSeed — that
      // stays committed until the player rotates their seed pair (verify later).
      base.floorTraps = game.floorTraps;
    }

    return base;
  }
}
