import { BonusStatus, Prisma, PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const EPSILON = 0.0001;
const RECOVERY_SCRIPT = 'repair-bonus-convert-recovery';
const REVERSED_CONVERT_TYPE = 'BONUS_CONVERT_REVERSED';

type BonusBucket = 'casino' | 'sports' | 'crypto';
type WalletField = 'balance' | 'cryptoBalance' | 'casinoBonus' | 'sportsBonus' | 'cryptoBonus';

type UserRow = {
  id: number;
  username: string | null;
  balance: number;
  cryptoBalance: number;
  fiatBonus: number;
  casinoBonus: number;
  sportsBonus: number;
  cryptoBonus: number;
};

type BonusRow = {
  id: number;
  bonusCode: string;
  bonusTitle: string;
  bonusCurrency: string;
  applicableTo: string;
  depositAmount: number;
  bonusAmount: number;
  wageringRequired: number;
  wageringDone: number;
  status: BonusStatus;
  isEnabled: boolean;
  createdAt: Date;
  completedAt: Date | null;
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
};

type DepositTxnRow = TxnRow;

type DepositMatchEntry = {
  amount: number;
  createdAt: Date;
  used: boolean;
};

type RecoveryCandidate = {
  tx: TxnRow;
  bucket: BonusBucket;
  source: string;
  bonusCode: string | null;
  matchedBonus: BonusRow | null;
};

type InvalidRecovery = {
  txId: number;
  userId: number;
  bucket: BonusBucket;
  originalAmount: number;
  validAmount: number;
  amount: number;
  disposition: 'RESTORE_TO_BONUS' | 'FORFEIT_DUE_TO_CAP';
  reason: string;
  source: string;
  bonusCode: string | null;
  matchedBonusId: number | null;
};

type BucketTotals = Record<BonusBucket, number>;

type GrantSummary = {
  grantedAmount: number;
  releaseCapAmount: number;
};

type ConvertNormalizationPlan = {
  bucket: BonusBucket;
  bonusCode: string | null;
  reason: string;
  canonicalAmount: number;
  canonicalTxId: number | null;
  reversedTxIds: number[];
};

type CandidateEvaluation = {
  txId: number;
  validAmount: number;
};

type GrantGroupKey = `${BonusBucket}:${string}`;

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
    wageringMultiplier: getValue('--wageringMultiplier')
      ? Number(getValue('--wageringMultiplier'))
      : 5,
    userId: getValue('--userId') ? Number(getValue('--userId')) : undefined,
    limit: getValue('--limit') ? Number(getValue('--limit')) : undefined,
  };
}

function getBucketFromBonus(bonus: Pick<BonusRow, 'bonusCurrency' | 'applicableTo'>): BonusBucket {
  if (bonus.bonusCurrency === 'CRYPTO') return 'crypto';
  return bonus.applicableTo === 'SPORTS' ? 'sports' : 'casino';
}

function getBonusWalletField(bucket: BonusBucket): WalletField {
  if (bucket === 'sports') return 'sportsBonus';
  if (bucket === 'crypto') return 'cryptoBonus';
  return 'casinoBonus';
}

function getMainWalletField(bucket: BonusBucket): WalletField {
  return bucket === 'crypto' ? 'cryptoBalance' : 'balance';
}

function getRecoveryBonusCode(bucket: BonusBucket) {
  if (bucket === 'sports') return 'RECOVERY_SPORTS_CONVERT';
  if (bucket === 'crypto') return 'RECOVERY_CRYPTO_CONVERT';
  return 'RECOVERY_CASINO_CONVERT';
}

function getRecoveryBonusTitle(bucket: BonusBucket) {
  if (bucket === 'sports') return 'Recovered Sports Bonus';
  if (bucket === 'crypto') return 'Recovered Crypto Bonus';
  return 'Recovered Casino Bonus';
}

function getRecoveryBonusCurrency(bucket: BonusBucket) {
  return bucket === 'crypto' ? 'CRYPTO' : 'INR';
}

function getRecoveryApplicableTo(bucket: BonusBucket) {
  if (bucket === 'sports') return 'SPORTS';
  if (bucket === 'crypto') return 'BOTH';
  return 'CASINO';
}

function getCurrentBucketWalletBalance(user: UserRow, bucket: BonusBucket) {
  if (bucket === 'sports') return round2(Number(user.sportsBonus || 0));
  if (bucket === 'crypto') return round2(Number(user.cryptoBonus || 0));
  return round2(Number(user.casinoBonus || 0) + Number(user.fiatBonus || 0));
}

function getPositiveNumber(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = round2(Number(payload[key] || 0));
    if (value > EPSILON) return value;
  }

  return 0;
}

function getBonusReleaseCapAmount(
  bonus: Pick<BonusRow, 'bonusAmount' | 'depositAmount'> | null | undefined,
) {
  const bonusAmount = round2(Number(bonus?.bonusAmount || 0));
  const depositAmount = round2(Number(bonus?.depositAmount || 0));

  if (depositAmount > EPSILON) {
    return round2(Math.min(bonusAmount, depositAmount));
  }

  return bonusAmount;
}

function extractBonusCodeFromText(text: string | null | undefined) {
  const value = String(text || '').trim();
  if (!value) return null;

  const patterns = [
    /bonus:\s*([A-Z0-9_]+)/i,
    /wallet:\s*([A-Z0-9_]+)(?:\s|\(|$)/i,
    /moved to .* wallet:\s*([A-Z0-9_]+)(?:\s|\(|$)/i,
    /converted to .* wallet:\s*([A-Z0-9_]+)(?:\s|\(|$)/i,
    /force-completed bonus:\s*([A-Z0-9_]+)(?:\s|\(|$)/i,
    /:\s*([A-Z0-9_]+)(?:\s*\(|\s+by|\s*$)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return String(match[1]).toUpperCase();
    }
  }

  return null;
}

function extractBonusCode(txn: Pick<TxnRow, 'paymentDetails' | 'remarks'>) {
  const paymentDetails = isObject(txn.paymentDetails) ? txn.paymentDetails : {};
  const directCode = String(paymentDetails.bonusCode || '').trim();
  if (directCode) return directCode.toUpperCase();
  return extractBonusCodeFromText(txn.remarks);
}

function extractRecoveryAppliedAmount(txn: Pick<TxnRow, 'paymentDetails'>) {
  const paymentDetails = isObject(txn.paymentDetails) ? txn.paymentDetails : {};
  const recovery = isObject(paymentDetails.bonusConvertRecovery)
    ? paymentDetails.bonusConvertRecovery
    : {};
  return round2(Number(recovery.recoveredAmount || 0));
}

function extractDeclaredConversionCapAmount(txn: Pick<TxnRow, 'paymentDetails'>) {
  const paymentDetails = isObject(txn.paymentDetails) ? txn.paymentDetails : {};
  return getPositiveNumber(paymentDetails, [
    'conversionCapAmount',
    'cappedReleaseAmount',
    'depositAmount',
  ]);
}

function extractSource(txn: Pick<TxnRow, 'paymentDetails'>) {
  const paymentDetails = isObject(txn.paymentDetails) ? txn.paymentDetails : {};
  return String(paymentDetails.source || '').toUpperCase();
}

function inferBucketFromPayload(payload: Record<string, unknown>, fallbackText?: string | null) {
  const bonusType = String(payload.bonusType || '').toUpperCase();
  const walletLabel = String(payload.walletLabel || '').toLowerCase();
  const destinationWallet = String(payload.destinationWallet || '').toUpperCase();
  const remarks = String(fallbackText || '').toLowerCase();

  if (
    bonusType === 'CRYPTO_BONUS' ||
    walletLabel.includes('crypto bonus') ||
    destinationWallet === 'CRYPTO_WALLET' ||
    remarks.includes('crypto bonus')
  ) {
    return 'crypto' as const;
  }

  if (
    bonusType === 'SPORTS' ||
    bonusType === 'SPORTS_BONUS' ||
    walletLabel.includes('sports bonus') ||
    remarks.includes('sports bonus') ||
    remarks.includes('sports only')
  ) {
    return 'sports' as const;
  }

  if (
    bonusType === 'CASINO' ||
    bonusType === 'CASINO_BONUS' ||
    bonusType === 'FIAT_BONUS' ||
    bonusType === 'BOTH' ||
    walletLabel.includes('casino bonus') ||
    walletLabel.includes('fiat bonus') ||
    remarks.includes('casino bonus') ||
    remarks.includes('fiat bonus')
  ) {
    return 'casino' as const;
  }

  return null;
}

function inferBucketFromTxn(txn: Pick<TxnRow, 'paymentDetails' | 'remarks' | 'paymentMethod'>) {
  const paymentDetails = isObject(txn.paymentDetails) ? txn.paymentDetails : {};
  const payloadBucket = inferBucketFromPayload(paymentDetails, txn.remarks);
  if (payloadBucket) return payloadBucket;

  const paymentMethod = String(txn.paymentMethod || '').toUpperCase();
  if (paymentMethod === 'CRYPTO_WALLET') return 'crypto';
  if (paymentMethod === 'BONUS_WALLET') {
    const remarks = String(txn.remarks || '').toLowerCase();
    if (remarks.includes('sports')) return 'sports';
    if (remarks.includes('crypto')) return 'crypto';
    return 'casino';
  }

  return null;
}

function getGrantGroupKey(bucket: BonusBucket, bonusCode: string) {
  return `${bucket}:${bonusCode}` as GrantGroupKey;
}

function buildGrantTotals(txns: TxnRow[]) {
  const totals = new Map<GrantGroupKey, number>();

  for (const txn of txns) {
    const bucket = inferBucketFromTxn(txn);
    const bonusCode = extractBonusCode(txn);
    if (!bucket || !bonusCode) continue;

    const key = getGrantGroupKey(bucket, bonusCode);
    totals.set(key, round2((totals.get(key) || 0) + round2(Number(txn.amount || 0))));
  }

  return totals;
}

function inferGrantReleaseCapAmount(
  grantTxn: TxnRow,
  matchingDeposits: Array<{ amount: number; createdAt: Date; used: boolean }>,
  genericDeposits: DepositMatchEntry[],
) {
  const paymentDetails = isObject(grantTxn.paymentDetails) ? grantTxn.paymentDetails : {};
  const explicitCap = getPositiveNumber(paymentDetails, [
    'conversionCapAmount',
    'depositAmount',
    'qualifyingDepositAmount',
    'sourceDepositAmount',
    'cappedReleaseAmount',
  ]);
  const grantAmount = round2(Number(grantTxn.amount || 0));

  if (explicitCap > EPSILON) {
    return round2(Math.min(grantAmount, explicitCap));
  }

  const tryMatchDeposit = (deposits: DepositMatchEntry[], maxLookbackMs: number) => {
    const grantTime = grantTxn.createdAt.getTime();
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < deposits.length; index += 1) {
      const deposit = deposits[index];
      if (deposit.used) continue;

      const deltaMs = grantTime - deposit.createdAt.getTime();
      if (deltaMs < -10 * 60 * 1000) continue;
      if (deltaMs > maxLookbackMs) continue;

      if (deltaMs < bestDistance) {
        bestDistance = deltaMs;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) {
      deposits[bestIndex].used = true;
      return round2(Math.min(grantAmount, deposits[bestIndex].amount));
    }

    return 0;
  };

  const matchedCodeDepositCap = tryMatchDeposit(matchingDeposits, 7 * 24 * 60 * 60 * 1000);
  if (matchedCodeDepositCap > EPSILON) {
    return matchedCodeDepositCap;
  }

  const grantRemarks = String(grantTxn.remarks || '').toLowerCase();
  const source = String(paymentDetails.source || '').toUpperCase();
  const likelyDepositLinkedGrant =
    source === 'PROMO_REDEEM' ||
    source === 'PENDING_DEPOSIT_BONUS' ||
    (!source &&
      !grantRemarks.startsWith('manual bonus grant:') &&
      !grantRemarks.startsWith('manual ') &&
      !grantRemarks.startsWith('signup bonus:') &&
      !grantRemarks.includes('admin direct') &&
      !grantRemarks.includes('admin bonus credit') &&
      !grantRemarks.includes('bulk casino bonus action'));

  if (likelyDepositLinkedGrant) {
    const genericDepositCap = tryMatchDeposit(genericDeposits, 48 * 60 * 60 * 1000);
    if (genericDepositCap > EPSILON) {
      return genericDepositCap;
    }
  }

  return grantAmount;
}

function buildGrantSummaries(grantTxns: TxnRow[], depositTxns: DepositTxnRow[]) {
  const allDeposits: DepositMatchEntry[] = depositTxns.map((deposit) => ({
    amount: round2(Number(deposit.amount || 0)),
    createdAt: deposit.createdAt,
    used: false,
  }));
  const depositPools = new Map<string, DepositMatchEntry[]>();
  for (const deposit of depositTxns) {
    const bonusCode = extractBonusCode(deposit);
    if (!bonusCode) continue;

    const existing = depositPools.get(bonusCode) || [];
    const sharedEntry = allDeposits.find(
      (entry) =>
        entry.createdAt.getTime() === deposit.createdAt.getTime() &&
        Math.abs(entry.amount - round2(Number(deposit.amount || 0))) <= EPSILON &&
        !depositPools
          .get(bonusCode)
          ?.includes(entry),
    );
    if (sharedEntry) {
      existing.push(sharedEntry);
    }
    existing.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    depositPools.set(bonusCode, existing);
  }

  const summaries = new Map<GrantGroupKey, GrantSummary>();
  const sortedGrants = [...grantTxns].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );

  for (const grant of sortedGrants) {
    const bucket = inferBucketFromTxn(grant);
    const bonusCode = extractBonusCode(grant);
    if (!bucket || !bonusCode) continue;

    const key = getGrantGroupKey(bucket, bonusCode);
    const previous = summaries.get(key) || {
      grantedAmount: 0,
      releaseCapAmount: 0,
    };
    const pool = depositPools.get(bonusCode) || [];
    const releaseCapAmount = inferGrantReleaseCapAmount(grant, pool, allDeposits);

    summaries.set(key, {
      grantedAmount: round2(previous.grantedAmount + round2(Number(grant.amount || 0))),
      releaseCapAmount: round2(previous.releaseCapAmount + releaseCapAmount),
    });
  }

  return summaries;
}

function buildCandidateGroupKey(candidate: RecoveryCandidate) {
  if (candidate.matchedBonus) return `bonus:${candidate.matchedBonus.id}`;
  if (candidate.bonusCode) return `orphan:${candidate.bucket}:${candidate.bonusCode}`;
  if (candidate.source === 'AUTO_WAGERING') {
    return `orphan-auto:${candidate.bucket}:${candidate.tx.id}`;
  }
  return null;
}

function matchTxnToBonus(txn: TxnRow, bonuses: BonusRow[]) {
  const bucket = inferBucketFromTxn(txn);
  const bonusCode = extractBonusCode(txn);
  const txnTime = txn.createdAt.getTime();

  let candidates = bonuses.filter(
    (bonus) =>
      bonus.createdAt.getTime() <= txnTime + 60 * 1000 &&
      (!bucket || getBucketFromBonus(bonus) === bucket),
  );

  if (bonusCode) {
    const exactCode = candidates.filter(
      (bonus) => String(bonus.bonusCode || '').toUpperCase() === bonusCode,
    );
    if (exactCode.length > 0) {
      candidates = exactCode;
    }
  }

  if (candidates.length === 0) return null;

  return candidates.sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )[0];
}

function emptyBucketTotals(): BucketTotals {
  return {
    casino: 0,
    sports: 0,
    crypto: 0,
  };
}

function addBucketAmount(totals: BucketTotals, bucket: BonusBucket, amount: number) {
  totals[bucket] = round2(totals[bucket] + round2(amount));
}

function buildRepairedRemarks(
  currentRemarks: string | null,
  recovery: Pick<InvalidRecovery, 'reason' | 'amount' | 'validAmount' | 'disposition'>,
) {
  const base = String(currentRemarks || '').replace(/\s*\[repair:[^\]]+\]\s*$/i, '').trim();

  let suffix = `[repair: valid=${round2(recovery.validAmount)}`;
  if (recovery.disposition === 'FORFEIT_DUE_TO_CAP') {
    suffix += `, forfeited=${round2(recovery.amount)}`;
  } else {
    suffix += `, restored=${round2(recovery.amount)}`;
  }
  suffix += `, reason=${recovery.reason}]`;

  return base ? `${base} ${suffix}` : suffix;
}

function buildCanonicalConvertRemarks(
  currentRemarks: string | null,
  canonicalAmount: number,
  reversedCount: number,
) {
  const base = String(currentRemarks || '').replace(/\s*\[repair:[^\]]+\]\s*$/i, '').trim();
  const suffix = `[repair: canonical=${round2(canonicalAmount)}, mergedDuplicates=${reversedCount}]`;
  return base ? `${base} ${suffix}` : suffix;
}

function buildReversedConvertRemarks(
  currentRemarks: string | null,
  canonicalTxId: number | null,
) {
  const base = String(currentRemarks || '').replace(/\s*\[repair:[^\]]+\]\s*$/i, '').trim();
  const suffix = `[repair: reversed duplicate, canonicalTxId=${canonicalTxId ?? 'none'}]`;
  return base ? `${base} ${suffix}` : suffix;
}

function resolveHistoricalReleaseCap(params: {
  matchedBonus: BonusRow | null;
  grantSummary?: GrantSummary;
  candidates: RecoveryCandidate[];
}) {
  const { matchedBonus, grantSummary, candidates } = params;

  let releaseCap = matchedBonus
    ? getBonusReleaseCapAmount(matchedBonus)
    : round2(grantSummary?.releaseCapAmount || 0);

  const bonusAmount = round2(
    Number(matchedBonus?.bonusAmount || grantSummary?.grantedAmount || 0),
  );

  if (matchedBonus && (!matchedBonus.depositAmount || matchedBonus.depositAmount <= EPSILON)) {
    const historicalCap = round2(grantSummary?.releaseCapAmount || 0);
    if (historicalCap > EPSILON) {
      releaseCap = releaseCap > EPSILON ? Math.min(releaseCap, historicalCap) : historicalCap;
    }
  }

  const declaredCaps = candidates
    .map((candidate) => extractDeclaredConversionCapAmount(candidate.tx))
    .filter((amount) => amount > EPSILON);

  if (declaredCaps.length > 0) {
    const smallestDeclaredCap = round2(Math.min(...declaredCaps));
    releaseCap =
      releaseCap > EPSILON ? Math.min(releaseCap, smallestDeclaredCap) : smallestDeclaredCap;
  }

  if (bonusAmount > EPSILON && releaseCap > bonusAmount) {
    releaseCap = bonusAmount;
  }

  return round2(releaseCap);
}

function sumActiveTrackedAmounts(bonuses: BonusRow[]) {
  const totals = emptyBucketTotals();

  for (const bonus of bonuses) {
    if (bonus.status !== 'ACTIVE') continue;
    addBucketAmount(totals, getBucketFromBonus(bonus), round2(Number(bonus.bonusAmount || 0)));
  }

  return totals;
}

async function syncUserBonusCountersTx(tx: Prisma.TransactionClient, userId: number) {
  const activeBonuses = await tx.userBonus.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    select: {
      applicableTo: true,
      bonusCurrency: true,
      wageringRequired: true,
      wageringDone: true,
    },
  });

  let globalReq = 0;
  let globalDone = 0;
  let casinoReq = 0;
  let casinoDone = 0;
  let sportsReq = 0;
  let sportsDone = 0;

  for (const bonus of activeBonuses) {
    const req = round2(Number(bonus.wageringRequired || 0));
    const done = round2(Math.min(Number(bonus.wageringDone || 0), req));

    globalReq = round2(globalReq + req);
    globalDone = round2(globalDone + done);

    const bucket =
      bonus.bonusCurrency === 'CRYPTO'
        ? 'crypto'
        : bonus.applicableTo === 'SPORTS'
          ? 'sports'
          : 'casino';

    if (bucket === 'sports') {
      sportsReq = round2(sportsReq + req);
      sportsDone = round2(sportsDone + done);
    } else if (bucket === 'casino') {
      casinoReq = round2(casinoReq + req);
      casinoDone = round2(casinoDone + done);
    }
  }

  await tx.user.update({
    where: { id: userId },
    data: {
      wageringRequired: globalReq,
      wageringDone: globalDone,
      casinoBonusWageringRequired: casinoReq,
      casinoBonusWageringDone: casinoDone,
      sportsBonusWageringRequired: sportsReq,
      sportsBonusWageringDone: sportsDone,
    },
  });
}

async function ensureRecoveryTrackingTx(params: {
  tx: Prisma.TransactionClient;
  user: UserRow;
  activeBonuses: BonusRow[];
  restored: BucketTotals;
  wageringMultiplier: number;
}) {
  const { tx, user, activeBonuses, restored, wageringMultiplier } = params;
  const activeTracked = sumActiveTrackedAmounts(activeBonuses);

  for (const bucket of ['casino', 'sports', 'crypto'] as const) {
    const restoredAmount = round2(restored[bucket]);
    if (restoredAmount <= EPSILON) continue;

    const currentWallet = getCurrentBucketWalletBalance(user, bucket);
    const deficitBefore = round2(Math.max(0, currentWallet - activeTracked[bucket]));
    const deficitAfter = round2(
      Math.max(0, currentWallet + restoredAmount - activeTracked[bucket]),
    );
    const trackingNeeded = round2(
      Math.min(restoredAmount, Math.max(0, deficitAfter - deficitBefore)),
    );

    if (trackingNeeded <= EPSILON) continue;

    const recoveryBonusCode = getRecoveryBonusCode(bucket);
    const wageringRequired = round2(
      trackingNeeded * Math.max(0, wageringMultiplier),
    );

    const existing = await tx.userBonus.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        bonusCode: recoveryBonusCode,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      await tx.userBonus.update({
        where: { id: existing.id },
        data: {
          bonusAmount: { increment: trackingNeeded },
          wageringRequired: { increment: wageringRequired },
          isEnabled: true,
        },
      });
    } else {
      await tx.userBonus.create({
        data: {
          userId: user.id,
          bonusId: `${RECOVERY_SCRIPT}_${bucket}`,
          bonusCode: recoveryBonusCode,
          bonusTitle: getRecoveryBonusTitle(bucket),
          bonusCurrency: getRecoveryBonusCurrency(bucket),
          applicableTo: getRecoveryApplicableTo(bucket),
          depositAmount: 0,
          bonusAmount: trackingNeeded,
          wageringRequired,
          wageringDone: 0,
          status: 'ACTIVE',
          isEnabled: true,
          expiresAt: null,
        },
      });
    }
  }
}

async function main() {
  const { apply, allowNegative, wageringMultiplier, userId, limit } = parseArgs();

  console.log(`[BonusConvertRecovery] Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  if (allowNegative) {
    console.log('[BonusConvertRecovery] Negative-balance correction: ENABLED');
  }
  console.log(`[BonusConvertRecovery] Repair wagering multiplier: ${wageringMultiplier}x`);
  if (userId) console.log(`[BonusConvertRecovery] Scoped to userId=${userId}`);
  if (limit) console.log(`[BonusConvertRecovery] Limit=${limit}`);

  const userIdRows = await prisma.transaction.findMany({
    where: {
      type: 'BONUS_CONVERT',
      status: { in: ['APPROVED', 'COMPLETED'] },
      ...(userId ? { userId } : {}),
    },
    select: { userId: true },
    orderBy: { userId: 'asc' },
  });

  const candidateUserIds = Array.from(
    new Set(userIdRows.map((row) => row.userId)),
  ).slice(0, limit ?? undefined);

  console.log(`[BonusConvertRecovery] Candidate users: ${candidateUserIds.length}`);

  let scannedUsers = 0;
  let scannedConvertTxns = 0;
  let usersToRecover = 0;
  let invalidTxnCount = 0;
  let skippedUsers = 0;

  for (const candidateUserId of candidateUserIds) {
    scannedUsers += 1;

    const [user, bonusesRaw, convertTxnsRaw, grantTxnsRaw, depositTxnsRaw] = await Promise.all([
      prisma.user.findUnique({
        where: { id: candidateUserId },
        select: {
          id: true,
          username: true,
          balance: true,
          cryptoBalance: true,
          fiatBonus: true,
          casinoBonus: true,
          sportsBonus: true,
          cryptoBonus: true,
        },
      }),
      prisma.userBonus.findMany({
        where: { userId: candidateUserId },
        select: {
          id: true,
          bonusCode: true,
          bonusTitle: true,
          bonusCurrency: true,
          applicableTo: true,
          depositAmount: true,
          bonusAmount: true,
          wageringRequired: true,
          wageringDone: true,
          status: true,
          isEnabled: true,
          createdAt: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.transaction.findMany({
        where: {
          userId: candidateUserId,
          type: 'BONUS_CONVERT',
          status: { in: ['APPROVED', 'COMPLETED'] },
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          type: true,
          status: true,
          paymentMethod: true,
          paymentDetails: true,
          remarks: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.transaction.findMany({
        where: {
          userId: candidateUserId,
          type: 'BONUS',
          status: { in: ['APPROVED', 'COMPLETED'] },
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          type: true,
          status: true,
          paymentMethod: true,
          paymentDetails: true,
          remarks: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.transaction.findMany({
        where: {
          userId: candidateUserId,
          type: 'DEPOSIT',
          status: { in: ['APPROVED', 'COMPLETED'] },
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          type: true,
          status: true,
          paymentMethod: true,
          paymentDetails: true,
          remarks: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!user) continue;

    const userRow: UserRow = {
      id: user.id,
      username: user.username,
      balance: round2(Number(user.balance || 0)),
      cryptoBalance: round2(Number(user.cryptoBalance || 0)),
      fiatBonus: round2(Number(user.fiatBonus || 0)),
      casinoBonus: round2(Number(user.casinoBonus || 0)),
      sportsBonus: round2(Number(user.sportsBonus || 0)),
      cryptoBonus: round2(Number(user.cryptoBonus || 0)),
    };

    const bonuses: BonusRow[] = bonusesRaw.map((bonus) => ({
      ...bonus,
      depositAmount: round2(Number(bonus.depositAmount || 0)),
      bonusAmount: round2(Number(bonus.bonusAmount || 0)),
      wageringRequired: round2(Number(bonus.wageringRequired || 0)),
      wageringDone: round2(Number(bonus.wageringDone || 0)),
    }));
    const convertTxns: TxnRow[] = convertTxnsRaw.map((txn) => ({
      ...txn,
      amount: round2(Number(txn.amount || 0)),
    }));
    const grantTxns: TxnRow[] = grantTxnsRaw.map((txn) => ({
      ...txn,
      amount: round2(Number(txn.amount || 0)),
    }));
    const depositTxns: DepositTxnRow[] = depositTxnsRaw.map((txn) => ({
      ...txn,
      amount: round2(Number(txn.amount || 0)),
    }));

    scannedConvertTxns += convertTxns.length;
    const grantSummaries = buildGrantSummaries(grantTxns, depositTxns);
    const groupedCandidates = new Map<string, RecoveryCandidate[]>();

    for (const txn of convertTxns) {
      const bucket = inferBucketFromTxn(txn);
      const source = extractSource(txn);
      const bonusCode = extractBonusCode(txn);
      const matchedBonus = matchTxnToBonus(txn, bonuses);
      const resolvedBucket = bucket || (matchedBonus ? getBucketFromBonus(matchedBonus) : null);

      if (!resolvedBucket) continue;

      const candidate: RecoveryCandidate = {
        tx: txn,
        bucket: resolvedBucket,
        source,
        bonusCode,
        matchedBonus,
      };

      const key = buildCandidateGroupKey(candidate);
      if (!key) continue;

      const group = groupedCandidates.get(key) || [];
      group.push(candidate);
      groupedCandidates.set(key, group);
    }

    const invalidRecoveries: InvalidRecovery[] = [];
    const normalizationPlans: ConvertNormalizationPlan[] = [];

    for (const candidates of groupedCandidates.values()) {
      const sorted = [...candidates].sort(
        (left, right) => left.tx.createdAt.getTime() - right.tx.createdAt.getTime(),
      );
      const matchedBonus = sorted[0]?.matchedBonus || null;
      const bucket = sorted[0]?.bucket;
      const bonusCode = sorted[0]?.bonusCode || null;
      const grantSummary =
        bucket && bonusCode
          ? grantSummaries.get(getGrantGroupKey(bucket, bonusCode))
          : undefined;

      if (!bucket) continue;

      let validLimit = 0;
      let fullGrantAmount = 0;

      if (matchedBonus) {
        fullGrantAmount = round2(Number(matchedBonus.bonusAmount || 0));
        if (matchedBonus.status === 'COMPLETED') {
          validLimit = resolveHistoricalReleaseCap({
            matchedBonus,
            grantSummary,
            candidates: sorted,
          });
        }
      } else if (bonusCode) {
        validLimit = resolveHistoricalReleaseCap({
          matchedBonus: null,
          grantSummary,
          candidates: sorted,
        });
        fullGrantAmount = round2(grantSummary?.grantedAmount || 0);
      }

      if (!matchedBonus && validLimit <= EPSILON) {
        const allAuto = sorted.every((candidate) => candidate.source === 'AUTO_WAGERING');
        if (!allAuto) {
          if (sorted.length > 1 && bonusCode) {
            validLimit = round2(sorted[0].tx.amount);
          } else {
            continue;
          }
        }
      }

      const isCapLimited =
        fullGrantAmount > EPSILON && validLimit + EPSILON < fullGrantAmount;
      let validRemaining = validLimit;
      const candidateEvaluations: CandidateEvaluation[] = [];

      for (const candidate of sorted) {
        const alreadyRecovered = extractRecoveryAppliedAmount(candidate.tx);
        const originalAmount = round2(candidate.tx.amount);
        let invalidOriginalAmount = 0;
        let validAmount = originalAmount;
        let disposition: InvalidRecovery['disposition'] = 'RESTORE_TO_BONUS';
        let reason = '';

        if (matchedBonus && matchedBonus.status !== 'COMPLETED') {
          invalidOriginalAmount = originalAmount;
          validAmount = 0;
          reason = 'bonus_not_completed';
          disposition = 'RESTORE_TO_BONUS';
        } else if (
          candidate.source === 'AUTO_WAGERING' &&
          ((matchedBonus && matchedBonus.wageringRequired <= EPSILON) ||
            (!matchedBonus && validLimit <= EPSILON))
        ) {
          invalidOriginalAmount = originalAmount;
          validAmount = 0;
          reason = 'zero_wager_auto_convert';
          disposition = 'RESTORE_TO_BONUS';
        } else {
          const validHere = round2(Math.min(validRemaining, originalAmount));
          validAmount = validHere;
          invalidOriginalAmount = round2(Math.max(0, originalAmount - validHere));
          validRemaining = round2(Math.max(0, validRemaining - validHere));

          if (invalidOriginalAmount > EPSILON) {
            if (isCapLimited) {
              reason = 'conversion_cap_excess';
              disposition = 'FORFEIT_DUE_TO_CAP';
            } else {
              reason = matchedBonus
                ? 'duplicate_bonus_convert'
                : 'orphan_duplicate_convert';
              disposition = 'RESTORE_TO_BONUS';
            }
          }
        }

        candidateEvaluations.push({
          txId: candidate.tx.id,
          validAmount,
        });

        const unrecoveredInvalidAmount = round2(
          Math.max(0, invalidOriginalAmount - alreadyRecovered),
        );

        if (unrecoveredInvalidAmount <= EPSILON || !reason) continue;

        invalidRecoveries.push({
          txId: candidate.tx.id,
          userId: candidate.tx.userId,
          bucket: candidate.bucket,
          originalAmount,
          validAmount,
          amount: unrecoveredInvalidAmount,
          disposition,
          reason,
          source: candidate.source,
          bonusCode: candidate.bonusCode,
          matchedBonusId: matchedBonus?.id || null,
        });
      }

      const canonicalEvaluation =
        validLimit > EPSILON
          ? candidateEvaluations.find((evaluation) => evaluation.validAmount > EPSILON) || null
          : null;
      const canonicalTx = canonicalEvaluation
        ? sorted.find((candidate) => candidate.tx.id === canonicalEvaluation.txId)?.tx || null
        : null;
      const reversedTxIds = sorted
        .map((candidate) => candidate.tx.id)
        .filter((txId) => txId !== canonicalTx?.id);

      const requiresNormalization =
        reversedTxIds.length > 0 ||
        (canonicalTx == null && sorted.length > 0);

      if (requiresNormalization) {
        normalizationPlans.push({
          bucket,
          bonusCode,
          reason:
            validLimit <= EPSILON
              ? 'invalid_bonus_convert_group'
              : sorted.length > 1
                ? 'duplicate_bonus_convert_group'
                : 'invalid_bonus_convert_group',
          canonicalAmount: round2(validLimit),
          canonicalTxId: canonicalTx?.id || null,
          reversedTxIds,
        });
      }
    }

    if (invalidRecoveries.length === 0 && normalizationPlans.length === 0) {
      continue;
    }

    invalidTxnCount += invalidRecoveries.length;
    usersToRecover += 1;

    const restored = emptyBucketTotals();
    const forfeited = emptyBucketTotals();
    for (const recovery of invalidRecoveries) {
      if (recovery.disposition === 'FORFEIT_DUE_TO_CAP') {
        addBucketAmount(forfeited, recovery.bucket, recovery.amount);
      } else {
        addBucketAmount(restored, recovery.bucket, recovery.amount);
      }
    }

    const balanceRecovery = round2(
      restored.casino + restored.sports + forfeited.casino + forfeited.sports,
    );
    const cryptoRecovery = round2(restored.crypto + forfeited.crypto);

    console.log(
      [
        `[BonusConvertRecovery] user=${userRow.id}`,
        userRow.username ? `(${userRow.username})` : '',
        restored.casino > EPSILON ? `casino=${restored.casino}` : '',
        restored.sports > EPSILON ? `sports=${restored.sports}` : '',
        restored.crypto > EPSILON ? `crypto=${restored.crypto}` : '',
        forfeited.casino > EPSILON ? `forfeitCasino=${forfeited.casino}` : '',
        forfeited.sports > EPSILON ? `forfeitSports=${forfeited.sports}` : '',
        forfeited.crypto > EPSILON ? `forfeitCrypto=${forfeited.crypto}` : '',
        `invalidTxns=${invalidRecoveries.length}`,
        normalizationPlans.length > 0 ? `normalizeGroups=${normalizationPlans.length}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );

    if (!apply) {
      continue;
    }

    const hasInsufficientBalance =
      !allowNegative &&
      balanceRecovery > EPSILON &&
      userRow.balance + EPSILON < balanceRecovery;
    const hasInsufficientCrypto =
      !allowNegative &&
      cryptoRecovery > EPSILON &&
      userRow.cryptoBalance + EPSILON < cryptoRecovery;

    if (hasInsufficientBalance || hasInsufficientCrypto) {
      skippedUsers += 1;
      console.warn(
        [
          `[BonusConvertRecovery] skip user=${userRow.id}`,
          hasInsufficientBalance
            ? `insufficient balance (${userRow.balance} < ${balanceRecovery})`
            : '',
          hasInsufficientCrypto
            ? `insufficient cryptoBalance (${userRow.cryptoBalance} < ${cryptoRecovery})`
            : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const updateData: Record<string, any> = {};

      if (balanceRecovery > EPSILON) {
        updateData.balance = { decrement: balanceRecovery };
      }
      if (cryptoRecovery > EPSILON) {
        updateData.cryptoBalance = { decrement: cryptoRecovery };
      }
      if (restored.casino > EPSILON) {
        updateData.casinoBonus = { increment: restored.casino };
      }
      if (restored.sports > EPSILON) {
        updateData.sportsBonus = { increment: restored.sports };
      }
      if (restored.crypto > EPSILON) {
        updateData.cryptoBonus = { increment: restored.crypto };
      }

      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id: userRow.id },
          data: updateData,
        });
      }

      for (const recovery of invalidRecoveries) {
        const txn = convertTxns.find((row) => row.id === recovery.txId);
        if (!txn) continue;

        const paymentDetails = isObject(txn.paymentDetails)
          ? { ...txn.paymentDetails }
          : {};
        const existingRecovery = isObject(paymentDetails.bonusConvertRecovery)
          ? paymentDetails.bonusConvertRecovery
          : {};
        const recoveredAmount = round2(
          Number(existingRecovery.recoveredAmount || 0) + recovery.amount,
        );
        const originalRecordedAmount = round2(
          Number(existingRecovery.originalAmount || recovery.originalAmount || txn.amount || 0),
        );
        const restoredAmount = round2(
          Number(existingRecovery.restoredAmount || 0) +
            (recovery.disposition === 'RESTORE_TO_BONUS' ? recovery.amount : 0),
        );
        const forfeitedAmount = round2(
          Number(existingRecovery.forfeitedAmount || 0) +
            (recovery.disposition === 'FORFEIT_DUE_TO_CAP' ? recovery.amount : 0),
        );

        paymentDetails.bonusConvertRecovery = {
          script: RECOVERY_SCRIPT,
          originalAmount: originalRecordedAmount,
          validAmount: recovery.validAmount,
          recoveredAmount,
          restoredAmount,
          forfeitedAmount,
          disposition: recovery.disposition,
          bucket: recovery.bucket,
          reason: recovery.reason,
          source: recovery.source || null,
          bonusCode: recovery.bonusCode || null,
          matchedBonusId: recovery.matchedBonusId,
          appliedAt: new Date().toISOString(),
        };

        await tx.transaction.update({
          where: { id: recovery.txId },
          data: {
            amount: recovery.validAmount,
            paymentDetails: paymentDetails as Prisma.InputJsonValue,
            remarks: buildRepairedRemarks(txn.remarks, recovery),
          },
        });
      }

      for (const plan of normalizationPlans) {
        if (plan.canonicalTxId) {
          const canonicalTxn = await tx.transaction.findUnique({
            where: { id: plan.canonicalTxId },
            select: {
              id: true,
              paymentDetails: true,
              remarks: true,
            },
          });

          if (canonicalTxn) {
            const paymentDetails = isObject(canonicalTxn.paymentDetails)
              ? { ...canonicalTxn.paymentDetails }
              : {};
            const existingNormalization = isObject(paymentDetails.bonusConvertNormalization)
              ? paymentDetails.bonusConvertNormalization
              : {};

            paymentDetails.bonusConvertNormalization = {
              ...existingNormalization,
              script: RECOVERY_SCRIPT,
              canonical: true,
              bucket: plan.bucket,
              bonusCode: plan.bonusCode,
              canonicalAmount: plan.canonicalAmount,
              reversedTxIds: plan.reversedTxIds,
              reason: plan.reason,
              appliedAt: new Date().toISOString(),
            };

            await tx.transaction.update({
              where: { id: plan.canonicalTxId },
              data: {
                type: 'BONUS_CONVERT',
                status: 'APPROVED',
                amount: plan.canonicalAmount,
                paymentDetails: paymentDetails as Prisma.InputJsonValue,
                remarks: buildCanonicalConvertRemarks(
                  canonicalTxn.remarks,
                  plan.canonicalAmount,
                  plan.reversedTxIds.length,
                ),
              },
            });
          }
        }

        for (const reversedTxId of plan.reversedTxIds) {
          const reversedTxn = await tx.transaction.findUnique({
            where: { id: reversedTxId },
            select: {
              id: true,
              amount: true,
              paymentDetails: true,
              remarks: true,
            },
          });
          if (!reversedTxn) continue;

          const paymentDetails = isObject(reversedTxn.paymentDetails)
            ? { ...reversedTxn.paymentDetails }
            : {};
          const existingNormalization = isObject(paymentDetails.bonusConvertNormalization)
            ? paymentDetails.bonusConvertNormalization
            : {};

          paymentDetails.bonusConvertNormalization = {
            ...existingNormalization,
            script: RECOVERY_SCRIPT,
            canonical: false,
            bucket: plan.bucket,
            bonusCode: plan.bonusCode,
            canonicalTxId: plan.canonicalTxId,
            originalAmount: round2(Number(reversedTxn.amount || 0)),
            reason: plan.reason,
            appliedAt: new Date().toISOString(),
          };

          await tx.transaction.update({
            where: { id: reversedTxId },
            data: {
              type: REVERSED_CONVERT_TYPE,
              status: 'REVERSED',
              paymentDetails: paymentDetails as Prisma.InputJsonValue,
              remarks: buildReversedConvertRemarks(
                reversedTxn.remarks,
                plan.canonicalTxId,
              ),
            },
          });
        }
      }

      const activeBonuses = bonuses.filter((bonus) => bonus.status === 'ACTIVE');
      await ensureRecoveryTrackingTx({
        tx,
        user: userRow,
        activeBonuses,
        restored,
        wageringMultiplier,
      });

      await syncUserBonusCountersTx(tx, userRow.id);
    });
  }

  console.log(
    `[BonusConvertRecovery] Complete. scannedUsers=${scannedUsers}, scannedConvertTxns=${scannedConvertTxns}, usersToRecover=${usersToRecover}, invalidTxns=${invalidTxnCount}, skippedUsers=${skippedUsers}, mode=${apply ? 'APPLY' : 'DRY-RUN'}`,
  );
}

main()
  .catch((error) => {
    console.error('[BonusConvertRecovery] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
