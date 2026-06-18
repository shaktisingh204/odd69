import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const MONGO_URI = process.env.MONGO_URI;

// Accept userId as CLI arg, default 1527.
const USER_ID = Number(process.argv[2] || 1527);

function round2(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

async function main() {
  console.log(`\n════════ INVESTIGATION: user=${USER_ID} ════════\n`);

  // 1) Current user row
  const user = await prisma.user.findUnique({ where: { id: USER_ID } });
  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('── Current DB wallet state ──');
  console.log(`  username=${user.username}`);
  console.log(`  role=${user.role}`);
  console.log(`  balance         = ${(user.balance ?? 0).toFixed(2)}`);
  console.log(`  cryptoBalance   = ${(user.cryptoBalance ?? 0).toFixed(2)}`);
  console.log(`  casinoBonus     = ${(user.casinoBonus ?? 0).toFixed(2)}`);
  console.log(`  sportsBonus     = ${(user.sportsBonus ?? 0).toFixed(2)}`);
  console.log(`  cryptoBonus     = ${(user.cryptoBonus ?? 0).toFixed(2)}`);
  console.log(`  fiatBonus       = ${(user.fiatBonus ?? 0).toFixed(2)}`);
  console.log(`  exposure        = ${(user.exposure ?? 0).toFixed(2)}`);
  console.log(`  totalDeposited  = ${(user.totalDeposited ?? 0).toFixed(2)}`);
  console.log(`  totalWagered    = ${(user.totalWagered ?? 0).toFixed(2)}`);
  console.log(
    `  SUM(all wallets)= ${(
      (user.balance ?? 0) +
      (user.cryptoBalance ?? 0) +
      (user.casinoBonus ?? 0) +
      (user.sportsBonus ?? 0) +
      (user.cryptoBonus ?? 0)
    ).toFixed(2)}`,
  );

  // 2) Transaction rows, grouped by (type, status)
  console.log('\n── Transaction rows by (type, status) ──');
  const txns = await prisma.transaction.findMany({
    where: { userId: USER_ID },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  console.log(`  total Transaction rows: ${txns.length}`);
  const txnSummary = new Map<string, { count: number; sum: number }>();
  for (const t of txns) {
    const key = `${t.type}/${t.status}`;
    const entry = txnSummary.get(key) || { count: 0, sum: 0 };
    entry.count += 1;
    entry.sum = round2(entry.sum + (t.amount || 0));
    txnSummary.set(key, entry);
  }
  for (const [key, v] of Array.from(txnSummary.entries()).sort()) {
    console.log(
      `    ${key.padEnd(40)} count=${String(v.count).padStart(6)}  sumAmount=${v.sum.toFixed(2)}`,
    );
  }

  // 2b) Break BET_PLACE / BET_WIN / BET_CASHOUT / BET_REFUND / BET_VOID_DEBIT by source
  console.log('\n── Bet transactions by paymentDetails.source ──');
  const sourceSummary = new Map<
    string,
    { placeCount: number; placeSum: number; winCount: number; winSum: number; cashoutCount: number; cashoutSum: number; refundCount: number; refundSum: number; voidCount: number; voidSum: number; lossCount: number }
  >();
  for (const t of txns) {
    const pd: any = t.paymentDetails || {};
    const source = String(pd.source || 'SPORTS').toUpperCase();
    const entry =
      sourceSummary.get(source) || {
        placeCount: 0,
        placeSum: 0,
        winCount: 0,
        winSum: 0,
        cashoutCount: 0,
        cashoutSum: 0,
        refundCount: 0,
        refundSum: 0,
        voidCount: 0,
        voidSum: 0,
        lossCount: 0,
      };
    if (t.type === 'BET_PLACE') {
      entry.placeCount += 1;
      entry.placeSum = round2(entry.placeSum + (t.amount || 0));
    } else if (t.type === 'BET_WIN') {
      entry.winCount += 1;
      entry.winSum = round2(entry.winSum + (t.amount || 0));
    } else if (t.type === 'BET_CASHOUT') {
      entry.cashoutCount += 1;
      entry.cashoutSum = round2(entry.cashoutSum + (t.amount || 0));
    } else if (t.type === 'BET_REFUND') {
      entry.refundCount += 1;
      entry.refundSum = round2(entry.refundSum + (t.amount || 0));
    } else if (t.type === 'BET_VOID_DEBIT') {
      entry.voidCount += 1;
      entry.voidSum = round2(entry.voidSum + (t.amount || 0));
    } else if (t.type === 'BET_LOSS') {
      entry.lossCount += 1;
    } else {
      continue;
    }
    sourceSummary.set(source, entry);
  }
  for (const [source, v] of Array.from(sourceSummary.entries()).sort()) {
    const stake = round2(v.placeSum - v.voidSum);
    const returns = round2(v.winSum + v.cashoutSum + v.refundSum);
    const net = round2(returns - stake);
    console.log(
      `    ${source.padEnd(12)} place=${v.placeCount}/${v.placeSum.toFixed(2)}  ` +
        `win=${v.winCount}/${v.winSum.toFixed(2)}  ` +
        `cashout=${v.cashoutCount}/${v.cashoutSum.toFixed(2)}  ` +
        `refund=${v.refundCount}/${v.refundSum.toFixed(2)}  ` +
        `voidDebit=${v.voidCount}/${v.voidSum.toFixed(2)}  ` +
        `loss=${v.lossCount}  ` +
        `→ NET_TO_USER=${net >= 0 ? '+' : ''}${net.toFixed(2)}`,
    );
  }

  // 3) CasinoTransaction rows (Huidu provider)
  console.log('\n── CasinoTransaction rows (Huidu) ──');
  const casinoTxns = await prisma.casinoTransaction.findMany({
    where: { user_id: USER_ID },
    orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
  });
  console.log(`  total CasinoTransaction rows: ${casinoTxns.length}`);
  const casinoSummary = new Map<
    string,
    { betCount: number; betSum: number; winCount: number; winSum: number; updCount: number }
  >();
  for (const t of casinoTxns) {
    const key = String(t.wallet_type || 'fiat');
    const entry =
      casinoSummary.get(key) || {
        betCount: 0,
        betSum: 0,
        winCount: 0,
        winSum: 0,
        updCount: 0,
      };
    const type = String(t.type || '').toUpperCase();
    if (type === 'BET' || type === 'DEBIT') {
      entry.betCount += 1;
      entry.betSum = round2(entry.betSum + (t.amount || 0));
    } else if (type === 'WIN' || type === 'CREDIT' || type === 'REFUND') {
      entry.winCount += 1;
      entry.winSum = round2(entry.winSum + (t.amount || 0));
    } else {
      entry.updCount += 1;
    }
    casinoSummary.set(key, entry);
  }
  for (const [walletType, v] of Array.from(casinoSummary.entries()).sort()) {
    const net = round2(v.winSum - v.betSum);
    console.log(
      `    walletType=${walletType.padEnd(6)} bet=${v.betCount}/${v.betSum.toFixed(2)}  ` +
        `win=${v.winCount}/${v.winSum.toFixed(2)}  ` +
        `update=${v.updCount}  ` +
        `→ NET_TO_USER=${net >= 0 ? '+' : ''}${net.toFixed(2)}`,
    );
  }

  // 4) MongoDB — every bet-like collection
  if (!MONGO_URI) {
    console.log('\n── Mongo: SKIPPED (no MONGO_URI) ──');
    return;
  }
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  const collections = await db.listCollections().toArray();
  const betLikeNames = collections
    .map((c) => c.name)
    .filter((n) =>
      /bet|game|mines|aviator|limbo|dice|plinko|casino|round|wager/i.test(n),
    )
    .sort();

  console.log('\n── Mongo bet-like collections found ──');
  console.log(`  ${betLikeNames.join(', ')}`);

  for (const name of betLikeNames) {
    const col = db.collection(name);
    const count = await col.countDocuments({ userId: USER_ID });
    if (count === 0) continue;

    console.log(`\n  collection=${name}  userDocs=${count}`);

    // Try a few common aggregation shapes
    try {
      const stakeSum = await col
        .aggregate([
          { $match: { userId: USER_ID } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              stakeSum: { $sum: { $ifNull: ['$stake', { $ifNull: ['$betAmount', 0] }] } },
              paidSum: {
                $sum: {
                  $ifNull: [
                    '$payout',
                    { $ifNull: ['$potentialWin', { $ifNull: ['$cashoutValue', 0] }] },
                  ],
                },
              },
              walletStakeSum: { $sum: { $ifNull: ['$walletStakeAmount', 0] } },
              bonusStakeSum: { $sum: { $ifNull: ['$bonusStakeAmount', 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();
      for (const r of stakeSum) {
        console.log(
          `    status=${String(r._id).padEnd(14)} count=${String(r.count).padStart(6)}  ` +
            `stake=${(r.stakeSum || 0).toFixed(2)}  ` +
            `walletStake=${(r.walletStakeSum || 0).toFixed(2)}  ` +
            `bonusStake=${(r.bonusStakeSum || 0).toFixed(2)}  ` +
            `payout=${(r.paidSum || 0).toFixed(2)}`,
        );
      }
    } catch (e: any) {
      console.log(`    aggregation failed: ${e.message}`);
    }
  }

  // 5) Cross-check: compare Mongo bets vs Prisma Transaction BET_PLACE for sports
  console.log('\n── Cross-check: Mongo `bets` vs Transaction(BET_PLACE, source=SPORTS) ──');
  try {
    const mongoBetsAgg = await db
      .collection('bets')
      .aggregate([
        { $match: { userId: USER_ID } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalStake: { $sum: { $ifNull: ['$stake', 0] } },
          },
        },
      ])
      .toArray();
    const mongoBets = mongoBetsAgg[0] || { count: 0, totalStake: 0 };

    const sportsSrc = sourceSummary.get('SPORTS') || ({ placeCount: 0, placeSum: 0 } as any);

    console.log(
      `    Mongo bets:        count=${mongoBets.count}  totalStake=${(mongoBets.totalStake || 0).toFixed(2)}`,
    );
    console.log(
      `    Prisma BET_PLACE:  count=${sportsSrc.placeCount}  totalStake=${(sportsSrc.placeSum || 0).toFixed(2)}`,
    );
    console.log(
      `    GAP (mongo − prisma stake): ${((mongoBets.totalStake || 0) - (sportsSrc.placeSum || 0)).toFixed(2)}`,
    );
  } catch (e: any) {
    console.log(`    cross-check failed: ${e.message}`);
  }

  console.log('\n════════ END ════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
