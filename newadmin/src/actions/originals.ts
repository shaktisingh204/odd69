"use server";

import connectMongo from "@/lib/mongo";
import { prisma } from "@/lib/db";
import {
  OriginalsConfig,
  MinesGame,
  PlinkoGame,
  OriginalsGGRSnapshot,
  OriginalsSession,
  OriginalsEngagementEvent,
  AviatorRound,
  AviatorBet,
} from "@/models/MongoModels";

const GAME_KEYS = ["mines", "crash", "dice", "limbo", "plinko", "keno", "hilo", "roulette", "wheel", "coinflip", "towers", "color", "lotto", "jackpot"];
const GLOBAL_ACCESS_KEY = "__global_access__";
const LEGACY_ALLOWED_PHONE_SUFFIXES = ["9460290991"];

const DEFAULTS: Record<string, any> = {
  mines:  { isActive: true,  minBet: 10, maxBet: 100000, targetGgrPercent: 5.0,  displayRtpPercent: 95.0, gameName: "Zeero Mines",   gameDescription: "Dodge the mines, collect the gems.",             fakePlayerMin: 200, fakePlayerMax: 300 },
  crash:  { isActive: true,  minBet: 10, maxBet: 50000,  targetGgrPercent: 4.0,  displayRtpPercent: 96.0, gameName: "Zeero Crash",   gameDescription: "Watch the multiplier climb. Cash out in time.",  fakePlayerMin: 180, fakePlayerMax: 280 },
  dice:   { isActive: true,  minBet: 10, maxBet: 50000,  targetGgrPercent: 3.0,  displayRtpPercent: 97.0, gameName: "Zeero Dice",    gameDescription: "Roll the dice, beat the house.",                 fakePlayerMin: 120, fakePlayerMax: 220 },
  limbo:  { isActive: true,  minBet: 10, maxBet: 50000,  targetGgrPercent: 3.5,  displayRtpPercent: 96.5, gameName: "Zeero Limbo",   gameDescription: "Pick your multiplier and beat the bust point.",  fakePlayerMin: 140, fakePlayerMax: 240 },
  plinko: { isActive: true,  minBet: 10, maxBet: 25000,  targetGgrPercent: 3.0,  displayRtpPercent: 97.0, gameName: "Zeero Plinko",  gameDescription: "Drop the ball and chase riskier multiplier slots.", fakePlayerMin: 90,  fakePlayerMax: 160 },
  keno:   { isActive: false, minBet: 10, maxBet: 25000,  targetGgrPercent: 4.5,  displayRtpPercent: 95.5, gameName: "Zeero Keno",    gameDescription: "Pick your lucky numbers and hit the board.",       fakePlayerMin: 70,  fakePlayerMax: 140 },
  hilo:   { isActive: false, minBet: 10, maxBet: 20000,  targetGgrPercent: 4.0,  displayRtpPercent: 96.0, gameName: "Zeero Hi-Lo",   gameDescription: "Guess whether the next card goes higher or lower.", fakePlayerMin: 60,  fakePlayerMax: 110 },
  roulette:{ isActive: false, minBet: 10, maxBet: 50000, targetGgrPercent: 5.3,  displayRtpPercent: 94.7, gameName: "Zeero Roulette", gameDescription: "Cover your numbers and let the wheel decide.",      fakePlayerMin: 80,  fakePlayerMax: 150 },
  wheel:  { isActive: false, minBet: 10, maxBet: 25000,  targetGgrPercent: 4.8,  displayRtpPercent: 95.2, gameName: "Zeero Wheel",   gameDescription: "Spin a fast bonus wheel for instant multipliers.", fakePlayerMin: 50,  fakePlayerMax: 120 },
  coinflip:{ isActive: false, minBet: 10, maxBet: 20000, targetGgrPercent: 2.9,  displayRtpPercent: 97.1, gameName: "Zeero Coinflip", gameDescription: "Call heads or tails and settle each round instantly.", fakePlayerMin: 65, fakePlayerMax: 135 },
  towers: { isActive: false, minBet: 10, maxBet: 20000,  targetGgrPercent: 3.6,  displayRtpPercent: 96.4, gameName: "Zeero Towers",  gameDescription: "Climb one floor at a time and cash out before you fall.", fakePlayerMin: 55, fakePlayerMax: 125 },
  color:  { isActive: false, minBet: 10, maxBet: 15000,  targetGgrPercent: 4.2,  displayRtpPercent: 95.8, gameName: "Zeero Color",   gameDescription: "Pick a color lane and ride short, fast multiplier rounds.", fakePlayerMin: 75, fakePlayerMax: 155 },
  lotto:  { isActive: false, minBet: 10, maxBet: 15000,  targetGgrPercent: 5.1,  displayRtpPercent: 94.9, gameName: "Zeero Lotto",   gameDescription: "Choose your ticket line and chase oversized payout grids.", fakePlayerMin: 45, fakePlayerMax: 95 },
  jackpot:{ isActive: false, minBet: 10, maxBet: 25000,  targetGgrPercent: 5.5,  displayRtpPercent: 94.5, gameName: "Zeero Jackpot", gameDescription: "Snap into boosted prize pots with a high-volatility hit chase.", fakePlayerMin: 35, fakePlayerMax: 85 },
};

async function ensureConfig(gameKey: string) {
  await connectMongo();
  const existing = await OriginalsConfig.findOne({ gameKey });
  if (existing) return existing;
  return OriginalsConfig.create({ gameKey, ...(DEFAULTS[gameKey] ?? DEFAULTS.mines) });
}

function getHistoryModel(game: string) {
  return game === "plinko" ? PlinkoGame : MinesGame;
}

function isWinningStatus(game: string, status: string) {
  return game === "plinko" ? status === "WON" : status === "CASHEDOUT";
}

function normalizeAllowedUserIds(userIds: unknown): number[] {
  if (!Array.isArray(userIds)) {
    return [];
  }

  return [...new Set(
    userIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];
}

async function filterExistingUserIds(userIds: number[]) {
  if (userIds.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true },
  });

  const existingIds = new Set(users.map((user) => user.id));
  return userIds.filter((userId) => existingIds.has(userId));
}

async function ensureAccessConfig() {
  await connectMongo();
  const existing = await OriginalsConfig.findOne({ gameKey: GLOBAL_ACCESS_KEY });
  if (existing) return existing;

  const legacyUsers = await prisma.user.findMany({
    where: {
      OR: LEGACY_ALLOWED_PHONE_SUFFIXES.map((phoneSuffix) => ({
        phoneNumber: { endsWith: phoneSuffix },
      })),
    },
    select: { id: true },
  });

  const allowedUserIds = [...new Set(legacyUsers.map((user) => user.id))];
  return OriginalsConfig.create({
    gameKey: GLOBAL_ACCESS_KEY,
    accessMode: "ALLOW_LIST",
    allowedUserIds,
  });
}

async function getCompactUsersByIds(userIds: number[]) {
  if (userIds.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      email: true,
      phoneNumber: true,
      role: true,
      isBanned: true,
    },
  });

  const order = new Map(userIds.map((userId, index) => [userId, index]));
  return users.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getAllOriginalsConfigs() {
  try {
    await connectMongo();
    await Promise.all(GAME_KEYS.map(ensureConfig));
    const data = await OriginalsConfig.find({ gameKey: { $in: GAME_KEYS } })
      .sort({ gameKey: 1 }).lean();
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getOriginalsConfig(game: string) {
  try {
    const data = await ensureConfig(game);
    return { success: true, data: data.toObject() };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateOriginalsConfig(game: string, payload: any) {
  try {
    await connectMongo();
    const ALLOWED = [
      "isActive","maintenanceMode","maintenanceMessage","minBet","maxBet","maxWin",
      "houseEdgePercent","maxMultiplier","targetGgrPercent","ggrWindowHours","ggrBiasStrength",
      "engagementMode","nearMissEnabled","bigWinThreshold","streakWindow","displayRtpPercent",
      "thumbnailUrl","gameName","gameDescription","fakePlayerMin","fakePlayerMax",
    ];
    const clean: Record<string, any> = {};
    for (const k of ALLOWED) if (k in payload && payload[k] !== undefined) clean[k] = payload[k];

    const data = await OriginalsConfig.findOneAndUpdate(
      { gameKey: game },
      { $setOnInsert: { gameKey: game }, $set: clean },
      { upsert: true, returnDocument: 'after' }
    ).lean();
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function quickToggleGame(game: string, isActive: boolean) {
  try {
    await connectMongo();
    const defaults = DEFAULTS[game] ?? DEFAULTS.mines;
    const data = await OriginalsConfig.findOneAndUpdate(
      { gameKey: game },
      {
        $setOnInsert: { gameKey: game, ...defaults },
        $set: { isActive },
      },
      { upsert: true, returnDocument: 'after' }
    ).lean();
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}


// ── Access Control ───────────────────────────────────────────────────────────

export async function getOriginalsAccessControl() {
  try {
    const config = await ensureAccessConfig();
    const allowedUserIds = normalizeAllowedUserIds((config as any)?.allowedUserIds ?? []);
    const allowedUsers = await getCompactUsersByIds(allowedUserIds);

    return {
      success: true,
      data: {
        accessMode: (config as any)?.accessMode === "ALL" ? "ALL" : "ALLOW_LIST",
        allowedUserIds,
        allowedUsers,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateOriginalsAccessControl(payload: { accessMode?: "ALL" | "ALLOW_LIST"; allowedUserIds?: number[] }) {
  try {
    await connectMongo();
    const clean: Record<string, any> = {};

    if (payload.accessMode === "ALL" || payload.accessMode === "ALLOW_LIST") {
      clean.accessMode = payload.accessMode;
    }

    if (payload.allowedUserIds !== undefined) {
      const normalizedIds = normalizeAllowedUserIds(payload.allowedUserIds);
      clean.allowedUserIds = await filterExistingUserIds(normalizedIds);
    }

    const insertDefaults: Record<string, any> = { gameKey: GLOBAL_ACCESS_KEY };
    if (clean.accessMode === undefined) {
      insertDefaults.accessMode = "ALLOW_LIST";
    }
    if (clean.allowedUserIds === undefined) {
      insertDefaults.allowedUserIds = [];
    }

    const data = await OriginalsConfig.findOneAndUpdate(
      { gameKey: GLOBAL_ACCESS_KEY },
      {
        $setOnInsert: insertDefaults,
        $set: clean,
      },
      { upsert: true, returnDocument: 'after' }
    ).lean();

    const allowedUserIds = normalizeAllowedUserIds((data as any)?.allowedUserIds ?? []);
    const allowedUsers = await getCompactUsersByIds(allowedUserIds);

    return {
      success: true,
      data: {
        ...(data as any),
        accessMode: (data as any)?.accessMode === "ALL" ? "ALL" : "ALLOW_LIST",
        allowedUserIds,
        allowedUsers,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function searchOriginalsAccessUsers(query: string) {
  try {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { success: true, data: [] };
    }

    const data = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: trimmed, mode: "insensitive" } },
          { email: { contains: trimmed, mode: "insensitive" } },
          { phoneNumber: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        phoneNumber: true,
        role: true,
        isBanned: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── GGR ───────────────────────────────────────────────────────────────────────

export async function getOriginalsGGR(game: string) {
  try {
    await connectMongo();
    const [config, snapshot] = await Promise.all([
      OriginalsConfig.findOne({ gameKey: game }).lean(),
      OriginalsGGRSnapshot.findOne({ gameKey: game }).sort({ snapshotAt: -1 }).lean(),
    ]);
    return {
      success: true,
      data: {
        gameKey: game,
        targetGgrPercent:  (config as any)?.targetGgrPercent ?? 5,
        actualGgrPercent:  (snapshot as any)?.ggrPercent ?? 0,
        totalWagered:      (snapshot as any)?.totalWagered ?? 0,
        totalPaidOut:      (snapshot as any)?.totalPaidOut ?? 0,
        totalGames:        (snapshot as any)?.totalGames ?? 0,
        totalWins:         (snapshot as any)?.totalWins ?? 0,
        totalLosses:       (snapshot as any)?.totalLosses ?? 0,
        snapshotAt:        (snapshot as any)?.snapshotAt,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getAllOriginalsGGR() {
  try {
    const results = await Promise.all(GAME_KEYS.map((g) => getOriginalsGGR(g)));
    return { success: true, data: results.map((r) => r.data) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getOriginalsGGRHistory(game: string, hours = 168) {
  try {
    await connectMongo();
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const data = await OriginalsGGRSnapshot.find({ gameKey: game, snapshotAt: { $gte: since } })
      .sort({ snapshotAt: 1 }).lean();
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function getOriginalsSessions(game?: string) {
  try {
    await connectMongo();
    const filter: any = { isActive: true };
    if (game) filter.gameKey = game;
    const data = await OriginalsSession.find(filter).sort({ connectedAt: -1 }).lean();
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Game History ──────────────────────────────────────────────────────────────

export async function getOriginalsHistory(game: string, page = 1, limit = 50, userId?: number) {
  try {
    await connectMongo();
    const filter: any = { status: { $ne: "ACTIVE" } };
    if (userId) filter.userId = userId;
    const HistoryModel = getHistoryModel(game);

    const [games, total] = await Promise.all([
      HistoryModel.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).lean(),
      HistoryModel.countDocuments(filter),
    ]);
    const won          = games.filter((g) => isWinningStatus(game, g.status)).length;
    const lost         = games.filter((g) => g.status === "LOST").length;
    const totalWagered = games.reduce((s, g) => s + g.betAmount, 0);
    const totalPaidOut = games.reduce((s, g) => s + g.payout, 0);

    return {
      success: true,
      data: {
        games: games.map((g) => ({ ...g, gameId: String((g as any)._id), gameKey: game })),
        total, page, limit, pages: Math.ceil(total / limit),
        summary: { won, lost, totalWagered, totalPaidOut, house: totalWagered - totalPaidOut },
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function forceCloseGame(gameId: string) {
  try {
    await connectMongo();
    const game = await MinesGame.findById(gameId);
    if (!game) return { success: false, error: "Game not found" };
    if (game.status !== "ACTIVE") return { success: false, error: `Game is not active (${game.status})` };
    game.status = "LOST";
    game.payout = 0;
    await game.save();
    return { success: true, data: { gameId, closed: true } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function forceCloseUserGames(userId: number) {
  try {
    await connectMongo();
    const result = await MinesGame.updateMany(
      { userId, status: "ACTIVE" },
      { $set: { status: "LOST", payout: 0 } }
    );
    return { success: true, data: { closed: result.modifiedCount } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Active Games ──────────────────────────────────────────────────────────────

export async function getActiveGames() {
  try {
    await connectMongo();
    const [mines, aviator] = await Promise.all([
      MinesGame.find({ status: "ACTIVE" }).sort({ createdAt: -1 }).lean(),
      AviatorRound.findOne({ status: { $in: ["BETTING", "FLYING"] } }).sort({ roundId: -1 }).lean(),
    ]);
    return { success: true, data: { mines, currentAviatorRound: aviator } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Engagement ────────────────────────────────────────────────────────────────

export async function getEngagementStats(game: string) {
  try {
    await connectMongo();
    const [summary, recent] = await Promise.all([
      OriginalsEngagementEvent.aggregate([
        { $match: { gameKey: game } },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
        { $project: { _id: 0, type: "$_id", count: 1 } },
      ]),
      OriginalsEngagementEvent.find({ gameKey: game }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    return { success: true, data: { summary, recent } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Per-user GGR ──────────────────────────────────────────────────────────────

export async function getPerUserGGR(game: string) {
  try {
    await connectMongo();
    const config = await OriginalsConfig.findOne({ gameKey: game }).lean();
    const overrides = (config as any)?.perUserGgrOverrides ?? {};
    const data = Object.entries(overrides).map(([uid, tgr]) => ({ userId: parseInt(uid), targetGgr: tgr }));
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function setPerUserGGR(game: string, userId: number, targetGgr: number) {
  try {
    await connectMongo();
    const data = await OriginalsConfig.findOneAndUpdate(
      { gameKey: game },
      { $set: { [`perUserGgrOverrides.${userId}`]: targetGgr } },
      { upsert: true, returnDocument: 'after' }
    ).lean();
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function removePerUserGGR(game: string, userId: number) {
  try {
    await connectMongo();
    const data = await OriginalsConfig.findOneAndUpdate(
      { gameKey: game },
      { $unset: { [`perUserGgrOverrides.${userId}`]: "" } },
      { returnDocument: 'after' }
    ).lean();
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Player stats ──────────────────────────────────────────────────────────────

export async function getUserOriginalsStats(userId: number) {
  try {
    await connectMongo();
    const [minesGames, plinkoGames] = await Promise.all([
      MinesGame.find({ userId, status: { $ne: "ACTIVE" } }).lean(),
      PlinkoGame.find({ userId, status: { $ne: "ACTIVE" } }).lean(),
    ]);
    const games = [
      ...minesGames.map((g) => ({ ...g, gameKey: "mines" })),
      ...plinkoGames.map((g) => ({ ...g, gameKey: "plinko" })),
    ].sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime());
    const totalGames   = games.length;
    const totalWins    = games.filter((g) => isWinningStatus((g as any).gameKey, g.status)).length;
    const totalLosses  = games.filter((g) => g.status === "LOST").length;
    const totalWagered = games.reduce((s, g) => s + g.betAmount, 0);
    const totalPaidOut = games.reduce((s, g) => s + g.payout, 0);
    return {
      success: true,
      data: {
        userId, totalGames, totalWins, totalLosses, totalWagered, totalPaidOut,
        netPnl: totalPaidOut - totalWagered,
        winRate: totalGames > 0 ? (totalWins / totalGames) * 100 : 0,
        recentGames: games.slice(0, 10).map((g) => ({ ...g, gameId: String((g as any)._id) })),
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Aviator ───────────────────────────────────────────────────────────────────

export async function getAviatorHistory(limit = 50) {
  try {
    await connectMongo();
    const data = await AviatorRound.find({ status: "CRASHED" })
      .sort({ roundId: -1 }).limit(limit).lean();
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getAviatorRoundBets(roundId: number) {
  try {
    await connectMongo();
    const data = await AviatorBet.find({ roundId }).sort({ createdAt: -1 }).lean();
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
