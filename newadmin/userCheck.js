const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const user = await prisma.user.findUnique({ where: { id: 4120 } });
    console.log(user);
    const aggr = await prisma.transaction.aggregate({
        where: {
            userId: 4120,
            type: 'DEPOSIT',
            status: { in: ['APPROVED', 'COMPLETED'] },
            wallet_type: { notIn: ['crypto', 'crypto_wallet'] },
        },
        _sum: { amount: true },
    }).catch(e => console.error(e));
    console.log('aggr', aggr);
}
main().catch(console.error).finally(() => prisma.$disconnect());
