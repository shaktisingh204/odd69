import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OriginalsConfig, OriginalsConfigDocument } from './schemas/originals-config.schema';
import { OriginalsGGRSnapshot, OriginalsGGRSnapshotDocument } from './schemas/originals-ggr-snapshot.schema';
import { MinesGame, MinesGameDocument } from './schemas/mines-game.schema';
import { DiceGame, DiceGameDocument } from './schemas/dice-game.schema';
import { PlinkoGame, PlinkoGameDocument } from './schemas/plinko-game.schema';

export interface GGRResult {
  targetGgr: number;
  actualGgr: number;
  biasWeight: number;
  houseEdge: number;
}

@Injectable()
export class GGRService {
  private readonly logger = new Logger(GGRService.name);

  private readonly HOT_ZONES  = [7, 8, 9, 12, 13, 14, 17, 18, 19];
  private readonly COLD_ZONES = [0, 4, 20, 24, 2, 22, 10, 11, 14];

  constructor(
    @InjectModel(OriginalsConfig.name)
    private readonly configModel: Model<OriginalsConfigDocument>,
    @InjectModel(OriginalsGGRSnapshot.name)
    private readonly snapshotModel: Model<OriginalsGGRSnapshotDocument>,
    @InjectModel(MinesGame.name)
    private readonly minesGameModel: Model<MinesGameDocument>,
    @InjectModel(DiceGame.name)
    private readonly diceGameModel: Model<DiceGameDocument>,
    @InjectModel(PlinkoGame.name)
    private readonly plinkoGameModel: Model<PlinkoGameDocument>,
  ) {}

  async computeBias(gameKey: string, userId: number, mineCount: number): Promise<GGRResult> {
    const [config, snapshot] = await Promise.all([
      this.getConfig(gameKey),
      this.snapshotModel.findOne({ gameKey }).sort({ snapshotAt: -1 }),
    ]);

    if (!config) {
      return { targetGgr: 5, actualGgr: 0, biasWeight: 0, houseEdge: 0.01 };
    }

    let targetGgr = config.targetGgrPercent;
    if (config.perUserGgrOverrides?.[String(userId)] !== undefined) {
      targetGgr = config.perUserGgrOverrides[String(userId)];
    }

    const actualGgr = snapshot?.ggrPercent ?? 0;
    const diff = actualGgr - targetGgr;
    const maxBias = config.ggrBiasStrength ?? 0.20;
    const rawBias = Math.tanh(diff / 10);
    const biasWeight = Math.max(-maxBias, Math.min(maxBias, rawBias));
    const baseEdge = (config.houseEdgePercent ?? 1.0) / 100;
    const houseEdge = Math.max(0, baseEdge + biasWeight * 0.05);

    this.logger.debug(
      `GGR [${gameKey}] uid=${userId} target=${targetGgr}% actual=${actualGgr.toFixed(2)}% bias=${biasWeight.toFixed(3)}`,
    );

    return { targetGgr, actualGgr, biasWeight, houseEdge };
  }

  applyBiasToMines(mines: number[], biasWeight: number, mineCount: number): number[] {
    if (Math.abs(biasWeight) < 0.05) return mines;
    const swapCount = Math.max(1, Math.floor(mineCount * Math.abs(biasWeight)));
    const result = [...mines];

    if (biasWeight > 0) {
      const hotAvailable = this.HOT_ZONES.filter((t) => !result.includes(t));
      const toReplace = result.filter((t) => !this.HOT_ZONES.includes(t)).slice(0, Math.min(swapCount, hotAvailable.length));
      for (let i = 0; i < toReplace.length && i < hotAvailable.length; i++) {
        result[result.indexOf(toReplace[i])] = hotAvailable[i];
      }
    } else {
      const coldAvail = this.COLD_ZONES.filter((t) => !result.includes(t));
      const toReplace = result.filter((t) => this.HOT_ZONES.includes(t)).slice(0, Math.min(swapCount, coldAvail.length));
      for (let i = 0; i < toReplace.length && i < coldAvail.length; i++) {
        result[result.indexOf(toReplace[i])] = coldAvail[i];
      }
    }
    return result;
  }

  async updateSnapshot(gameKey: string, wagered: number, paidOut: number, won: boolean): Promise<void> {
    const config = await this.getConfig(gameKey);
    const windowHours = config?.ggrWindowHours ?? 24;
    const since = new Date(Date.now() - windowHours * 3600 * 1000);

    let games: any[] = [];
    if (gameKey === 'mines') {
      games = await this.minesGameModel.find({
        status: { $ne: 'ACTIVE' },
        createdAt: { $gte: since },
      }).lean();
    } else if (gameKey === 'dice') {
      games = await this.diceGameModel.find({
        createdAt: { $gte: since },
      }).lean();
    } else if (gameKey === 'plinko') {
      games = await this.plinkoGameModel.find({
        createdAt: { $gte: since },
      }).lean();
    }

    const totalWagered = games.reduce((s, g) => s + g.betAmount, 0);
    const totalPaidOut = games.reduce((s, g) => s + g.payout, 0);
    const totalGames   = games.length;
    const totalWins    = games.filter((g) => g.status === 'CASHEDOUT' || g.status === 'WON').length;
    const totalLosses  = games.filter((g) => g.status === 'LOST').length;
    const ggrPercent   = totalWagered > 0 ? ((totalWagered - totalPaidOut) / totalWagered) * 100 : 0;

    await this.snapshotModel.create({
      gameKey, windowStart: since, windowEnd: new Date(),
      totalWagered, totalPaidOut, totalGames, totalWins, totalLosses, ggrPercent,
      snapshotAt: new Date(),
    });
  }

  async getConfig(gameKey: string): Promise<OriginalsConfigDocument | null> {
    const defaults = this.defaults(gameKey);
    // findOneAndUpdate with upsert = ensure doc exists, return current state
    return this.configModel.findOneAndUpdate(
      { gameKey },
      { $setOnInsert: { gameKey, ...defaults } },
      { upsert: true, returnDocument: 'after' },
    );
  }

  async getLiveGGRStats(gameKey: string) {
    const [config, snapshot] = await Promise.all([
      this.getConfig(gameKey),
      this.snapshotModel.findOne({ gameKey }).sort({ snapshotAt: -1 }),
    ]);
    return {
      gameKey,
      targetGgrPercent:  config?.targetGgrPercent ?? 5,
      actualGgrPercent:  snapshot?.ggrPercent ?? 0,
      totalWagered:      snapshot?.totalWagered ?? 0,
      totalPaidOut:      snapshot?.totalPaidOut ?? 0,
      totalGames:        snapshot?.totalGames ?? 0,
      totalWins:         snapshot?.totalWins ?? 0,
      totalLosses:       snapshot?.totalLosses ?? 0,
      windowHours:       config?.ggrWindowHours ?? 24,
      snapshotAt:        snapshot?.snapshotAt,
    };
  }

  private defaults(gameKey: string) {
    const d: Record<string, any> = {
      mines:  { isActive: true,  minBet: 10, maxBet: 100000, targetGgrPercent: 5.0,  displayRtpPercent: 95.0, fakePlayerMin: 200, fakePlayerMax: 300, gameName: 'Zeero Mines',  gameDescription: 'Dodge the mines, collect the gems.' },
      crash:  { isActive: true,  minBet: 10, maxBet: 50000,  targetGgrPercent: 4.0,  displayRtpPercent: 96.0, fakePlayerMin: 180, fakePlayerMax: 280, gameName: 'Zeero Crash',  gameDescription: 'Watch the multiplier climb. Cash out in time.' },
      dice:   { isActive: true,  minBet: 10, maxBet: 50000,  targetGgrPercent: 3.0,  displayRtpPercent: 97.0, fakePlayerMin: 120, fakePlayerMax: 220, gameName: 'Zeero Dice',   gameDescription: 'Roll the dice, beat the house.' },
      limbo:  { isActive: true,  minBet: 10, maxBet: 50000,  targetGgrPercent: 3.5,  displayRtpPercent: 96.5, fakePlayerMin: 140, fakePlayerMax: 240, gameName: 'Zeero Limbo',  gameDescription: 'Pick your multiplier and beat the bust point.' },
      plinko: { isActive: true,  minBet: 10, maxBet: 25000,  targetGgrPercent: 3.0,  displayRtpPercent: 97.0, fakePlayerMin: 90,  fakePlayerMax: 160, gameName: 'Zeero Plinko', gameDescription: 'Drop the ball and chase riskier multiplier slots.' },
      keno:   { isActive: false, minBet: 10, maxBet: 25000,  targetGgrPercent: 4.5,  displayRtpPercent: 95.5, fakePlayerMin: 70,  fakePlayerMax: 140, gameName: 'Zeero Keno',   gameDescription: 'Pick your lucky numbers and hit the board.' },
      hilo:   { isActive: false, minBet: 10, maxBet: 20000,  targetGgrPercent: 4.0,  displayRtpPercent: 96.0, fakePlayerMin: 60,  fakePlayerMax: 110, gameName: 'Zeero Hi-Lo',  gameDescription: 'Guess whether the next card goes higher or lower.' },
      roulette:{ isActive: false, minBet: 10, maxBet: 50000, targetGgrPercent: 5.3,  displayRtpPercent: 94.7, fakePlayerMin: 80,  fakePlayerMax: 150, gameName: 'Zeero Roulette', gameDescription: 'Cover your numbers and let the wheel decide.' },
      wheel:  { isActive: false, minBet: 10, maxBet: 25000,  targetGgrPercent: 4.8,  displayRtpPercent: 95.2, fakePlayerMin: 50,  fakePlayerMax: 120, gameName: 'Zeero Wheel',  gameDescription: 'Spin a fast bonus wheel for instant multipliers.' },
      coinflip:{ isActive: false, minBet: 10, maxBet: 20000, targetGgrPercent: 2.9,  displayRtpPercent: 97.1, fakePlayerMin: 65,  fakePlayerMax: 135, gameName: 'Zeero Coinflip', gameDescription: 'Call heads or tails and settle each round instantly.' },
      towers: { isActive: false, minBet: 10, maxBet: 20000,  targetGgrPercent: 3.6,  displayRtpPercent: 96.4, fakePlayerMin: 55,  fakePlayerMax: 125, gameName: 'Zeero Towers',  gameDescription: 'Climb one floor at a time and cash out before you fall.' },
      color:  { isActive: false, minBet: 10, maxBet: 15000,  targetGgrPercent: 4.2,  displayRtpPercent: 95.8, fakePlayerMin: 75,  fakePlayerMax: 155, gameName: 'Zeero Color',   gameDescription: 'Pick a color lane and ride short, fast multiplier rounds.' },
      lotto:  { isActive: false, minBet: 10, maxBet: 15000,  targetGgrPercent: 5.1,  displayRtpPercent: 94.9, fakePlayerMin: 45,  fakePlayerMax: 95, gameName: 'Zeero Lotto',   gameDescription: 'Choose your ticket line and chase oversized payout grids.' },
      jackpot:{ isActive: false, minBet: 10, maxBet: 25000,  targetGgrPercent: 5.5,  displayRtpPercent: 94.5, fakePlayerMin: 35,  fakePlayerMax: 85, gameName: 'Zeero Jackpot', gameDescription: 'Snap into boosted prize pots with a high-volatility hit chase.' },
    };
    return d[gameKey] ?? d.mines;
  }
}
