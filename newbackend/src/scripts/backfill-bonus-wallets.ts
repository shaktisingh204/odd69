import { BonusStatus, PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const EPSILON = 0.0001;

type BonusBucket = 'casino' | 'sports' | 'crypto';

type UserSnapshot = {
  id: number;
  username: string | null;
  balance: number;
  cryptoBalance: number;
  fiatBonus: number;
  casinoBonus: number;
  sportsBonus: number;
  cryptoBonus: number;
  wageringRequired: number;
  wageringDone: number;
  casinoBonusWageringRequired: number;
  casinoBonusWageringDone: number;
  sportsBonusWageringRequired: number;
  sportsBonusWageringDone: number;
};

type BonusLike = {
  id: number;
  bonusCode: string;
  bonusTitle: string;
  bonusCurrency: string;
  applicableTo: string;
  bonusAmount: number;
  wageringRequired: number;
  wageringDone: number;
  status: BonusStatus;
  createdAt: Date;
  completedAt: Date | null;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function positiveDelta(actual: number, expected: number) {
  return round2(Math.max(0, actual - expected));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const hasFlag = (flag: string) => args.includes(flag);
  const getValue = (name: string) => {
    const exact = args.find((arg) => arg.startsWith(`${name}=`));
    return exact ? exact.slice(name.length + 1) : undefined;
  };

  const userIdRaw = getValue('--userId');
  const limitRaw = getValue('--limit');

  return {
    apply: hasFlag('--apply'),
    noLog: hasFlag('--no-log'),
    userId: userIdRaw ? Number(userIdRaw) : undefined,
    limit: limitRaw ? Number(limitRaw) : undefined,
  };
}

function bucketFromBonus(bonus: { bonusCurrency: string; applicableTo: string }): BonusBucket {
  if (bonus.bonusCurrency === 'CRYPTO') return 'crypto';
  return bonus.applicableTo === 'SPORTS' ? 'sports' : 'casino';
}

function getBonusWalletField(bucket: BonusBucket) {
  if (bucket === 'crypto') return 'cryptoBonus';
  return bucket === 'sports' ? 'sportsBonus' : 'casinoBonus';
}

function getMainWalletField(bucket: BonusBucket) {
  return bucket === 'crypto' ? 'cryptoBalance' : 'balance';
}

function isSuspiciousZeroWagerCompletion(bonus: BonusLike) {
  return bonus.status === 'COMPLETED' && (bonus.wageringRequired ?? 0) <= 0;
}

async function createSyntheticBonus(params: {
  tx: PrismaClient | any;
  userId: number;
  bucket: BonusBucket;
  bonusAmount: number;
  wageringRequired: number;
  wageringDone: number;
  note: string;
  noLog?: boolean;
}) {
  const {
    tx,
    userId,
    bucket,
    bonusAmount,
    wageringRequired,
    wageringDone,
    note,
    noLog,
  } = params;

  const bonusCurrency = bucket === 'crypto' ? 'CRYPTO' : 'INR';
  const applicableTo = bucket === 'sports' ? 'SPORTS' : 'CASINO';
  const bonusCode =
    bucket === 'sports'
      ? 'BACKFILL_SPORTS'
      : bucket === 'crypto'
        ? 'BACKFILL_CRYPTO'
        : 'BACKFILL_CASINO';
  const bonusTitle =
    bucket === 'sports'
      ? 'Backfilled Sports Bonus'
      : bucket === 'crypto'
        ? 'Backfilled Crypto Bonus'
        : 'Backfilled Casino Bonus';

  await tx.userBonus.create({
    data: {
      userId,
      bonusId: 'backfill_legacy_bonus',
      bonusCode,
      bonusTitle,
      bonusCurrency,
      applicableTo,
      depositAmount: 0,
      bonusAmount: round2(bonusAmount),
      wageringRequired: round2(wageringRequired),
      wageringDone: round2(Math.min(wageringDone, wageringRequired)),
      status: 'ACTIVE',
      isEnabled: true,
      expiresAt: null,
    },
  });

  if (!noLog) {
    await tx.transaction.create({
      data: {
        userId,
        amount: round2(bonusAmount),
        type: 'BONUS',
        status: 'APPROVED',
        remarks: note,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

function summarizeActiveBonuses(activeBonuses: BonusLike[]) {
  let casinoWallet = 0;
  let sportsWallet = 0;
  let cryptoWallet = 0;
  let casinoReq = 0;
  let casinoDone = 0;
  let sportsReq = 0;
  let sportsDone = 0;
  let globalReq = 0;
  let globalDone = 0;

  for (const bonus of activeBonuses) {
    const bucket = bucketFromBonus(bonus);
    const amount = round2(bonus.bonusAmount || 0);
    const req = round2(Math.max(0, bonus.wageringRequired || 0));
    const done = round2(Math.min(Math.max(0, bonus.wageringDone || 0), req));

    if (bucket === 'casino') {
      casinoWallet += amount;
      casinoReq += req;
      casinoDone += done;
    } else if (bucket === 'sports') {
      sportsWallet += amount;
      sportsReq += req;
      sportsDone += done;
    } else {
      cryptoWallet += amount;
    }

    globalReq += req;
    globalDone += done;
  }

  return {
    casinoWallet: round2(casinoWallet),
    sportsWallet: round2(sportsWallet),
    cryptoWallet: round2(cryptoWallet),
    casinoReq: round2(casinoReq),
    casinoDone: round2(casinoDone),
    sportsReq: round2(sportsReq),
    sportsDone: round2(sportsDone),
    globalReq: round2(globalReq),
    globalDone: round2(globalDone),
  };
}

async function repairAdminSwitchTransactions(userId: number, apply: boolean) {
  const txns = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'BONUS_CONVERT',
      remarks: { startsWith: 'Admin converted bonus:' },
    },
    select: { id: true, remarks: true },
  });

  if (txns.length === 0) return 0;

  if (!apply) return txns.length;

  for (const txn of txns) {
    await prisma.transaction.update({
      where: { id: txn.id },
      data: {
        type: 'BONUS_TYPE_SWITCH',
        remarks: txn.remarks.replace('Admin converted bonus:', 'Admin switched bonus type:'),
      },
    });
  }

  return txns.length;
}

async function restoreZeroWagerCompletedBonuses(user: UserSnapshot, apply: boolean) {
  const completedBonuses = (await prisma.userBonus.findMany({
    where: {
      userId: user.id,
      status: 'COMPLETED',
      wageringRequired: { lte: 0 },
    },
    orderBy: { completedAt: 'asc' },
  })) as BonusLike[];

  let restored = 0;
  const notes: string[] = [];

  for (const bonus of completedBonuses) {
    if (!isSuspiciousZeroWagerCompletion(bonus)) continue;

    const bucket = bucketFromBonus(bonus);
    const mainWalletField = getMainWalletField(bucket);
    const bonusWalletField = getBonusWalletField(bucket);
    const currentMainBalance =
      mainWalletField === 'cryptoBalance' ? user.cryptoBalance : user.balance;

    if (currentMainBalance + EPSILON < bonus.bonusAmount) {
      notes.push(
        `skip_restore_bonus_${bonus.id}: insufficient ${mainWalletField} (${currentMainBalance} < ${bonus.bonusAmount})`,
      );
      continue;
    }

    const matchingTxn = await prisma.transaction.findFirst({
      where: {
        userId: user.id,
        type: 'BONUS_CONVERT',
        amount: bonus.bonusAmount,
        createdAt: {
          gte: new Date((bonus.completedAt || bonus.createdAt).getTime() - 10 * 60 * 1000),
          lte: new Date((bonus.completedAt || bonus.createdAt).getTime() + 10 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    restored++;

    if (!apply) {
      notes.push(`would_restore_bonus_${bonus.id}`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          [mainWalletField]: { decrement: bonus.bonusAmount },
          [bonusWalletField]: { increment: bonus.bonusAmount },
        },
      });

      await tx.userBonus.update({
        where: { id: bonus.id },
        data: {
          status: 'ACTIVE',
          wageringDone: 0,
          completedAt: null,
          isEnabled: true,
        },
      });

      if (matchingTxn) {
        await tx.transaction.delete({ where: { id: matchingTxn.id } });
      }
    });

    if (mainWalletField === 'cryptoBalance') {
      user.cryptoBalance = round2(user.cryptoBalance - bonus.bonusAmount);
      user.cryptoBonus = round2(user.cryptoBonus + bonus.bonusAmount);
    } else {
      user.balance = round2(user.balance - bonus.bonusAmount);
      if (bucket === 'sports') {
        user.sportsBonus = round2(user.sportsBonus + bonus.bonusAmount);
      } else {
        user.casinoBonus = round2(user.casinoBonus + bonus.bonusAmount);
      }
    }
  }

  return { restored, notes };
}

async function main() {
  const { apply, noLog, userId, limit } = parseArgs();

  console.log(`[BonusBackfill] Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  if (noLog) console.log('[BonusBackfill] Synthetic transaction logs: DISABLED');
  if (userId) console.log(`[BonusBackfill] Scoped to userId=${userId}`);
  if (limit) console.log(`[BonusBackfill] Limit=${limit}`);

  const users = await prisma.user.findMany({
    where: userId
      ? { id: userId }
      : {
          OR: [
            { fiatBonus: { gt: 0 } },
            { casinoBonus: { gt: 0 } },
            { sportsBonus: { gt: 0 } },
            { cryptoBonus: { gt: 0 } },
            { wageringRequired: { gt: 0 } },
            { casinoBonusWageringRequired: { gt: 0 } },
            { sportsBonusWageringRequired: { gt: 0 } },
            { userBonuses: { some: {} } },
            { transactions: { some: { type: 'BONUS_CONVERT' } } },
          ],
        },
    select: {
      id: true,
      username: true,
      balance: true,
      cryptoBalance: true,
      fiatBonus: true,
      casinoBonus: true,
      sportsBonus: true,
      cryptoBonus: true,
      wageringRequired: true,
      wageringDone: true,
      casinoBonusWageringRequired: true,
      casinoBonusWageringDone: true,
      sportsBonusWageringRequired: true,
      sportsBonusWageringDone: true,
    },
    take: limit,
    orderBy: { id: 'asc' },
  });

  console.log(`[BonusBackfill] Candidate users: ${users.length}`);

  let checked = 0;
  let changed = 0;
  let syntheticRows = 0;
  let restoredZeroWagerBonuses = 0;
  let relabeledSwitchTxns = 0;

  for (const rawUser of users) {
    const user: UserSnapshot = {
      ...rawUser,
      balance: round2(rawUser.balance || 0),
      cryptoBalance: round2(rawUser.cryptoBalance || 0),
      fiatBonus: round2(rawUser.fiatBonus || 0),
      casinoBonus: round2(rawUser.casinoBonus || 0),
      sportsBonus: round2(rawUser.sportsBonus || 0),
      cryptoBonus: round2(rawUser.cryptoBonus || 0),
      wageringRequired: round2(rawUser.wageringRequired || 0),
      wageringDone: round2(rawUser.wageringDone || 0),
      casinoBonusWageringRequired: round2(rawUser.casinoBonusWageringRequired || 0),
      casinoBonusWageringDone: round2(rawUser.casinoBonusWageringDone || 0),
      sportsBonusWageringRequired: round2(rawUser.sportsBonusWageringRequired || 0),
      sportsBonusWageringDone: round2(rawUser.sportsBonusWageringDone || 0),
    };

    checked++;

    const relabeledForUser = await repairAdminSwitchTransactions(user.id, apply);
    relabeledSwitchTxns += relabeledForUser;

    const restoreResult = await restoreZeroWagerCompletedBonuses(user, apply);
    restoredZeroWagerBonuses += restoreResult.restored;

    const activeBonuses = (await prisma.userBonus.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { id: 'asc' },
    })) as BonusLike[];

    const existing = summarizeActiveBonuses(activeBonuses);

    const normalizedCasinoWallet = round2((user.casinoBonus || 0) + (user.fiatBonus || 0));
    const actualSportsWallet = round2(user.sportsBonus || 0);
    const actualCryptoWallet = round2(user.cryptoBonus || 0);

    const missingCasinoWallet = positiveDelta(normalizedCasinoWallet, existing.casinoWallet);
    const missingSportsWallet = positiveDelta(actualSportsWallet, existing.sportsWallet);
    const missingCryptoWallet = positiveDelta(actualCryptoWallet, existing.cryptoWallet);

    const missingCasinoReq = positiveDelta(user.casinoBonusWageringRequired || 0, existing.casinoReq);
    const missingCasinoDone = round2(
      Math.min(
        positiveDelta(user.casinoBonusWageringDone || 0, existing.casinoDone),
        missingCasinoReq,
      ),
    );
    const missingSportsReq = positiveDelta(user.sportsBonusWageringRequired || 0, existing.sportsReq);
    const missingSportsDone = round2(
      Math.min(
        positiveDelta(user.sportsBonusWageringDone || 0, existing.sportsDone),
        missingSportsReq,
      ),
    );

    const remainingGlobalReqAfterFiat = round2(
      Math.max(
        0,
        (user.wageringRequired || 0) - existing.globalReq - missingCasinoReq - missingSportsReq,
      ),
    );
    const remainingGlobalDoneAfterFiat = round2(
      Math.min(
        Math.max(
          0,
          (user.wageringDone || 0) - existing.globalDone - missingCasinoDone - missingSportsDone,
        ),
        remainingGlobalReqAfterFiat,
      ),
    );

    const willNormalizeLegacyFiat = (user.fiatBonus || 0) > EPSILON;
    const needsSynthetic =
      missingCasinoWallet > EPSILON || missingSportsWallet > EPSILON || missingCryptoWallet > EPSILON;
    const needsCounterSync =
      Math.abs(user.casinoBonusWageringRequired - existing.casinoReq) > EPSILON ||
      Math.abs(user.casinoBonusWageringDone - existing.casinoDone) > EPSILON ||
      Math.abs(user.sportsBonusWageringRequired - existing.sportsReq) > EPSILON ||
      Math.abs(user.sportsBonusWageringDone - existing.sportsDone) > EPSILON ||
      Math.abs(user.wageringRequired - existing.globalReq) > EPSILON ||
      Math.abs(user.wageringDone - existing.globalDone) > EPSILON;

    if (
      !willNormalizeLegacyFiat &&
      !needsSynthetic &&
      !needsCounterSync &&
      relabeledForUser === 0 &&
      restoreResult.restored === 0
    ) {
      continue;
    }

    changed++;

    console.log(
      [
        `[BonusBackfill] user=${user.id}`,
        user.username ? `(${user.username})` : '',
        willNormalizeLegacyFiat ? `fiatBonus->casinoBonus=${round2(user.fiatBonus || 0)}` : '',
        missingCasinoWallet > EPSILON ? `missingCasino=${missingCasinoWallet}` : '',
        missingSportsWallet > EPSILON ? `missingSports=${missingSportsWallet}` : '',
        missingCryptoWallet > EPSILON ? `missingCrypto=${missingCryptoWallet}` : '',
        relabeledForUser > 0 ? `switchTxns=${relabeledForUser}` : '',
        restoreResult.restored > 0 ? `restoredZeroWager=${restoreResult.restored}` : '',
        restoreResult.notes.length > 0 ? restoreResult.notes.join(',') : '',
      ]
        .filter(Boolean)
        .join(' '),
    );

    if (apply && needsSynthetic) {
      await prisma.$transaction(async (tx) => {
        if (willNormalizeLegacyFiat) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              casinoBonus: { increment: round2(user.fiatBonus || 0) },
              fiatBonus: 0,
            },
          });
        }

        if (missingCasinoWallet > EPSILON) {
          syntheticRows++;
          await createSyntheticBonus({
            tx,
            userId: user.id,
            bucket: 'casino',
            bonusAmount: missingCasinoWallet,
            wageringRequired: missingCasinoReq,
            wageringDone: missingCasinoDone,
            note: 'Backfilled missing casino bonus record from legacy wallet balance',
            noLog,
          });
        }

        if (missingSportsWallet > EPSILON) {
          syntheticRows++;
          await createSyntheticBonus({
            tx,
            userId: user.id,
            bucket: 'sports',
            bonusAmount: missingSportsWallet,
            wageringRequired: missingSportsReq,
            wageringDone: missingSportsDone,
            note: 'Backfilled missing sports bonus record from legacy wallet balance',
            noLog,
          });
        }

        if (missingCryptoWallet > EPSILON) {
          syntheticRows++;
          await createSyntheticBonus({
            tx,
            userId: user.id,
            bucket: 'crypto',
            bonusAmount: missingCryptoWallet,
            wageringRequired: remainingGlobalReqAfterFiat,
            wageringDone: remainingGlobalDoneAfterFiat,
            note: 'Backfilled missing crypto bonus record from legacy wallet balance',
            noLog,
          });
        }
      });
    } else if (!apply) {
      if (missingCasinoWallet > EPSILON) syntheticRows++;
      if (missingSportsWallet > EPSILON) syntheticRows++;
      if (missingCryptoWallet > EPSILON) syntheticRows++;
    }

    const refreshedActiveBonuses = (await prisma.userBonus.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
    })) as BonusLike[];

    const synced = summarizeActiveBonuses(refreshedActiveBonuses);

    if (apply) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          fiatBonus: 0,
          casinoBonus: synced.casinoWallet,
          sportsBonus: synced.sportsWallet,
          cryptoBonus: synced.cryptoWallet,
          wageringRequired: synced.globalReq,
          wageringDone: synced.globalDone,
          casinoBonusWageringRequired: synced.casinoReq,
          casinoBonusWageringDone: synced.casinoDone,
          sportsBonusWageringRequired: synced.sportsReq,
          sportsBonusWageringDone: synced.sportsDone,
        },
      });
    }
  }

  console.log(
    `[BonusBackfill] Complete. checked=${checked}, changed=${changed}, syntheticRows=${syntheticRows}, restoredZeroWagerBonuses=${restoredZeroWagerBonuses}, relabeledSwitchTxns=${relabeledSwitchTxns}, mode=${apply ? 'APPLY' : 'DRY-RUN'}`,
  );
}

main()
  .catch((error) => {
    console.error('[BonusBackfill] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
