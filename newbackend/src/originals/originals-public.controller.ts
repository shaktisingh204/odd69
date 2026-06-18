import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OriginalsConfig, OriginalsConfigDocument } from './schemas/originals-config.schema';
import { Public } from '../auth/public.decorator';

const GAME_DISPLAY: Record<string, { name: string; description: string; emoji: string }> = {
  mines:  { name: 'Zeero Mines',  description: 'Dodge the mines, collect the gems.',             emoji: '💣' },
  crash:  { name: 'Zeero Crash',  description: 'Watch the multiplier climb. Cash out in time.',  emoji: '🚀' },
  dice:   { name: 'Zeero Dice',   description: 'Roll the dice, beat the house.',                 emoji: '🎲' },
  limbo:  { name: 'Zeero Limbo',  description: 'Pick your multiplier and beat the bust point.',  emoji: '✈️' },
  plinko: { name: 'Zeero Plinko', description: 'Drop the ball and chase riskier multiplier slots.', emoji: '🪙' },
  keno:   { name: 'Zeero Keno',   description: 'Pick your lucky numbers and hit the board.',       emoji: '🔢' },
  hilo:   { name: 'Zeero Hi-Lo',  description: 'Guess whether the next card goes higher or lower.', emoji: '🃏' },
  roulette:{ name: 'Zeero Roulette', description: 'Cover your numbers and let the wheel decide.', emoji: '🎯' },
  wheel:  { name: 'Zeero Wheel',  description: 'Spin a fast bonus wheel for instant multipliers.', emoji: '🎡' },
  coinflip:{ name: 'Zeero Coinflip', description: 'Call heads or tails and settle each round instantly.', emoji: '🪙' },
  towers: { name: 'Zeero Towers', description: 'Climb one floor at a time and cash out before you fall.', emoji: '🗼' },
  color:  { name: 'Zeero Color', description: 'Pick a color lane and ride short, fast multiplier rounds.', emoji: '🔴' },
  lotto:  { name: 'Zeero Lotto', description: 'Choose your ticket line and chase oversized payout grids.', emoji: '🎟️' },
  jackpot:{ name: 'Zeero Jackpot', description: 'Snap into boosted prize pots with a high-volatility hit chase.', emoji: '👑' },
};

const ALL_GAME_KEYS = Object.keys(GAME_DISPLAY);

const DEFAULT_FIELDS: Record<string, any> = {
  mines:  { isActive: true,  displayRtpPercent: 95.0, minBet: 10, maxBet: 100000, fakePlayerMin: 200, fakePlayerMax: 300 },
  crash:  { isActive: true,  displayRtpPercent: 96.0, minBet: 10, maxBet: 50000,  fakePlayerMin: 180, fakePlayerMax: 280 },
  dice:   { isActive: true,  displayRtpPercent: 97.0, minBet: 10, maxBet: 50000,  fakePlayerMin: 120, fakePlayerMax: 220 },
  limbo:  { isActive: true,  displayRtpPercent: 96.0, minBet: 10, maxBet: 50000,  fakePlayerMin: 140, fakePlayerMax: 240 },
  plinko: { isActive: true,  displayRtpPercent: 97.0, minBet: 10, maxBet: 25000,  fakePlayerMin: 90,  fakePlayerMax: 160 },
  keno:   { isActive: true,  displayRtpPercent: 95.5, minBet: 10, maxBet: 25000,  fakePlayerMin: 70,  fakePlayerMax: 140 },
  hilo:   { isActive: true,  displayRtpPercent: 96.0, minBet: 10, maxBet: 20000,  fakePlayerMin: 60,  fakePlayerMax: 110 },
  roulette:{ isActive: true,  displayRtpPercent: 97.3, minBet: 10, maxBet: 50000, fakePlayerMin: 80,  fakePlayerMax: 150 },
  wheel:  { isActive: true,  displayRtpPercent: 95.2, minBet: 10, maxBet: 25000,  fakePlayerMin: 50,  fakePlayerMax: 120 },
  coinflip:{ isActive: true,  displayRtpPercent: 98.0, minBet: 10, maxBet: 20000, fakePlayerMin: 65,  fakePlayerMax: 135 },
  towers: { isActive: true,  displayRtpPercent: 96.0, minBet: 10, maxBet: 20000,  fakePlayerMin: 55,  fakePlayerMax: 125 },
  color:  { isActive: true,  displayRtpPercent: 96.0, minBet: 10, maxBet: 15000,  fakePlayerMin: 75,  fakePlayerMax: 155 },
  lotto:  { isActive: true,  displayRtpPercent: 95.0, minBet: 10, maxBet: 15000,  fakePlayerMin: 45,  fakePlayerMax: 95 },
  jackpot:{ isActive: true,  displayRtpPercent: 97.5, minBet: 10, maxBet: 25000,  fakePlayerMin: 35,  fakePlayerMax: 85 },
};

@Public()
@Controller('originals')
export class OriginalsPublicController {
  constructor(
    @InjectModel(OriginalsConfig.name)
    private readonly configModel: Model<OriginalsConfigDocument>,
  ) {}

  private toGameResponse(key: string, row: OriginalsConfigDocument | null) {
    const display = GAME_DISPLAY[key];
    const d = DEFAULT_FIELDS[key];

    return {
      gameKey:           key,
      gameName:          row?.gameName          ?? display.name,
      gameDescription:   row?.gameDescription   ?? display.description,
      emoji:             display.emoji,
      isActive:          row?.isActive ?? d.isActive,
      displayRtpPercent: row?.displayRtpPercent ?? d.displayRtpPercent,
      minBet:            row?.minBet            ?? d.minBet,
      maxBet:            row?.maxBet            ?? d.maxBet,
      thumbnailUrl:      row?.thumbnailUrl       ?? null,
      fakePlayerMin:     row?.fakePlayerMin      ?? d.fakePlayerMin,
      fakePlayerMax:     row?.fakePlayerMax      ?? d.fakePlayerMax,
    };
  }


  /**
   * GET /originals/games
   * Returns display config for all Zeero Originals games (no auth required).
   * Used by home page ZeeroOriginalsSection.
   */
  @Get('games')
  async getAllGames() {
    const rows = await this.configModel
      .find({ gameKey: { $in: ALL_GAME_KEYS } })
      .lean();

    return ALL_GAME_KEYS.map((key) => {
      const row = rows.find((r) => r.gameKey === key) as any;
      return this.toGameResponse(key, row);
    });
  }

  /**
   * GET /originals/games/:key
   * Returns display config for one game.
   */
  @Get('games/:key')
  async getGame(@Param('key') key: string) {
    if (!ALL_GAME_KEYS.includes(key)) {
      throw new NotFoundException(`Game '${key}' not found`);
    }
    const row = await this.configModel.findOne({ gameKey: key });
    return this.toGameResponse(key, row);
  }
}
