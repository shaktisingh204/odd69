import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

async function updatePopularity() {
    console.log('--- Updating Games Popularity ---');

    /*
    Ranking Strategy:
    1. Online Slots (Video Slots, Slot, Classic Slots) - Base Score 5000
    2. Live Casino (Live Table, Live Dealer) - Base Score 4000
    3. Blackjack - Base Score 3000
    4. Roulette - Base Score 2500
    5. Baccarat - Base Score 2000
    6. Video Poker / Poker - Base Score 1500
    7. Others (Scratch Cards, Bingo, Keno, Fishing) - Base Score 1000
    */

    const categoryScores: { [key: string]: number } = {
        'Video Slots': 5000,
        'Slot': 5000,
        'Classic Slots': 4800,
        'Live Table': 4000,
        'Live Dealer': 4000,
        'Blackjack': 3000,
        'Roulette': 2500,
        'Baccarat': 2000,
        'Video Poker': 1500,
        'Table Games': 1200,
        'Scratch Cards': 1000,
        'Bingo': 900,
        'Keno': 900,
        'Fishing': 800,
        'Virtual Games': 700,
        'Other': 500
    };

    const games = await prisma.casino.findMany();
    let updatedCount = 0;

    for (const rawGame of games) {
        const game = rawGame as any;
        let baseScore = 500; // Default low score

        // Check sub_category first (most specific)
        if (game.sub_category) {
            for (const [key, score] of Object.entries(categoryScores)) {
                if (game.sub_category.includes(key)) {
                    baseScore = Math.max(baseScore, score);
                }
            }
        }

        // Check game_sub_type next
        if (game.game_sub_type) {
            for (const [key, score] of Object.entries(categoryScores)) {
                if (game.game_sub_type.includes(key)) {
                    baseScore = Math.max(baseScore, score);
                }
            }
        }

        // Check description as fallback
        if (game.description) {
            for (const [key, score] of Object.entries(categoryScores)) {
                if (game.description.includes(key)) {
                    baseScore = Math.max(baseScore, score);
                }
            }
        }

        // Add random variance (0-99) to shuffle games within the same category
        const finalScore = baseScore + Math.floor(Math.random() * 100);

        if (game.popularity !== finalScore) {
            await prisma.casino.update({
                where: { id: game.id },
                data: { popularity: finalScore }
            });
            updatedCount++;
        }
    }

    console.log(`Updated popularity for ${updatedCount} games.`);
}

updatePopularity()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
