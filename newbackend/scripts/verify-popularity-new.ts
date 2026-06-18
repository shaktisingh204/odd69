import { PrismaClient } from '@prisma/client';
import { CasinoService } from '../src/casino/casino.service';
import { UsersService } from '../src/users/users.service';

// Mock PrismaService
class MockPrismaService extends PrismaClient {
    async onModuleInit() { await this.$connect(); }
}

async function verifyPopularity() {
    console.log('--- Verifying Popularity Sorting with Casino Model ---');

    const prisma = new MockPrismaService() as any;
    await prisma.$connect();

    const usersService = new UsersService(prisma as any);
    const casinoService = new CasinoService(usersService, prisma as any);

    // 1. Verify Categories Sorting
    console.log('\n--- Testing Categories Sorting ---');
    try {
        const categories = await casinoService.getCategoriesHub();
        console.log('Top 10 Categories:', categories.slice(0, 10).map((c: any) => `${c.name} (${c.count})`));
        console.log('Category IDs:', categories.slice(0, 15).map((c: any) => c.id));
    } catch (e: any) {
        console.error('Categories Error:', e.message);
    }

    // 2. Verify Games Sorting
    console.log('\n--- Testing Games Sorting ---');
    try {
        const games = await casinoService.getGamesByProviderHub('all');
        console.log('Total Games Fetched:', games.length);

        const dbGamesValues = await prisma.casino.findMany({
            take: 5,
            orderBy: { popularity: 'desc' },
            select: { game_name: true, popularity: true }
        });
        console.log('Top 5 DB Games by Popularity:', dbGamesValues.map((g: any) => `${g.game_name} (${g.popularity})`));

        console.log('Top 5 API Games:', games.slice(0, 5).map((g: any) => g.gameName));
    } catch (e: any) {
        console.error('Games Error:', e.message);
    }

    await prisma.$disconnect();
}

verifyPopularity().catch(console.error);
