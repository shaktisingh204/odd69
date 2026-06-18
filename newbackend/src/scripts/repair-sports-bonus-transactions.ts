import { Prisma, PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const MONGO_URI = process.env.MONGO_URI;
const EPSILON = 0.0001;

if (!MONGO_URI) {
  console.error('MONGO_URI is not defined in .env');
  process.exit(1);
}

type WalletField = 'balance' | 'sportsBonus' | 'cryptoBalance';

type Allocation = {
  walletField: WalletField;
  amount: number;
};

type BetDoc = {
  _id: mongoose.Types.ObjectId;
  userId: number;
  eventName?: string | null;
  selectionName?: string | null;
  marketId?: string | null;
  status?: string | null;
  walletType?: string | null;
  betSource?: string | null;
  stake?: number | null;
  originalStake?: number | null;
  potentialWin?: number | null;
  bonusStakeAmount?: number | null;
  walletStakeAmount?: number | null;
  placedAt?: Date | null;
  settledAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
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

type BonusTxnRow = {
  amount: number;
  remarks: string | null;
  paymentDetails: unknown;
};

type UserDelta = Record<WalletField, number>;

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

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getPrimaryWalletField(walletType: string | null | undefined): WalletField {
  return walletType === 'crypto' ? 'cryptoBalance' : 'balance';
}

function mapWalletFieldToPaymentMethod(walletField: WalletField) {
  if (walletField === 'sportsBonus') return 'BONUS_WALLET';
  if (walletField === 'cryptoBalance') return 'CRYPTO_WALLET';
  return 'MAIN_WALLET';
}

function getBetOriginalStake(bet: Pick<BetDoc, 'originalStake' | 'stake'>) {
  return round2(Number(bet.originalStake ?? bet.stake ?? 0));
}

function getBetBonusStakeAmount(
  bet: Pick<BetDoc, 'betSource' | 'originalStake' | 'stake' | 'bonusStakeAmount'>,
) {
  const storedBonusStake = round2(Number(bet.bonusStakeAmount ?? 0));
  if (storedBonusStake > 0) return storedBonusStake;

  const betSource = String(bet.betSource || '');
  return betSource.includes('sportsBonus') ? getBetOriginalStake(bet) : 0;
}

function sumAllocations(allocations: Allocation[]): Allocation[] {
  const totals = new Map<WalletField, number>();
  for (const allocation of allocations) {
    if (!allocation.amount) continue;
    totals.set(
      allocation.walletField,
      round2((totals.get(allocation.walletField) || 0) + allocation.amount),
    );
  }

  return Array.from(totals.entries()).map(([walletField, amount]) => ({
    walletField,
    amount,
  }));
}

function buildStakeAllocations(
  bet: Pick<
    BetDoc,
    'walletType' | 'betSource' | 'originalStake' | 'stake' | 'bonusStakeAmount' | 'walletStakeAmount'
  >,
): Allocation[] {
  const originalStake = getBetOriginalStake(bet);
  const bonusStakeAmount = Math.min(
    originalStake,
    getBetBonusStakeAmount(bet),
  );
  const primaryWalletField = getPrimaryWalletField(bet.walletType);
  const walletStakeAmount =
    Number(bet.walletStakeAmount ?? 0) > 0
      ? round2(Number(bet.walletStakeAmount ?? 0))
      : round2(Math.max(0, originalStake - bonusStakeAmount));

  const allocations: Allocation[] = [];

  if (bonusStakeAmount > 0) {
    allocations.push({ walletField: 'sportsBonus', amount: bonusStakeAmount });
  }

  if (walletStakeAmount > 0) {
    allocations.push({
      walletField: primaryWalletField,
      amount: walletStakeAmount,
    });
  }

  if (allocations.length === 0 && originalStake > 0) {
    allocations.push({
      walletField: primaryWalletField,
      amount: originalStake,
    });
  }

  return sumAllocations(allocations);
}

function buildPayoutAllocations(
  bet: Pick<
    BetDoc,
    'walletType' | 'betSource' | 'originalStake' | 'stake' | 'bonusStakeAmount' | 'walletStakeAmount'
  >,
  amount: number,
): Allocation[] {
  const payoutAmount = round2(amount);
  if (payoutAmount <= 0) return [];

  const originalStake = getBetOriginalStake(bet);
  const bonusStakeAmount = Math.min(
    originalStake,
    getBetBonusStakeAmount(bet),
  );
  const primaryWalletField = getPrimaryWalletField(bet.walletType);
  const walletStakeAmount = round2(Math.max(0, originalStake - bonusStakeAmount));

  if (bonusStakeAmount <= 0 || originalStake <= 0) {
    return [{ walletField: primaryWalletField, amount: payoutAmount }];
  }

  if (walletStakeAmount <= 0) {
    return [{ walletField: 'sportsBonus', amount: payoutAmount }];
  }

  const bonusPayout = round2((payoutAmount * bonusStakeAmount) / originalStake);
  const walletPayout = round2(payoutAmount - bonusPayout);

  return sumAllocations([
    { walletField: 'sportsBonus', amount: bonusPayout },
    { walletField: primaryWalletField, amount: walletPayout },
  ]);
}

function allocationsEqual(left: Allocation[], right: Allocation[]) {
  const normalize = (allocations: Allocation[]) =>
    JSON.stringify(
      [...sumAllocations(allocations)].sort((a, b) =>
        a.walletField.localeCompare(b.walletField),
      ),
    );

  return normalize(left) === normalize(right);
}

function getTxnAllocations(txn: TxnRow, fallbackAmount: number): Allocation[] {
  const paymentDetails = isObject(txn.paymentDetails) ? txn.paymentDetails : {};
  const rawAllocations = Array.isArray(paymentDetails.allocations)
    ? paymentDetails.allocations
    : [];

  const allocations: Allocation[] = [];

  for (const rawAllocation of rawAllocations) {
    if (!isObject(rawAllocation)) continue;
    const walletField = String(rawAllocation.walletField || '');
    const amount = round2(Number(rawAllocation.amount || 0));
    if (
      amount > 0 &&
      (walletField === 'balance' ||
        walletField === 'sportsBonus' ||
        walletField === 'cryptoBalance')
    ) {
      allocations.push({
        walletField,
        amount,
      });
    }
  }

  if (allocations.length > 0) {
    return sumAllocations(allocations);
  }

  const paymentDetailsWalletField = String(paymentDetails.walletField || '');
  if (
    paymentDetailsWalletField === 'balance' ||
    paymentDetailsWalletField === 'sportsBonus' ||
    paymentDetailsWalletField === 'cryptoBalance'
  ) {
    return [{ walletField: paymentDetailsWalletField, amount: round2(fallbackAmount) }];
  }

  const paymentMethod = String(txn.paymentMethod || '').toUpperCase();
  if (paymentMethod === 'BONUS_WALLET') {
    return [{ walletField: 'sportsBonus', amount: round2(fallbackAmount) }];
  }
  if (paymentMethod === 'CRYPTO_WALLET') {
    return [{ walletField: 'cryptoBalance', amount: round2(fallbackAmount) }];
  }
  if (
    paymentMethod === 'MAIN_WALLET' ||
    paymentMethod === 'FIAT_WALLET' ||
    paymentMethod === 'MULTI_WALLET' ||
    !paymentMethod
  ) {
    return [{ walletField: 'balance', amount: round2(fallbackAmount) }];
  }

  return [{ walletField: 'balance', amount: round2(fallbackAmount) }];
}

function buildHistoricalActualAllocations(
  bet: BetDoc,
  txn: TxnRow,
  fallbackAmount: number,
): Allocation[] {
  const paymentDetails = isObject(txn.paymentDetails) ? txn.paymentDetails : {};
  const source = String(paymentDetails.source || '').toUpperCase();
  const amount = round2(fallbackAmount);
  const primaryWalletField = getPrimaryWalletField(bet.walletType);
  const hasSportsBonusSource = String(bet.betSource || '').includes('sportsBonus');

  if (txn.type === 'BET_WIN') {
    if (
      source === 'AUTO_SETTLEMENT' ||
      source === 'MANUAL_SETTLEMENT' ||
      source === 'SPORTS_SETTLEMENT_REPAIR'
    ) {
      return [{ walletField: primaryWalletField, amount }];
    }

    if (
      source === 'MATCH_SETTLEMENT' ||
      source === 'SPORTS_SETTLEMENT'
    ) {
      return [
        {
          walletField: hasSportsBonusSource
            ? 'sportsBonus'
            : primaryWalletField,
          amount,
        },
      ];
    }
  }

  if (txn.type === 'BET_REFUND') {
    if (
      source === 'BET_CANCEL' ||
      source === 'SPORTS_REFUND_REPAIR' ||
      !source
    ) {
      return [{ walletField: primaryWalletField, amount }];
    }
  }

  return getTxnAllocations(txn, fallbackAmount);
}

function scoreTransactionMatch(bet: BetDoc, txn: TxnRow, targetDate: Date | null | undefined) {
  let score = 0;
  const paymentDetails = isObject(txn.paymentDetails) ? txn.paymentDetails : {};
  if (String(paymentDetails.betId || '') === String(bet._id)) score += 1000;
  if (String(paymentDetails.marketId || '') === String(bet.marketId || '')) score += 200;

  const remarks = String(txn.remarks || '').toLowerCase();
  if (bet.eventName && remarks.includes(String(bet.eventName).toLowerCase())) score += 100;
  if (bet.selectionName && remarks.includes(String(bet.selectionName).toLowerCase())) score += 100;

  if (targetDate) {
    const diffMs = Math.abs(txn.createdAt.getTime() - targetDate.getTime());
    score += Math.max(0, 50 - Math.floor(diffMs / 60000));
  }

  return score;
}

function buildTxnWhere(userId: number, type: string, amount: number, targetDate: Date | null | undefined) {
  const start = targetDate
    ? new Date(targetDate.getTime() - 12 * 60 * 60 * 1000)
    : undefined;
  const end = targetDate
    ? new Date(targetDate.getTime() + 12 * 60 * 60 * 1000)
    : undefined;

  return {
    userId,
    type,
    status: 'COMPLETED',
    amount: {
      gte: round2(amount - 0.01),
      lte: round2(amount + 0.01),
    },
    ...(start && end
      ? {
          createdAt: {
            gte: start,
            lte: end,
          },
        }
      : {}),
  };
}

async function findBestTransactionMatch(params: {
  bet: BetDoc;
  type: string;
  amount: number;
  targetDate: Date | null | undefined;
  usedIds: Set<number>;
}) {
  const rows = (await prisma.transaction.findMany({
    where: buildTxnWhere(
      params.bet.userId,
      params.type,
      params.amount,
      params.targetDate,
    ),
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
    take: 25,
  })) as TxnRow[];

  const available = rows.filter((row) => !params.usedIds.has(row.id));
  if (available.length === 0) return null;

  return (
    available
      .map((txn) => ({
        txn,
        score: scoreTransactionMatch(params.bet, txn, params.targetDate),
      }))
      .sort((left, right) => right.score - left.score)[0]?.txn || null
  );
}

function addUserDelta(
  deltas: Map<number, UserDelta>,
  userId: number,
  allocations: Allocation[],
  direction: 1 | -1,
) {
  const current = deltas.get(userId) || {
    balance: 0,
    sportsBonus: 0,
    cryptoBalance: 0,
  };

  for (const allocation of allocations) {
    current[allocation.walletField] = round2(
      current[allocation.walletField] + direction * allocation.amount,
    );
  }

  deltas.set(userId, current);
}

function looksLikeSportsBonusGrant(txn: BonusTxnRow) {
  const remarks = String(txn.remarks || '').toLowerCase();
  const paymentDetails = isObject(txn.paymentDetails) ? txn.paymentDetails : {};
  const bonusType = String(paymentDetails.bonusType || '').toUpperCase();
  const walletLabel = String(paymentDetails.walletLabel || '').toLowerCase();

  return (
    bonusType === 'SPORTS_BONUS' ||
    walletLabel.includes('sports bonus') ||
    remarks.includes('sports bonus') ||
    remarks.includes('sports only')
  );
}

async function getSportsBonusGrantEstimate(userId: number) {
  const txns = (await prisma.transaction.findMany({
    where: {
      userId,
      type: 'BONUS',
      status: 'APPROVED',
    },
    select: {
      amount: true,
      remarks: true,
      paymentDetails: true,
    },
    orderBy: { createdAt: 'asc' },
  })) as BonusTxnRow[];

  return round2(
    txns
      .filter((txn) => looksLikeSportsBonusGrant(txn))
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0),
  );
}

async function syncUserBonusCounters(userId: number) {
  const activeBonuses = await prisma.userBonus.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    select: {
      applicableTo: true,
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

    if (bonus.applicableTo === 'SPORTS') {
      sportsReq = round2(sportsReq + req);
      sportsDone = round2(sportsDone + done);
    } else {
      casinoReq = round2(casinoReq + req);
      casinoDone = round2(casinoDone + done);
    }
  }

  await prisma.user.update({
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

async function ensureSportsBonusWageringState(params: {
  userId: number;
  sportsBonusBalance: number;
  observedBonusStake: number;
  wageringMultiplier: number;
}) {
  const { userId, sportsBonusBalance, observedBonusStake, wageringMultiplier } = params;
  if (sportsBonusBalance <= EPSILON) {
    await syncUserBonusCounters(userId);
    return;
  }

  const activeSportsBonuses = await prisma.userBonus.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      applicableTo: 'SPORTS',
    },
    select: {
      id: true,
      wageringRequired: true,
    },
  });

  const hasTrackedSportsBonus = activeSportsBonuses.some(
    (bonus) => Number(bonus.wageringRequired || 0) > 0,
  );

  if (!hasTrackedSportsBonus) {
    const estimatedGrantAmount = await getSportsBonusGrantEstimate(userId);
    const baseBonusAmount =
      estimatedGrantAmount > EPSILON
        ? Math.min(sportsBonusBalance, estimatedGrantAmount)
        : sportsBonusBalance;
    const normalizedBaseAmount = round2(baseBonusAmount);
    const wageringRequired = round2(
      normalizedBaseAmount * Math.max(0, wageringMultiplier),
    );
    const wageringDone = round2(
      Math.min(wageringRequired, Math.max(0, observedBonusStake)),
    );

    await prisma.userBonus.create({
      data: {
        userId,
        bonusId: 'repair_sports_bonus_5x',
        bonusCode: 'REPAIR_SPORTS_5X',
        bonusTitle: 'Repaired Sports Bonus',
        bonusCurrency: 'INR',
        applicableTo: 'SPORTS',
        depositAmount: 0,
        bonusAmount: normalizedBaseAmount,
        wageringRequired,
        wageringDone,
        status: 'ACTIVE',
        isEnabled: true,
        expiresAt: null,
      },
    });
  }

  await syncUserBonusCounters(userId);
}

async function main() {
  const { apply, allowNegative, wageringMultiplier, userId, limit } = parseArgs();
  console.log(`[SportsTxnRepair] Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  if (allowNegative) {
    console.log('[SportsTxnRepair] Negative-balance correction: ENABLED');
  }
  console.log(`[SportsTxnRepair] Sports bonus wagering multiplier: ${wageringMultiplier}x`);
  if (userId) console.log(`[SportsTxnRepair] Scoped to userId=${userId}`);
  if (limit) console.log(`[SportsTxnRepair] Limit=${limit}`);

  await mongoose.connect(MONGO_URI);

  try {
    const betsCollection = mongoose.connection.collection<BetDoc>('bets');
    const query: Record<string, unknown> = {
      $or: [
        { betSource: { $regex: 'sportsBonus', $options: 'i' } },
        { bonusStakeAmount: { $gt: 0 } },
      ],
    };

    if (userId) {
      query.userId = userId;
    }

    const bets = await betsCollection
      .find(query)
      .sort({ createdAt: 1 })
      .limit(limit ?? 0)
      .toArray();

    console.log(`[SportsTxnRepair] Candidate bets: ${bets.length}`);

    const usedTxnIds = new Set<number>();
    const userDeltas = new Map<number, UserDelta>();
    const observedBonusStakeByUser = new Map<number, number>();
    const txnUpdates = new Map<
      number,
      {
        userId: number;
        paymentMethod: string | null;
        paymentDetails: Prisma.InputJsonValue;
      }
    >();

    let scanned = 0;
    let touchedTxns = 0;
    let touchedUsers = 0;
    let unmatched = 0;

    for (const bet of bets) {
      scanned += 1;
      observedBonusStakeByUser.set(
        bet.userId,
        round2(
          (observedBonusStakeByUser.get(bet.userId) || 0) +
            getBetBonusStakeAmount(bet),
        ),
      );
      const targetPlaceDate = bet.placedAt || bet.createdAt || null;
      const stakeAllocations = buildStakeAllocations(bet);
      const placeTxn = await findBestTransactionMatch({
        bet,
        type: 'BET_PLACE',
        amount: getBetOriginalStake(bet),
        targetDate: targetPlaceDate,
        usedIds: usedTxnIds,
      });

      if (placeTxn) {
        usedTxnIds.add(placeTxn.id);
        const nextPlacePaymentMethod =
          stakeAllocations.length === 1
            ? mapWalletFieldToPaymentMethod(stakeAllocations[0].walletField)
            : 'MULTI_WALLET';
        const placePaymentDetails = isObject(placeTxn.paymentDetails)
          ? { ...placeTxn.paymentDetails }
          : {};
        placePaymentDetails.source = 'BET_PLACE';
        placePaymentDetails.walletField =
          stakeAllocations.length === 1 ? stakeAllocations[0].walletField : null;
        placePaymentDetails.allocations = stakeAllocations;
        placePaymentDetails.betId = String(bet._id);
        placePaymentDetails.marketId = String(bet.marketId || '');

        const currentPlaceAllocations = getTxnAllocations(
          placeTxn,
          getBetOriginalStake(bet),
        );

        if (
          placeTxn.paymentMethod !== nextPlacePaymentMethod ||
          !allocationsEqual(currentPlaceAllocations, stakeAllocations) ||
          String((placePaymentDetails.betId as string) || '') !== String(bet._id)
        ) {
          txnUpdates.set(placeTxn.id, {
            userId: bet.userId,
            paymentMethod: nextPlacePaymentMethod,
            paymentDetails: placePaymentDetails as Prisma.InputJsonValue,
          });
        }
      } else {
        unmatched += 1;
      }

      const settledAt = bet.settledAt || bet.updatedAt || null;
      const normalizedStatus = String(bet.status || '').toUpperCase();

      if (normalizedStatus === 'WON') {
        const winAmount = round2(Number(bet.potentialWin || 0));
        const payoutAllocations = buildPayoutAllocations(bet, winAmount);
        const winTxn = await findBestTransactionMatch({
          bet,
          type: 'BET_WIN',
          amount: winAmount,
          targetDate: settledAt,
          usedIds: usedTxnIds,
        });

        if (!winTxn) {
          unmatched += 1;
        } else {
          usedTxnIds.add(winTxn.id);
          const actualAllocations = buildHistoricalActualAllocations(
            bet,
            winTxn,
            winAmount,
          );
          addUserDelta(userDeltas, bet.userId, actualAllocations, -1);
          addUserDelta(userDeltas, bet.userId, payoutAllocations, 1);

          const paymentDetails = isObject(winTxn.paymentDetails)
            ? { ...winTxn.paymentDetails }
            : {};
          paymentDetails.walletField =
            payoutAllocations.length === 1
              ? payoutAllocations[0].walletField
              : null;
          paymentDetails.allocations = payoutAllocations;
          paymentDetails.betId = String(bet._id);
          paymentDetails.marketId = String(bet.marketId || '');
          paymentDetails.source = paymentDetails.source || 'SPORTS_SETTLEMENT_REPAIR';

          txnUpdates.set(winTxn.id, {
            userId: bet.userId,
            paymentMethod:
              payoutAllocations.length === 1
                ? mapWalletFieldToPaymentMethod(payoutAllocations[0].walletField)
                : 'MULTI_WALLET',
            paymentDetails: paymentDetails as Prisma.InputJsonValue,
          });
        }
      }

      if (normalizedStatus === 'VOID') {
        const refundAmount = getBetOriginalStake(bet);
        const refundAllocations = stakeAllocations;
        const refundTxn = await findBestTransactionMatch({
          bet,
          type: 'BET_REFUND',
          amount: refundAmount,
          targetDate: settledAt,
          usedIds: usedTxnIds,
        });

        if (!refundTxn) {
          unmatched += 1;
        } else {
          usedTxnIds.add(refundTxn.id);
          const actualAllocations = buildHistoricalActualAllocations(
            bet,
            refundTxn,
            refundAmount,
          );
          addUserDelta(userDeltas, bet.userId, actualAllocations, -1);
          addUserDelta(userDeltas, bet.userId, refundAllocations, 1);

          const paymentDetails = isObject(refundTxn.paymentDetails)
            ? { ...refundTxn.paymentDetails }
            : {};
          paymentDetails.walletField =
            refundAllocations.length === 1
              ? refundAllocations[0].walletField
              : null;
          paymentDetails.allocations = refundAllocations;
          paymentDetails.betId = String(bet._id);
          paymentDetails.marketId = String(bet.marketId || '');
          paymentDetails.source = paymentDetails.source || 'SPORTS_REFUND_REPAIR';

          txnUpdates.set(refundTxn.id, {
            userId: bet.userId,
            paymentMethod:
              refundAllocations.length === 1
                ? mapWalletFieldToPaymentMethod(refundAllocations[0].walletField)
                : 'MULTI_WALLET',
            paymentDetails: paymentDetails as Prisma.InputJsonValue,
          });
        }
      }
    }

    touchedTxns = txnUpdates.size;
    touchedUsers = Array.from(userDeltas.values()).filter(
      (delta) =>
        Math.abs(delta.balance) > EPSILON ||
        Math.abs(delta.sportsBonus) > EPSILON ||
        Math.abs(delta.cryptoBalance) > EPSILON,
    ).length;

    console.log(
      `[SportsTxnRepair] scanned=${scanned} txnsToUpdate=${touchedTxns} usersToRebalance=${touchedUsers} unmatched=${unmatched}`,
    );

    for (const [affectedUserId, delta] of userDeltas.entries()) {
      if (
        Math.abs(delta.balance) <= EPSILON &&
        Math.abs(delta.sportsBonus) <= EPSILON &&
        Math.abs(delta.cryptoBalance) <= EPSILON
      ) {
        continue;
      }

      console.log(
        `[SportsTxnRepair] user=${affectedUserId} delta balance=${delta.balance} sportsBonus=${delta.sportsBonus} cryptoBalance=${delta.cryptoBalance}`,
      );
    }

    if (!apply) {
      console.log(
        '[SportsTxnRepair] Dry run complete. Re-run with --apply to persist changes.',
      );
      return;
    }

    const eligibleUsers = new Set<number>();
    const usersWithDelta = new Set<number>(userDeltas.keys());

    for (const [affectedUserId, delta] of userDeltas.entries()) {
      if (
        Math.abs(delta.balance) <= EPSILON &&
        Math.abs(delta.sportsBonus) <= EPSILON &&
        Math.abs(delta.cryptoBalance) <= EPSILON
      ) {
        eligibleUsers.add(affectedUserId);
        continue;
      }

      const user = await prisma.user.findUnique({
        where: { id: affectedUserId },
        select: {
          balance: true,
          sportsBonus: true,
          cryptoBalance: true,
        },
      });

      if (!user) {
        continue;
      }

      if (
        !allowNegative &&
        delta.balance < -EPSILON &&
        user.balance + EPSILON < Math.abs(delta.balance)
      ) {
        console.warn(
          `[SportsTxnRepair] skip user=${affectedUserId} insufficient balance for delta ${delta.balance}`,
        );
        continue;
      }
      if (
        !allowNegative &&
        delta.sportsBonus < -EPSILON &&
        user.sportsBonus + EPSILON < Math.abs(delta.sportsBonus)
      ) {
        console.warn(
          `[SportsTxnRepair] skip user=${affectedUserId} insufficient sportsBonus for delta ${delta.sportsBonus}`,
        );
        continue;
      }
      if (
        !allowNegative &&
        delta.cryptoBalance < -EPSILON &&
        user.cryptoBalance + EPSILON < Math.abs(delta.cryptoBalance)
      ) {
        console.warn(
          `[SportsTxnRepair] skip user=${affectedUserId} insufficient cryptoBalance for delta ${delta.cryptoBalance}`,
        );
        continue;
      }

      eligibleUsers.add(affectedUserId);
    }

    for (const update of txnUpdates.values()) {
      if (!usersWithDelta.has(update.userId)) {
        eligibleUsers.add(update.userId);
      }
    }

    for (const [transactionId, next] of txnUpdates.entries()) {
      if (!eligibleUsers.has(next.userId)) {
        continue;
      }

      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          paymentMethod: next.paymentMethod,
          paymentDetails: next.paymentDetails,
        },
      });
    }

    for (const [affectedUserId, delta] of userDeltas.entries()) {
      if (!eligibleUsers.has(affectedUserId)) {
        continue;
      }

      if (
        Math.abs(delta.balance) <= EPSILON &&
        Math.abs(delta.sportsBonus) <= EPSILON &&
        Math.abs(delta.cryptoBalance) <= EPSILON
      ) {
        continue;
      }

      const updateData: Record<string, any> = {};
      if (Math.abs(delta.balance) > EPSILON) {
        updateData.balance =
          delta.balance > 0
            ? { increment: round2(delta.balance) }
            : { decrement: round2(Math.abs(delta.balance)) };
      }
      if (Math.abs(delta.sportsBonus) > EPSILON) {
        updateData.sportsBonus =
          delta.sportsBonus > 0
            ? { increment: round2(delta.sportsBonus) }
            : { decrement: round2(Math.abs(delta.sportsBonus)) };
      }
      if (Math.abs(delta.cryptoBalance) > EPSILON) {
        updateData.cryptoBalance =
          delta.cryptoBalance > 0
            ? { increment: round2(delta.cryptoBalance) }
            : { decrement: round2(Math.abs(delta.cryptoBalance)) };
      }

      await prisma.user.update({
        where: { id: affectedUserId },
        data: updateData,
      });

      const refreshedUser = await prisma.user.findUnique({
        where: { id: affectedUserId },
        select: {
          sportsBonus: true,
        },
      });

      await ensureSportsBonusWageringState({
        userId: affectedUserId,
        sportsBonusBalance: round2(Number(refreshedUser?.sportsBonus || 0)),
        observedBonusStake: round2(
          observedBonusStakeByUser.get(affectedUserId) || 0,
        ),
        wageringMultiplier,
      });
    }

    for (const eligibleUserId of eligibleUsers) {
      if (userDeltas.has(eligibleUserId)) {
        continue;
      }

      const user = await prisma.user.findUnique({
        where: { id: eligibleUserId },
        select: {
          sportsBonus: true,
        },
      });

      await ensureSportsBonusWageringState({
        userId: eligibleUserId,
        sportsBonusBalance: round2(Number(user?.sportsBonus || 0)),
        observedBonusStake: round2(
          observedBonusStakeByUser.get(eligibleUserId) || 0,
        ),
        wageringMultiplier,
      });
    }

    console.log('[SportsTxnRepair] Apply complete.');
  } finally {
    await mongoose.disconnect();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[SportsTxnRepair] Failed:', error);
  process.exit(1);
});
