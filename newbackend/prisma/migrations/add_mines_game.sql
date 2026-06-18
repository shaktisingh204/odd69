-- ============================================================
-- ZEERO ORIGINALS — COMPLETE PRODUCTION MIGRATION SQL v3
-- Run on your PostgreSQL database (psql or your DB GUI)
-- ============================================================

-- ─────────────────────────────────────────
-- STEP 1: ENUMS
-- ─────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "MinesGameStatus" AS ENUM ('ACTIVE', 'CASHEDOUT', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EngagementMode" AS ENUM ('OFF', 'SOFT', 'AGGRESSIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OriginalsEngagementEventType" AS ENUM (
    'NEAR_MISS', 'WIN_STREAK', 'LOSS_STREAK', 'BIG_WIN', 'COMEBACK'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────
-- STEP 2: MINES GAME TABLE
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "MinesGame" (
  "id"              SERIAL PRIMARY KEY,
  "userId"          INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "betAmount"       DOUBLE PRECISION NOT NULL,
  "mineCount"       INTEGER NOT NULL CHECK ("mineCount" BETWEEN 1 AND 24),
  "status"          "MinesGameStatus" NOT NULL DEFAULT 'ACTIVE',

  -- Provably fair
  "serverSeed"      TEXT NOT NULL,
  "serverSeedHash"  TEXT NOT NULL,
  "clientSeed"      TEXT NOT NULL DEFAULT 'zeero',
  "nonce"           INTEGER NOT NULL DEFAULT 0,

  -- Game state  (persisted for reconnection)
  "minePositions"   INTEGER[] NOT NULL DEFAULT '{}',
  "revealedTiles"   INTEGER[] NOT NULL DEFAULT '{}',

  -- Outcome
  "multiplier"      DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "payout"          DOUBLE PRECISION NOT NULL DEFAULT 0,

  -- Wallet
  "walletType"      TEXT NOT NULL DEFAULT 'fiat',
  "usedBonus"       BOOLEAN NOT NULL DEFAULT FALSE,
  "bonusAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency"        TEXT NOT NULL DEFAULT 'INR',

  -- GGR audit (INTERNAL — never sent to client)
  "biasWeight"      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "engagementFlags" JSONB,

  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MinesGame_userId_idx"    ON "MinesGame"("userId");
CREATE INDEX IF NOT EXISTS "MinesGame_status_idx"    ON "MinesGame"("status");
CREATE INDEX IF NOT EXISTS "MinesGame_createdAt_idx" ON "MinesGame"("createdAt");

-- auto-update updatedAt
CREATE OR REPLACE FUNCTION _zeero_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER "MinesGame_updatedAt"
    BEFORE UPDATE ON "MinesGame"
    FOR EACH ROW EXECUTE PROCEDURE _zeero_update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────
-- STEP 3: ORIGINALS PER-GAME ADMIN CONFIG
-- ─────────────────────────────────────────
-- Admin sets targetGgrPercent (house revenue %).
-- e.g. 70 = house keeps 70% of all wagered, players get back 30% on avg.

CREATE TABLE IF NOT EXISTS "OriginalsConfig" (
  "id"                   SERIAL PRIMARY KEY,
  "gameKey"              TEXT NOT NULL UNIQUE,         -- 'mines' | 'crash' | 'dice' | 'plinko'
  "isActive"             BOOLEAN NOT NULL DEFAULT TRUE,
  "maintenanceMode"      BOOLEAN NOT NULL DEFAULT FALSE,
  "maintenanceMessage"   TEXT,

  -- Bet limits
  "minBet"               DOUBLE PRECISION NOT NULL DEFAULT 10.0,
  "maxBet"               DOUBLE PRECISION NOT NULL DEFAULT 100000.0,
  "maxWin"               DOUBLE PRECISION NOT NULL DEFAULT 1000000.0,

  -- House edge
  "houseEdgePercent"     DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "maxMultiplier"        DOUBLE PRECISION NOT NULL DEFAULT 500.0,

  -- GGR control (MAIN REVENUE LEVER)
  -- targetGgrPercent = % of all wagered the house keeps over rolling window
  "targetGgrPercent"     DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  "ggrWindowHours"       INTEGER NOT NULL DEFAULT 24,
  "ggrBiasStrength"      DOUBLE PRECISION NOT NULL DEFAULT 0.20,

  -- Per-user GGR overrides: JSON map of { "userId": targetGgr% }
  -- E.g. { "42": 20.0 } gives user #42 only 20% GGR (better odds)
  "perUserGgrOverrides"  JSONB,

  -- Engagement system
  "engagementMode"       "EngagementMode" NOT NULL DEFAULT 'SOFT',
  "nearMissEnabled"      BOOLEAN NOT NULL DEFAULT TRUE,
  "bigWinThreshold"      DOUBLE PRECISION NOT NULL DEFAULT 10.0,
  "streakWindow"         INTEGER NOT NULL DEFAULT 5,

  -- Display (what users see - informational only)
  "displayRtpPercent"    DOUBLE PRECISION NOT NULL DEFAULT 95.0,

  -- Audit
  "updatedBy"            INTEGER,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  CREATE TRIGGER "OriginalsConfig_updatedAt"
    BEFORE UPDATE ON "OriginalsConfig"
    FOR EACH ROW EXECUTE PROCEDURE _zeero_update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Default game configs
INSERT INTO "OriginalsConfig"
  ("gameKey","isActive","minBet","maxBet","targetGgrPercent","engagementMode","displayRtpPercent","houseEdgePercent")
VALUES
  ('mines',  TRUE,  10.0,  100000.0, 5.0,  'SOFT',       95.0, 1.0),
  ('crash',  FALSE, 10.0,   50000.0, 4.0,  'SOFT',       96.0, 1.0),
  ('dice',   FALSE, 10.0,   50000.0, 3.0,  'SOFT',       97.0, 1.0),
  ('plinko', FALSE, 10.0,   50000.0, 3.5,  'SOFT',       96.5, 1.0)
ON CONFLICT ("gameKey") DO NOTHING;

-- ─────────────────────────────────────────
-- STEP 4: GGR SNAPSHOTS (rolling tracker)
-- ─────────────────────────────────────────
-- Written after each game completion.
-- GGR engine reads the latest snapshot to compute bias.

CREATE TABLE IF NOT EXISTS "OriginalsGGRSnapshot" (
  "id"            SERIAL PRIMARY KEY,
  "gameKey"       TEXT NOT NULL,
  "windowStart"   TIMESTAMP(3) NOT NULL,
  "windowEnd"     TIMESTAMP(3) NOT NULL,
  "totalWagered"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalPaidOut"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalGames"    INTEGER NOT NULL DEFAULT 0,
  "totalWins"     INTEGER NOT NULL DEFAULT 0,
  "totalLosses"   INTEGER NOT NULL DEFAULT 0,
  "ggrPercent"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "snapshotAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "GGRSnapshot_gameKey_window_idx"
  ON "OriginalsGGRSnapshot"("gameKey", "windowStart");
CREATE INDEX IF NOT EXISTS "GGRSnapshot_snapshotAt_idx"
  ON "OriginalsGGRSnapshot"("snapshotAt");

-- ─────────────────────────────────────────
-- STEP 5: LIVE SESSION TRACKING
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "OriginalsSession" (
  "id"            SERIAL PRIMARY KEY,
  "gameKey"       TEXT NOT NULL,
  "userId"        INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "socketId"      TEXT NOT NULL,
  "gameId"        INTEGER,
  "connectedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive"      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS "OriginalsSession_gameKey_idx"  ON "OriginalsSession"("gameKey");
CREATE INDEX IF NOT EXISTS "OriginalsSession_userId_idx"   ON "OriginalsSession"("userId");
CREATE INDEX IF NOT EXISTS "OriginalsSession_isActive_idx" ON "OriginalsSession"("isActive");

-- ─────────────────────────────────────────
-- STEP 6: ENGAGEMENT EVENTS (analytics)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "OriginalsEngagementEvent" (
  "id"          SERIAL PRIMARY KEY,
  "gameKey"     TEXT NOT NULL,
  "userId"      INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "gameId"      INTEGER NOT NULL,
  "eventType"   "OriginalsEngagementEventType" NOT NULL,
  "metadata"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "EngagementEvent_userId_idx"  ON "OriginalsEngagementEvent"("userId");
CREATE INDEX IF NOT EXISTS "EngagementEvent_gameKey_idx" ON "OriginalsEngagementEvent"("gameKey");
CREATE INDEX IF NOT EXISTS "EngagementEvent_type_idx"    ON "OriginalsEngagementEvent"("eventType");

-- ─────────────────────────────────────────
-- STEP 7: REGISTER IN PRISMA MIGRATIONS
-- (prevents re-migration if you run prisma migrate deploy)
-- ─────────────────────────────────────────

INSERT INTO "_prisma_migrations" (
  "id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count"
)
SELECT
  gen_random_uuid()::text,
  'zeero_originals_v3_complete',
  NOW(),
  '20260313_zeero_originals_complete',
  NULL, NULL, NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE "migration_name" = '20260313_zeero_originals_complete'
);

-- ─────────────────────────────────────────
-- VERIFICATION (run these to check)
-- ─────────────────────────────────────────
-- SELECT * FROM "OriginalsConfig";
-- SELECT COUNT(*) FROM "MinesGame";
-- \d "MinesGame"
-- \d "OriginalsConfig"
-- ─────────────────────────────────────────
