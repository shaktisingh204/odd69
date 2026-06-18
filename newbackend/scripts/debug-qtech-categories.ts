import { PrismaClient } from '@prisma/client';

// Mock PrismaService
class MockPrismaService extends PrismaClient {
    async onModuleInit() { await this.$connect(); }
}

async function debugQtechCategories() {
    console.log('--- Debugging QTECH Sub-Categories ---');

    const prisma = new MockPrismaService() as any;
    await prisma.$connect();

    try {
        const raw = await prisma.casino.groupBy({
            by: ['sub_category'],
            _count: {
                sub_category: true
            },
            where: {
                provider: { equals: 'QTECH', mode: 'insensitive' },
                sub_category: { not: null }
            }
        });

        console.log('QTECH Sub-Categories:');
        raw.forEach((c: any) => {
            console.log(`${c.sub_category}: ${c._count.sub_category}`);
        });

        // Manual Normalize Logic Simulation
        console.log('\n--- Simulation ---');
        let slotsCount = 0;
        const normalize = (cat: string) => {
            if (!cat) return '';
            let n = cat.toLowerCase().trim();
            if (n === 'slot' || n === 'slot game' || n === 'slot games' || n.includes('reels') || n.includes('video slot')) return 'slots';
            return n;
        };

        raw.forEach((c: any) => {
            const n = normalize(c.sub_category);
            if (n === 'slots') {
                console.log(`Mapped '${c.sub_category}' -> 'slots' (${c._count.sub_category})`);
                slotsCount += c._count.sub_category;
            }
        });
        console.log(`Total Simulated Slots Count: ${slotsCount}`);

    } catch (e: any) {
        console.error('Debug Error:', e);
    }

    await prisma.$disconnect();
}

debugQtechCategories().catch(console.error);
