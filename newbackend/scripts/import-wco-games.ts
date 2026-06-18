import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

async function importWcoGames() {
    const csvFilePath = path.join(__dirname, '../../WCO - Games List(Games List).csv');

    if (!fs.existsSync(csvFilePath)) {
        console.error(`File not found: ${csvFilePath}`);
        return;
    }

    console.log(`Reading CSV file: ${csvFilePath}`);
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');

    // Parse CSV
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });

    console.log(`Found ${records.length} records. Processing...`);

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const rawRecord of records) {
        const record = rawRecord as any;
        try {
            // Map CSV fields to DB fields
            // provider,game_name,Game Tag,Game Sub Type,sub_category,casinoGameId,game_id,description,logo_round,logo_square,banner

            const gameId = parseInt(record.game_id);
            const casinoGameId = record.casinoGameId;

            if (!gameId && !casinoGameId) {
                console.warn('Skipping record with no ID:', record);
                continue;
            }

            // Find existing record by game_id first, then casinoGameId
            let existing = null;
            if (gameId) {
                existing = await prisma.casino.findFirst({ where: { game_id: gameId } });
            }
            if (!existing && casinoGameId) {
                existing = await prisma.casino.findFirst({ where: { casinoGameId: casinoGameId } });
            }

            const data = {
                game_id: gameId || undefined,
                game_name: record.game_name,
                casinoGameId: casinoGameId,
                provider: record.provider,
                sub_category: record.sub_category,
                description: record.description === 'Deactive' ? null : record.description, // Handle 'Deactive' as null or keep string?
                // logic: if description says 'Deactive', maybe we should mark it? 
                // But schema has no isActive. Let's just store checks.
                logo_round: record.logo_round,
                logo_square: record.logo_square,
                banner: record.banner,
                game_tag: record['Game Tag'],
                game_sub_type: record['Game Sub Type']
            };

            if (existing) {
                await prisma.casino.update({
                    where: { id: existing.id },
                    data: data
                });
                updated++;
            } else {
                await prisma.casino.create({
                    data: data
                });
                created++;
            }

        } catch (error) {
            console.error(`Error processing record:`, record, error.message);
            errors++;
        }
    }

    console.log(`Import completed.`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
}

importWcoGames()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
