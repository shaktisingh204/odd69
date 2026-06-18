/**
 * audit-user-balance.ts
 *
 * Per-user forensic ledger. Pulls every row touching a single user's wallet from
 * Postgres (Transaction, CasinoTransaction, UserBonus) and MongoDB (bets), merges
 * them chronologically, and prints a running-balance ledger alongside the final
 * computed balance vs the current DB value.
 *
 * Usage:
 *   npx ts-node src/scripts/audit-user-balance.ts <userId>
 *   npx ts-node src/scripts/audit-user-balance.ts 1527
 *   npx ts-node src/scripts/audit-user-balance.ts 1527 --tail=200   # only last 200 rows
 *   npx ts-node src/scripts/audit-user-balance.ts 1527 --from=2026-04-01
 */

import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const MONGO_URI = process.env.MONGO_URI;

const args = process.argv.slice(2);
const userId = Number(args.find((a) => !a.startsWith('--')) || 0);
if (!userId) {
  console.error('Usage: audit-user-balance.ts <userId> [--tail=N] [--from=YYYY-MM-DD]');
  process.exit(1);
}
const tailArg = args.find((a) => a.startsWith('--tail='));
const tailN = tailArg ? Number(tailArg.split('=')[1]) : 0;
const fromArg = args.find((a) => a.startsWith('--from='));
const fromDate = fromArg ? new Date(fromArg.split('=')[1]) : null;

function r2(n: any): number {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function pad(s: string, n: number) {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function padR(s: string, n: number) {
  return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s;
}

type WalletField = 'balance' | 'cryptoBalance' | 'casinoBonus' | 'sportsBonus' | 'cryptoBonus';

interface LedgerEvent {
  ts: Date;
  source: string; // e.g. 'txn', 'casino', 'forfeit', 'legacy-bet'
  refId: string;
  summary: string;
  deltas: Partial<Record<WalletField, number>>;
}

async function main() {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`User ${userId} not found`);
    return;
  }

  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`  FORENSIC AUDIT — user #${userId} (${user.username ?? 'no-username'})`);
  console.log(`  role=${user.role}`);
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('── CURRENT DB WALLET STATE ──');
  const current: Record<WalletField, number> = {
    balance: r2(user.balance),
    cryptoBalance: r2((user as any).cryptoBalance),
    casinoBonus: r2((user as any).casinoBonus),
    sportsBonus: r2((user as any).sportsBonus),
    cryptoBonus: r2((user as any).cryptoBonus),
  };
  for (const k of Object.keys(current) as WalletField[]) {
    console.log(`  ${pad(k, 16)} = ${padR(current[k].toFixed(2), 14)}`);
  }
  const currentTotal = r2(
    current.balance +
      current.cryptoBalance +
      current.casinoBonus +
      current.sportsBonus +
      current.cryptoBonus,
  );
  console.log(`  ${pad('TOTAL', 16)} = ${padR(currentTotal.toFixed(2), 14)}`);
  console.log(`  exposure        = ${padR(r2((user as any).exposure).toFixed(2), 14)}`);
  console.log(`  totalDeposited  = ${padR(r2((user as any).totalDeposited).toFixed(2), 14)}`);
  console.log(`  totalWagered    = ${padR(r2((user as any).totalWagered).toFixed(2), 14)}`);
  console.log('');

  // ─────────── Postgres: Transaction rows ───────────
  const where: any = { userId };
  if (fromDate) where.createdAt = { gte: fromDate };
  const txns = await prisma.transaction.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  // ─────────── Postgres: CasinoTransaction rows ───────────
  const casinoWhere: any = { user_id: userId };
  if (fromDate) casinoWhere.timestamp = { gte: fromDate };
  const casinoTxns = await prisma.casinoTransaction.findMany({
    where: casinoWhere,
    orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
  });

  // ─────────── Postgres: UserBonus (forfeited) ───────────
  const forfeits = await prisma.userBonus.findMany({
    where: {
      userId,
      status: 'FORFEITED',
      ...(fromDate ? { forfeitedAt: { gte: fromDate } } : {}),
    },
    orderBy: [{ forfeitedAt: 'asc' }, { id: 'asc' }],
  });

  // ─────────── Postgres: UserBonus (all, for reference) ───────────
  const allBonuses = await prisma.userBonus.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }],
  });

  // ─────────── Mongo bets ───────────
  let mongoBets: any[] = [];
  if (MONGO_URI) {
    try {
      await mongoose.connect(MONGO_URI);
      const filter: any = { userId };
      if (fromDate) filter.createdAt = { $gte: fromDate };
      mongoBets = await mongoose.connection
        .collection('bets')
        .find(filter)
        .sort({ placedAt: 1, createdAt: 1 })
        .toArray();
    } catch (e: any) {
      console.log(`  (Mongo unavailable: ${e.message})`);
    }
  }

  // ─────────── Summary counts ───────────
  console.log('── RAW ROW COUNTS ──');
  console.log(`  Transaction rows:        ${txns.length}`);
  console.log(`  CasinoTransaction rows:  ${casinoTxns.length}`);
  console.log(`  UserBonus rows (all):    ${allBonuses.length}`);
  console.log(`    └─ FORFEITED:          ${forfeits.length}`);
  console.log(`  Mongo bets rows:         ${mongoBets.length}`);
  console.log('');

  // ─────────── Transaction summary by (type, status) ───────────
  console.log('── Transaction by (type, status) ──');
  const txnSummary = new Map<string, { count: number; sum: number }>();
  for (const t of txns) {
    const key = `${t.type}/${t.status}`;
    const e = txnSummary.get(key) || { count: 0, sum: 0 };
    e.count += 1;
    e.sum = r2(e.sum + Number(t.amount || 0));
    txnSummary.set(key, e);
  }
  for (const [k, v] of Array.from(txnSummary.entries()).sort()) {
    console.log(`  ${pad(k, 40)} count=${padR(String(v.count), 5)}  sum=${padR(v.sum.toFixed(2), 14)}`);
  }
  console.log('');

  // ─────────── BET_* by paymentDetails.source ───────────
  console.log('── Bet transactions by source ──');
  const srcAgg = new Map<string, any>();
  for (const t of txns) {
    if (!t.type.startsWith('BET_')) continue;
    const pd: any = t.paymentDetails || {};
    const src = String(pd.source || 'SPORTS').toUpperCase();
    const e = srcAgg.get(src) || { place: 0, win: 0, cashout: 0, refund: 0, voidDebit: 0, loss: 0, n: 0 };
    const amt = Number(t.amount || 0);
    e.n += 1;
    if (t.type === 'BET_PLACE') e.place = r2(e.place + amt);
    else if (t.type === 'BET_WIN') e.win = r2(e.win + amt);
    else if (t.type === 'BET_CASHOUT') e.cashout = r2(e.cashout + amt);
    else if (t.type === 'BET_REFUND') e.refund = r2(e.refund + amt);
    else if (t.type === 'BET_VOID_DEBIT') e.voidDebit = r2(e.voidDebit + amt);
    else if (t.type === 'BET_LOSS') e.loss += 1;
    srcAgg.set(src, e);
  }
  for (const [src, e] of Array.from(srcAgg.entries()).sort()) {
    const stake = r2(e.place - e.voidDebit);
    const returns = r2(e.win + e.cashout + e.refund);
    const net = r2(returns - stake);
    console.log(
      `  ${pad(src, 12)} rows=${padR(String(e.n), 4)} ` +
        `place=${padR(e.place.toFixed(2), 11)} ` +
        `win=${padR(e.win.toFixed(2), 11)} ` +
        `cashout=${padR(e.cashout.toFixed(2), 11)} ` +
        `refund=${padR(e.refund.toFixed(2), 9)} ` +
        `void=${padR(e.voidDebit.toFixed(2), 9)} ` +
        `lossRows=${padR(String(e.loss), 4)} ` +
        `→ NET(user)=${net >= 0 ? '+' : ''}${net.toFixed(2)}`,
    );
  }
  console.log('');

  // ─────────── CasinoTransaction summary ───────────
  console.log('── CasinoTransaction (Huidu) by (wallet_type, type) ──');
  const casinoAgg = new Map<string, { count: number; sum: number }>();
  for (const t of casinoTxns) {
    const key = `${t.wallet_type || 'fiat'}/${t.type}`;
    const e = casinoAgg.get(key) || { count: 0, sum: 0 };
    e.count += 1;
    e.sum = r2(e.sum + Number(t.amount || 0));
    casinoAgg.set(key, e);
  }
  for (const [k, v] of Array.from(casinoAgg.entries()).sort()) {
    console.log(`  ${pad(k, 24)} count=${padR(String(v.count), 6)}  sum=${padR(v.sum.toFixed(2), 14)}`);
  }
  // Net from casino
  let casinoBet = 0, casinoWin = 0;
  for (const t of casinoTxns) {
    const ty = String(t.type || '').toUpperCase();
    if (ty === 'BET' || ty === 'DEBIT') casinoBet = r2(casinoBet + Number(t.amount || 0));
    else if (ty === 'WIN' || ty === 'CREDIT' || ty === 'REFUND') casinoWin = r2(casinoWin + Number(t.amount || 0));
  }
  console.log(`  ↳ casinoBet total  = ${casinoBet.toFixed(2)}`);
  console.log(`  ↳ casinoWin total  = ${casinoWin.toFixed(2)}`);
  console.log(`  ↳ NET (win - bet)  = ${(casinoWin - casinoBet).toFixed(2)}`);
  console.log('');

  // ─────────── Bonus rows ───────────
  console.log('── UserBonus rows (all) ──');
  for (const ub of allBonuses) {
    console.log(
      `  #${ub.id} status=${pad(ub.status, 14)} ` +
        `bonusAmount=${padR(Number(ub.bonusAmount).toFixed(2), 10)} ` +
        `applicableTo=${pad(ub.applicableTo, 8)} ` +
        `currency=${pad(ub.bonusCurrency, 6)} ` +
        `forfeitedAt=${ub.forfeitedAt ? ub.forfeitedAt.toISOString() : '-'} ` +
        `completedAt=${ub.completedAt ? ub.completedAt.toISOString() : '-'}`,
    );
  }
  console.log('');

  // ─────────── Mongo bets summary ───────────
  if (mongoBets.length > 0) {
    console.log('── Mongo bets summary ──');
    const byStatus = new Map<string, { count: number; stake: number; legacy: number; modernPlace: number }>();
    for (const b of mongoBets) {
      const st = String(b.status || 'UNKNOWN').toUpperCase();
      const e = byStatus.get(st) || { count: 0, stake: 0, legacy: 0, modernPlace: 0 };
      e.count += 1;
      e.stake = r2(e.stake + Number(b.stake || 0));
      const isLegacy = !b.betSource && b.walletStakeAmount == null && b.bonusStakeAmount == null;
      if (isLegacy) e.legacy += 1;
      else e.modernPlace += 1;
      byStatus.set(st, e);
    }
    for (const [st, e] of Array.from(byStatus.entries()).sort()) {
      console.log(
        `  status=${pad(st, 14)} count=${padR(String(e.count), 5)}  ` +
          `totalStake=${padR(e.stake.toFixed(2), 12)} ` +
          `legacy(no-betSource)=${e.legacy}  modern=${e.modernPlace}`,
      );
    }
    console.log('');
  }

  // ─────────── Build deltas for every event ───────────
  const events: LedgerEvent[] = [];

  // Helper to flip sign for withdrawals/loss etc.
  const pushDelta = (
    ts: Date,
    source: string,
    refId: string,
    summary: string,
    deltas: Partial<Record<WalletField, number>>,
  ) => events.push({ ts, source, refId, summary, deltas });

  // Transactions: apply our same replay rules
  for (const t of txns) {
    const pd: any = t.paymentDetails || {};
    const type = String(t.type || '').toUpperCase();
    const status = String(t.status || '').toUpperCase();
    const amt = Number(t.amount || 0);
    const refId = `#${t.id}`;
    const src = String(pd.source || 'SPORTS').toUpperCase();

    const inferMainField = (): WalletField => {
      const cur = String(pd.depositCurrency || pd.currency || '').toUpperCase();
      const pm = String(t.paymentMethod || '').toUpperCase();
      const wf = String(pd.walletField || '');
      if (wf === 'cryptoBalance' || wf === 'cryptoBonus') return 'cryptoBalance';
      if (cur === 'CRYPTO' || pm.startsWith('CRYPTO')) return 'cryptoBalance';
      return 'balance';
    };

    const getAllocations = (): Array<{ walletField: WalletField; amount: number }> => {
      if (Array.isArray(pd.allocations) && pd.allocations.length) {
        return pd.allocations
          .map((a: any) => ({ walletField: String(a.walletField) as WalletField, amount: r2(a.amount) }))
          .filter((a: any) => a.amount > 0);
      }
      const wf = String(pd.walletField || '') as WalletField;
      if (['balance', 'cryptoBalance', 'casinoBonus', 'sportsBonus', 'cryptoBonus'].includes(wf)) {
        return [{ walletField: wf, amount: r2(amt) }];
      }
      return [{ walletField: 'balance', amount: r2(amt) }];
    };

    switch (type) {
      case 'DEPOSIT':
        if (status === 'APPROVED' || status === 'COMPLETED') {
          const wf = inferMainField();
          pushDelta(t.updatedAt, 'txn', refId, `DEPOSIT ${status}`, { [wf]: +amt });
        }
        break;
      case 'WITHDRAWAL': {
        const restored = ['REJECTED', 'CANCELLED', 'CANCELED', 'REVERSED', 'FAILED', 'REFUNDED'].includes(status);
        if (!restored) {
          const wf = inferMainField();
          pushDelta(t.createdAt, 'txn', refId, `WITHDRAWAL ${status}`, { [wf]: -amt });
        }
        break;
      }
      case 'ADMIN_DEPOSIT':
      case 'MANUAL_CREDIT':
        pushDelta(t.createdAt, 'txn', refId, type, { balance: +amt });
        break;
      case 'ADMIN_WITHDRAWAL':
      case 'MANUAL_DEBIT':
        pushDelta(t.createdAt, 'txn', refId, type, { balance: -amt });
        break;
      case 'ADMIN_REFUND_REVERSAL':
        // Explicitly ignored per user directive.
        break;
      case 'BONUS':
      case 'REFERRAL_BONUS': {
        const bt = String(pd.bonusType || '').toUpperCase();
        let field: WalletField = 'casinoBonus';
        if (bt === 'CRYPTO_BONUS') field = 'cryptoBonus';
        else if (String(pd.applicableTo || '').toUpperCase() === 'SPORTS') field = 'sportsBonus';
        pushDelta(t.createdAt, 'txn', refId, `${type} (→${field})`, { [field]: +amt });
        break;
      }
      case 'BONUS_CONVERT': {
        // Source bonus wallet -> destination main wallet
        const dest = String(pd.destinationWallet || '').toUpperCase() === 'CRYPTO_WALLET' ? 'cryptoBalance' : 'balance';
        let srcField: WalletField = 'casinoBonus';
        if (String(pd.bonusType || '').toUpperCase() === 'CRYPTO_BONUS') srcField = 'cryptoBonus';
        else if (String(pd.applicableTo || '').toUpperCase() === 'SPORTS') srcField = 'sportsBonus';
        const deduction = r2(Number(pd.deductionAmount || pd.bonusAmount || amt));
        pushDelta(t.createdAt, 'txn', refId, `BONUS_CONVERT`, {
          [srcField]: -deduction,
          [dest]: +amt,
        });
        break;
      }
      case 'BET_PLACE': {
        const allocs = getAllocations();
        const d: Partial<Record<WalletField, number>> = {};
        for (const a of allocs) d[a.walletField] = (d[a.walletField] || 0) - a.amount;
        pushDelta(t.createdAt, 'txn', refId, `BET_PLACE [${src}]`, d);
        break;
      }
      case 'BET_WIN':
      case 'BET_CASHOUT':
      case 'BET_REFUND': {
        const allocs = getAllocations();
        const d: Partial<Record<WalletField, number>> = {};
        for (const a of allocs) d[a.walletField] = (d[a.walletField] || 0) + a.amount;
        pushDelta(t.createdAt, 'txn', refId, `${type} [${src}]`, d);
        break;
      }
      case 'BET_VOID_DEBIT':
      case 'BET_SETTLEMENT_REVERT_DEBIT': {
        const allocs = getAllocations();
        const d: Partial<Record<WalletField, number>> = {};
        for (const a of allocs) d[a.walletField] = (d[a.walletField] || 0) - a.amount;
        pushDelta(t.createdAt, 'txn', refId, `${type} [${src}]`, d);
        break;
      }
      case 'BET_LOSS':
        // no balance change
        break;
      default:
        pushDelta(t.createdAt, 'txn', refId, `? ${type} (unhandled)`, {});
    }
  }

  // Casino rows — simple wallet_type mapping (not the greedy router, but close enough for diagnosis)
  for (const t of casinoTxns) {
    const ty = String(t.type || '').toUpperCase();
    const amt = Number(t.amount || 0);
    const field: WalletField = String(t.wallet_type || '').toLowerCase() === 'crypto' ? 'cryptoBalance' : 'balance';
    const refId = `#${t.id}(${t.round_id || '-'})`;
    if (ty === 'BET' || ty === 'DEBIT') {
      pushDelta(t.timestamp, 'casino', refId, `HUIDU BET ${t.game_name || t.game_code || ''}`, { [field]: -amt });
    } else if (ty === 'WIN' || ty === 'CREDIT' || ty === 'REFUND') {
      pushDelta(t.timestamp, 'casino', refId, `HUIDU ${ty} ${t.game_name || t.game_code || ''}`, { [field]: +amt });
    }
  }

  // Forfeits
  for (const ub of forfeits) {
    if (!ub.forfeitedAt) continue;
    const isCrypto = String(ub.bonusCurrency || '').toUpperCase() === 'CRYPTO';
    const app = String(ub.applicableTo || 'BOTH').toUpperCase();
    let field: WalletField;
    if (isCrypto) field = 'cryptoBonus';
    else if (app === 'SPORTS') field = 'sportsBonus';
    else field = 'casinoBonus';
    pushDelta(ub.forfeitedAt, 'forfeit', `UB#${ub.id}`, `BONUS_FORFEIT (${ub.bonusCode || '-'})`, {
      [field]: -r2(ub.bonusAmount),
    });
  }

  // Legacy sports bets from Mongo
  for (const b of mongoBets) {
    const isLegacy = !b.betSource && b.walletStakeAmount == null && b.bonusStakeAmount == null;
    if (!isLegacy) continue;
    const placedAt = b.placedAt || b.createdAt;
    const stake = r2(b.stake || 0);
    const field: WalletField = String(b.walletType || '').toLowerCase() === 'crypto' ? 'cryptoBalance' : 'balance';
    if (placedAt && stake > 0) {
      pushDelta(new Date(placedAt), 'legacy-bet', String(b._id), `LEGACY sports BET_PLACE`, { [field]: -stake });
    }
    const resolvedAt = b.cashedOutAt || b.settledAt || b.result_posted_at;
    const st = String(b.status || '').toUpperCase();
    if (resolvedAt) {
      if (st === 'WON') {
        const odds = Number(b.odds || 0);
        const pw = Number(b.potentialWin || 0);
        const payout = pw > 0 ? r2(stake + pw) : odds > 0 ? r2(stake * odds) : stake;
        pushDelta(new Date(resolvedAt), 'legacy-bet', String(b._id), `LEGACY sports WON (odds=${odds})`, { [field]: +payout });
      } else if (st === 'VOID' || st === 'REFUNDED' || st === 'CASHED_OUT') {
        pushDelta(new Date(resolvedAt), 'legacy-bet', String(b._id), `LEGACY sports ${st}`, { [field]: +stake });
      }
      // LOST → nothing
    }
  }

  // Sort chronologically
  events.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  // ─────────── Play the ledger ───────────
  const wallets: Record<WalletField, number> = {
    balance: 0,
    cryptoBalance: 0,
    casinoBonus: 0,
    sportsBonus: 0,
    cryptoBonus: 0,
  };

  const tailStart = tailN > 0 ? Math.max(0, events.length - tailN) : 0;
  if (tailStart > 0) {
    // Apply pre-tail events silently to get the starting state
    for (let i = 0; i < tailStart; i++) {
      const e = events[i];
      for (const k of Object.keys(e.deltas) as WalletField[]) {
        wallets[k] = r2(wallets[k] + (e.deltas[k] || 0));
      }
    }
    console.log(`── LEDGER (last ${events.length - tailStart} events; ${tailStart} earlier events folded in) ──`);
    console.log(
      `  starting: balance=${wallets.balance.toFixed(2)} crypto=${wallets.cryptoBalance.toFixed(2)} casinoBonus=${wallets.casinoBonus.toFixed(2)} sportsBonus=${wallets.sportsBonus.toFixed(2)} cryptoBonus=${wallets.cryptoBonus.toFixed(2)}`,
    );
  } else {
    console.log(`── LEDGER (all ${events.length} events) ──`);
  }

  for (let i = tailStart; i < events.length; i++) {
    const e = events[i];
    for (const k of Object.keys(e.deltas) as WalletField[]) {
      wallets[k] = r2(wallets[k] + (e.deltas[k] || 0));
    }
    const deltaStr = Object.entries(e.deltas)
      .map(([k, v]) => `${k}${(v as number) >= 0 ? '+' : ''}${(v as number).toFixed(2)}`)
      .join(' ');
    console.log(
      `  ${e.ts.toISOString()} ${pad(e.source, 11)} ${pad(e.refId, 18)} ${pad(e.summary, 42)}  ${pad(deltaStr, 38)}  → bal=${wallets.balance.toFixed(2)} cB=${wallets.casinoBonus.toFixed(2)} sB=${wallets.sportsBonus.toFixed(2)}`,
    );
  }

  console.log('');
  console.log('── FINAL COMPUTED vs CURRENT ──');
  const totalComputed = r2(
    wallets.balance + wallets.cryptoBalance + wallets.casinoBonus + wallets.sportsBonus + wallets.cryptoBonus,
  );
  for (const k of Object.keys(wallets) as WalletField[]) {
    const diff = r2(wallets[k] - current[k]);
    console.log(
      `  ${pad(k, 16)} computed=${padR(wallets[k].toFixed(2), 14)}  current=${padR(current[k].toFixed(2), 14)}  diff=${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`,
    );
  }
  const totalDiff = r2(totalComputed - currentTotal);
  console.log(
    `  ${pad('TOTAL', 16)} computed=${padR(totalComputed.toFixed(2), 14)}  current=${padR(currentTotal.toFixed(2), 14)}  diff=${totalDiff >= 0 ? '+' : ''}${totalDiff.toFixed(2)}`,
  );
  console.log('════════════════════════════════════════════════════════════════════');
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
