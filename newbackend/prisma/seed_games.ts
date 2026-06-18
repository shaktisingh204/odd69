
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';

const prisma = new PrismaClient();

const csvFilePath = path.join(__dirname, '../../WCO - Games List(Games List).csv');

async function main() {
    console.log(`Reading games from ${csvFilePath}...`);

    const games: any[] = [];

    const parser = fs.createReadStream(csvFilePath).pipe(
        parse({
            columns: true, // Auto-detect headers
            skip_empty_lines: true,
            trim: true,
        })
    );

    for await (const record of parser) {
        games.push(record);
    }

    console.log(`Found ${games.length} games in CSV. inserting...`);

    let count = 0;
    const batchSize = 100;

    // Process in batches
    for (let i = 0; i < games.length; i += batchSize) {
        const batch = games.slice(i, i + batchSize);

        await Promise.all(batch.map(async (row) => {
            try {
                // Map CSV fields to Prisma model
                // CSV Header: provider,game_name,Game Tag,Game Sub Type,sub_category,casinoGameId,game_id,description,logo_round,logo_square,banner
                // Model: provider, game_name, game_tag, game_sub_type, sub_category, casinoGameId, game_id, description, logo_round, logo_square, banner

                const gameIdInt = parseInt(row['game_id'] || '0');

                // Use upsert to avoid duplicates if running multiple times
                // Assuming casinoGameId is unique enough? Or just create?
                // The schema doesn't verify unique on casinoGameId for 'Casino' model (only for CasinoGame model).
                // But let's check duplicates by casinoGameId + provider

                /*
                const existing = await prisma.casino.findFirst({
                    where: {
                        casinoGameId: row['casinoGameId'],
                        provider: row['provider']
                    }
                });

                if (existing) {
                    // Update?
                     await prisma.casino.update({
                        where: { id: existing.id },
                        data: {
                            game_name: row['game_name'],
                            game_tag: row['Game Tag'],
                            game_sub_type: row['Game Sub Type'],
                            sub_category: row['sub_category'],
                            description: row['description'],
                            logo_round: row['logo_round'],
                            logo_square: row['logo_square'],
                            banner: row['banner'],
                            game_id: gameIdInt
                        }
                     });
                } else {
                */
                await prisma.casino.create({
                    data: {
                        provider: row['provider'],
                        game_name: row['game_name'],
                        game_tag: row['Game Tag'],
                        game_sub_type: row['Game Sub Type'],
                        sub_category: row['sub_category'],
                        casinoGameId: row['casinoGameId'],
                        game_id: gameIdInt,
                        description: row['description'],
                        logo_round: row['logo_round'],
                        logo_square: row['logo_square'],
                        banner: row['banner'],
                        popularity: 0
                    }
                });
                /* } */

            } catch (err) {
                console.error(`Error processing game ${row['game_name']}:`, err);
            }
        }));

        count += batch.length;
        if (count % 500 === 0) {
            console.log(`Processed ${count} games...`);
        }
    }

    console.log(`Creating/Updating completed. Total processed: ${count}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
