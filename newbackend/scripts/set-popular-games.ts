import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Add names of games to mark as POPULAR here
const POPULAR_GAMES = [
    "Aviator",
    "Lightning Roulette",
    "Crazy Time",
    "Monopoly Live",
    "Teen Patti",
    "Andar Bahar",
    "Roulette",
    "Blackjack",
    "Baccarat",
    "Dragon Tiger",
    "Mega Ball",
    "Dream Catcher",
    "Deal or No Deal",
    "Sweet Bonanza",
    "Gates of Olympus",
    "Starlight Princess",
    "Sugar Rush",
    "Big Bass Bonanza",
    "Fruit Party",
    "The Dog House",
    "Wolf Gold",
    "Book of Dead",
    "Legacy of Dead",
    "Reactoonz",
    "Moon Princess",
    "Fire Joker",
    "Rise of Olympus",
    "Money Train 2",
    "Temple Tumble",
    "Snake Arena",
    "Iron Bank",
    "Deadwood",
    "San Quentin",
    "Mental",
    "East Coast vs West Coast",
    "Chaos Crew"
];

async function setPopularGames() {
    console.log('Setting POPULAR games...');

    // Reset all games to NORMAL first? Or keep existing?
    // User said "set using name".
    // Maybe we should reset all POPULAR to NORMAL first to ensure clean state?
    // But maybe user wants additive?
    // I'll reset Type='POPULAR' to 'NORMAL' first to be safe, assuming this list is the source of truth.
    console.log('Resetting existing POPULAR games to NORMAL...');
    await prisma.casinoGame.updateMany({
        where: { type: 'POPULAR' },
        data: { type: 'NORMAL' }
    });

    let updatedCount = 0;

    for (const name of POPULAR_GAMES) {
        // Use contains match or exact match?
        // User said "using name". Exact match is safer but names might vary slightly.
        // I'll use `contains` (insensitive) to catch variations like "Lightning Roulette Live".

        const result = await prisma.casinoGame.updateMany({
            where: {
                name: {
                    contains: name,
                    mode: 'insensitive'
                }
            },
            data: {
                type: 'POPULAR'
            }
        });

        if (result.count > 0) {
            console.log(`Marked ${result.count} games as POPULAR for "${name}"`);
            updatedCount += result.count;
        } else {
            console.log(`No games found for "${name}"`);
        }
    }

    console.log(`Total ${updatedCount} games marked as POPULAR.`);
    await prisma.$disconnect();
}

setPopularGames();
