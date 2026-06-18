import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeNamelessGames() {
    console.log('--- Removing Games without Name ---');

    // Delete where game_name is null
    const resultNull = await prisma.casino.deleteMany({
        where: {
            game_name: null
        }
    });
    console.log(`Deleted (null name): ${resultNull.count}`);

    // Delete where game_name is empty string
    const resultEmpty = await prisma.casino.deleteMany({
        where: {
            game_name: ''
        }
    });
    console.log(`Deleted (empty name): ${resultEmpty.count}`);
}

removeNamelessGames()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
