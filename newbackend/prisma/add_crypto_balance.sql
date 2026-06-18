-- Migration: add cryptoBalance to User table for dual wallet system
-- Run this on production: psql $DATABASE_URL < add_crypto_balance.sql

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cryptoBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeWallet" TEXT NOT NULL DEFAULT 'fiat';
ALTER TABLE "CasinoTransaction" ADD COLUMN IF NOT EXISTS "wallet_type" TEXT NOT NULL DEFAULT 'fiat';
