"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
const prisma = new client_1.PrismaClient();
async function main() {
    const csvPath = path.resolve(__dirname, '../../WCO - Games List(Games List).csv');
    console.log(`Reading CSV from: ${csvPath}`);
    if (!fs.existsSync(csvPath)) {
        console.error('CSV file not found!');
        process.exit(1);
    }
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = (0, sync_1.parse)(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        from_line: 2
    });
    console.log(`Found ${records.length} records. Processing...`);
    let successCount = 0;
    let errorCount = 0;
    if (records.length > 0) {
        console.log('First record keys:', Object.keys(records[0]));
        console.log('First record:', records[0]);
    }
    for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const provider = row['Provider'];
        const domain = row['Domain'];
        const name = row['Game Name'];
        const type = row['Game Type'];
        const subType = row['Game Sub Type'];
        const category = row['Game Category'];
        const rtp = row['RTP'];
        const gameCode = row['Game Code'];
        const gameId = row['Game ID'];
        const remarks = row['Remarks (if any)'];
        if (!gameCode || !name) {
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
        }
        catch (e) {
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
//# sourceMappingURL=seed-casino.js.map