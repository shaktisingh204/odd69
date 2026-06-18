import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importCasinos() {
    const sqlPath = path.join(__dirname, '../../wazirx.sql');
    console.log(`Reading SQL file from ${sqlPath}`);

    if (!fs.existsSync(sqlPath)) {
        console.error('SQL file not found!');
        return;
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    // Extract INSERT INTO `casinos` ... statements
    const insertRegex = /INSERT INTO `casinos` VALUES (.*?);/g;
    let match;
    let count = 0;

    console.log('Parsing SQL content...');

    while ((match = insertRegex.exec(sqlContent)) !== null) {
        const valuesPart = match[1];
        const rows = valuesPart.split('),(');

        for (const row of rows) {
            let cleanRow = row;
            if (cleanRow.startsWith('(')) cleanRow = cleanRow.substring(1);
            if (cleanRow.endsWith(')')) cleanRow = cleanRow.substring(0, cleanRow.length - 1);

            const values = parseSqlValues(cleanRow);

            if (values.length < 11) {
                continue;
            }

            const [
                idStr,
                gameIdStr,
                gameName,
                casinoGameId,
                provider,
                subCategory,
                description,
                logoRound,
                logoSquare,
                banner,
                pid
            ] = values;

            const id = idStr === 'NULL' || idStr === null ? undefined : parseInt(idStr) || undefined;
            const gameId = parseInt(gameIdStr) || null;

            try {
                let existing = null;
                if (casinoGameId) {
                    existing = await prisma.casino.findFirst({
                        where: { casinoGameId: casinoGameId }
                    });
                }

                const data = {
                    game_id: gameId,
                    game_name: gameName,
                    casinoGameId: casinoGameId,
                    provider: provider,
                    sub_category: subCategory,
                    description: description,
                    logo_round: logoRound,
                    logo_square: logoSquare,
                    banner: banner,
                    pid: pid,
                };

                if (existing) {
                    await prisma.casino.update({
                        where: { id: existing.id },
                        data: data
                    });
                } else {
                    await prisma.casino.create({
                        data: {
                            ...data,
                            ...(id ? { id } : {})
                        }
                    });
                }

                count++;
                if (count % 100 === 0) process.stdout.write('.');
            } catch (e) {
                console.error(`Error importing row ${gameName}:`, e);
            }
        }
    }

    console.log(`\nImported ${count} casino records.`);
}

function parseSqlValues(row: string): string[] {
    const values: string[] = [];
    let currentVal = '';
    let inQuote = false;
    let escape = false;

    for (let i = 0; i < row.length; i++) {
        const char = row[i];

        if (escape) {
            currentVal += char;
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === "'" && !escape) {
            inQuote = !inQuote;
            continue;
        }

        if (char === ',' && !inQuote) {
            values.push(cleanValue(currentVal));
            currentVal = '';
            continue;
        }

        currentVal += char;
    }
    values.push(cleanValue(currentVal));
    return values;
}

function cleanValue(val: string): string | null {
    val = val.trim();
    if (val === 'NULL') return null;
    return val;
}

importCasinos()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
