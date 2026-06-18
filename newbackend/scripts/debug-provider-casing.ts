import { PrismaClient } from '@prisma/client';

// Mock PrismaService
class MockPrismaService extends PrismaClient {
    async onModuleInit() { await this.$connect(); }
}

async function debugProviderCasing() {
    console.log('--- Debugging Provider Casing ---');

    const prisma = new MockPrismaService() as any;
    await prisma.$connect();

    try {
        const raw = await prisma.casino.groupBy({
            by: ['provider'],
            _count: {
                provider: true
            },
            where: {
                provider: { contains: 'qtech', mode: 'insensitive' }
            }
        });

        console.log('QTECH Variations:');
        raw.forEach((c: any) => {
            console.log(`'${c.provider}': ${c._count.provider}`);
        });

    } catch (e: any) {
        console.error('Debug Error:', e);
    }

    await prisma.$disconnect();
}

debugProviderCasing().catch(console.error);
