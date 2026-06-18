import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI is not defined in .env');
  process.exit(1);
}

type BonusCurrency = 'INR' | 'CRYPTO' | 'BOTH';

type BonusDoc = {
  _id: mongoose.Types.ObjectId;
  code?: string;
  currency?: string | null;
  minDeposit?: number | null;
  minDepositFiat?: number | null;
  minDepositCrypto?: number | null;
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
    code: getValue('--code')?.trim().toUpperCase(),
    limit: getValue('--limit') ? Number(getValue('--limit')) : undefined,
  };
}

function toNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeCurrency(value?: string | null): BonusCurrency {
  return value === 'CRYPTO' || value === 'BOTH' ? value : 'INR';
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getNormalizedMinimums(doc: BonusDoc) {
  const currency = normalizeCurrency(doc.currency);
  const legacyMinDeposit = toNumber(doc.minDeposit);
  const minDepositFiat = hasFiniteNumber(doc.minDepositFiat)
    ? toNumber(doc.minDepositFiat)
    : (currency === 'CRYPTO' ? 0 : legacyMinDeposit);
  const minDepositCrypto = hasFiniteNumber(doc.minDepositCrypto)
    ? toNumber(doc.minDepositCrypto)
    : (currency === 'INR' ? 0 : legacyMinDeposit);

  return {
    currency,
    minDeposit: currency === 'CRYPTO' ? minDepositCrypto : minDepositFiat,
    minDepositFiat,
    minDepositCrypto,
  };
}

async function main() {
  const { apply, code, limit } = parseArgs();

  console.log(`Connecting to MongoDB (${apply ? 'apply' : 'dry-run'} mode)...`);
  await mongoose.connect(MONGO_URI);

  try {
    const bonusesCollection = mongoose.connection.collection<BonusDoc>('bonuses');
    const query: Record<string, unknown> = {};
    if (code) query.code = code;

    const bonuses = await bonusesCollection.find(query).limit(limit ?? 0).toArray();

    if (bonuses.length === 0) {
      console.log('No bonus documents found for the given filters.');
      return;
    }

    let changedCount = 0;

    for (const bonus of bonuses) {
      const next = getNormalizedMinimums(bonus);
      const currentCurrency = normalizeCurrency(bonus.currency);
      const currentMinDeposit = toNumber(bonus.minDeposit);
      const currentMinDepositFiat = hasFiniteNumber(bonus.minDepositFiat) ? toNumber(bonus.minDepositFiat) : null;
      const currentMinDepositCrypto = hasFiniteNumber(bonus.minDepositCrypto) ? toNumber(bonus.minDepositCrypto) : null;

      const needsUpdate =
        currentCurrency !== next.currency ||
        currentMinDeposit !== next.minDeposit ||
        currentMinDepositFiat !== next.minDepositFiat ||
        currentMinDepositCrypto !== next.minDepositCrypto;

      if (!needsUpdate) continue;

      changedCount += 1;
      console.log(
        [
          `code=${bonus.code || bonus._id.toString()}`,
          `currency:${String(bonus.currency || 'INR')} -> ${next.currency}`,
          `minDeposit:${currentMinDeposit} -> ${next.minDeposit}`,
          `fiat:${currentMinDepositFiat ?? 'missing'} -> ${next.minDepositFiat}`,
          `crypto:${currentMinDepositCrypto ?? 'missing'} -> ${next.minDepositCrypto}`,
        ].join(' | '),
      );

      if (apply) {
        await bonusesCollection.updateOne(
          { _id: bonus._id },
          {
            $set: {
              currency: next.currency,
              minDeposit: next.minDeposit,
              minDepositFiat: next.minDepositFiat,
              minDepositCrypto: next.minDepositCrypto,
            },
          },
        );
      }
    }

    console.log(
      apply
        ? `Backfill complete. Updated ${changedCount} bonus document(s).`
        : `Dry run complete. ${changedCount} bonus document(s) would be updated. Re-run with --apply to persist changes.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
