import { BonusStatus, PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const EPSILON = 0.0001;

type BonusBucket = 'casino' | 'sports' | 'crypto';

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
  bonusId: string;
  bonusCode: string;
  bonusCurrency: string;
  applicableTo: string;
  bonusAmount: number;
  wageringRequired: number;
  wageringDone: number;
  status: BonusStatus;
  isEnabled: boolean;
  createdAt: Date;
};

type Summary = {
  casinoWallet: number;
  sportsWallet: number;
  cryptoWallet: number;
  casinoReq: number;
  casinoDone: number;
  sportsReq: number;
  sportsDone: number;
  globalReq: number;
  globalDone: number;
};

type BurnPlan = {
  bonusId: number;
  bucket: BonusBucket;
  burnAmount: number;
  nextBonusAmount: number;
  nextWageringRequired: number;
  nextWageringDone: number;
  nextStatus: BonusStatus;
  nextIsEnabled: boolean;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    userId: getValue('--userId') ? Number(getValue('--userId')) : undefined,
    limit: getValue('--limit') ? Number(getValue('--limit')) : undefined,
  };
}

function bucketFromBonus(bonus: Pick<BonusRow, 'bonusCurrency' | 'applicableTo'>): BonusBucket {
  if (bonus.bonusCurrency === 'CRYPTO') return 'crypto';
  return bonus.applicableTo === 'SPORTS' ? 'sports' : 'casino';
}

function summarizeActiveBonuses(activeBonuses: BonusRow[]) {
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
    if (bonus.status !== 'ACTIVE') continue;

    const bucket = bucketFromBonus(bonus);
    const amount = round2(Math.max(0, bonus.bonusAmount || 0));
    const req = round2(Math.max(0, bonus.wageringRequired || 0));
    const done = round2(Math.min(Math.max(0, bonus.wageringDone || 0), req));

    if (bucket === 'casino') {
      casinoWallet = round2(casinoWallet + amount);
      casinoReq = round2(casinoReq + req);
      casinoDone = round2(casinoDone + done);
    } else if (bucket === 'sports') {
      sportsWallet = round2(sportsWallet + amount);
      sportsReq = round2(sportsReq + req);
      sportsDone = round2(sportsDone + done);
    } else {
      cryptoWallet = round2(cryptoWallet + amount);
    }

    globalReq = round2(globalReq + req);
    globalDone = round2(globalDone + done);
  }

  return {
    casinoWallet,
    sportsWallet,
    cryptoWallet,
    casinoReq,
    casinoDone,
    sportsReq,
    sportsDone,
    globalReq,
    globalDone,
  } satisfies Summary;
}

function isSyntheticBonus(bonus: Pick<BonusRow, 'bonusCode' | 'bonusId'>) {
  const bonusCode = String(bonus.bonusCode || '').toUpperCase();
  const bonusId = String(bonus.bonusId || '').toLowerCase();

  return (
    bonusCode.startsWith('RECOVERY_') ||
    bonusCode.startsWith('BACKFILL_') ||
    bonusCode.startsWith('REPAIR_') ||
    bonusId.startsWith('backfill_') ||
    bonusId.startsWith('repair_') ||
    bonusId.startsWith('repair-') ||
    bonusId.includes('repair-bonus-convert-recovery')
  );
}

function getSyntheticPriority(bonus: Pick<BonusRow, 'bonusCode' | 'bonusId' | 'createdAt'>) {
  const bonusCode = String(bonus.bonusCode || '').toUpperCase();
  const bonusId = String(bonus.bonusId || '').toLowerCase();

  if (bonusCode.startsWith('RECOVERY_') || bonusId.includes('repair-bonus-convert-recovery')) {
    return 0;
  }
  if (bonusCode.startsWith('BACKFILL_') || bonusId.startsWith('backfill_')) {
    return 1;
  }
  if (bonusCode.startsWith('REPAIR_') || bonusId.startsWith('repair_') || bonusId.startsWith('repair-')) {
    return 2;
  }
  return 3;
}

function compareSyntheticBonus(left: BonusRow, right: BonusRow) {
  const priorityDelta = getSyntheticPriority(left) - getSyntheticPriority(right);
  if (priorityDelta !== 0) return priorityDelta;
  return right.createdAt.getTime() - left.createdAt.getTime();
}

function buildBurnPlan(bonus: BonusRow, burnAmountRaw: number): BurnPlan | null {
  const currentAmount = round2(Math.max(0, bonus.bonusAmount || 0));
  const burnAmount = round2(Math.min(currentAmount, Math.max(0, burnAmountRaw)));
  if (burnAmount <= EPSILON) return null;

  const currentReq = round2(Math.max(0, bonus.wageringRequired || 0));
  const currentDone = round2(Math.min(Math.max(0, bonus.wageringDone || 0), currentReq));
  const nextBonusAmount = round2(Math.max(0, currentAmount - burnAmount));

  let reqReduction = 0;
  if (currentAmount > EPSILON && currentReq > EPSILON) {
    reqReduction = round2((currentReq * burnAmount) / currentAmount);
  }

  let nextWageringRequired = round2(Math.max(0, currentReq - reqReduction));
  if (nextBonusAmount <= EPSILON) {
    nextWageringRequired = 0;
  }

  const nextWageringDone = round2(Math.min(currentDone, nextWageringRequired));
  const nextStatus = nextBonusAmount <= EPSILON ? 'FORFEITED' : bonus.status;
  const nextIsEnabled = nextBonusAmount > EPSILON && bonus.isEnabled;

  return {
    bonusId: bonus.id,
    bucket: bucketFromBonus(bonus),
    burnAmount,
    nextBonusAmount,
    nextWageringRequired,
    nextWageringDone,
    nextStatus,
    nextIsEnabled,
  };
}

function applyBurnPlansInMemory(activeBonuses: BonusRow[], burnPlans: BurnPlan[]) {
  const planByBonusId = new Map(burnPlans.map((plan) => [plan.bonusId, plan]));

  return activeBonuses.map((bonus) => {
    const plan = planByBonusId.get(bonus.id);
    if (!plan) return bonus;

    return {
      ...bonus,
      bonusAmount: plan.nextBonusAmount,
      wageringRequired: plan.nextWageringRequired,
      wageringDone: plan.nextWageringDone,
      status: plan.nextStatus,
      isEnabled: plan.nextIsEnabled,
    };
  });
}

async function main() {
  const { apply, userId, limit } = parseArgs();

  console.log(`[WalletStabilize] Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('[WalletStabilize] Synthetic transaction logs: DISABLED');
  if (userId) console.log(`[WalletStabilize] Scoped to userId=${userId}`);
  if (limit) console.log(`[WalletStabilize] Limit=${limit}`);

  const users = await prisma.user.findMany({
    where: {
      ...(userId ? { id: userId } : {}),
      OR: [{ balance: { lt: 0 } }, { cryptoBalance: { lt: 0 } }],
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
    },
    orderBy: { id: 'asc' },
    take: limit ?? undefined,
  });

  console.log(`[WalletStabilize] Candidate users: ${users.length}`);

  let checked = 0;
  let changed = 0;
  let unresolved = 0;

  for (const rawUser of users) {
    checked += 1;

    const user: UserRow = {
      id: rawUser.id,
      username: rawUser.username,
      balance: round2(Number(rawUser.balance || 0)),
      cryptoBalance: round2(Number(rawUser.cryptoBalance || 0)),
      fiatBonus: round2(Number(rawUser.fiatBonus || 0)),
      casinoBonus: round2(Number(rawUser.casinoBonus || 0)),
      sportsBonus: round2(Number(rawUser.sportsBonus || 0)),
      cryptoBonus: round2(Number(rawUser.cryptoBonus || 0)),
    };

    const activeBonusesRaw = await prisma.userBonus.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        bonusId: true,
        bonusCode: true,
        bonusCurrency: true,
        applicableTo: true,
        bonusAmount: true,
        wageringRequired: true,
        wageringDone: true,
        status: true,
        isEnabled: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const activeBonuses: BonusRow[] = activeBonusesRaw.map((bonus) => ({
      ...bonus,
      bonusAmount: round2(Number(bonus.bonusAmount || 0)),
      wageringRequired: round2(Number(bonus.wageringRequired || 0)),
      wageringDone: round2(Number(bonus.wageringDone || 0)),
    }));

    const activeSummary = summarizeActiveBonuses(activeBonuses);
    const rawCasinoWallet = round2(user.casinoBonus + user.fiatBonus);
    const rawSportsWallet = round2(user.sportsBonus);
    const rawCryptoWallet = round2(user.cryptoBonus);

    let remainingFiatDeficit = round2(Math.max(0, -user.balance));
    let remainingCryptoDeficit = round2(Math.max(0, -user.cryptoBalance));

    const burnPlans: BurnPlan[] = [];
    const syntheticBonuses = activeBonuses
      .filter((bonus) => isSyntheticBonus(bonus))
      .sort(compareSyntheticBonus);

    for (const bonus of syntheticBonuses) {
      const bucket = bucketFromBonus(bonus);
      const remainingDeficit = bucket === 'crypto' ? remainingCryptoDeficit : remainingFiatDeficit;
      if (remainingDeficit <= EPSILON) continue;

      const burnPlan = buildBurnPlan(bonus, remainingDeficit);
      if (!burnPlan) continue;

      burnPlans.push(burnPlan);
      if (bucket === 'crypto') {
        remainingCryptoDeficit = round2(Math.max(0, remainingCryptoDeficit - burnPlan.burnAmount));
      } else {
        remainingFiatDeficit = round2(Math.max(0, remainingFiatDeficit - burnPlan.burnAmount));
      }
    }

    const nextBonuses = applyBurnPlansInMemory(activeBonuses, burnPlans);
    const nextSummary = summarizeActiveBonuses(nextBonuses);

    const trackedCasinoDrop = round2(Math.max(0, activeSummary.casinoWallet - nextSummary.casinoWallet));
    const trackedSportsDrop = round2(Math.max(0, activeSummary.sportsWallet - nextSummary.sportsWallet));
    const trackedCryptoDrop = round2(Math.max(0, activeSummary.cryptoWallet - nextSummary.cryptoWallet));
    const trackedFiatRecovered = round2(trackedCasinoDrop + trackedSportsDrop);

    const casinoExcess = round2(Math.max(0, rawCasinoWallet - activeSummary.casinoWallet));
    const sportsExcess = round2(Math.max(0, rawSportsWallet - activeSummary.sportsWallet));
    const cryptoExcess = round2(Math.max(0, rawCryptoWallet - activeSummary.cryptoWallet));

    let extraFiatRecovered = 0;
    let extraCryptoRecovered = 0;

    const remainingFiatAfterTracked = round2(Math.max(0, remainingFiatDeficit));
    if (remainingFiatAfterTracked > EPSILON) {
      const recoverFromSportsExtra = round2(Math.min(remainingFiatAfterTracked, sportsExcess));
      const remainingAfterSports = round2(Math.max(0, remainingFiatAfterTracked - recoverFromSportsExtra));
      const recoverFromCasinoExtra = round2(Math.min(remainingAfterSports, casinoExcess));
      extraFiatRecovered = round2(recoverFromSportsExtra + recoverFromCasinoExtra);
      remainingFiatDeficit = round2(Math.max(0, remainingAfterSports - recoverFromCasinoExtra));
    } else {
      remainingFiatDeficit = 0;
    }

    const remainingCryptoAfterTracked = round2(Math.max(0, remainingCryptoDeficit));
    if (remainingCryptoAfterTracked > EPSILON) {
      extraCryptoRecovered = round2(Math.min(remainingCryptoAfterTracked, cryptoExcess));
      remainingCryptoDeficit = round2(Math.max(0, remainingCryptoAfterTracked - extraCryptoRecovered));
    } else {
      remainingCryptoDeficit = 0;
    }

    const fiatRecovered = round2(trackedFiatRecovered + extraFiatRecovered);
    const cryptoRecovered = round2(trackedCryptoDrop + extraCryptoRecovered);

    if (fiatRecovered <= EPSILON && cryptoRecovered <= EPSILON && burnPlans.length === 0) {
      continue;
    }

    changed += 1;

    console.log(
      [
        `[WalletStabilize] user=${user.id}`,
        user.username ? `(${user.username})` : '',
        fiatRecovered > EPSILON ? `fiatRecovered=${fiatRecovered}` : '',
        cryptoRecovered > EPSILON ? `cryptoRecovered=${cryptoRecovered}` : '',
        burnPlans.length > 0 ? `syntheticRows=${burnPlans.length}` : '',
        remainingFiatDeficit > EPSILON ? `unresolvedFiat=${remainingFiatDeficit}` : '',
        remainingCryptoDeficit > EPSILON ? `unresolvedCrypto=${remainingCryptoDeficit}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );

    if (remainingFiatDeficit > EPSILON || remainingCryptoDeficit > EPSILON) {
      unresolved += 1;
    }

    if (!apply) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      for (const plan of burnPlans) {
        await tx.userBonus.update({
          where: { id: plan.bonusId },
          data: {
            bonusAmount: plan.nextBonusAmount,
            wageringRequired: plan.nextWageringRequired,
            wageringDone: plan.nextWageringDone,
            status: plan.nextStatus,
            isEnabled: plan.nextIsEnabled,
            ...(plan.nextStatus === 'FORFEITED' ? { completedAt: now } : {}),
          },
        });
      }

      const finalBalance = round2(user.balance + fiatRecovered);
      const finalCryptoBalance = round2(user.cryptoBalance + cryptoRecovered);

      await tx.user.update({
        where: { id: user.id },
        data: {
          balance: finalBalance,
          cryptoBalance: finalCryptoBalance,
          fiatBonus: 0,
          casinoBonus: nextSummary.casinoWallet,
          sportsBonus: nextSummary.sportsWallet,
          cryptoBonus: nextSummary.cryptoWallet,
          wageringRequired: nextSummary.globalReq,
          wageringDone: nextSummary.globalDone,
          casinoBonusWageringRequired: nextSummary.casinoReq,
          casinoBonusWageringDone: nextSummary.casinoDone,
          sportsBonusWageringRequired: nextSummary.sportsReq,
          sportsBonusWageringDone: nextSummary.sportsDone,
        },
      });
    });
  }

  console.log(
    `[WalletStabilize] Complete. checked=${checked}, changed=${changed}, unresolved=${unresolved}, mode=${apply ? 'APPLY' : 'DRY-RUN'}`,
  );
}

main()
  .catch((error) => {
    console.error('[WalletStabilize] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
