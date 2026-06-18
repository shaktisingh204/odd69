-- Add withdrawal turnover tracking columns (separate from bonus wagering)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalDeposited" FLOAT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalWagered"   FLOAT NOT NULL DEFAULT 0;
