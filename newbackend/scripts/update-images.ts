
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function updateImages() {
    const filePath = '/Users/harshkhandelwal/Documents/100xwins/wazirx.sql';
    const fileStream = fs.createReadStream(filePath);

    // Pattern to capture (gameCode) and (image). 
    // SQL: INSERT INTO `casinos` VALUES (NULL, 2,' Aladdin and the Sorcerer', 'vsaladdinsorc', 'PP', 'Slots', 'Pragmatic Play' ,NULL, 'http://files...
    // Adjust regex based on observed structure.
    // Assuming standard MySQL dump format: VALUES (...), (...);
    // Since lines can be long, we might process chunks. But let's assume one line per INSERT or multiple inserts in one line.

    // Regex explanation:
    // \(\s*NULL\s*,\s*\d+\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*NULL\s*,\s*'((?:[^']|'')*)'
    // Group 2: GameCode
    // Group 6: Image

    // However, regex on huge strings is slow/dangerous. Maybe simple split by '),(' is safer if we isolate the VALUES part.

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;

    for await (const line of rl) {
        if (line.includes('INSERT INTO `casinos`')) {
            // Extract the part after VALUES
            const valuesPart = line.substring(line.indexOf('VALUES') + 6).trim();
            // Remove trailing semicolon if present
            const cleanValues = valuesPart.replace(/;$/, '');

            // Split by '),(' carefully?
            // Since we know the structure, let's try a global regex match on the line.
            // Note: Data might contain , inside strings. Regex handles this if strings use '...' and escape ' as ''.

            // Refined Regex to capture just the GameCode and Image
            // We ignore other fields with .*? but be careful.

            // Try to match the whole tuple structure:
            // (NULL, \d+, 'Name', 'GameCod', 'ProvCod', 'Cat', 'ProvName', NULL, 'Image')
            const tupleRegex = /\(\s*NULL\s*,\s*\d+\s*,\s*'(?:[^']|'')*'\s*,\s*'((?:[^']|'')*)'\s*,\s*'(?:[^']|'')*'\s*,\s*'(?:[^']|'')*'\s*,\s*'(?:[^']|'')*'\s*,\s*NULL\s*,\s*'((?:[^']|'')*)'/g;

            let match;
            while ((match = tupleRegex.exec(line)) !== null) {
                const gameCode = match[1];
                const image = match[2];

                if (gameCode && image) {
                    try {
                        // Check if exists first to avoid unnecessary failures? 
                        // Or just updateMany to be safe (though unique constraint exists).
                        // update causes error if not found? No, update requires unique selector.

                        // We use upsert or update. Since we only want to update existing, use update.
                        // But if records don't exist, we skip.
                        // Standard Prisma update throws if not found. updateMany does not.

                        const result = await prisma.casinoGame.updateMany({
                            where: {
                                gameCode: gameCode
                            },
                            data: {
                                image: image
                            }
                        });

                        if (result.count > 0) {
                            count++;
                            if (count % 100 === 0) console.log(`Updated ${count} images...`);
                        }
                    } catch (e) {
                        // Ignore errors (e.g. record not found)
                        // console.error(`Error updating ${gameCode}:`, e.message);
                    }
                }
            }
        }
    }

    console.log(`Finished updating ${count} images.`);
}

updateImages()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
