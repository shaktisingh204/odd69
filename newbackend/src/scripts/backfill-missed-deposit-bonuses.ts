import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient() as any;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI is not defined in .env');
  process.exit(1);
}

type DepositCurrency = 'INR' | 'CRYPTO';
type BonusCurrency = 'INR' | 'CRYPTO' | 'BOTH';
type ApplicableTo = 'CASINO' | 'SPORTS' | 'BOTH';

type BonusDoc = {
  _id: mongoose.Types.ObjectId;
  code: string;
  title?: string;
  currency?: BonusCurrency | null;
  applicableTo?: ApplicableTo | null;
  amount?: number | null;
  percentage?: number | null;
  minDeposit?: number | null;
  minDepositFiat?: number | null;
  minDepositCrypto?: number | null;
  maxBonus?: number | null;
  wageringRequirement?: number | null;
  depositWagerMultiplier?: number | null;
  expiryDays?: number | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  usageCount?: number | null;
};

type DepositTxn = {
  id: number;
  userId: number;
  amount: number;
  type: string;
  status: string;
  createdAt: Date;
  paymentDetails: Record<string, unknown> | null;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const hasFlag = (flag: string) => args.includes(flag);
  const getValue = (name: string) => {
    const exact = args.find((arg) => arg.startsWith(`${name}=`));
    return exact ? exact.slice(name.length + 1) : undefined;
  };

  return {
    apply: hasFlag('--apply'),
    transactionId: getValue('--transactionId') ? Number(getValue('--transactionId')) : undefined,
    userId: getValue('--userId') ? Number(getValue('--userId')) : undefined,
    bonusCode: getValue('--bonusCode')?.trim().toUpperCase(),
    limit: getValue('--limit') ? Number(getValue('--limit')) : 100,
  };
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeDepositCurrency(value: unknown): DepositCurrency {
  return value === 'CRYPTO' ? 'CRYPTO' : 'INR';
}

function normalizeBonusCurrency(value: unknown): BonusCurrency {
  return value === 'CRYPTO' || value === 'BOTH' ? value : 'INR';
}

function getMinimumDepositForCurrency(bonus: BonusDoc, depositCurrency: DepositCurrency) {
  const legacyMinimum = round2(Number(bonus.minDeposit || 0));
  const fiatMinimum = bonus.minDepositFiat == null ? null : round2(Number(bonus.minDepositFiat || 0));
  const cryptoMinimum = bonus.minDepositCrypto == null ? null : round2(Number(bonus.minDepositCrypto || 0));
  return depositCurrency === 'CRYPTO' ? (cryptoMinimum ?? legacyMinimum) : (fiatMinimum ?? legacyMinimum);
}

function calculateBonusAmount(bonus: BonusDoc, depositAmount: number) {
  let bonusAmount =
    Number(bonus.percentage || 0) > 0
      ? (depositAmount * Number(bonus.percentage || 0)) / 100
      : Number(bonus.amount || 0);

  const maxBonus = Number(bonus.maxBonus || 0);
  if (maxBonus > 0) {
    bonusAmount = Math.min(bonusAmount, maxBonus);
  }

  return round2(bonusAmount);
}

function getBonusWalletField(applicableTo: ApplicableTo, isCrypto: boolean) {
  if (isCrypto) return 'cryptoBonus';
  return applicableTo === 'SPORTS' ? 'sportsBonus' : 'casinoBonus';
}

function getBonusConflictTypes(applicableTo: ApplicableTo) {
  return applicableTo === 'BOTH' ? ['CASINO', 'SPORTS', 'BOTH'] : [applicableTo, 'BOTH'];
}

function getPaymentDetails(paymentDetails: unknown) {
  if (!paymentDetails || typeof paymentDetails !== 'object' || Array.isArray(paymentDetails)) {
    return {};
  }
  return paymentDetails as Record<string, unknown>;
}

async function main() {
  const { apply, transactionId, userId, bonusCode, limit } = parseArgs();

  console.log(`Connecting (${apply ? 'apply' : 'dry-run'} mode)...`);
  await mongoose.connect(MONGO_URI);

  try {
    const bonusesCollection = mongoose.connection.collection<BonusDoc>('bonuses');

    const where: Record<string, unknown> = {
      type: 'DEPOSIT',
      status: { in: ['APPROVED', 'COMPLETED'] },
    };

    if (typeof transactionId === 'number' && Number.isFinite(transactionId)) {
      where.id = transactionId;
    }
    if (typeof userId === 'number' && Number.isFinite(userId)) {
      where.userId = userId;
    }

    const deposits = (await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        amount: true,
        type: true,
        status: true,
        createdAt: true,
        paymentDetails: true,
      },
    })) as DepositTxn[];

    let inspected = 0;
    let eligible = 0;

    for (const deposit of deposits) {
      const paymentDetails = getPaymentDetails(deposit.paymentDetails);
      const rawCode = typeof paymentDetails.bonusCode === 'string' ? paymentDetails.bonusCode.trim().toUpperCase() : '';
      if (!rawCode) continue;
      if (bonusCode && rawCode !== bonusCode) continue;

      inspected += 1;

      const depositCurrency = normalizeDepositCurrency(paymentDetails.depositCurrency ?? paymentDetails.currency);
      const bonus = await bonusesCollection.findOne({ code: rawCode });

      if (!bonus) {
        console.log(`#${deposit.id} user=${deposit.userId} code=${rawCode} | skip: bonus template not found`);
        continue;
      }

      const approvedDepositCountBeforeThisDeposit = await prisma.transaction.count({
        where: {
          userId: deposit.userId,
          type: 'DEPOSIT',
          status: { in: ['APPROVED', 'COMPLETED'] },
          OR: [
            { createdAt: { lt: deposit.createdAt } },
            {
              AND: [
                { createdAt: deposit.createdAt },
                { id: { lt: deposit.id } },
              ],
            },
          ],
        },
      });

      const effectiveAt = deposit.createdAt;
      if (bonus.validFrom && new Date(bonus.validFrom) > effectiveAt) {
        console.log(`#${deposit.id} user=${deposit.userId} code=${rawCode} | skip: bonus not active yet at deposit time`);
        continue;
      }
      if (bonus.validUntil && new Date(bonus.validUntil) < effectiveAt) {
        console.log(`#${deposit.id} user=${deposit.userId} code=${rawCode} | skip: bonus expired before deposit`);
        continue;
      }

      const bonusCurrency = normalizeBonusCurrency(bonus.currency);
      if (!(bonusCurrency === 'BOTH' || bonusCurrency === depositCurrency)) {
        console.log(`#${deposit.id} user=${deposit.userId} code=${rawCode} | skip: currency mismatch (${depositCurrency})`);
        continue;
      }

      if (bonusCode && rawCode !== bonusCode) continue;

      const isFirstDepositOnly = Boolean((bonus as any).forFirstDepositOnly);
      if (isFirstDepositOnly && approvedDepositCountBeforeThisDeposit > 0) {
        console.log(`#${deposit.id} user=${deposit.userId} code=${rawCode} | skip: not first deposit`);
        continue;
      }

      const minDeposit = getMinimumDepositForCurrency(bonus, depositCurrency);
      if (deposit.amount < minDeposit) {
        console.log(`#${deposit.id} user=${deposit.userId} code=${rawCode} | skip: amount ${deposit.amount} below min ${minDeposit}`);
        continue;
      }

      const existingRedemption = await prisma.userBonus.findFirst({
        where: {
          userId: deposit.userId,
          bonusCode: rawCode,
          status: { not: 'FORFEITED' },
        },
      });
      if (existingRedemption) {
        console.log(`#${deposit.id} user=${deposit.userId} code=${rawCode} | skip: user bonus already exists`);
        continue;
      }

      const applicableTo = (bonus.applicableTo || 'BOTH') as ApplicableTo;
      const activeConflict = await prisma.userBonus.findFirst({
        where: {
          userId: deposit.userId,
          status: 'ACTIVE',
          applicableTo: { in: getBonusConflictTypes(applicableTo) },
        },
      });
      if (activeConflict) {
        console.log(`#${deposit.id} user=${deposit.userId} code=${rawCode} | skip: active conflicting bonus ${activeConflict.bonusCode}`);
        continue;
      }

      const bonusAmount = calculateBonusAmount(bonus, deposit.amount);
      if (bonusAmount <= 0) {
        console.log(`#${deposit.id} user=${deposit.userId} code=${rawCode} | skip: calculated bonus is 0`);
        continue;
      }

      const wageringRequirement = Number(bonus.wageringRequirement || 1);
      const wageringRequired = round2(bonusAmount * wageringRequirement);
      const depositWagerMultiplier = Number(bonus.depositWagerMultiplier ?? 1) || 1;
      const expiryDays = Number(bonus.expiryDays ?? 30) || 30;
      const expiresAt = new Date(deposit.createdAt.getTime() + expiryDays * 24 * 60 * 60 * 1000);
      if (expiresAt <= new Date()) {
        console.log(`#${deposit.id} user=${deposit.userId} code=${rawCode} | skip: bonus window already expired`);
        continue;
      }

      eligible += 1;
      const isCrypto = depositCurrency === 'CRYPTO';
      const walletField = getBonusWalletField(applicableTo, isCrypto);

      console.log(
        [
          `#${deposit.id}`,
          `user=${deposit.userId}`,
          `code=${rawCode}`,
          `deposit=${deposit.amount}`,
          `currency=${depositCurrency}`,
          `bonus=${bonusAmount}`,
          `wallet=${walletField}`,
        ].join(' | '),
      );

      if (!apply) continue;

      await prisma.$transaction(async (tx: any) => {
        const userUpdate: Record<string, unknown> = {
          [walletField]: { increment: bonusAmount },
          wageringRequired: { increment: wageringRequired },
          depositWageringRequired: { increment: round2(deposit.amount * depositWagerMultiplier) },
        };

        if (!isCrypto) {
          if (applicableTo === 'SPORTS') {
            userUpdate.sportsBonusWageringRequired = { increment: wageringRequired };
          } else {
            userUpdate.casinoBonusWageringRequired = { increment: wageringRequired };
          }
        }

        await tx.user.update({
          where: { id: deposit.userId },
          data: userUpdate,
        });

        await tx.userBonus.create({
          data: {
            userId: deposit.userId,
            bonusId: String(bonus._id),
            bonusCode: rawCode,
            bonusTitle: bonus.title || rawCode,
            bonusCurrency: bonusCurrency,
            applicableTo,
            depositAmount: deposit.amount,
            bonusAmount,
            wageringRequired,
            wageringDone: 0,
            status: 'ACTIVE',
            expiresAt,
          },
        });

        await tx.transaction.create({
          data: {
            userId: deposit.userId,
            amount: bonusAmount,
            type: 'BONUS',
            status: 'APPROVED',
            remarks: `Backfill bonus credit for deposit #${deposit.id} (${rawCode})`,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      });

      await bonusesCollection.updateOne(
        { _id: bonus._id },
        { $inc: { usageCount: 1 } },
      );
    }

    console.log(
      apply
        ? `Applied ${eligible} backfill bonus credit(s).`
        : `Dry run complete. ${eligible} deposit(s) are eligible for bonus backfill out of ${inspected} inspected with bonus codes.`,
    );
  } finally {
    await mongoose.disconnect();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Missed deposit bonus backfill failed:', error);
  process.exit(1);
});
