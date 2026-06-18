"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
        if (!game && target.provider) {
            game = await prisma.casinoGame.findFirst({
                where: {
                    provider: { contains: target.provider, mode: 'insensitive' },
                    name: { contains: 'via', mode: 'insensitive' }
                }
            });
            if (!game) {
                const spribes = await prisma.casinoGame.findMany({ where: { provider: target.provider } });
                console.log(`Spribe games: ${spribes.map(s => s.name).join(', ')}`);
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
        }
        else {
            console.log(`STILL MISSING: ${target.name}`);
        }
    }
}
fixTopGames().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=fix-top-games.js.map