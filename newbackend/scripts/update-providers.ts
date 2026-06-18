
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const providerMapping: Record<string, string> = {
    'Supernowa': 'SN',
    'Power Games': 'PG',
    'Xprogramming': 'XPG',
    'Evolution': 'EVZ',
    'Ezugi': 'EZ',
    'Qtech': 'QT',
    'AE Sexy Casino': 'AWC',
    'Pragmatic Play': 'PP',
    'Only Play': 'GT',
    '7 Mojo': '7MJ',
    'RTG slots': 'NGP',
    'Spribe': 'SPB',
    'Aman Casino': 'AC',
    'Aura casino': 'AC',
    'Dream Casino': 'DC',
    'Smartsoft Gaming': 'SMTSG',
    'Betradar': 'BR',
    'Bollytech': 'BT',
    'Jacktop': 'JT',
    'Bollygaming RNG': 'BGS',
    'Superspade': 'SSG',
    'Galaxys': 'GLX',
    'Creedroomz': 'CRZ',
    'Marbles': 'MRB',
    'Darwin': 'DW',
    'Ncasino': 'ST8',
    'TVBet': 'TVB',
    'InOut': 'IO',
    '100HP': 'HP'
};

async function main() {
    console.log("Starting provider code update...");

    for (const [name, code] of Object.entries(providerMapping)) {
        // Find games where provider match the name (flexible check?)
        // The user provided "Provider Name" which likely matches 'provider' column or part of it.
        // We will try exact match first, then potential "contains" if needed?
        // Let's assume the current DB has these names in the `provider` column (which seems to be the name currently based on casino.service.ts logs).

        // However, looking at casino.service.ts, `provider` column stores the NAME or CODE?
        // Line 124 in casino.service.ts says: `where.provider = { equals: provider ... }`
        // Line 158 mapping says: `providerCode: g.provider`
        // So `g.provider` currently holds what?

        // If the user wants to UPDATE them to codes, it implies they might be names right now.
        // Or maybe they are mixed.

        // Strategy: Update all records where `provider` matches the Name to the new Code.
        // Also handling case-insensitive match for the name.

        const result = await prisma.casinoGame.updateMany({
            where: {
                provider: {
                    equals: name,
                    mode: 'insensitive'
                }
            },
            data: {
                provider: code
            }
        });

        console.log(`Updated ${result.count} games for provider '${name}' to code '${code}'`);
    }

    // Also handle specific multi-match ones if any (e.g. "Aman Casino and Aura casino")
    // I split them in the mapping above for 'Aman Casino' and 'Aura casino'.

    // Check "Betradar(Virtualsport)" -> "Betradar"
    // "Bollytech(Sportbook)" -> "Bollytech"

    await prisma.casinoGame.updateMany({
        where: { provider: { contains: 'Betradar', mode: 'insensitive' } },
        data: { provider: 'BR' }
    });
    await prisma.casinoGame.updateMany({
        where: { provider: { contains: 'Bollytech', mode: 'insensitive' } },
        data: { provider: 'BT' }
    });

}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
