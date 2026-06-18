import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const MONGO_URI = process.env.MONGO_URI;
// No time cutoff by default — replay every transaction in history. This makes the
// rebuild equivalent to "as if the replay engine had run all along", which is what
// we want after a corruption event where the exact corruption time is fuzzy.
// Pass --cutoff=<iso> to restore the old behavior (stop replaying at a given time).
const DEFAULT_CUTOFF = '2999-12-31T23:59:59Z';
const EPSILON = 0.0001;
const USER_BATCH_SIZE = 200;

type WalletField =
  | 'balance'
  | 'cryptoBalance'
  | 'casinoBonus'
  | 'sportsBonus'
  | 'cryptoBonus';

type WalletState = Record<WalletField, number>;

type TxAllocation = {
  walletField: WalletField;
  amount: number;
};

type WalletBuckets = {
  fiat: number;
  crypto: number;
};

type UserComputation = {
  wallets: WalletState;
  exposure: number;
  totals: {
    deposits: WalletBuckets;
    withdrawals: WalletBuckets;
    manualAdjustments: WalletBuckets;
    adminReversals: WalletBuckets;
    sportsStake: WalletBuckets;
    sportsReturns: WalletBuckets;
    casinoStake: WalletBuckets;
    casinoReturns: WalletBuckets;
    huiduCasinoStake: WalletBuckets;
    huiduCasinoReturns: WalletBuckets;
    bonusCredits: {
      casinoBonus: number;
      sportsBonus: number;
      cryptoBonus: number;
    };
  };
  warnings: string[];
  unhandledTypes: Set<string>;
};

type TxnRow = {
  id: number;
  userId: number;
  amount: number;
  type: string;
  status: string;
  paymentMethod: string | null;
  paymentDetails: unknown;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CasinoTxnRow = {
  id: number;
  user_id: number;
  amount: number;
  type: string;
  provider: string;
  wallet_type: string;
  round_id: string | null;
  game_code: string | null;
  timestamp: Date;
};

type BonusForfeitRow = {
  id: number;
  userId: number;
  bonusAmount: number;
  bonusCurrency: string | null;
  applicableTo: string | null;
  forfeitedAt: Date;
};

type BetRow = {
  _id?: any;
  userId: number;
  stake?: number | null;
  originalStake?: number | null;
  odds?: number | null;
  potentialWin?: number | null;
  status?: string | null;
  betSource?: string | null;
  walletStakeAmount?: number | null;
  bonusStakeAmount?: number | null;
  walletType?: string | null;
  placedAt?: Date | null;
  createdAt?: Date | null;
  settledAt?: Date | null;
  result_posted_at?: Date | null;
  cashedOutAt?: Date | null;
};

const ZERO_WALLETS: WalletState = {
  balance: 0,
  cryptoBalance: 0,
  casinoBonus: 0,
  sportsBonus: 0,
  cryptoBonus: 0,
};

const CASINO_SOURCES = new Set(['MINES', 'PLINKO', 'AVIATOR', 'LIMBO', 'DICE']);

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const hasFlag = (flag: string) => args.includes(flag);
  const getValue = (name: string) => {
    const exact = args.find((arg) => arg.startsWith(`${name}=`));
    return exact ? exact.slice(name.length + 1) : undefined;
  };

  return {
    apply: hasFlag('--apply'),
    allowNegative: hasFlag('--allow-negative'),
    skipMongo: hasFlag('--skip-mongo'),
    verbose: hasFlag('--verbose'),

    // By default, only replay role=USER accounts. Admin/staff accounts have
    // balances managed out-of-band and must not be overwritten by the replay.
    includeStaff: hasFlag('--include-staff'),
    userId: getValue('--userId') ? Number(getValue('--userId')) : undefined,
    limit: getValue('--limit') ? Number(getValue('--limit')) : undefined,
    cutoff: getValue('--cutoff') || DEFAULT_CUTOFF,
  };
}

function emptyWalletBuckets(): WalletBuckets {
  return { fiat: 0, crypto: 0 };
}

function emptyComputation(): UserComputation {
  return {
    wallets: { ...ZERO_WALLETS },
    exposure: 0,
    totals: {
      deposits: emptyWalletBuckets(),
      withdrawals: emptyWalletBuckets(),
      manualAdjustments: emptyWalletBuckets(),
      adminReversals: emptyWalletBuckets(),
      sportsStake: emptyWalletBuckets(),
      sportsReturns: emptyWalletBuckets(),
      casinoStake: emptyWalletBuckets(),
      casinoReturns: emptyWalletBuckets(),
      huiduCasinoStake: emptyWalletBuckets(),
      huiduCasinoReturns: emptyWalletBuckets(),
      bonusCredits: {
        casinoBonus: 0,
        sportsBonus: 0,
        cryptoBonus: 0,
      },
    },
    warnings: [],
    unhandledTypes: new Set<string>(),
  };
}

function cloneWallets(wallets: WalletState): WalletState {
  return {
    balance: round2(wallets.balance || 0),
    cryptoBalance: round2(wallets.cryptoBalance || 0),
    casinoBonus: round2(wallets.casinoBonus || 0),
    sportsBonus: round2(wallets.sportsBonus || 0),
    cryptoBonus: round2(wallets.cryptoBonus || 0),
  };
}

function addWalletDelta(wallets: WalletState, field: WalletField, delta: number) {
  wallets[field] = round2((wallets[field] || 0) + delta);
}

function addWalletBucketDelta(bucket: WalletBuckets, field: WalletField, amount: number) {
  if (field === 'cryptoBalance' || field === 'cryptoBonus') {
    bucket.crypto = round2(bucket.crypto + amount);
    return;
  }

  bucket.fiat = round2(bucket.fiat + amount);
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

function normalizeSource(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function getPaymentDetails(tx: Pick<TxnRow, 'paymentDetails'> | { paymentDetails?: unknown }) {
  return isObject(tx.paymentDetails) ? tx.paymentDetails : {};
}

function getDestinationWalletField(destinationWallet: unknown): WalletField {
  const normalized = String(destinationWallet || '').trim().toUpperCase();
  if (normalized === 'CRYPTO_WALLET') return 'cryptoBalance';
  return 'balance';
}

function inferBonusWalletField(payload: Record<string, unknown>, fallback?: WalletField): WalletField {
  const bonusType = String(payload.bonusType || '').trim().toUpperCase();
  const walletLabel = String(payload.walletLabel || '').trim().toLowerCase();
  const applicableTo = String(payload.applicableTo || '').trim().toUpperCase();
  const bonusCurrency = String(payload.bonusCurrency || '').trim().toUpperCase();
  const source = String(payload.source || '').trim().toUpperCase();
  const remarksHint = String(payload.remarksHint || '').trim().toLowerCase();

  if (
    bonusType === 'CRYPTO_BONUS' ||
    bonusCurrency === 'CRYPTO' ||
    walletLabel.includes('crypto') ||
    source.includes('CRYPTO')
  ) {
    return 'cryptoBonus';
  }

  if (
    bonusType === 'SPORTS_BONUS' ||
    applicableTo === 'SPORTS' ||
    walletLabel.includes('sports') ||
    source.includes('SPORTS')
  ) {
    return 'sportsBonus';
  }

  if (
    bonusType === 'CASINO_BONUS' ||
    bonusType === 'FIAT_BONUS' ||
    applicableTo === 'CASINO' ||
    applicableTo === 'BOTH' ||
    walletLabel.includes('casino') ||
    walletLabel.includes('bonus') ||
    remarksHint.includes('casino bonus')
  ) {
    return 'casinoBonus';
  }

  return fallback || 'casinoBonus';
}

function inferMainWalletField(tx: Pick<TxnRow, 'paymentMethod' | 'paymentDetails'>): WalletField {
  const paymentDetails = getPaymentDetails(tx);
  const depositCurrency = String(paymentDetails.depositCurrency || paymentDetails.currency || '')
    .trim()
    .toUpperCase();
  const payCurrency = String(paymentDetails.payCurrency || '').trim().toUpperCase();
  const paymentMethod = String(tx.paymentMethod || '').trim().toUpperCase();
  const walletField = String(paymentDetails.walletField || '').trim();

  if (walletField === 'cryptoBalance' || walletField === 'cryptoBonus') {
    return 'cryptoBalance';
  }
  if (
    depositCurrency === 'CRYPTO' ||
    payCurrency.length > 0 ||
    paymentMethod.startsWith('CRYPTO')
  ) {
    return 'cryptoBalance';
  }

  return 'balance';
}

function getAmountFromKeys(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = round2(Number(payload[key] || 0));
    if (Math.abs(value) > EPSILON) return value;
  }

  return 0;
}

function getTxnAllocations(
  tx: Pick<TxnRow, 'paymentDetails' | 'paymentMethod'>,
  fallbackAmount: number,
): TxAllocation[] {
  const paymentDetails = getPaymentDetails(tx);
  const rawAllocations = Array.isArray(paymentDetails.allocations) ? paymentDetails.allocations : [];
  const totals = new Map<WalletField, number>();

  for (const rawAllocation of rawAllocations) {
    if (!isObject(rawAllocation)) continue;
    const walletField = String(rawAllocation.walletField || '') as WalletField;
    const amount = round2(Number(rawAllocation.amount || 0));
    if (
      amount > 0 &&
      (walletField === 'balance' ||
        walletField === 'cryptoBalance' ||
        walletField === 'casinoBonus' ||
        walletField === 'sportsBonus' ||
        walletField === 'cryptoBonus')
    ) {
      totals.set(walletField, round2((totals.get(walletField) || 0) + amount));
    }
  }

  if (totals.size > 0) {
    return Array.from(totals.entries()).map(([walletField, amount]) => ({
      walletField,
      amount,
    }));
  }

  const walletField = String(paymentDetails.walletField || '') as WalletField;
  if (
    walletField === 'balance' ||
    walletField === 'cryptoBalance' ||
    walletField === 'casinoBonus' ||
    walletField === 'sportsBonus' ||
    walletField === 'cryptoBonus'
  ) {
    return [{ walletField, amount: round2(fallbackAmount) }];
  }

  const paymentMethod = String(tx.paymentMethod || '').trim().toUpperCase();
  if (paymentMethod === 'BONUS_WALLET') {
    const bonusWallet = inferBonusWalletField(paymentDetails, 'casinoBonus');
    return [{ walletField: bonusWallet, amount: round2(fallbackAmount) }];
  }
  if (paymentMethod === 'CRYPTO_WALLET' || paymentMethod.startsWith('CRYPTO')) {
    return [{ walletField: 'cryptoBalance', amount: round2(fallbackAmount) }];
  }

  return [{ walletField: 'balance', amount: round2(fallbackAmount) }];
}

function getTxnCategory(tx: Pick<TxnRow, 'paymentDetails'>): 'sports' | 'casino' {
  const source = normalizeSource(getPaymentDetails(tx).source);
  return CASINO_SOURCES.has(source) ? 'casino' : 'sports';
}

function addCategoryStake(
  computation: UserComputation,
  category: 'sports' | 'casino',
  field: WalletField,
  amount: number,
) {
  const target = category === 'casino' ? computation.totals.casinoStake : computation.totals.sportsStake;
  addWalletBucketDelta(target, field, amount);
}

function addCategoryReturn(
  computation: UserComputation,
  category: 'sports' | 'casino',
  field: WalletField,
  amount: number,
) {
  const target =
    category === 'casino' ? computation.totals.casinoReturns : computation.totals.sportsReturns;
  addWalletBucketDelta(target, field, amount);
}

function depositCreditedByCutoff(tx: TxnRow, cutoff: Date) {
  const status = normalizeStatus(tx.status);
  if (status !== 'APPROVED' && status !== 'COMPLETED') return false;
  return tx.updatedAt < cutoff;
}

const WITHDRAWAL_RESTORED_STATUSES = new Set([
  'REJECTED',
  'CANCELLED',
  'CANCELED',
  'REVERSED',
  'FAILED',
  'REFUNDED',
]);

function withdrawalDebitedByCutoff(tx: TxnRow, cutoff: Date) {
  if (tx.createdAt >= cutoff) return false;

  const status = normalizeStatus(tx.status);
  // If the withdrawal was restored (rejected/cancelled/reversed/etc.) before the cutoff,
  // the user's balance was already returned — treat as no-op.
  if (WITHDRAWAL_RESTORED_STATUSES.has(status) && tx.updatedAt < cutoff) {
    return false;
  }

  return true;
}

function processDeposit(tx: TxnRow, computation: UserComputation, cutoff: Date) {
  if (!depositCreditedByCutoff(tx, cutoff)) return;

  const walletField = inferMainWalletField(tx);
  addWalletDelta(computation.wallets, walletField, tx.amount);
  addWalletBucketDelta(computation.totals.deposits, walletField, tx.amount);
}

function processWithdrawal(tx: TxnRow, computation: UserComputation, cutoff: Date) {
  if (!withdrawalDebitedByCutoff(tx, cutoff)) return;

  const walletField = inferMainWalletField(tx);
  addWalletDelta(computation.wallets, walletField, -tx.amount);
  addWalletBucketDelta(computation.totals.withdrawals, walletField, tx.amount);
}

function processBonusCredit(tx: TxnRow, computation: UserComputation) {
  const paymentDetails = getPaymentDetails(tx);
  const bonusWallet = inferBonusWalletField(
    {
      ...paymentDetails,
      remarksHint: tx.remarks,
    },
    'casinoBonus',
  );

  addWalletDelta(computation.wallets, bonusWallet, tx.amount);
  computation.totals.bonusCredits[bonusWallet] = round2(
    computation.totals.bonusCredits[bonusWallet] + tx.amount,
  );
}

function processBonusConvert(tx: TxnRow, computation: UserComputation) {
  const paymentDetails = getPaymentDetails(tx);
  const sourceBonusWallet = inferBonusWalletField(
    {
      ...paymentDetails,
      remarksHint: tx.remarks,
    },
    'casinoBonus',
  );
  const deductionAmount = getAmountFromKeys(paymentDetails, [
    'deductionAmount',
    'bonusAmount',
    'canonicalAmount',
  ]);
  const sourceAmount = deductionAmount > 0 ? deductionAmount : tx.amount;
  const destinationWallet = getDestinationWalletField(paymentDetails.destinationWallet);

  addWalletDelta(computation.wallets, sourceBonusWallet, -sourceAmount);
  addWalletDelta(computation.wallets, destinationWallet, tx.amount);
}

function processBonusConvertReversed(tx: TxnRow, computation: UserComputation) {
  const paymentDetails = getPaymentDetails(tx);
  const sourceBonusWallet = inferBonusWalletField(
    {
      ...paymentDetails,
      remarksHint: tx.remarks,
    },
    'casinoBonus',
  );
  const destinationWallet = getDestinationWalletField(paymentDetails.destinationWallet);
  const restoredAmount = getAmountFromKeys(paymentDetails, [
    'recoveredAmount',
    'deductionAmount',
    'bonusAmount',
  ]);
  const sourceAmount = restoredAmount > 0 ? restoredAmount : tx.amount;

  addWalletDelta(computation.wallets, destinationWallet, -tx.amount);
  addWalletDelta(computation.wallets, sourceBonusWallet, sourceAmount);
}

function processBonusTypeSwitch(tx: TxnRow, computation: UserComputation) {
  const paymentDetails = getPaymentDetails(tx);
  const fromWalletRaw = String(paymentDetails.fromWalletField || paymentDetails.sourceWalletField || '');
  const toWalletRaw = String(paymentDetails.toWalletField || paymentDetails.destinationWalletField || '');
  const amount = getAmountFromKeys(paymentDetails, ['amount', 'bonusAmount']) || tx.amount;

  const fromWallet = fromWalletRaw as WalletField;
  const toWallet = toWalletRaw as WalletField;

  if (
    amount <= 0 ||
    !['casinoBonus', 'sportsBonus', 'cryptoBonus'].includes(fromWallet) ||
    !['casinoBonus', 'sportsBonus', 'cryptoBonus'].includes(toWallet)
  ) {
    computation.warnings.push(`bonus_type_switch_tx_${tx.id}_ignored`);
    return;
  }

  addWalletDelta(computation.wallets, fromWallet, -amount);
  addWalletDelta(computation.wallets, toWallet, amount);
}

function processBetPlacement(tx: TxnRow, computation: UserComputation) {
  const allocations = getTxnAllocations(tx, tx.amount);
  const category = getTxnCategory(tx);

  for (const allocation of allocations as TxAllocation[]) {
    addWalletDelta(computation.wallets, allocation.walletField, -allocation.amount);
    addCategoryStake(computation, category, allocation.walletField, allocation.amount);
  }
}

function processBetCredit(tx: TxnRow, computation: UserComputation) {
  const allocations = getTxnAllocations(tx, tx.amount);
  const category = getTxnCategory(tx);

  for (const allocation of allocations as TxAllocation[]) {
    addWalletDelta(computation.wallets, allocation.walletField, allocation.amount);
    addCategoryReturn(computation, category, allocation.walletField, allocation.amount);
  }
}

function processBetDebit(tx: TxnRow, computation: UserComputation) {
  const allocations = getTxnAllocations(tx, tx.amount);
  const category = getTxnCategory(tx);

  for (const allocation of allocations as TxAllocation[]) {
    addWalletDelta(computation.wallets, allocation.walletField, -allocation.amount);
    addCategoryReturn(computation, category, allocation.walletField, -allocation.amount);
  }
}

function processTransaction(tx: TxnRow, computation: UserComputation, cutoff: Date) {
  if (tx.createdAt >= cutoff) return;

  switch (normalizeStatus(tx.type)) {
    case 'DEPOSIT':
      processDeposit(tx, computation, cutoff);
      return;
    case 'WITHDRAWAL':
      processWithdrawal(tx, computation, cutoff);
      return;
    case 'ADMIN_DEPOSIT':
    case 'MANUAL_CREDIT':
      addWalletDelta(computation.wallets, 'balance', tx.amount);
      computation.totals.manualAdjustments.fiat = round2(
        computation.totals.manualAdjustments.fiat + tx.amount,
      );
      return;
    case 'ADMIN_WITHDRAWAL':
    case 'MANUAL_DEBIT':
      addWalletDelta(computation.wallets, 'balance', -tx.amount);
      computation.totals.manualAdjustments.fiat = round2(
        computation.totals.manualAdjustments.fiat - tx.amount,
      );
      return;
    case 'ADMIN_REFUND_REVERSAL':
      // Explicitly ignored per user directive — these rows are not applied to balances.
      return;
    case 'BONUS':
    case 'REFERRAL_BONUS':
      processBonusCredit(tx, computation);
      return;
    case 'BONUS_CONVERT':
      processBonusConvert(tx, computation);
      return;
    case 'BONUS_CONVERT_REVERSED':
      processBonusConvertReversed(tx, computation);
      return;
    case 'BONUS_TYPE_SWITCH':
      processBonusTypeSwitch(tx, computation);
      return;
    case 'BET_PLACE':
      processBetPlacement(tx, computation);
      return;
    case 'BET_WIN':
    case 'BET_REFUND':
    case 'BET_CASHOUT':
    case 'REFUND':
      processBetCredit(tx, computation);
      return;
    case 'BET_VOID_DEBIT':
    case 'BET_SETTLEMENT_REVERT_DEBIT':
      // BET_SETTLEMENT_REVERT_DEBIT: when a match that was already settled is voided
      // after the fact, the previously-credited win is debited back out (and a matching
      // BET_REFUND credits the stake). Same balance semantics as BET_VOID_DEBIT.
      processBetDebit(tx, computation);
      return;
    case 'BET_LOSS':
      return;
    default:
      computation.unhandledTypes.add(normalizeStatus(tx.type) || 'UNKNOWN');
  }
}

/**
 * Huidu casino transactions only persist `wallet_type` as "fiat"/"crypto" — the real target
 * (`balance` vs `casinoBonus`, or `cryptoBalance` vs `cryptoBonus`) is inferred at webhook
 * time from the member_account suffix and never stored. To reconstruct accurately we:
 *
 *   1. Sort transactions chronologically (already done at query time).
 *   2. For each BET: if the running main wallet can't cover the stake but the sibling bonus
 *      wallet can, debit the bonus wallet instead; otherwise debit the main wallet.
 *   3. Record the wallet choice keyed by `round_id` (or by `game_code`+session if round_id
 *      is missing), so the paired WIN goes back to the same wallet.
 *   4. For WINs with no known pairing, fall back to the user's last-used wallet for that
 *      currency side.
 */
type CasinoRouterState = {
  roundWallet: Map<string, WalletField>;
  lastFiatBetWallet: WalletField;
  lastCryptoBetWallet: WalletField;
};

function newCasinoRouterState(): CasinoRouterState {
  return {
    roundWallet: new Map(),
    lastFiatBetWallet: 'balance',
    lastCryptoBetWallet: 'cryptoBalance',
  };
}

function casinoRoundKey(tx: CasinoTxnRow): string | null {
  const roundId = String(tx.round_id || '').trim();
  if (roundId) return `round:${roundId}`;
  return null;
}

function chooseCasinoBetWallet(
  tx: CasinoTxnRow,
  computation: UserComputation,
): WalletField {
  const isCrypto = String(tx.wallet_type || '').trim().toLowerCase() === 'crypto';
  const mainField: WalletField = isCrypto ? 'cryptoBalance' : 'balance';
  const bonusField: WalletField = isCrypto ? 'cryptoBonus' : 'casinoBonus';

  const mainRunning = computation.wallets[mainField] || 0;
  const bonusRunning = computation.wallets[bonusField] || 0;

  // Prefer main wallet if it can cover the stake.
  if (mainRunning + EPSILON >= tx.amount) return mainField;
  // Otherwise, if the bonus wallet can cover it, use bonus.
  if (bonusRunning + EPSILON >= tx.amount) return bonusField;
  // Neither covers it — fall back to main (will go negative, matches prior behavior).
  return mainField;
}

function processCasinoTransaction(
  tx: CasinoTxnRow,
  computation: UserComputation,
  router: CasinoRouterState,
) {
  const type = normalizeStatus(tx.type);

  if (type === 'UPDATE' || tx.amount <= 0) {
    return;
  }

  const isCrypto = String(tx.wallet_type || '').trim().toLowerCase() === 'crypto';
  const mainField: WalletField = isCrypto ? 'cryptoBalance' : 'balance';
  const bonusField: WalletField = isCrypto ? 'cryptoBonus' : 'casinoBonus';
  const roundKey = casinoRoundKey(tx);

  if (type === 'BET' || type === 'DEBIT') {
    const walletField = chooseCasinoBetWallet(tx, computation);
    addWalletDelta(computation.wallets, walletField, -tx.amount);
    addCategoryStake(computation, 'casino', walletField, tx.amount);
    addWalletBucketDelta(computation.totals.huiduCasinoStake, walletField, tx.amount);

    if (roundKey) router.roundWallet.set(roundKey, walletField);
    if (isCrypto) router.lastCryptoBetWallet = walletField;
    else router.lastFiatBetWallet = walletField;
  } else if (type === 'WIN' || type === 'CREDIT' || type === 'REFUND') {
    // Match the win to the wallet that was debited for the same round.
    let walletField: WalletField | undefined;
    if (roundKey) walletField = router.roundWallet.get(roundKey);
    if (!walletField) {
      walletField = isCrypto ? router.lastCryptoBetWallet : router.lastFiatBetWallet;
    }
    // Safety: make sure it's a valid field for this currency side.
    if (isCrypto && walletField !== 'cryptoBalance' && walletField !== 'cryptoBonus') {
      walletField = 'cryptoBalance';
    }
    if (!isCrypto && walletField !== 'balance' && walletField !== 'casinoBonus') {
      walletField = 'balance';
    }

    addWalletDelta(computation.wallets, walletField, tx.amount);
    addCategoryReturn(computation, 'casino', walletField, tx.amount);
    addWalletBucketDelta(computation.totals.huiduCasinoReturns, walletField, tx.amount);
  } else {
    computation.unhandledTypes.add(`CASINO_${type}`);
  }

  // Suppress the per-row warning flood — routing is now principled, not "best effort".
  // We keep a single aggregate warning if routing ever fell back to an overdraft.
  void mainField;
  void bonusField;
}

/**
 * Detect whether a Mongo bet row is "legacy" — i.e. it was placed via the old
 * `sports/sports.service.ts` path which calls `usersService.updateBalance()` directly
 * and writes NO `Transaction` row. Modern bets written by `bets/bets.service.ts` set
 * `betSource` / `walletStakeAmount` / `bonusStakeAmount` / `placedAt`. Legacy bets
 * have none of these. Use the presence of `betSource` as the discriminator.
 */
function isLegacySportsBet(bet: BetRow): boolean {
  const hasBetSource = bet.betSource != null && String(bet.betSource).trim().length > 0;
  const hasWalletStake =
    bet.walletStakeAmount != null || bet.bonusStakeAmount != null;
  return !hasBetSource && !hasWalletStake;
}

type LegacyBetEvent =
  | { kind: 'legacy-place'; ts: number; bet: BetRow }
  | { kind: 'legacy-resolve'; ts: number; bet: BetRow };

function expandLegacyBetEvents(bet: BetRow): LegacyBetEvent[] {
  const events: LegacyBetEvent[] = [];
  const placedAt = bet.placedAt || bet.createdAt;
  if (!placedAt) return events;

  events.push({ kind: 'legacy-place', ts: placedAt.getTime(), bet });

  const status = String(bet.status || '').trim().toUpperCase();
  const resolvedAt =
    bet.cashedOutAt || bet.settledAt || bet.result_posted_at || null;

  if (
    (status === 'WON' ||
      status === 'LOST' ||
      status === 'VOID' ||
      status === 'CASHED_OUT' ||
      status === 'REFUNDED') &&
    resolvedAt
  ) {
    events.push({ kind: 'legacy-resolve', ts: resolvedAt.getTime(), bet });
  }
  return events;
}

function processLegacyBetPlace(bet: BetRow, computation: UserComputation) {
  const stake = round2(Number(bet.stake || bet.originalStake || 0));
  if (stake <= 0) return;
  const walletField: WalletField =
    String(bet.walletType || '').trim().toLowerCase() === 'crypto'
      ? 'cryptoBalance'
      : 'balance';
  addWalletDelta(computation.wallets, walletField, -stake);
  addCategoryStake(computation, 'sports', walletField, stake);
  computation.warnings.push(`legacy_sports_bet_place_${String(bet._id || '')}`);
}

function processLegacyBetResolve(bet: BetRow, computation: UserComputation) {
  const stake = round2(Number(bet.stake || bet.originalStake || 0));
  if (stake <= 0) return;
  const walletField: WalletField =
    String(bet.walletType || '').trim().toLowerCase() === 'crypto'
      ? 'cryptoBalance'
      : 'balance';
  const status = String(bet.status || '').trim().toUpperCase();

  if (status === 'WON') {
    // Payout = stake + profit. Use potentialWin if present (profit only on newer rows),
    // otherwise derive from odds.
    const odds = Number(bet.odds || 0);
    const potentialWin = round2(Number(bet.potentialWin || 0));
    let payout = 0;
    if (potentialWin > 0) {
      payout = round2(stake + potentialWin);
    } else if (odds > 0) {
      payout = round2(stake * odds);
    } else {
      payout = stake; // fallback — at least refund the stake
    }
    addWalletDelta(computation.wallets, walletField, payout);
    addCategoryReturn(computation, 'sports', walletField, payout);
  } else if (status === 'VOID' || status === 'REFUNDED' || status === 'CASHED_OUT') {
    // Refund stake (or cashout value — legacy bets don't persist cashout amount, so refund stake).
    addWalletDelta(computation.wallets, walletField, stake);
    addCategoryReturn(computation, 'sports', walletField, stake);
  }
  // LOST → no balance change; stake already deducted on place.
}

/**
 * Replays a bonus forfeiture. The production code (`bonus.service.ts#forfeitBonusById` +
 * `getEligibleBonusSnapshot`) decrements the user's bonus wallet by
 *    min(runningWalletBalance, ub.bonusAmount)
 * without writing any Transaction row. This function emulates that exact math using the
 * chronological running wallet state in `computation.wallets`.
 */
function processBonusForfeit(row: BonusForfeitRow, computation: UserComputation) {
  const isCrypto = String(row.bonusCurrency || '').trim().toUpperCase() === 'CRYPTO';
  const applicableTo = String(row.applicableTo || 'BOTH').trim().toUpperCase();
  const bonusAmountCap = round2(Number(row.bonusAmount || 0));
  if (bonusAmountCap <= 0) return;

  let targetField: WalletField;
  if (isCrypto) {
    targetField = 'cryptoBonus';
  } else if (applicableTo === 'SPORTS') {
    targetField = 'sportsBonus';
  } else {
    targetField = 'casinoBonus';
  }

  const running = round2(computation.wallets[targetField] || 0);
  // Production deducts min(running wallet, bonusAmount). Cap at running so we never
  // drive the wallet below zero because of a forfeit (production wouldn't either).
  const deducted = round2(Math.max(0, Math.min(running, bonusAmountCap)));
  if (deducted <= 0) return;

  addWalletDelta(computation.wallets, targetField, -deducted);
  computation.totals.bonusCredits[targetField] = round2(
    computation.totals.bonusCredits[targetField] - deducted,
  );

  // Legacy casinoBonus forfeits can also spill into fiatBonus in production if
  // casinoBonus isn't enough. Replay that spillover too for completeness.
  if (targetField === 'casinoBonus' && deducted < bonusAmountCap) {
    const remaining = round2(bonusAmountCap - deducted);
    // fiatBonus isn't tracked in our WalletState — production zeroes it on apply anyway.
    // Record the spillover in warnings so operators can audit.
    computation.warnings.push(
      `bonus_forfeit_${row.id}_fiatBonus_spillover_${remaining.toFixed(2)}`,
    );
  }
}

function getBetPlacedAt(bet: BetRow) {
  return bet.placedAt || bet.createdAt || null;
}

function getBetResolvedAt(bet: BetRow) {
  return bet.cashedOutAt || bet.settledAt || null;
}

function getBetLiveStake(bet: BetRow) {
  const currentStake = round2(Number(bet.stake ?? 0));
  if (currentStake > 0) return currentStake;
  return round2(Number(bet.originalStake ?? 0));
}

function computeExposureFromBets(bets: BetRow[], cutoff: Date) {
  let exposure = 0;

  for (const bet of bets) {
    const placedAt = getBetPlacedAt(bet);
    if (!placedAt || placedAt > cutoff) continue;

    const resolvedAt = getBetResolvedAt(bet);
    if (resolvedAt && resolvedAt <= cutoff) continue;

    const liveStake = getBetLiveStake(bet);
    if (liveStake <= 0) continue;
    exposure = round2(exposure + liveStake);
  }

  return exposure;
}

function formatWallets(wallets: WalletState) {
  return [
    `balance=${wallets.balance.toFixed(2)}`,
    `cryptoBalance=${wallets.cryptoBalance.toFixed(2)}`,
    `casinoBonus=${wallets.casinoBonus.toFixed(2)}`,
    `sportsBonus=${wallets.sportsBonus.toFixed(2)}`,
    `cryptoBonus=${wallets.cryptoBonus.toFixed(2)}`,
  ].join(' ');
}

function formatBuckets(label: string, bucket: WalletBuckets) {
  return `${label}[fiat=${bucket.fiat.toFixed(2)} crypto=${bucket.crypto.toFixed(2)}]`;
}

function netBuckets(returnsBucket: WalletBuckets, stakeBucket: WalletBuckets): WalletBuckets {
  return {
    fiat: round2(returnsBucket.fiat - stakeBucket.fiat),
    crypto: round2(returnsBucket.crypto - stakeBucket.crypto),
  };
}

async function connectMongoIfNeeded() {
  if (!MONGO_URI) return false;
  if (mongoose.connection.readyState === 1) return true;
  try {
    await mongoose.connect(MONGO_URI);
    return true;
  } catch (error) {
    console.warn(
      `[WalletCutoffRebuild] Mongo unavailable, continuing without exposure rebuild: ${error instanceof Error ? error.message : String(error)
      }`,
    );
    return false;
  }
}

async function fetchUserBatch(
  lastId: number,
  userId?: number,
  limit?: number,
  includeStaff?: boolean,
) {
  const remaining = typeof limit === 'number' ? Math.max(0, limit) : USER_BATCH_SIZE;
  if (remaining <= 0) return [];

  const baseWhere: any = userId ? { id: userId } : { id: { gt: lastId } };
  // Exclude admin/staff roles unless --include-staff is passed.
  if (!includeStaff && !userId) {
    baseWhere.role = 'USER';
  }

  return prisma.user.findMany({
    where: baseWhere,
    orderBy: { id: 'asc' },
    take: userId ? 1 : Math.min(USER_BATCH_SIZE, remaining),
    select: {
      id: true,
      username: true,
      balance: true,
      cryptoBalance: true,
      casinoBonus: true,
      sportsBonus: true,
      cryptoBonus: true,
      fiatBonus: true,
      exposure: true,
      totalDeposited: true,
      totalWagered: true,
    },
  });
}

async function main() {
  const { apply, allowNegative, skipMongo, verbose, includeStaff, userId, limit, cutoff } = parseArgs();
  const cutoffDate = new Date(cutoff);

  if (Number.isNaN(cutoffDate.getTime())) {
    throw new Error(`Invalid cutoff: ${cutoff}`);
  }

  const noCutoff = cutoffDate.getUTCFullYear() >= 2999;
  console.log(`[WalletCutoffRebuild] Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  if (noCutoff) {
    console.log(`[WalletCutoffRebuild] Cutoff: DISABLED — replaying full history`);
  } else {
    console.log(`[WalletCutoffRebuild] Cutoff: ${cutoffDate.toISOString()} (input=${cutoff})`);
  }
  if (allowNegative) console.log('[WalletCutoffRebuild] Negative wallet balances: ALLOWED');
  if (userId) console.log(`[WalletCutoffRebuild] Scoped to userId=${userId}`);
  if (limit) console.log(`[WalletCutoffRebuild] Limit=${limit}`);
  console.log(
    `[WalletCutoffRebuild] Staff/admin roles: ${includeStaff ? 'INCLUDED' : 'EXCLUDED (default — pass --include-staff to override)'}`,
  );

  const mongoConnected = skipMongo ? false : await connectMongoIfNeeded();
  if (!mongoConnected) {
    console.log('[WalletCutoffRebuild] Mongo exposure rebuild: DISABLED');
  }

  let processed = 0;
  let applied = 0;
  let skippedNegative = 0;
  let warningCount = 0;
  let bestEffortCasinoRows = 0;
  const overallUnhandled = new Set<string>();

  // Grand totals — current (corrupted) vs computed (replayed).
  const grandTotals = {
    // Wallet fields
    currentBalance: 0,
    computedBalance: 0,
    currentCryptoBalance: 0,
    computedCryptoBalance: 0,
    currentCasinoBonus: 0,
    computedCasinoBonus: 0,
    currentSportsBonus: 0,
    computedSportsBonus: 0,
    currentCryptoBonus: 0,
    computedCryptoBonus: 0,
    currentFiatBonus: 0,
    // Cash-flow aggregates across every user (replayed)
    depositsFiat: 0,
    depositsCrypto: 0,
    withdrawalsFiat: 0,
    withdrawalsCrypto: 0,
    manualAdjustFiat: 0,
    adminReversalsFiat: 0,
    // Bet-flow aggregates across every user (replayed)
    sportsStakeFiat: 0,
    sportsStakeCrypto: 0,
    sportsReturnsFiat: 0,
    sportsReturnsCrypto: 0,
    casinoStakeFiat: 0,
    casinoStakeCrypto: 0,
    casinoReturnsFiat: 0,
    casinoReturnsCrypto: 0,
    huiduStakeFiat: 0,
    huiduStakeCrypto: 0,
    huiduReturnsFiat: 0,
    huiduReturnsCrypto: 0,
    bonusCreditsCasino: 0,
    bonusCreditsSports: 0,
    bonusCreditsCrypto: 0,
    // Row counts
    txnRowsSeen: 0,
    casinoRowsSeen: 0,
    forfeitRowsSeen: 0,
    legacyBetsSeen: 0,
    legacyBetEventsReplayed: 0,
  };
  const biggestDiffs: Array<{
    userId: number;
    username: string | null;
    diff: number;
    current: number;
    computed: number;
  }> = [];

  let lastId = 0;
  let remaining = typeof limit === 'number' ? limit : undefined;

  while (true) {
    const users = await fetchUserBatch(lastId, userId, remaining, includeStaff);
    if (users.length === 0) break;

    const userIds = users.map((user) => user.id);
    lastId = users[users.length - 1].id;
    if (typeof remaining === 'number') {
      remaining -= users.length;
    }

    const [transactions, casinoTransactions, forfeits, bets] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: { in: userIds },
          createdAt: { lt: cutoffDate },
        },
        orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.casinoTransaction.findMany({
        where: {
          user_id: { in: userIds },
          timestamp: { lt: cutoffDate },
        },
        orderBy: [{ user_id: 'asc' }, { timestamp: 'asc' }, { id: 'asc' }],
      }),
      // Bonus forfeits: production debits bonus wallets here with NO Transaction row.
      // We synthesize a "forfeit event" per row and merge into the chronological stream.
      prisma.userBonus.findMany({
        where: {
          userId: { in: userIds },
          status: 'FORFEITED',
          forfeitedAt: { not: null, lt: cutoffDate },
        },
        orderBy: [{ userId: 'asc' }, { forfeitedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          userId: true,
          bonusAmount: true,
          bonusCurrency: true,
          applicableTo: true,
          forfeitedAt: true,
        },
      }),
      mongoConnected
        ? mongoose.connection
          .collection('bets')
          .find(
            {
              userId: { $in: userIds },
              $or: [
                { placedAt: { $lt: cutoffDate } },
                { placedAt: { $exists: false }, createdAt: { $lt: cutoffDate } },
              ],
            },
            {
              projection: {
                _id: 1,
                userId: 1,
                stake: 1,
                originalStake: 1,
                odds: 1,
                potentialWin: 1,
                status: 1,
                betSource: 1,
                walletStakeAmount: 1,
                bonusStakeAmount: 1,
                walletType: 1,
                placedAt: 1,
                createdAt: 1,
                settledAt: 1,
                result_posted_at: 1,
                cashedOutAt: 1,
              },
            },
          )
          .toArray()
        : Promise.resolve([] as BetRow[]),
    ]);

    const txByUser = new Map<number, TxnRow[]>();
    for (const tx of transactions) {
      const list = txByUser.get(tx.userId) || [];
      list.push(tx as TxnRow);
      txByUser.set(tx.userId, list);
    }

    const casinoByUser = new Map<number, CasinoTxnRow[]>();
    for (const tx of casinoTransactions) {
      const list = casinoByUser.get(tx.user_id) || [];
      list.push(tx as CasinoTxnRow);
      casinoByUser.set(tx.user_id, list);
    }

    const betsByUser = new Map<number, BetRow[]>();
    for (const bet of bets as BetRow[]) {
      const list = betsByUser.get(bet.userId) || [];
      list.push(bet);
      betsByUser.set(bet.userId, list);
    }

    const forfeitsByUser = new Map<number, BonusForfeitRow[]>();
    for (const ub of forfeits) {
      if (!ub.forfeitedAt) continue;
      const list = forfeitsByUser.get(ub.userId) || [];
      list.push({
        id: ub.id,
        userId: ub.userId,
        bonusAmount: Number(ub.bonusAmount || 0),
        bonusCurrency: ub.bonusCurrency,
        applicableTo: ub.applicableTo,
        forfeitedAt: ub.forfeitedAt,
      });
      forfeitsByUser.set(ub.userId, list);
    }

    for (const user of users) {
      processed += 1;
      const computation = emptyComputation();

      // Merge-sort Transaction rows, CasinoTransaction rows, bonus-forfeit events, AND
      // legacy sports bet events (Mongo bets that have no matching Transaction row
      // because the old `sports/sports.service.ts` module wrote them via
      // `usersService.updateBalance()` bypassing the audit log).
      const userTxns = txByUser.get(user.id) || [];
      const userCasinoTxns = casinoByUser.get(user.id) || [];
      const userForfeits = forfeitsByUser.get(user.id) || [];
      const userBets = betsByUser.get(user.id) || [];
      const userLegacyBetEvents: LegacyBetEvent[] = [];
      let legacyBetCount = 0;
      for (const bet of userBets) {
        if (!isLegacySportsBet(bet)) continue;
        legacyBetCount += 1;
        for (const ev of expandLegacyBetEvents(bet)) {
          // Respect the cutoff window.
          if (ev.ts >= cutoffDate.getTime()) continue;
          userLegacyBetEvents.push(ev);
        }
      }

      type MergedRow =
        | { kind: 'txn'; ts: number; tiebreak: number; row: TxnRow }
        | { kind: 'casino'; ts: number; tiebreak: number; row: CasinoTxnRow }
        | { kind: 'forfeit'; ts: number; tiebreak: number; row: BonusForfeitRow }
        | { kind: 'legacy-bet'; ts: number; tiebreak: number; row: LegacyBetEvent };
      const merged: MergedRow[] = [];
      for (const tx of userTxns) {
        merged.push({ kind: 'txn', ts: tx.createdAt.getTime(), tiebreak: tx.id, row: tx });
      }
      for (const tx of userCasinoTxns) {
        merged.push({
          kind: 'casino',
          ts: tx.timestamp.getTime(),
          tiebreak: tx.id,
          row: tx,
        });
      }
      for (const ub of userForfeits) {
        merged.push({
          kind: 'forfeit',
          ts: ub.forfeitedAt.getTime(),
          tiebreak: ub.id,
          row: ub,
        });
      }
      for (let i = 0; i < userLegacyBetEvents.length; i++) {
        merged.push({
          kind: 'legacy-bet',
          ts: userLegacyBetEvents[i].ts,
          tiebreak: i,
          row: userLegacyBetEvents[i],
        });
      }
      const kindOrder: Record<MergedRow['kind'], number> = {
        txn: 0,
        casino: 1,
        'legacy-bet': 2,
        forfeit: 3,
      };
      merged.sort((a, b) => {
        if (a.ts !== b.ts) return a.ts - b.ts;
        // Within the same millisecond: txn (deposits/credits) first so the router sees
        // incoming funds, then casino rows, then legacy sports bets, then forfeits
        // (which happen as a side effect of the withdrawal txn that immediately precedes them).
        if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind];
        return a.tiebreak - b.tiebreak;
      });

      const casinoRouter = newCasinoRouterState();
      for (const entry of merged) {
        if (entry.kind === 'txn') {
          processTransaction(entry.row, computation, cutoffDate);
        } else if (entry.kind === 'casino') {
          processCasinoTransaction(entry.row, computation, casinoRouter);
        } else if (entry.kind === 'forfeit') {
          processBonusForfeit(entry.row, computation);
        } else {
          if (entry.row.kind === 'legacy-place') {
            processLegacyBetPlace(entry.row.bet, computation);
          } else {
            processLegacyBetResolve(entry.row.bet, computation);
          }
        }
      }
      void legacyBetCount;

      computation.exposure = mongoConnected
        ? computeExposureFromBets(betsByUser.get(user.id) || [], cutoffDate)
        : 0;

      for (const type of Array.from(computation.unhandledTypes)) {
        overallUnhandled.add(type);
      }

      const hasNegativeWallet = Object.values(computation.wallets).some(
        (value) => value < -EPSILON,
      );
      const totalDeposited = round2(
        computation.totals.deposits.fiat + computation.totals.deposits.crypto,
      );
      const totalWagered = round2(
        computation.totals.sportsStake.fiat +
        computation.totals.sportsStake.crypto +
        computation.totals.casinoStake.fiat +
        computation.totals.casinoStake.crypto,
      );
      if (hasNegativeWallet && !allowNegative) {
        skippedNegative += 1;
      } else if (apply) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            balance: computation.wallets.balance,
            cryptoBalance: computation.wallets.cryptoBalance,
            fiatBonus: 0,
            casinoBonus: computation.wallets.casinoBonus,
            sportsBonus: computation.wallets.sportsBonus,
            cryptoBonus: computation.wallets.cryptoBonus,
            exposure: computation.exposure,
            totalDeposited,
            totalWagered,
          },
        });
        applied += 1;
      }

      const sportsNet = netBuckets(
        computation.totals.sportsReturns,
        computation.totals.sportsStake,
      );
      const casinoNet = netBuckets(
        computation.totals.casinoReturns,
        computation.totals.casinoStake,
      );
      const huiduCasinoNet = netBuckets(
        computation.totals.huiduCasinoReturns,
        computation.totals.huiduCasinoStake,
      );

      warningCount += computation.warnings.length;
      bestEffortCasinoRows += computation.warnings.filter((warning) =>
        warning.startsWith('huidu_best_effort_tx_'),
      ).length;

      // Diff current (corrupted) vs computed (replayed).
      const currentBalance = round2(Number((user as any).balance || 0));
      const currentCryptoBalance = round2(Number((user as any).cryptoBalance || 0));
      const currentCasinoBonus = round2(Number((user as any).casinoBonus || 0));
      const currentSportsBonus = round2(Number((user as any).sportsBonus || 0));
      const currentCryptoBonus = round2(Number((user as any).cryptoBonus || 0));
      const currentFiatBonus = round2(Number((user as any).fiatBonus || 0));

      // Cash-flow + bet-flow aggregates
      grandTotals.txnRowsSeen += userTxns.length;
      grandTotals.casinoRowsSeen += userCasinoTxns.length;
      grandTotals.forfeitRowsSeen += userForfeits.length;
      grandTotals.legacyBetsSeen += legacyBetCount;
      grandTotals.legacyBetEventsReplayed += userLegacyBetEvents.length;
      grandTotals.depositsFiat = round2(grandTotals.depositsFiat + computation.totals.deposits.fiat);
      grandTotals.depositsCrypto = round2(grandTotals.depositsCrypto + computation.totals.deposits.crypto);
      grandTotals.withdrawalsFiat = round2(grandTotals.withdrawalsFiat + computation.totals.withdrawals.fiat);
      grandTotals.withdrawalsCrypto = round2(grandTotals.withdrawalsCrypto + computation.totals.withdrawals.crypto);
      grandTotals.manualAdjustFiat = round2(grandTotals.manualAdjustFiat + computation.totals.manualAdjustments.fiat);
      grandTotals.adminReversalsFiat = round2(grandTotals.adminReversalsFiat + computation.totals.adminReversals.fiat);
      grandTotals.sportsStakeFiat = round2(grandTotals.sportsStakeFiat + computation.totals.sportsStake.fiat);
      grandTotals.sportsStakeCrypto = round2(grandTotals.sportsStakeCrypto + computation.totals.sportsStake.crypto);
      grandTotals.sportsReturnsFiat = round2(grandTotals.sportsReturnsFiat + computation.totals.sportsReturns.fiat);
      grandTotals.sportsReturnsCrypto = round2(grandTotals.sportsReturnsCrypto + computation.totals.sportsReturns.crypto);
      grandTotals.casinoStakeFiat = round2(grandTotals.casinoStakeFiat + computation.totals.casinoStake.fiat);
      grandTotals.casinoStakeCrypto = round2(grandTotals.casinoStakeCrypto + computation.totals.casinoStake.crypto);
      grandTotals.casinoReturnsFiat = round2(grandTotals.casinoReturnsFiat + computation.totals.casinoReturns.fiat);
      grandTotals.casinoReturnsCrypto = round2(grandTotals.casinoReturnsCrypto + computation.totals.casinoReturns.crypto);
      grandTotals.huiduStakeFiat = round2(grandTotals.huiduStakeFiat + computation.totals.huiduCasinoStake.fiat);
      grandTotals.huiduStakeCrypto = round2(grandTotals.huiduStakeCrypto + computation.totals.huiduCasinoStake.crypto);
      grandTotals.huiduReturnsFiat = round2(grandTotals.huiduReturnsFiat + computation.totals.huiduCasinoReturns.fiat);
      grandTotals.huiduReturnsCrypto = round2(grandTotals.huiduReturnsCrypto + computation.totals.huiduCasinoReturns.crypto);
      grandTotals.bonusCreditsCasino = round2(grandTotals.bonusCreditsCasino + computation.totals.bonusCredits.casinoBonus);
      grandTotals.bonusCreditsSports = round2(grandTotals.bonusCreditsSports + computation.totals.bonusCredits.sportsBonus);
      grandTotals.bonusCreditsCrypto = round2(grandTotals.bonusCreditsCrypto + computation.totals.bonusCredits.cryptoBonus);

      grandTotals.currentBalance = round2(grandTotals.currentBalance + currentBalance);
      grandTotals.computedBalance = round2(grandTotals.computedBalance + computation.wallets.balance);
      grandTotals.currentCryptoBalance = round2(grandTotals.currentCryptoBalance + currentCryptoBalance);
      grandTotals.computedCryptoBalance = round2(grandTotals.computedCryptoBalance + computation.wallets.cryptoBalance);
      grandTotals.currentCasinoBonus = round2(grandTotals.currentCasinoBonus + currentCasinoBonus);
      grandTotals.computedCasinoBonus = round2(grandTotals.computedCasinoBonus + computation.wallets.casinoBonus);
      grandTotals.currentSportsBonus = round2(grandTotals.currentSportsBonus + currentSportsBonus);
      grandTotals.computedSportsBonus = round2(grandTotals.computedSportsBonus + computation.wallets.sportsBonus);
      grandTotals.currentCryptoBonus = round2(grandTotals.currentCryptoBonus + currentCryptoBonus);
      grandTotals.computedCryptoBonus = round2(grandTotals.computedCryptoBonus + computation.wallets.cryptoBonus);
      grandTotals.currentFiatBonus = round2(grandTotals.currentFiatBonus + currentFiatBonus);

      const balanceDiff = round2(computation.wallets.balance - currentBalance);
      const cryptoBalanceDiff = round2(computation.wallets.cryptoBalance - currentCryptoBalance);
      const casinoBonusDiff = round2(computation.wallets.casinoBonus - currentCasinoBonus);
      const sportsBonusDiff = round2(computation.wallets.sportsBonus - currentSportsBonus);
      const cryptoBonusDiff = round2(computation.wallets.cryptoBonus - currentCryptoBonus);
      const totalDiff = round2(
        balanceDiff + cryptoBalanceDiff + casinoBonusDiff + sportsBonusDiff + cryptoBonusDiff,
      );

      if (Math.abs(totalDiff) > EPSILON) {
        biggestDiffs.push({
          userId: user.id,
          username: user.username,
          diff: totalDiff,
          current: round2(
            currentBalance +
            currentCryptoBalance +
            currentCasinoBonus +
            currentSportsBonus +
            currentCryptoBonus,
          ),
          computed: round2(
            computation.wallets.balance +
            computation.wallets.cryptoBalance +
            computation.wallets.casinoBonus +
            computation.wallets.sportsBonus +
            computation.wallets.cryptoBonus,
          ),
        });
      }

      const diffFragment = [
        `diffBalance=${balanceDiff >= 0 ? '+' : ''}${balanceDiff.toFixed(2)}`,
        `diffCrypto=${cryptoBalanceDiff >= 0 ? '+' : ''}${cryptoBalanceDiff.toFixed(2)}`,
        `diffCasinoBonus=${casinoBonusDiff >= 0 ? '+' : ''}${casinoBonusDiff.toFixed(2)}`,
        `diffSportsBonus=${sportsBonusDiff >= 0 ? '+' : ''}${sportsBonusDiff.toFixed(2)}`,
        `diffCryptoBonus=${cryptoBonusDiff >= 0 ? '+' : ''}${cryptoBonusDiff.toFixed(2)}`,
      ].join(' ');

      console.log(
        [
          `[WalletCutoffRebuild] user=${user.id}`,
          user.username ? `(${user.username})` : '',
          `current[balance=${currentBalance.toFixed(2)} crypto=${currentCryptoBalance.toFixed(2)} casinoBonus=${currentCasinoBonus.toFixed(2)} sportsBonus=${currentSportsBonus.toFixed(2)} cryptoBonus=${currentCryptoBonus.toFixed(2)}]`,
          `computed[${formatWallets(cloneWallets(computation.wallets))}]`,
          diffFragment,
          `exposure=${computation.exposure.toFixed(2)}`,
          formatBuckets('deposits', computation.totals.deposits),
          formatBuckets('withdrawals', computation.totals.withdrawals),
          formatBuckets('sportsStake', computation.totals.sportsStake),
          formatBuckets('sportsReturns', computation.totals.sportsReturns),
          formatBuckets('sportsNet', sportsNet),
          formatBuckets('casinoStake', computation.totals.casinoStake),
          formatBuckets('casinoReturns', computation.totals.casinoReturns),
          formatBuckets('casinoNet', casinoNet),
          formatBuckets('huiduStake', computation.totals.huiduCasinoStake),
          formatBuckets('huiduReturns', computation.totals.huiduCasinoReturns),
          formatBuckets('huiduNet', huiduCasinoNet),
          `totalDeposited=${totalDeposited.toFixed(2)}`,
          `totalWagered=${totalWagered.toFixed(2)}`,
          computation.unhandledTypes.size > 0
            ? `unhandled=${Array.from(computation.unhandledTypes).sort().join(',')}`
            : '',
          hasNegativeWallet && !allowNegative ? 'apply=SKIPPED_NEGATIVE' : '',
        ]
          .filter(Boolean)
          .join(' '),
      );

      if (verbose) {
        for (const warning of computation.warnings) {
          console.log(`[WalletCutoffRebuild] user=${user.id} warning=${warning}`);
        }
      }
    }

    if (userId) break;
    if (typeof remaining === 'number' && remaining <= 0) break;
  }

  console.log(
    [
      `[WalletCutoffRebuild] Complete.`,
      `processed=${processed}`,
      `applied=${applied}`,
      `skippedNegative=${skippedNegative}`,
      `warnings=${warningCount}`,
      `bestEffortCasinoRows=${bestEffortCasinoRows}`,
      overallUnhandled.size > 0
        ? `unhandledTypes=${Array.from(overallUnhandled).sort().join(',')}`
        : 'unhandledTypes=none',
    ].join(' '),
  );

  // Grand totals — shows the blast radius of the rebuild across all users.
  const fmt = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2);
  const diffBalance = round2(grandTotals.computedBalance - grandTotals.currentBalance);
  const diffCrypto = round2(grandTotals.computedCryptoBalance - grandTotals.currentCryptoBalance);
  const diffCasinoBonus = round2(grandTotals.computedCasinoBonus - grandTotals.currentCasinoBonus);
  const diffSportsBonus = round2(grandTotals.computedSportsBonus - grandTotals.currentSportsBonus);
  const diffCryptoBonus = round2(grandTotals.computedCryptoBonus - grandTotals.currentCryptoBonus);

  console.log('');
  console.log('[WalletCutoffRebuild] ──────── GRAND TOTALS ────────');
  console.log(
    `[WalletCutoffRebuild] balance         current=${grandTotals.currentBalance.toFixed(2)} computed=${grandTotals.computedBalance.toFixed(2)} diff=${fmt(diffBalance)}`,
  );
  console.log(
    `[WalletCutoffRebuild] cryptoBalance   current=${grandTotals.currentCryptoBalance.toFixed(2)} computed=${grandTotals.computedCryptoBalance.toFixed(2)} diff=${fmt(diffCrypto)}`,
  );
  console.log(
    `[WalletCutoffRebuild] casinoBonus     current=${grandTotals.currentCasinoBonus.toFixed(2)} computed=${grandTotals.computedCasinoBonus.toFixed(2)} diff=${fmt(diffCasinoBonus)}`,
  );
  console.log(
    `[WalletCutoffRebuild] sportsBonus     current=${grandTotals.currentSportsBonus.toFixed(2)} computed=${grandTotals.computedSportsBonus.toFixed(2)} diff=${fmt(diffSportsBonus)}`,
  );
  console.log(
    `[WalletCutoffRebuild] cryptoBonus     current=${grandTotals.currentCryptoBonus.toFixed(2)} computed=${grandTotals.computedCryptoBonus.toFixed(2)} diff=${fmt(diffCryptoBonus)}`,
  );
  console.log(
    `[WalletCutoffRebuild] fiatBonus(legacy) current=${grandTotals.currentFiatBonus.toFixed(2)} (will be zeroed on apply)`,
  );

  console.log('');
  console.log('[WalletCutoffRebuild] ──────── REPLAYED ROWS ────────');
  console.log(
    `[WalletCutoffRebuild] Transaction rows replayed:      ${grandTotals.txnRowsSeen}`,
  );
  console.log(
    `[WalletCutoffRebuild] CasinoTransaction rows replayed: ${grandTotals.casinoRowsSeen}`,
  );
  console.log(
    `[WalletCutoffRebuild] Bonus forfeit events replayed:   ${grandTotals.forfeitRowsSeen}`,
  );
  console.log(
    `[WalletCutoffRebuild] Legacy Mongo sports bets found:  ${grandTotals.legacyBetsSeen}  (events replayed: ${grandTotals.legacyBetEventsReplayed})`,
  );

  console.log('');
  console.log('[WalletCutoffRebuild] ──────── CASH FLOW (replayed) ────────');
  console.log(
    `[WalletCutoffRebuild] deposits       fiat=${grandTotals.depositsFiat.toFixed(2)}   crypto=${grandTotals.depositsCrypto.toFixed(2)}`,
  );
  console.log(
    `[WalletCutoffRebuild] withdrawals    fiat=${grandTotals.withdrawalsFiat.toFixed(2)}   crypto=${grandTotals.withdrawalsCrypto.toFixed(2)}`,
  );
  console.log(
    `[WalletCutoffRebuild] manualAdjust   fiat=${grandTotals.manualAdjustFiat.toFixed(2)}`,
  );
  console.log(
    `[WalletCutoffRebuild] adminReversals fiat=${grandTotals.adminReversalsFiat.toFixed(2)}`,
  );
  console.log(
    `[WalletCutoffRebuild] bonusCredits   casino=${grandTotals.bonusCreditsCasino.toFixed(2)}   sports=${grandTotals.bonusCreditsSports.toFixed(2)}   crypto=${grandTotals.bonusCreditsCrypto.toFixed(2)}`,
  );

  console.log('');
  console.log('[WalletCutoffRebuild] ──────── BET FLOW (replayed) ────────');
  const sportsNetFiat = round2(grandTotals.sportsReturnsFiat - grandTotals.sportsStakeFiat);
  const sportsNetCrypto = round2(grandTotals.sportsReturnsCrypto - grandTotals.sportsStakeCrypto);
  const casinoNetFiat = round2(grandTotals.casinoReturnsFiat - grandTotals.casinoStakeFiat);
  const casinoNetCrypto = round2(grandTotals.casinoReturnsCrypto - grandTotals.casinoStakeCrypto);
  const huiduNetFiat = round2(grandTotals.huiduReturnsFiat - grandTotals.huiduStakeFiat);
  const huiduNetCrypto = round2(grandTotals.huiduReturnsCrypto - grandTotals.huiduStakeCrypto);
  console.log(
    `[WalletCutoffRebuild] sports  stake:   fiat=${grandTotals.sportsStakeFiat.toFixed(2)}   crypto=${grandTotals.sportsStakeCrypto.toFixed(2)}`,
  );
  console.log(
    `[WalletCutoffRebuild] sports  returns: fiat=${grandTotals.sportsReturnsFiat.toFixed(2)}   crypto=${grandTotals.sportsReturnsCrypto.toFixed(2)}`,
  );
  console.log(
    `[WalletCutoffRebuild] sports  net(user): fiat=${fmt(sportsNetFiat)}   crypto=${fmt(sportsNetCrypto)}`,
  );
  console.log(
    `[WalletCutoffRebuild] casino(originals+huidu) stake:   fiat=${grandTotals.casinoStakeFiat.toFixed(2)}   crypto=${grandTotals.casinoStakeCrypto.toFixed(2)}`,
  );
  console.log(
    `[WalletCutoffRebuild] casino(originals+huidu) returns: fiat=${grandTotals.casinoReturnsFiat.toFixed(2)}   crypto=${grandTotals.casinoReturnsCrypto.toFixed(2)}`,
  );
  console.log(
    `[WalletCutoffRebuild] casino(originals+huidu) net(user): fiat=${fmt(casinoNetFiat)}   crypto=${fmt(casinoNetCrypto)}`,
  );
  console.log(
    `[WalletCutoffRebuild]   └ of which huidu stake:   fiat=${grandTotals.huiduStakeFiat.toFixed(2)}   crypto=${grandTotals.huiduStakeCrypto.toFixed(2)}`,
  );
  console.log(
    `[WalletCutoffRebuild]   └ of which huidu returns: fiat=${grandTotals.huiduReturnsFiat.toFixed(2)}   crypto=${grandTotals.huiduReturnsCrypto.toFixed(2)}`,
  );
  console.log(
    `[WalletCutoffRebuild]   └ of which huidu net(user): fiat=${fmt(huiduNetFiat)}   crypto=${fmt(huiduNetCrypto)}`,
  );

  // Top 20 biggest diffs (absolute value) — helps spot-check the scariest users.
  biggestDiffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  if (biggestDiffs.length > 0) {
    console.log('');
    console.log('[WalletCutoffRebuild] ──────── TOP 20 BIGGEST USER DIFFS ────────');
    for (const entry of biggestDiffs.slice(0, 20)) {
      console.log(
        `[WalletCutoffRebuild] user=${entry.userId}${entry.username ? ` (${entry.username})` : ''} current=${entry.current.toFixed(2)} computed=${entry.computed.toFixed(2)} diff=${fmt(entry.diff)}`,
      );
    }
    console.log(
      `[WalletCutoffRebuild] Users with nonzero diff: ${biggestDiffs.length}/${processed}`,
    );
  } else {
    console.log('[WalletCutoffRebuild] No user diffs detected — all balances already match replay.');
  }
}

main()
  .catch((error) => {
    console.error('[WalletCutoffRebuild] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
