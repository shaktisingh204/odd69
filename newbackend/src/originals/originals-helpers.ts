/**
 * Shared utilities for the new in-house ODD69 Originals games
 * (keno, hilo, roulette, wheel, coinflip, towers, color, lotto, jackpot).
 *
 * Extracted from the dice/mines/plinko services so each new game stays small.
 *
 * Import these helpers from inside each <game>.service.ts.
 */
import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ─── Provably-fair primitives ─────────────────────────────────────────────────

/** Generate a fresh server seed + its public hash. */
export function generateServerSeed() {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const serverSeedHash = crypto
    .createHash('sha256')
    .update(serverSeed)
    .digest('hex');
  return { serverSeed, serverSeedHash };
}

/**
 * HMAC-SHA256(serverSeed:clientSeed:nonce[:tag])  →  hex digest.
 * `tag` lets you derive multiple independent values from the same seed/nonce.
 */
export function hmacHex(
  serverSeed: string,
  clientSeed: string,
  nonce: number | string,
  tag = '',
): string {
  const key = `${serverSeed}:${clientSeed}:${nonce}${tag ? `:${tag}` : ''}`;
  return crypto.createHmac('sha256', key).digest('hex');
}

/**
 * Pull a uniform integer in [0, max) from an HMAC digest, using the
 * 4-bytes-per-roll Stake/BC.Game scheme. Reads bytes until one fits the
 * unbiased range; falls back to modulo if the digest is exhausted.
 */
export function rollInt(digest: string, max: number): number {
  if (max <= 1) return 0;
  // Unbiased rejection sampling: only accept 4-byte (8-hex) windows that fall
  // below the largest multiple of `max` representable in 32 bits, so the modulo
  // is uniform. Walk successive 8-hex windows until one is accepted.
  const limit = Math.floor(0x100000000 / max) * max;
  let lastRaw = 0;
  for (let i = 0; i + 8 <= digest.length; i += 8) {
    const raw = parseInt(digest.slice(i, i + 8), 16);
    lastRaw = raw;
    if (raw < limit) return raw % max;
  }
  // Digest exhausted without an accepted window (astronomically unlikely):
  // fall back to the modulo of the last window read (slightly biased).
  return lastRaw % max;
}

/** Float in [0,1) from the first 13 hex chars (52 bits ≈ Number safe). */
export function rollFloat(digest: string): number {
  const raw = parseInt(digest.slice(0, 13), 16);
  return raw / 0x10000000000000; // 2^52
}

/**
 * Provably-fair shuffle (Fisher-Yates) of an array of any T.
 * Each swap consumes a fresh HMAC keyed by index.
 */
export function shuffle<T>(
  arr: T[],
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const digest = hmacHex(serverSeed, clientSeed, nonce, `shuffle:${i}`);
    const j = rollInt(digest, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Wallet allocation (mirrors DiceService.buildAllocations) ────────────────

export type WalletField = 'balance' | 'cryptoBalance' | 'casinoBonus';
export type WalletType = 'fiat' | 'crypto';

export interface Allocation {
  walletField: WalletField;
  walletLabel: string;
  amount: number;
}

export function roundCurrency(value: number) {
  return parseFloat(Number(value || 0).toFixed(2));
}

export function walletFieldLabel(field: WalletField) {
  if (field === 'casinoBonus') return 'Casino Bonus Wallet';
  return field === 'cryptoBalance' ? 'Crypto Wallet' : 'Main Wallet';
}

export function primaryWalletField(walletType: WalletType | string): WalletField {
  return walletType === 'crypto' ? 'cryptoBalance' : 'balance';
}

export function paymentMethodForField(field: WalletField) {
  if (field === 'casinoBonus') return 'BONUS_WALLET';
  return field === 'cryptoBalance' ? 'CRYPTO_WALLET' : 'MAIN_WALLET';
}

/**
 * Split `amount` proportionally between the bonus wallet and the primary wallet,
 * mirroring how the player's stake was funded. If only one wallet was used,
 * returns a single-item allocation.
 */
export function buildAllocations(
  walletType: WalletType | string,
  bonusAmountUsed: number,
  betAmount: number,
  amount: number,
): Allocation[] {
  const normalizedAmount = roundCurrency(amount);
  if (normalizedAmount <= 0) return [];

  const primary = primaryWalletField(walletType);

  if (walletType === 'crypto') {
    return [
      {
        walletField: 'cryptoBalance',
        walletLabel: walletFieldLabel('cryptoBalance'),
        amount: normalizedAmount,
      },
    ];
  }

  const normalizedBet = roundCurrency(betAmount);
  const normalizedBonus = roundCurrency(
    Math.min(normalizedBet, Math.max(0, bonusAmountUsed)),
  );
  const mainStake = roundCurrency(Math.max(0, normalizedBet - normalizedBonus));

  if (normalizedBonus <= 0 || normalizedBet <= 0) {
    return [
      {
        walletField: primary,
        walletLabel: walletFieldLabel(primary),
        amount: normalizedAmount,
      },
    ];
  }

  if (mainStake <= 0) {
    return [
      {
        walletField: 'casinoBonus',
        walletLabel: walletFieldLabel('casinoBonus'),
        amount: normalizedAmount,
      },
    ];
  }

  const bonusPart = roundCurrency(
    (normalizedAmount * normalizedBonus) / normalizedBet,
  );
  const mainPart = roundCurrency(normalizedAmount - bonusPart);

  const out: Allocation[] = [
    {
      walletField: 'casinoBonus',
      walletLabel: walletFieldLabel('casinoBonus'),
      amount: bonusPart,
    },
    {
      walletField: primary,
      walletLabel: walletFieldLabel(primary),
      amount: mainPart,
    },
  ];
  return out.filter((a) => a.amount > 0);
}

/**
 * Pick the payment method label for a *whole* allocation set
 * — single allocation = its specific label, multi = MULTI_WALLET.
 */
export function paymentMethodForAllocations(allocs: Allocation[]) {
  if (allocs.length === 1) return paymentMethodForField(allocs[0].walletField);
  return 'MULTI_WALLET';
}

// ─── Atomic stake deduction (Prisma) ─────────────────────────────────────────

export interface DeductedStake {
  bonusUsed: number;
  actualBet: number;
}

/**
 * Deduct `betAmount` from the user's correct sub-wallet inside an open
 * Prisma transaction. Throws BadRequestException on insufficient funds.
 */
export async function deductStake(
  prisma: PrismaService,
  userId: number,
  user: { balance: number; cryptoBalance: number; casinoBonus: number },
  betAmount: number,
  walletType: WalletType | string,
  useBonus: boolean,
): Promise<DeductedStake> {
  let bonusUsed = 0;
  let actualBet = betAmount;

  await prisma.$transaction(async (tx) => {
    if (walletType === 'crypto') {
      const r = await tx.user.updateMany({
        where: { id: userId, cryptoBalance: { gte: betAmount } },
        data: { cryptoBalance: { decrement: betAmount } },
      });
      if (!r.count) {
        throw new BadRequestException('Insufficient crypto balance');
      }
      return;
    }

    if (useBonus && user.casinoBonus > 0) {
      bonusUsed = Math.min(user.casinoBonus, betAmount);
      actualBet = Math.max(0, betAmount - bonusUsed);
      const r = await tx.user.updateMany({
        where: {
          id: userId,
          balance: { gte: actualBet },
          casinoBonus: { gte: bonusUsed },
        },
        data: {
          balance: { decrement: actualBet },
          casinoBonus: { decrement: bonusUsed },
        },
      });
      if (!r.count) {
        throw new BadRequestException('Insufficient balance');
      }
      return;
    }

    const r = await tx.user.updateMany({
      where: { id: userId, balance: { gte: betAmount } },
      data: { balance: { decrement: betAmount } },
    });
    if (!r.count) {
      throw new BadRequestException('Insufficient balance');
    }
  });

  return { bonusUsed, actualBet };
}

/**
 * Credit `payout` (split across the same wallets the stake came from) and
 * write a BET_WIN transaction; or write a BET_LOSS row when payout = 0.
 *
 * `gameSource` is the upper-cased game label that goes into paymentDetails.source
 * (e.g. 'KENO', 'COINFLIP'). `gameId` is the Mongo doc id as a string.
 */
export async function settlePayout(
  prisma: PrismaService,
  userId: number,
  betAmount: number,
  payout: number,
  walletType: WalletType | string,
  bonusUsed: number,
  gameSource: string,
  gameId: string,
  remarksWin: string,
  remarksLoss: string,
) {
  const won = payout > 0;
  const allocs = won
    ? buildAllocations(walletType, bonusUsed, betAmount, payout)
    : [];
  const paymentMethod = paymentMethodForAllocations(allocs);

  await prisma.$transaction(async (tx) => {
    if (won) {
      const updateData: Record<string, any> = {};
      for (const a of allocs) {
        updateData[a.walletField] = { increment: a.amount };
      }
      await tx.user.update({ where: { id: userId }, data: updateData });

      await tx.transaction.create({
        data: {
          userId,
          amount: payout,
          type: 'BET_WIN',
          status: 'COMPLETED',
          paymentMethod,
          paymentDetails: {
            source: gameSource,
            gameId,
            walletField:
              allocs.length === 1 ? allocs[0].walletField : null,
            walletLabel:
              allocs.length === 1
                ? allocs[0].walletLabel
                : allocs.map((a) => a.walletLabel).join(' + '),
            allocations: allocs,
          } as any,
          remarks: remarksWin,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return;
    }

    await tx.transaction.create({
      data: {
        userId,
        amount: betAmount,
        type: 'BET_LOSS',
        status: 'COMPLETED',
        paymentDetails: { source: gameSource, gameId } as any,
        remarks: remarksLoss,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });
}

/**
 * Write the BET_PLACE log entry that records the stake (no balance change —
 * the stake was already deducted via deductStake).
 */
export async function logStakeTransaction(
  prisma: PrismaService,
  userId: number,
  betAmount: number,
  walletType: WalletType | string,
  bonusUsed: number,
  gameSource: string,
  gameId: string,
  remarks: string,
) {
  const allocs = buildAllocations(walletType, bonusUsed, betAmount, betAmount);
  const paymentMethod = paymentMethodForAllocations(allocs);

  await prisma.transaction.create({
    data: {
      userId,
      amount: betAmount,
      type: 'BET_PLACE',
      status: 'COMPLETED',
      paymentMethod,
      paymentDetails: {
        source: gameSource,
        gameId,
        walletField: allocs.length === 1 ? allocs[0].walletField : null,
        walletLabel:
          allocs.length === 1
            ? allocs[0].walletLabel
            : allocs.map((a) => a.walletLabel).join(' + '),
        allocations: allocs,
      } as any,
      remarks,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}
