import { PrismaClient } from '@prisma/client';
import { CasinoService } from '../src/casino/casino.service';
import { UsersService } from '../src/users/users.service';

// Mock PrismaService
class MockPrismaService extends PrismaClient {
    async onModuleInit() { await this.$connect(); }
}

async function verifyPopularity() {
    console.log('--- Verifying Popularity Sorting ---');

    const prisma = new MockPrismaService() as any;
    await prisma.$connect();

    const usersService = new UsersService(prisma as any);
    const casinoService = new CasinoService(usersService, prisma as any);

    // 1. Verify Categories Sorting
    console.log('\n--- Testing Categories Sorting ---');
    try {
        const categories = await casinoService.getCategoriesHub();
        console.log('Top 10 Categories:', categories.slice(0, 10).map((c: any) => `${c.name} (${c.count})`));

        // Basic check: Slots should be near top
        const first = categories[0]; // Assuming 'All Games' is 0, 'popular' 1, 'new' 2?
        // Logic puts explicit Popular/New/All first.
        // Then sorted list.
        // Let's print the IDs to verify order
        console.log('Category IDs:', categories.slice(0, 15).map((c: any) => c.id));
    } catch (e: any) {
        console.error('Categories Error:', e.message);
    }

    // 2. Verify Games Sorting
    console.log('\n--- Testing Games Sorting ---');
    try {
        const games = await casinoService.getGamesByProviderHub('all');
        // Check first few games using direct access if possible, or just print names
        // getGamesByProviderHub returns { id, gameCode, gameName ... }
        // It doesn't return popularity score in the mapped result, so we implicitly trust the DB sort or we check DB.
        // But we can check if high popularity games appear first if we know some names.
        // Or we can query DB directly to see if `popularity` field is set.

        const dbGamesValues = await prisma.casinoGame.findMany({
            take: 5,
            orderBy: { popularity: 'desc' },
            select: { name: true, popularity: true }
        });
        console.log('Top 5 DB Games by Popularity:', dbGamesValues);

        console.log('Top 5 API Games:', games.slice(0, 5).map((g: any) => g.gameName));
    } catch (e: any) {
        console.error('Games Error:', e.message);
    }

    await prisma.$disconnect();
}

verifyPopularity().catch(console.error);
