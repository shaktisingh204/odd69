/**
 * wipe-user-bet-history.ts
 *
 * Deletes a user's bet history and resets their wallets to zero, while KEEPING
 * all `DEPOSIT` and `WITHDRAWAL` rows so the money-movement audit trail stays intact.
 *
 * What it deletes (per user):
 *   • Transaction rows where type starts with BET_ (BET_PLACE, BET_WIN, BET_LOSS,
 *     BET_CASHOUT, BET_REFUND, BET_VOID_DEBIT, BET_SETTLEMENT_REVERT_DEBIT)
 *   • CasinoTransaction rows (all Huidu provider history)
 *   • MongoDB `bets` documents (sportsbook bets — new bets service + legacy sports service)
 *   • MongoDB `mines_games` documents (Zeero Originals)
 *   • MongoDB `aviator_bets` documents
 *   • MongoDB `limbo_bets` documents
 *   • MongoDB `plinko_games` documents
 *   • MongoDB `dice_games` documents
 *   • MongoDB `orders` documents (sports limit orders — legacy matching engine)
 *   • MongoDB `trades` documents that reference any of the user's deleted orders
 *
 * What it KEEPS:
 *   • Transaction rows of type DEPOSIT, WITHDRAWAL, ADMIN_DEPOSIT, ADMIN_WITHDRAWAL,
 *     MANUAL_CREDIT, MANUAL_DEBIT, BONUS, BONUS_CONVERT, REFERRAL_BONUS, etc.
 *   • UserBonus rows (untouched)
 *
 * What it resets on `user`:
 *   • balance = 0
 *   • cryptoBalance = 0
 *   • casinoBonus = 0, sportsBonus = 0, cryptoBonus = 0, fiatBonus = 0
 *   • exposure = 0
 *   • totalWagered = 0
 *   • wagering counters (casinoBonusWageringDone, sportsBonusWageringDone,
 *     wageringDone, depositWageringDone) = 0
 *
 * Kept on `user`:
 *   • totalDeposited (unchanged — reflects lifetime deposits)
 *   • KYC, role, referral, profile fields, etc.
 *
 * Usage:
 *   npx ts-node src/scripts/wipe-user-bet-history.ts --userId=1527            # dry run
 *   npx ts-node src/scripts/wipe-user-bet-history.ts --userId=1527 --apply    # actually delete
 *   npx ts-node src/scripts/wipe-user-bet-history.ts --all                    # every USER role, dry run
 *   npx ts-node src/scripts/wipe-user-bet-history.ts --all --apply            # every USER role, apply
 *   npx ts-node src/scripts/wipe-user-bet-history.ts --userId=1527 --skip-mongo
 */

import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const MONGO_URI = process.env.MONGO_URI;

const BET_TYPES = [
  'BET_PLACE',
  'BET_WIN',
  'BET_LOSS',
  'BET_CASHOUT',
  'BET_REFUND',
  'BET_VOID_DEBIT',
  'BET_SETTLEMENT_REVERT_DEBIT',
];

// Mongo collections that hold bet documents keyed by `userId` (number).
const MONGO_BET_COLLECTIONS_USERID = [
  'bets', // sportsbook (new bets service + legacy sports service)
  'mines_games',
  'aviator_bets',
  'limbo_bets',
  'plinko_games',
  'dice_games',
];

// Mongo collections keyed by `user_id` (snake_case, different convention).
const MONGO_BET_COLLECTIONS_USER_ID_SNAKE = [
  'orders', // sports limit orders from legacy matching engine
];

type Args = {
  userId?: number;
  all: boolean;
  apply: boolean;
  skipMongo: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const hit = args.find((a) => a.startsWith(`${name}=`));
    return hit ? hit.slice(name.length + 1) : undefined;
  };
  const has = (name: string) => args.includes(name);
  const userIdStr = get('--userId');
  return {
    userId: userIdStr ? Number(userIdStr) : undefined,
    all: has('--all'),
    apply: has('--apply'),
    skipMongo: has('--skip-mongo'),
  };
}

async function connectMongoIfNeeded(skip: boolean) {
  if (skip || !MONGO_URI) return false;
  try {
    await mongoose.connect(MONGO_URI);
    return true;
  } catch (err) {
    console.warn(
      `[WipeBetHistory] Mongo unavailable — skipping Mongo cleanup: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

async function processUser(userId: number, apply: boolean, mongoConnected: boolean) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      role: true,
      balance: true,
      cryptoBalance: true,
      casinoBonus: true,
      sportsBonus: true,
      cryptoBonus: true,
      fiatBonus: true,
      exposure: true,
      totalWagered: true,
    },
  });
  if (!user) {
    console.log(`[WipeBetHistory] user=${userId}  NOT FOUND — skipping`);
    return;
  }

  // Count what WOULD be deleted.
  const txnBetCount = await prisma.transaction.count({
    where: { userId, type: { in: BET_TYPES } },
  });
  const casinoCount = await prisma.casinoTransaction.count({ where: { user_id: userId } });

  // Match both number AND string representations of the id, because some legacy
  // Mongo rows have `userId` as a string even though the current schema says number.
  const uidFilterUserId = { userId: { $in: [userId, String(userId)] } };
  const uidFilterUserIdSnake = { user_id: { $in: [userId, String(userId)] } };

  const mongoCounts: Record<string, number> = {};
  let userOrderIds: any[] = [];
  if (mongoConnected) {
    for (const name of MONGO_BET_COLLECTIONS_USERID) {
      try {
        const col = mongoose.connection.collection(name);
        const n = await col.countDocuments(uidFilterUserId);
        if (n > 0) mongoCounts[name] = n;
      } catch {
        // Collection doesn't exist — ignore.
      }
    }
    for (const name of MONGO_BET_COLLECTIONS_USER_ID_SNAKE) {
      try {
        const col = mongoose.connection.collection(name);
        const n = await col.countDocuments(uidFilterUserIdSnake);
        if (n > 0) mongoCounts[name] = n;
      } catch {
        // ignore
      }
    }
    // Diagnostic: for each bet-like collection, check whether ANY document exists
    // for this user under an unexpected field/type combination, so we can flag it.
    if (!apply) {
      for (const name of [...MONGO_BET_COLLECTIONS_USERID, ...MONGO_BET_COLLECTIONS_USER_ID_SNAKE]) {
        try {
          const col = mongoose.connection.collection(name);
          const sample = await col.findOne(
            {
              $or: [
                { userId: userId },
                { userId: String(userId) },
                { user_id: userId },
                { user_id: String(userId) },
              ],
            },
            { projection: { userId: 1, user_id: 1, _id: 0 } },
          );
          if (sample && (sample.userId != null || sample.user_id != null)) {
            const type = sample.userId != null ? typeof sample.userId : typeof sample.user_id;
            if (type === 'string') {
              console.log(
                `[WipeBetHistory]   ↳ NOTE: mongo ${name} stores user id as STRING — script will match both types.`,
              );
            }
          }
        } catch {
          // ignore
        }
      }
    }

    // Collect the user's order _ids so we can nuke matching `trades` rows that
    // reference them (trades have no user field of their own).
    try {
      const orders = await mongoose.connection
        .collection('orders')
        .find(uidFilterUserIdSnake)
        .project({ _id: 1 })
        .toArray();
      userOrderIds = orders.map((o: any) => o._id);
      if (userOrderIds.length > 0) {
        const tradeCount = await mongoose.connection
          .collection('trades')
          .countDocuments({
            $or: [
              { buyOrderId: { $in: userOrderIds } },
              { sellOrderId: { $in: userOrderIds } },
            ],
          });
        if (tradeCount > 0) mongoCounts.trades = tradeCount;
      }
    } catch {
      // ignore — orders/trades collection may not exist
    }
  }

  const before = {
    balance: Number(user.balance || 0),
    cryptoBalance: Number(user.cryptoBalance || 0),
    casinoBonus: Number(user.casinoBonus || 0),
    sportsBonus: Number(user.sportsBonus || 0),
    cryptoBonus: Number(user.cryptoBonus || 0),
    fiatBonus: Number(user.fiatBonus || 0),
    exposure: Number(user.exposure || 0),
    totalWagered: Number(user.totalWagered || 0),
  };

  const header = `[WipeBetHistory] user=${user.id}${user.username ? ` (${user.username})` : ''} role=${user.role}`;
  console.log(
    [
      header,
      `txnBET_rows=${txnBetCount}`,
      `casinoTransactions=${casinoCount}`,
      Object.keys(mongoCounts).length
        ? `mongo={${Object.entries(mongoCounts).map(([k, v]) => `${k}:${v}`).join(', ')}}`
        : 'mongo=none',
      `current[bal=${before.balance.toFixed(2)} crypto=${before.cryptoBalance.toFixed(2)} cBonus=${before.casinoBonus.toFixed(2)} sBonus=${before.sportsBonus.toFixed(2)} exposure=${before.exposure.toFixed(2)} wagered=${before.totalWagered.toFixed(2)}]`,
      apply ? 'APPLY' : 'DRY-RUN',
    ].join(' '),
  );

  if (!apply) return;

  // ── Apply: wrap Postgres deletes + user reset in a single transaction ──
  await prisma.$transaction(async (tx) => {
    const delTxn = await tx.transaction.deleteMany({
      where: { userId, type: { in: BET_TYPES } },
    });
    const delCasino = await tx.casinoTransaction.deleteMany({ where: { user_id: userId } });

    await tx.user.update({
      where: { id: userId },
      data: {
        balance: 0,
        cryptoBalance: 0,
        casinoBonus: 0,
        sportsBonus: 0,
        cryptoBonus: 0,
        fiatBonus: 0,
        exposure: 0,
        totalWagered: 0,
        wageringRequired: 0,
        wageringDone: 0,
        casinoBonusWageringRequired: 0,
        casinoBonusWageringDone: 0,
        sportsBonusWageringRequired: 0,
        sportsBonusWageringDone: 0,
        depositWageringDone: 0,
      },
    });

    console.log(
      `[WipeBetHistory]   ↳ deleted txn.BET=${delTxn.count} casinoTxn=${delCasino.count}`,
    );
  });

  // ── Mongo deletes (best-effort, per collection) ─────────────────────────
  if (mongoConnected) {
    // Trades first (before their parent orders are deleted), then per-user collections.
    if (userOrderIds.length > 0) {
      try {
        const res = await mongoose.connection.collection('trades').deleteMany({
          $or: [
            { buyOrderId: { $in: userOrderIds } },
            { sellOrderId: { $in: userOrderIds } },
          ],
        });
        if (res.deletedCount && res.deletedCount > 0) {
          console.log(`[WipeBetHistory]   ↳ mongo trades: deleted ${res.deletedCount}`);
        }
      } catch (err) {
        console.warn(
          `[WipeBetHistory]   ↳ mongo trades failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    for (const name of MONGO_BET_COLLECTIONS_USERID) {
      try {
        const col = mongoose.connection.collection(name);
        const res = await col.deleteMany(uidFilterUserId);
        if (res.deletedCount && res.deletedCount > 0) {
          console.log(`[WipeBetHistory]   ↳ mongo ${name}: deleted ${res.deletedCount}`);
        }
      } catch (err) {
        console.warn(
          `[WipeBetHistory]   ↳ mongo ${name} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    for (const name of MONGO_BET_COLLECTIONS_USER_ID_SNAKE) {
      try {
        const col = mongoose.connection.collection(name);
        const res = await col.deleteMany(uidFilterUserIdSnake);
        if (res.deletedCount && res.deletedCount > 0) {
          console.log(`[WipeBetHistory]   ↳ mongo ${name}: deleted ${res.deletedCount}`);
        }
      } catch (err) {
        console.warn(
          `[WipeBetHistory]   ↳ mongo ${name} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}

async function main() {
  const { userId, all, apply, skipMongo } = parseArgs();

  if (!userId && !all) {
    console.error('Usage: wipe-user-bet-history.ts --userId=N | --all  [--apply] [--skip-mongo]');
    process.exit(1);
  }

  console.log(`[WipeBetHistory] Mode: ${apply ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}`);
  if (userId) console.log(`[WipeBetHistory] Scope: single user id=${userId}`);
  if (all) console.log(`[WipeBetHistory] Scope: every user with role=USER`);
  if (skipMongo) console.log('[WipeBetHistory] Mongo cleanup: SKIPPED');

  const mongoConnected = await connectMongoIfNeeded(skipMongo);
  if (!mongoConnected && !skipMongo) {
    console.log('[WipeBetHistory] Mongo cleanup: DISABLED (not connected)');
  }

  if (userId) {
    await processUser(userId, apply, mongoConnected);
  } else if (all) {
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    console.log(`[WipeBetHistory] Processing ${users.length} users with role=USER`);
    let i = 0;
    for (const u of users) {
      i += 1;
      try {
        await processUser(u.id, apply, mongoConnected);
      } catch (err) {
        console.error(
          `[WipeBetHistory] user=${u.id} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (i % 100 === 0) console.log(`[WipeBetHistory] progress: ${i}/${users.length}`);
    }
  }

  console.log('[WipeBetHistory] Done.');
}

main()
  .catch((err) => {
    console.error('[WipeBetHistory] Fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
