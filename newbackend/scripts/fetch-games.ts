
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const API_URL = 'https://worldcasinoonline.com/api/games';
const PARTNER_KEY = process.env.CASINO_FETCH_KEY;

if (!PARTNER_KEY) {
    console.error("CASINO_FETCH_KEY is not defined in environment.");
    process.exit(1);
}

// Interface for API Response based on user input
interface ApiGame {
    name: string;
    code: string;
    providerCode: string;
    thumb: string;
}

interface ApiResponse {
    games: ApiGame[];
    status: {
        code: string;
        message: string;
    }
}

async function main() {
    console.log("Starting Casino Games Sync...");

    try {
        // 1. Delete all existing games
        console.log("Clearing existing casino games...");
        await prisma.casinoGame.deleteMany({});
        console.log("Existing games cleared.");

        // 2. Fetch games from API
        console.log(`Fetching new games from ${API_URL}...`);

        // According to user, body should be { partnerKey, providerCode: null }
        const payload = {
            partnerKey: PARTNER_KEY,
            providerCode: "SN"
        };

        const response = await axios.post<ApiResponse>(API_URL, payload);
        const data = response.data;

        if (data.status?.code !== 'SUCCESS') {
            console.error("API Error Response:", JSON.stringify(data, null, 2));
            throw new Error(`API returned error: ${data.status?.message}`);
        }

        const games = data.games || [];
        console.log(`Fetched ${games.length} games.`);

        if (games.length === 0) {
            console.warn("No games returned from API.");
            return;
        }

        // 3. Insert Games
        // We'll process them in chunks or one by one. one by one is fine for a script unless there are 10k+.
        // Let's use createMany for performance.

        // Need to map ApiGame to Prisma CreateInput.
        // Schema (based on observation):
        // name: string
        // gameCode: string (mapped from 'code')
        // provider: string (mapped from 'providerCode')
        // image: string (mapped from 'thumb')
        // isActive: boolean (default true probably)
        // type, category - might need default values or inference.

        // We don't have category/type in the API response provided by user.
        // We will insert them with null/default and maybe run the tag script later.

        const gamesToInsert = games.map(g => ({
            name: g.name,
            gameCode: g.code, // Unique constraint?
            provider: g.providerCode,
            image: g.thumb,
            isActive: true,
            // category: null,
            // type: null
        }));

        console.log("Inserting games into database...");
        // Use createMany to insert in bulk
        // Note: skipDuplicates ensures we don't crash on duplicates if APIs return them.
        const result = await prisma.casinoGame.createMany({
            data: gamesToInsert,
            skipDuplicates: true
        });

        console.log(`Successfully inserted ${result.count} games.`);

    } catch (error) {
        console.error("Error syncing games:", error.message);
        if (error.response) {
            console.error("Response Body:", error.response.data);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
