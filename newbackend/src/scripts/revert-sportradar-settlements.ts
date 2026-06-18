import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function undoRefundReversals() {
  console.log('🚀 Reverting ADMIN_REFUND_REVERSAL...');

  const reversals = await prisma.transaction.findMany({
    where: {
      type: 'ADMIN_REFUND_REVERSAL',
      status: 'COMPLETED',
    },
  });

  console.log(`Found ${reversals.length} reversal transactions`);

  let restored = 0;

  for (const txn of reversals) {
    try {
      await prisma.$transaction(async (tx) => {
        // 🔁 ADD BACK money
        await tx.user.update({
          where: { id: txn.userId },
          data: {
            balance: { increment: txn.amount },
          },
        });

        // 🧾 mark as reverted (IMPORTANT)
        await tx.transaction.update({
          where: { id: txn.id },
          data: {
            status: 'REVERSED',
            remarks: 'Auto reverted due to incorrect recovery script',
          },
        });
      });

      restored++;
    } catch (err) {
      console.error(`❌ Failed txn=${txn.id}`, err);
    }
  }

  console.log(`✅ Restored balances for ${restored} transactions`);
}

undoRefundReversals()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
