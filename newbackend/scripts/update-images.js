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
const readline = __importStar(require("readline"));
const prisma = new client_1.PrismaClient();
async function updateImages() {
    const filePath = '/Users/harshkhandelwal/Documents/100xwins/wazirx.sql';
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    let count = 0;
    for await (const line of rl) {
        if (line.includes('INSERT INTO `casinos`')) {
            const valuesPart = line.substring(line.indexOf('VALUES') + 6).trim();
            const cleanValues = valuesPart.replace(/;$/, '');
            const tupleRegex = /\(\s*NULL\s*,\s*\d+\s*,\s*'(?:[^']|'')*'\s*,\s*'((?:[^']|'')*)'\s*,\s*'(?:[^']|'')*'\s*,\s*'(?:[^']|'')*'\s*,\s*'(?:[^']|'')*'\s*,\s*NULL\s*,\s*'((?:[^']|'')*)'/g;
            let match;
            while ((match = tupleRegex.exec(line)) !== null) {
                const gameCode = match[1];
                const image = match[2];
                if (gameCode && image) {
                    try {
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
                            if (count % 100 === 0)
                                console.log(`Updated ${count} images...`);
                        }
                    }
                    catch (e) {
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
//# sourceMappingURL=update-images.js.map