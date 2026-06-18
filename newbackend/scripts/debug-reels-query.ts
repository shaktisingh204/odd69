import { PrismaClient } from '@prisma/client';

// Mock PrismaService
class MockPrismaService extends PrismaClient {
    async onModuleInit() { await this.$connect(); }
}

async function debugReelsQuery() {
    console.log('--- Debugging Reels Query ---');

    const prisma = new MockPrismaService() as any;
    await prisma.$connect();

    try {
        // Test 1: Check how many "6 Reels" exist for QTECH
        const count6Reels = await prisma.casino.count({
            where: {
                provider: { equals: 'QTECH', mode: 'insensitive' },
                sub_category: '6 Reels'
            }
        });
        console.log(`Explicit '6 Reels' Count: ${count6Reels}`);

        // Test 2: Check match with contains 'reels'
        const countContainsReels = await prisma.casino.count({
            where: {
                provider: { equals: 'QTECH', mode: 'insensitive' },
                sub_category: { contains: 'reels', mode: 'insensitive' }
            }
        });
        console.log(`Contains 'reels' Count: ${countContainsReels}`);

        // Test 3: Check match with OR condition used in Service
        const countOR = await prisma.casino.count({
            where: {
                provider: { equals: 'QTECH', mode: 'insensitive' },
                OR: [
                    { sub_category: { contains: 'slot', mode: 'insensitive' } },
                    { sub_category: { contains: 'reels', mode: 'insensitive' } },
                    { sub_category: { contains: 'video slot', mode: 'insensitive' } }
                ]
            }
        });
        console.log(`OR Query Count: ${countOR}`);

        // Test 4: Check if '6 Reels' matches contains 'reels'
        const count6ReelsContains = await prisma.casino.count({
            where: {
                provider: { equals: 'QTECH', mode: 'insensitive' },
                sub_category: '6 Reels',
                // AND
                OR: [
                    { sub_category: { contains: 'reels', mode: 'insensitive' } }
                ]
            }
        });
        console.log(`'6 Reels' matching contains 'reels': ${count6ReelsContains}`);

    } catch (e: any) {
        console.error('Debug Error:', e);
    }

    await prisma.$disconnect();
}

debugReelsQuery().catch(console.error);
