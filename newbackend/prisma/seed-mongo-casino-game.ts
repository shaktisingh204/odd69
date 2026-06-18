import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as dotenv from 'dotenv';
import { CasinoGameSchema } from '../src/casino/schemas/casino-game.schema';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI is not defined in .env');
    process.exit(1);
}

// Manually register schema for script usage
const CasinoGameModel = mongoose.model('CasinoGame', CasinoGameSchema);

async function main() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI as string);
    console.log('Connected.');

    // Adjust path to point to root folder where CSV likely is
    const csvPath = path.resolve(__dirname, '../../WCO - Games List(Games List).csv');
    if (!fs.existsSync(csvPath)) {
        console.error(`CSV file not found at ${csvPath}`);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
    });

    console.log(`Found ${records.length} records in CSV.`);

    let processed = 0;
    const batchSize = 100;

    // Chunking
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        await Promise.all(batch.map(async (row: any) => {
            // CSV Header: provider,game_name,Game Tag,Game Sub Type,sub_category,casinoGameId,game_id,description,logo_round,logo_square,banner
            const gameCode = row['casinoGameId'];
            const name = row['game_name'];
            const provider = row['provider'];

            if (!gameCode || !name) return;

            const isActive = (row['description']?.toLowerCase() !== 'deactive');

            // Upsert based on gameCode
            await CasinoGameModel.updateOne(
                { gameCode: gameCode },
                {
                    $set: {
                        provider: provider,
                        name: name,
                        domain: '', // Not in CSV
                        type: row['Game Tag'],
                        subType: row['Game Sub Type'],
                        category: row['sub_category'],
                        rtp: '', // Not in CSV
                        gameId: row['game_id'],
                        remarks: row['description'],
                        isActive: isActive,
                        image: row['banner'] || row['logo_square'] || row['logo_round'], // Fallback for image
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        playCount: 0,
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
        }));

        processed += batch.length;
        if (processed % 500 === 0) console.log(`Processed ${processed} / ${records.length}...`);
    }

    console.log('Seeding CasinoGames completed.');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
