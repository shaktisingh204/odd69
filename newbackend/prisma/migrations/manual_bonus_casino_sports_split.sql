-- Migration: add_bonus_casino_sports_split
-- Run this after deploying the updated backend code.
-- Safe to run multiple times (uses IF NOT EXISTS / conditional checks).

-- 1. Add per-type bonus wagering fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "casinoBonusWageringRequired" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "casinoBonusWageringDone"     DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sportsBonusWageringRequired" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sportsBonusWageringDone"     DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 2. Separate bonus wallet balances per type
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "casinoBonus" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sportsBonus" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 2. Add applicableTo to UserBonus table
ALTER TABLE "UserBonus" ADD COLUMN IF NOT EXISTS "applicableTo" TEXT NOT NULL DEFAULT 'BOTH';

-- Optional: backfill existing ACTIVE UserBonus rows based on their bonusCode prefix
-- (You can leave them as 'BOTH' — they'll be treated as applicable to all game types)

-- Done!
