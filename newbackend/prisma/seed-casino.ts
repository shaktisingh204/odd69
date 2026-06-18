import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

async function main() {
    const csvPath = path.resolve(__dirname, '../../WCO - Games List(Games List).csv');
    console.log(`Reading CSV from: ${csvPath}`);

    if (!fs.existsSync(csvPath)) {
        console.error('CSV file not found!');
        process.exit(1);
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');

    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
    });

    console.log(`Found ${records.length} records. Processing...`);

    let successCount = 0;
    let errorCount = 0;

    if (records.length > 0) {
        console.log('First record keys:', Object.keys(records[0] as object));
        console.log('First record:', records[0]);
    }

    for (let i = 0; i < records.length; i++) {
        const row = records[i] as any;

        // Map columns based on ACTUAL CSV header:
        // provider,game_name,Game Tag,Game Sub Type,sub_category,casinoGameId,game_id,description,logo_round,logo_square,banner
        const provider = row['provider'];
        const domain = ''; // Not in CSV
        const name = row['game_name'];
        const type = row['Game Tag'];
        const subType = row['Game Sub Type'];
        const category = row['sub_category'];
        const rtp = ''; // Not in CSV
        const gameCode = row['casinoGameId'];
        const gameId = row['game_id'];
        const remarks = row['description'];

        if (!gameCode || !name) {
            // console.warn(`Skipping row ${i + 1} due to missing gameCode or name`, row);
            continue;
        }

        const isActive = remarks?.toLowerCase() !== 'deactive';

        try {
            await prisma.casinoGame.upsert({
                where: { gameCode },
                update: {
                    provider,
                    domain,
                    name,
                    type,
                    subType,
                    category,
                    rtp,
                    gameId,
                    remarks,
                    isActive
                },
                create: {
                    provider,
                    domain,
                    name,
                    type,
                    subType,
                    category,
                    rtp,
                    gameCode,
                    gameId,
                    remarks,
                    isActive
                }
            });
            successCount++;
        } catch (e) {
            console.error(`Error processing row ${i + 1} (${gameCode}):`, e);
            errorCount++;
        }

        if (i % 100 === 0) {
            process.stdout.write(`Processed ${i} records...\r`);
        }
    }

    console.log(`\nFinished seeding. Success: ${successCount}, Errors: ${errorCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
