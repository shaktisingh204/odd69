/**
 * One-shot repair for user #468 (peak5033x).
 *
 * Situation:
 *   - A ₹2,000 BONUS transaction exists (APPROVED, 21/03/2026)
 *   - BUT casinoBonus = 0 and no ACTIVE UserBonus record exists
 *   - Root cause: old admin bulk-bonus action wrote to wrong fields
 *
 * This script:
 *   1. Verifies the orphaned BONUS transaction exists
 *   2. In a single Prisma transaction:
 *      a) Credits casinoBonus += 2000
 *      b) Creates the missing UserBonus record (ACTIVE, 0x wagering)
 *   3. Emits nothing (offline script), just prints result
 *
 * Run:
 *   npx ts-node src/scripts/repair-orphaned-bonus-user468.ts
 * Dry-run (default, no --apply):
 *   npx ts-node src/scripts/repair-orphaned-bonus-user468.ts
 * Apply:
 *   npx ts-node src/scripts/repair-orphaned-bonus-user468.ts --apply
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const TARGET_USER_ID = 468;
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`[Repair#468] Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const user = await (prisma as any).user.findUnique({
    where: { id: TARGET_USER_ID },
    select: {
      id: true,
      username: true,
      casinoBonus: true,
      fiatBonus: true,
      sportsBonus: true,
      cryptoBonus: true,
    },
  });

  if (!user) {
    console.error(`[Repair#468] User #${TARGET_USER_ID} not found.`);
    process.exit(1);
  }

  console.log(`[Repair#468] User: ${user.username} (#${user.id})`);
  console.log(`[Repair#468] Current casinoBonus=${user.casinoBonus}, fiatBonus=${user.fiatBonus}`);

  // Find the orphaned BONUS transactions (no matching ACTIVE UserBonus)
  const bonusTxns = await (prisma as any).transaction.findMany({
    where: {
      userId: TARGET_USER_ID,
      type: 'BONUS',
      status: 'APPROVED',
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[Repair#468] BONUS transactions found: ${bonusTxns.length}`);
  for (const tx of bonusTxns) {
    console.log(`  - id=${tx.id}, amount=${tx.amount}, date=${tx.createdAt}, remarks=${tx.remarks}`);
  }

  // Find active UserBonus records
  const activeUserBonuses = await (prisma as any).userBonus.findMany({
    where: { userId: TARGET_USER_ID, status: 'ACTIVE' },
  });
  console.log(`[Repair#468] Active UserBonus records: ${activeUserBonuses.length}`);
  for (const ub of activeUserBonuses) {
    console.log(`  - id=${ub.id}, code=${ub.bonusCode}, amount=${ub.bonusAmount}, applicableTo=${ub.applicableTo}`);
  }

  // Total bonus already credited to wallet
  const alreadyCreditedToWallet = parseFloat((user.casinoBonus || 0).toString())
    + parseFloat((user.fiatBonus || 0).toString());
  // Total from active UserBonus records
  const alreadyInUserBonus = activeUserBonuses.reduce((sum: number, ub: any) => sum + (ub.bonusAmount || 0), 0);

  console.log(`[Repair#468] casinoBonus+fiatBonus on user: ${alreadyCreditedToWallet}`);
  console.log(`[Repair#468] Sum of active UserBonus amounts: ${alreadyInUserBonus}`);

  // Find orphaned BONUS transactions (amount not covered by any active UserBonus)
  // Simple approach: if wallet balance < sum(BONUS txns) - we need to credit the difference
  const totalBonusTxnAmount = bonusTxns.reduce((sum: number, tx: any) => sum + parseFloat(tx.amount.toString()), 0);
  console.log(`[Repair#468] Total BONUS transaction amount: ₹${totalBonusTxnAmount}`);

  const missingAmount = Math.max(0, Math.round((totalBonusTxnAmount - alreadyCreditedToWallet) * 100) / 100);
  console.log(`[Repair#468] Missing from wallet: ₹${missingAmount}`);

  if (missingAmount <= 0) {
    console.log('[Repair#468] Nothing to fix — wallet already matches bonus transactions.');
    return;
  }

  if (!APPLY) {
    console.log(`[Repair#468] DRY-RUN: Would credit casinoBonus += ${missingAmount} and create UserBonus record.`);
    return;
  }

  // Apply the fix
  await (prisma as any).$transaction([
    // Credit the missing amount to casinoBonus
    (prisma as any).user.update({
      where: { id: TARGET_USER_ID },
      data: { casinoBonus: { increment: missingAmount } },
    }),
    // Create the missing UserBonus record
    (prisma as any).userBonus.create({
      data: {
        userId: TARGET_USER_ID,
        bonusId: 'admin_bulk',
        bonusCode: 'ADMIN_BULK',
        bonusTitle: 'Admin Bonus Credit (Repaired)',
        bonusCurrency: 'INR',
        applicableTo: 'CASINO',
        depositAmount: 0,
        bonusAmount: missingAmount,
        wageringRequired: 0,
        wageringDone: 0,
        status: 'ACTIVE',
        expiresAt: null,
      },
    }),
  ]);

  console.log(`[Repair#468] ✅ SUCCESS — credited casinoBonus += ₹${missingAmount} and created UserBonus record.`);

  // Verify
  const updated = await (prisma as any).user.findUnique({
    where: { id: TARGET_USER_ID },
    select: { casinoBonus: true, fiatBonus: true },
  });
  console.log(`[Repair#468] Verified casinoBonus=${updated.casinoBonus}, fiatBonus=${updated.fiatBonus}`);
}

main()
  .catch((e) => {
    console.error('[Repair#468] Failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
