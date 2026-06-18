import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Add names of games to mark as NEW here
// Placeholder list
const NEW_GAMES = [
    "Plinko",
    "Mines",
    "Goal",
    "Hotline",
    "Dice",
    "Keno",
    "HiLo",
    "Mini Roulette",
    "Limbo",
    "Crash",
    "Wheel"
];

async function setNewGames() {
    console.log('Setting NEW games...');

    // Reset existing NEW to NORMAL?
    console.log('Resetting existing NEW games to NORMAL...');
    await prisma.casinoGame.updateMany({
        where: { type: 'NEW' },
        data: { type: 'NORMAL' }
    });

    let updatedCount = 0;

    for (const name of NEW_GAMES) {
        const result = await prisma.casinoGame.updateMany({
            where: {
                name: {
                    contains: name,
                    mode: 'insensitive'
                }
            },
            data: {
                type: 'NEW'
            }
        });

        if (result.count > 0) {
            console.log(`Marked ${result.count} games as NEW for "${name}"`);
            updatedCount += result.count;
        } else {
            console.log(`No games found for "${name}"`);
        }
    }

    console.log(`Total ${updatedCount} games marked as NEW.`);
    await prisma.$disconnect();
}

setNewGames();
