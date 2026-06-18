import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI is not defined in .env');
    process.exit(1);
}

const casinoSchema = new mongoose.Schema({
    game_id: Number,
    game_name: String,
    casinoGameId: String,
    provider: String,
    sub_category: String,
    description: String,
    logo_round: String,
    logo_square: String,
    banner: String,
    pid: String,
    game_tag: String,
    game_sub_type: String,
    popularity: { type: Number, default: 0 },
    isNew: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { suppressReservedKeysWarning: true });

const CasinoModel = mongoose.model('Casino', casinoSchema, 'casinos'); // Explicit collection name 'casinos' to match Service

async function main() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI as string);
    console.log('Connected.');

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
            const gameIdInt = parseInt(row['game_id'] || '0');
            const gameCode = row['casinoGameId'];

            if (!gameCode) return;

            // Upsert
            await CasinoModel.updateOne(
                { casinoGameId: gameCode },
                {
                    $set: {
                        provider: row['provider'],
                        game_name: row['game_name'],
                        game_tag: row['Game Tag'],
                        game_sub_type: row['Game Sub Type'],
                        sub_category: row['sub_category'],
                        game_id: gameIdInt,
                        description: row['description'],
                        logo_round: row['logo_round'],
                        logo_square: row['logo_square'],
                        banner: row['banner'],
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        popularity: 0,
                        isNew: false,
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
        }));

        processed += batch.length;
        if (processed % 500 === 0) console.log(`Processed ${processed} / ${records.length}...`);
    }

    console.log('Seeding completed.');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
