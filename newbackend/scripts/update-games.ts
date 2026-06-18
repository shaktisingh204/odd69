import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { PROVIDERS_MAP } from '../src/config/casino.config';

const prisma = new PrismaClient();

const CASINO_API_URL = 'https://auth.worldcasinoonline.com/api/games';

// Partner Keys
const PARTNER_KEY_INR =
    process.env.CASINO_PARTNER_KEY_INR ||
    'FbYznnyM+gPTBka3Gt49k8VrqbDZwTe0P4Q+XHWtwzuSbEN/a0kSOdgJYV0/WqpxLcC2ivBxIwsJ7lxgDgsdaw==';

const PARTNER_KEY_LKR =
    process.env.CASINO_PARTNER_KEY_LKR ||
    'CaiizsbI4ki7btnsbQBud+x/dDnCr3U/H9t4PcaKq/Vz4PRgWZQYoeOYQKk8QgFtOdCCRBZSCI=';

/**
 * Fetch ALL games (providerCode must be null)
 */
async function fetchAllGames(
    partnerKey: string,
    label: string
): Promise<any[]> {
    try {
        console.log(`➡️ Fetching ALL ${label} games`);

        const response = await axios.post(
            CASINO_API_URL,
            {
                partnerKey,
                providerCode: null
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data?.status?.code !== 'SUCCESS') {
            console.error(`[${label}] API ERROR`, response.data);
            return [];
        }

        console.log(
            `✅ ${label} games fetched: ${response.data.games.length}`
        );

        return response.data.games || [];
    } catch (error: any) {
        console.error(`[${label}] REQUEST FAILED`, error.message);
        return [];
    }
}

async function updateGames() {
    try {
        console.log('🔌 Connecting to database...');

        // Fetch games ONCE per currency
        const [inrGames, lkrGames] = await Promise.all([
            fetchAllGames(PARTNER_KEY_INR, 'INR'),
            fetchAllGames(PARTNER_KEY_LKR, 'LKR')
        ]);

        // Merge & deduplicate by game.code
        const gamesMap = new Map<string, any>();

        [...inrGames, ...lkrGames].forEach((game) => {
            if (game?.code && !gamesMap.has(game.code)) {
                gamesMap.set(game.code, game);
            }
        });

        const uniqueGames = Array.from(gamesMap.values());

        console.log(`🧠 Unique games count: ${uniqueGames.length}`);

        // Clear DB
        console.log('🧹 Clearing existing casino games...');
        await prisma.casinoGame.deleteMany({});

        const insertData: any[] = [];
        const providersFound = new Set<string>();

        for (const game of uniqueGames) {
            // Map provider using providerCode
            const providerName =
                PROVIDERS_MAP.find(
                    (p) => p.code === game.providerCode
                )?.name || game.providerCode;

            providersFound.add(providerName);

            insertData.push({
                gameId: game.code,
                gameCode: game.code,
                name: game.name,
                provider: providerName,
                category: 'all',
                image: game.thumb,
                banner: game.thumb,
                isActive: true,
                isMobile: true,
                type: 'NORMAL',
                order: 0,
                remarks: `ProviderCode: ${game.providerCode}`
            });
        }

        // Batch insert
        const chunkSize = 500;
        for (let i = 0; i < insertData.length; i += chunkSize) {
            await prisma.casinoGame.createMany({
                data: insertData.slice(i, i + chunkSize),
                skipDuplicates: true
            });

            console.log(
                `🚀 Inserted ${Math.min(
                    i + chunkSize,
                    insertData.length
                )}/${insertData.length}`
            );
        }

        console.log('🎉 Games synced successfully!');
        console.log('🏷️ Providers:', Array.from(providersFound));
    } catch (err) {
        console.error('❌ Fatal error:', err);
    } finally {
        await prisma.$disconnect();
        console.log('🔌 Database connection closed');
    }
}

// Run
updateGames();
