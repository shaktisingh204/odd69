import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import {
  TowersGame,
  TowersGameDocument,
} from '../originals/schemas/towers-game.schema';
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

const HOUSE_EDGE = 0.04;
const TOTAL_FLOORS = 8;

interface DifficultyConfig {
  tilesPerFloor: number;
  safePerFloor: number;
}
const DIFFICULTY: Record<string, DifficultyConfig> = {
  easy: { tilesPerFloor: 4, safePerFloor: 3 }, // 1 trap
  medium: { tilesPerFloor: 3, safePerFloor: 2 },
  hard: { tilesPerFloor: 3, safePerFloor: 1 },
  expert: { tilesPerFloor: 2, safePerFloor: 1 },
};

function multiplierForFloor(
  floorIndex: number,
  cfg: DifficultyConfig,
): number {
  // floorIndex is 1-based here. P(safe) per floor = safe/tiles
  const probSafePerFloor = cfg.safePerFloor / cfg.tilesPerFloor;
  const fairMultiplier = Math.pow(1 / probSafePerFloor, floorIndex);
  return parseFloat((fairMultiplier * (1 - HOUSE_EDGE)).toFixed(4));
}

export interface StartTowersDto {
  betAmount: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  clientSeed?: string;
  walletType?: WalletType;
  useBonus?: boolean;
}

export interface PickTowersDto {
  gameId: string;
  tile: number;
}

export interface CashoutTowersDto {
  gameId: string;
}

@Injectable()
export class TowersService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(TowersGame.name)
    private readonly towersModel: Model<TowersGameDocument>,
    private readonly bonusService: BonusService,
  ) {}

  /** Pre-compute traps for every floor at game start. */
  private buildFloorTraps(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    cfg: DifficultyConfig,
  ): number[][] {
    const trapsPerFloor = cfg.tilesPerFloor - cfg.safePerFloor;
    const floorTraps: number[][] = [];
    for (let floor = 0; floor < TOTAL_FLOORS; floor++) {
      const tiles = Array.from({ length: cfg.tilesPerFloor }, (_, i) => i);
      // Fisher-Yates with HMAC tagged by floor
      for (let i = tiles.length - 1; i > 0; i--) {
        const digest = hmacHex(
          serverSeed,
          clientSeed,
          nonce,
          `towers:${floor}:${i}`,
        );
        const j = rollInt(digest, i + 1);
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
      floorTraps.push(tiles.slice(0, trapsPerFloor).sort((a, b) => a - b));
    }
    return floorTraps;
  }

  private summarize(game: TowersGameDocument, revealTraps = false) {
    const cfg = DIFFICULTY[game.difficulty];
    return {
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
      nextMultiplier:
        game.currentFloor < TOTAL_FLOORS
          ? multiplierForFloor(game.currentFloor + 1, cfg)
          : null,
      // Only reveal trap layout once the game ends
      floorTraps: revealTraps ? game.floorTraps : undefined,
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
    };
  }

  async start(userId: number, dto: StartTowersDto) {
    const {
      betAmount,
      difficulty = 'medium',
      clientSeed = 'zeero',
      walletType = 'fiat',
      useBonus = false,
    } = dto;
    if (!(betAmount > 0)) throw new BadRequestException('Bet must be positive');
    const cfg = DIFFICULTY[difficulty];
    if (!cfg) throw new BadRequestException('Invalid difficulty');

    // Force-close any active game
    const existing = await this.towersModel.findOne({ userId, status: 'ACTIVE' });
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
    const floorTraps = this.buildFloorTraps(serverSeed, clientSeed, nonce, cfg);

    const game = await this.towersModel.create({
      userId,
      betAmount,
      difficulty,
      tilesPerFloor: cfg.tilesPerFloor,
      safePerFloor: cfg.safePerFloor,
      totalFloors: TOTAL_FLOORS,
      floorTraps,
      picks: [],
      currentFloor: 0,
      multiplier: 1,
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
      'TOWERS',
      String(game._id),
      `Towers bet (${difficulty})`,
    );

    return this.summarize(game);
  }

  async pick(userId: number, dto: PickTowersDto) {
    const game = await this.towersModel.findOne({ _id: dto.gameId, userId });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'ACTIVE')
      throw new BadRequestException('Game already finished');
    if (game.currentFloor >= TOTAL_FLOORS)
      throw new BadRequestException('Tower already complete');
    if (
      !Number.isInteger(dto.tile) ||
      dto.tile < 0 ||
      dto.tile >= game.tilesPerFloor
    )
      throw new BadRequestException('Invalid tile index');

    const cfg = DIFFICULTY[game.difficulty];
    const traps = game.floorTraps[game.currentFloor] || [];
    const isTrap = traps.includes(dto.tile);

    game.picks.push(dto.tile);
    if (isTrap) {
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
        'TOWERS',
        String(game._id),
        '',
        `Towers loss on floor ${game.currentFloor + 1}`,
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
      return { ...this.summarize(game, true), pickedTile: dto.tile, isTrap: true };
    }

    game.currentFloor += 1;
    game.multiplier = multiplierForFloor(game.currentFloor, cfg);

    // Auto-cashout if reached top
    if (game.currentFloor >= TOTAL_FLOORS) {
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
        'TOWERS',
        String(game._id),
        `Towers complete × ${game.multiplier}`,
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
      return { ...this.summarize(game, true), pickedTile: dto.tile, isTrap: false };
    }

    await game.save();
    return { ...this.summarize(game), pickedTile: dto.tile, isTrap: false };
  }

  async cashout(userId: number, dto: CashoutTowersDto) {
    const game = await this.towersModel.findOne({ _id: dto.gameId, userId });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'ACTIVE')
      throw new BadRequestException('Game already finished');
    if (game.currentFloor === 0)
      throw new BadRequestException('Climb at least one floor before cashing out');

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
      'TOWERS',
      String(game._id),
      `Towers cashout × ${game.multiplier}`,
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

    return this.summarize(game, true);
  }

  async getActive(userId: number) {
    const game = await this.towersModel.findOne({ userId, status: 'ACTIVE' });
    return game ? this.summarize(game) : null;
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.towersModel
      .find({ userId, status: { $ne: 'ACTIVE' } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return games.map((g: any) => ({
      gameId: String(g._id),
      betAmount: g.betAmount,
      difficulty: g.difficulty,
      currentFloor: g.currentFloor,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      createdAt: g.createdAt,
    }));
  }
}
