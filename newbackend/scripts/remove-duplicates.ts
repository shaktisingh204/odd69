
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeDuplicateGames() {
    console.log('--- Removing Duplicate Games (Same Provider + Same Name) ---');

    // 1. Fetch all games
    // We only need id, provider, game_name to identify duplicates
    const allGames = await prisma.casino.findMany({
        select: {
            id: true,
            provider: true,
            game_name: true
        }
    });

    console.log(`Total games found: ${allGames.length}`);

    // 2. Group by Provider + Game Name
    const gameMap = new Map<string, number[]>();

    for (const game of allGames) {
        if (!game.provider || !game.game_name) continue;

        const key = `${game.provider.trim().toLowerCase()}|${game.game_name.trim().toLowerCase()}`;

        if (!gameMap.has(key)) {
            gameMap.set(key, []);
        }
        gameMap.get(key)?.push(game.id);
    }

    // 3. Identify IDs to delete
    const idsToDelete: number[] = [];
    let duplicateGroupsCount = 0;

    for (const [key, ids] of gameMap.entries()) {
        if (ids.length > 1) {
            duplicateGroupsCount++;
            // Sort IDs to ensure determinism (keep the smallest ID, or largest? Usually largest = newest)
            // User didn't specify, but often keeping the older one (smaller ID) preserves older stats/history?
            // Or newer one has better data?
            // "keep only 1". Let's keep the one with the lowest ID (oldest) assuming it's the original.
            // Or actually, let's keep the latest one (highest ID) as it might have updated info?
            // Let's stick to keeping the first one we see or sorting.
            // Let's sort ascending and keep the first (lowest ID).
            ids.sort((a, b) => a - b);

            // Keep the first one (index 0), delete the rest
            const toRemove = ids.slice(1);
            idsToDelete.push(...toRemove);

            // console.log(`Found duplicate for [${key}]: keeping ${ids[0]}, removing ${toRemove.join(', ')}`);
        }
    }

    console.log(`Found ${duplicateGroupsCount} groups with duplicates.`);
    console.log(`Total records to delete: ${idsToDelete.length}`);

    if (idsToDelete.length > 0) {
        // 4. Delete
        const batchSize = 1000;
        for (let i = 0; i < idsToDelete.length; i += batchSize) {
            const batch = idsToDelete.slice(i, i + batchSize);
            await prisma.casino.deleteMany({
                where: {
                    id: {
                        in: batch
                    }
                }
            });
            console.log(`Deleted batch ${Math.ceil((i + 1) / batchSize)}/${Math.ceil(idsToDelete.length / batchSize)}`);
        }
        console.log('--- Deduplication Complete ---');
    } else {
        console.log('No duplicates found.');
    }
}

removeDuplicateGames()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
