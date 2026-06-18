import mongoose from 'mongoose';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const AGENCY_UID = 'ab72cfab44395f7063c6f0c0f05b2325';
const BASE_URL = 'https://huidu.bet';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/adxwins';

const providerSchema = new mongoose.Schema({
    code: String,
    name: String,
    isActive: Boolean,
    priority: { type: Number, default: 0 },
    image: { type: String, default: '' }
}, { strict: false });

const gameSchema = new mongoose.Schema({
    gameCode: String,
    provider: String,
    name: String,
    type: String,
    category: String,
    isActive: Boolean,
    playCount: { type: Number, default: 0 },
    priority: { type: Number, default: 0 },
    isPopular: { type: Boolean, default: false },
    isNewGame: { type: Boolean, default: true }
}, { strict: false });

async function sync() {
    console.log('Connecting to', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    const ProviderModel = mongoose.model('CasinoProvider', providerSchema);
    const GameModel = mongoose.model('CasinoGame', gameSchema);

    console.log('Wiping DB...');
    await ProviderModel.deleteMany({});
    await GameModel.deleteMany({});
    console.log('DB Wiped.');

    console.log('Fetching HUIDU Providers...');
    const pRes = await axios.get(`${BASE_URL}/game/providers?agency_uid=${AGENCY_UID}`);
    const providers = pRes.data.data;

    if (providers) {
        let pDocs = providers.map((p: any) => ({
            updateOne: {
                filter: { code: p.code },
                update: {
                    $set: {
                        name: p.name || p.code,
                        isActive: p.status === 1
                    },
                    $setOnInsert: { priority: 0, image: '' }
                },
                upsert: true
            }
        }));
        if (pDocs.length > 0) await ProviderModel.bulkWrite(pDocs);
        console.log(`Synced ${pDocs.length} Providers.`);

        let totalGames = 0;
        for (const p of providers) {
            if (p.status !== 1) continue;

            const gRes = await axios.get(`${BASE_URL}/game/list?agency_uid=${AGENCY_UID}&code=${p.code}`);
            const games = gRes.data.data;
            if (!games) continue;

            let gDocs = games.map((g: any) => ({
                updateOne: {
                    filter: { gameCode: g.game_uid, provider: p.code },
                    update: {
                        $set: {
                            name: g.game_name || g.game_uid,
                            type: g.game_type || 'slot',
                            isActive: g.status === 1
                        },
                        $setOnInsert: {
                            category: g.game_type || 'slots',
                            playCount: 0,
                            priority: 0,
                            isPopular: false,
                            isNewGame: true
                        }
                    },
                    upsert: true
                }
            }));

            if (gDocs.length > 0) {
                await GameModel.bulkWrite(gDocs);
                totalGames += gDocs.length;
            }
        }
        console.log(`Synced ${totalGames} Games.`);
    }

    await mongoose.disconnect();
}

sync().catch(console.error);
