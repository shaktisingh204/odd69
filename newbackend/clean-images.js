require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const CasinoGame = mongoose.connection.collection('casinogames');
    const games = await CasinoGame.find({ isActive: true }).toArray();
    console.log(`Found ${games.length} active games`);

    let updated = 0;
    const batchSize = 100;

    for (let i = 0; i < games.length; i += batchSize) {
        const batch = games.slice(i, i + batchSize);
        await Promise.all(batch.map(async (g) => {
            const url = `https://odd69.com/game-images/${encodeURIComponent(g.icon)}.png`;
            try {
                await axios.head(url, { timeout: 5000 });
            } catch (err) {
                if (err.response && err.response.status === 404) {
                    await CasinoGame.updateOne({ _id: g._id }, { $set: { isActive: false } });
                    updated++;
                }
            }
        }));
        console.log(`Processed ${i + batch.length} / ${games.length}...`);
    }

    console.log(`Disabled ${updated} games missing images. Done.`);
    process.exit(0);
}

run();
