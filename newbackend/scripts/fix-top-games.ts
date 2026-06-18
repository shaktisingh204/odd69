
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixTopGames() {
    console.log("Fixing critical top games...");

    const topGames = [
        { name: 'Aviator', provider: 'Spribe' },
        { name: 'Ice Fishing' },
        { name: 'CosmoX' },
        { name: 'Tower Rush' },
        { name: 'Aviatrix' },
        { name: 'JetX' },
        { name: '3 Super Hot Chillies' },
        { name: 'Skyward Deluxe' },
        { name: 'Super Andar Bahar' }
    ];

    let score = 30000;

    for (const target of topGames) {
        let game = await prisma.casinoGame.findFirst({
            where: {
                name: { contains: target.name, mode: 'insensitive' }
            }
        });

        // If not found by name, try provider if specified (for Aviator)
        if (!game && target.provider) {
            // Maybe game name is different? 
            // Try strict provider + name contains 'Aviator'
            game = await prisma.casinoGame.findFirst({
                where: {
                    provider: { contains: target.provider, mode: 'insensitive' },
                    name: { contains: 'via', mode: 'insensitive' } // 'Aviator' might contain something else? 
                    // Or just check all games from provider Spribe manually?
                }
            });
            // Or actually fetch all spribe games and log them to see what Aviator is called.
            if (!game) {
                const spribes = await prisma.casinoGame.findMany({ where: { provider: target.provider } });
                console.log(`Spribe games: ${spribes.map(s => s.name).join(', ')}`);
                // Maybe it is "Aviator" but hidden chars.
                game = spribes.find(s => s.name.trim() === 'Aviator') || null;
            }
        }

        if (game) {
            await prisma.casinoGame.update({
                where: { id: game.id },
                data: { playCount: score, type: 'POPULAR' }
            });
            console.log(`FORCED UPDATE: ${game.name} -> Score ${score}`);
            score -= 10;
        } else {
            console.log(`STILL MISSING: ${target.name}`);
        }
    }
}

fixTopGames().catch(console.error).finally(() => prisma.$disconnect());
