
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as dotenv from 'dotenv';
import { CasinoGameSchema } from '../casino/schemas/casino-game.schema';
import { CasinoSchema } from '../casino/schemas/casino.schema';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI is not defined in .env');
    process.exit(1);
}

// Register Models
const CasinoGameModel = mongoose.model('CasinoGame', CasinoGameSchema);
const CasinoModel = mongoose.model('Casino', CasinoSchema);

async function main() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI as string);
        console.log('Connected to MongoDB.');

        console.log('Clearing existing Casino data...');
        await CasinoGameModel.deleteMany({});
        await CasinoModel.deleteMany({});
        console.log('Cleared CasinoGame and Casino collections.');

        const csvPath = path.resolve(__dirname, '../../../WCO - Games List(Games List).csv');
        if (!fs.existsSync(csvPath)) {
            console.error(`CSV file not found at ${csvPath}`);
            process.exit(1);
        }

        console.log(`Reading CSV from ${csvPath}...`);
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true
        });

        console.log(`Found ${records.length} games in CSV. Starting import...`);

        const providersMap = new Map<string, any>();
        const seenGameCodes = new Set<string>();
        let processedGames = 0;

        for (const row of records) {
            const gameCode = row['casinoGameId'];
            const name = row['game_name'];
            const provider = row['provider'];

            if (!gameCode || !name || !provider) continue;

            if (seenGameCodes.has(gameCode)) {
                // console.warn(`Duplicate game code found: ${gameCode}. Skipping.`);
                continue;
            }
            seenGameCodes.add(gameCode);

            const isActive = (row['description']?.toLowerCase() !== 'deactive');

            // prepare game doc
            const gameDoc = {
                gameCode: gameCode,
                provider: provider,
                name: name,
                domain: '',
                type: row['Game Tag'] || 'SLOT',
                subType: row['Game Sub Type'],
                category: row['sub_category'],
                gameId: row['game_id'],
                remarks: row['description'],
                isActive: isActive,
                image: row['banner'] || row['logo_square'] || row['logo_round'],
                providerCode: provider, // Use provider name as code if not separate
                status: isActive,
                createdAt: new Date(),
                updatedAt: new Date(),
                meta_keywords: row['meta_keywords'] || '',
                meta_title: row['meta_title'] || '',
                meta_description: row['meta_description'] || '',
                popularity: 0
            };

            await CasinoGameModel.create(gameDoc);
            processedGames++;

            // Track provider for later insertion
            if (!providersMap.has(provider)) {
                providersMap.set(provider, {
                    provider: provider,
                    name: provider,
                    code: provider,
                    status: true,
                    image: '', // Could try to find a logo if available
                    maintenance: false,
                    currency: 'INR', // Default
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            if (processedGames % 500 === 0) {
                console.log(`Imported ${processedGames} games...`);
            }
        }

        console.log(`Finished importing ${processedGames} games.`);

        console.log(`Importing ${providersMap.size} providers...`);
        const providers = Array.from(providersMap.values());
        if (providers.length > 0) {
            await CasinoModel.insertMany(providers);
        }
        console.log('Providers imported.');

        console.log('Casino Data Refresh Completed Successfully.');

    } catch (error) {
        console.error('Error during script execution:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

main();
