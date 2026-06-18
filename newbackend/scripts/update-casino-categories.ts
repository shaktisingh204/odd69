import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

async function updateCasinoCategories() {
    const csvPath = path.join(__dirname, '../../WCO - Games List(Games List).csv');
    console.log(`Reading CSV file from ${csvPath}`);

    if (!fs.existsSync(csvPath)) {
        console.error('CSV file not found!');
        return;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        from_line: 2
    });

    console.log(`Found ${records.length} records in CSV.`);

    // Fetch all games from DB to minimize queries
    const allGames = await prisma.casino.findMany();
    console.log(`Fetched ${allGames.length} games from database.`);

    if (allGames.length > 0) {
        console.log('Sample DB Game:', allGames[0]);
    }
    if (records.length > 0) {
        console.log('Sample CSV Record:', records[0]);
    }

    let updatedCount = 0;
    let debugMatchCount = 0;

    for (const record of records) {
        const csvGameName = record['Game Name'];
        const csvCategory = record['Game Category'];

        if (!csvGameName || !csvCategory) continue;

        // Find matches in DB
        // Validation: matches with name having at least 2 words matching with game name in csv file

        const matches = allGames.filter(game => {
            if (!game.game_name) return false;
            const matched = isMatch(csvGameName, game.game_name);
            if (matched && debugMatchCount < 5) {
                console.log(`Match found: CSV "${csvGameName}" <-> DB "${game.game_name}"`);
                debugMatchCount++;
            }
            return matched;
        });

        if (matches.length > 0) {
            // Update all matches
            for (const match of matches) {
                // Check if update is needed
                if (match.sub_category !== csvCategory) {
                    await prisma.casino.update({
                        where: { id: match.id },
                        data: { sub_category: csvCategory }
                    });
                    updatedCount++;
                    if (updatedCount % 100 === 0) process.stdout.write('.');
                }
            }
        }
    }

    console.log(`\nUpdated ${updatedCount} casino records.`);
}

function isMatch(csvName: string, dbName: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 1);

    const csvWords = normalize(csvName);
    const dbWords = normalize(dbName);

    if (csvWords.length === 0 || dbWords.length === 0) return false;

    let matchCount = 0;
    for (const word of csvWords) {
        if (dbWords.includes(word)) {
            matchCount++;
        }
    }

    // Debugging specific cases if needed
    // if (csvName.includes("SomeGame") && dbName.includes("SomeGame")) console.log(csvName, dbName, matchCount);

    return matchCount >= 2;
}

updateCasinoCategories()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
