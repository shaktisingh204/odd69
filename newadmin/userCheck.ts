import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const user = await prisma.user.findUnique({ where: { id: 4120 } });
    console.log(user);
}
main().catch(console.error).finally(() => prisma.$disconnect());
