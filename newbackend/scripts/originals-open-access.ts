/**
 * originals-open-access.ts
 *
 * Idempotent one-off: flip the existing ODD69 Originals global access config
 * to "open to everyone". It upserts the `originals_configs` document with
 * gameKey '__global_access__' to { accessMode: 'ALL' }, leaving any existing
 * allowedUserIds untouched.
 *
 * Run with:  npm run originals:open-access
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/adxwins';
const GLOBAL_ACCESS_KEY = '__global_access__';

const OriginalsConfigSchema = new mongoose.Schema(
  {},
  { strict: false, collection: 'originals_configs' },
);

async function run() {
  console.log(`Connecting to ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const OriginalsConfig = mongoose.model(
    'OriginalsConfigOpenAccess',
    OriginalsConfigSchema,
  );

  const res = await OriginalsConfig.updateOne(
    { gameKey: GLOBAL_ACCESS_KEY },
    {
      $set: { accessMode: 'ALL' },
      $setOnInsert: { gameKey: GLOBAL_ACCESS_KEY, allowedUserIds: [] },
    },
    { upsert: true },
  );

  console.log('Upsert result:', {
    matched: res.matchedCount,
    modified: res.modifiedCount,
    upsertedId: (res as any).upsertedId ?? null,
  });

  const doc = await OriginalsConfig.findOne({
    gameKey: GLOBAL_ACCESS_KEY,
  }).lean();
  console.log('Global access config is now:', {
    gameKey: (doc as any)?.gameKey,
    accessMode: (doc as any)?.accessMode,
    allowedUserIds: (doc as any)?.allowedUserIds,
  });

  await mongoose.disconnect();
  console.log('Done. ODD69 Originals are open to everyone.');
}

run().catch(async (err) => {
  console.error('Failed to open Originals access:', err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
