const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Mongoose Sub-Schema for CasinoGame (Only what we need to query)
const casinoGameSchema = new mongoose.Schema({
    gameCode: String,
    name: String,
    provider: String,
    icon: String,
    isActive: Boolean
}, { collection: 'casinogames' });

const CasinoGame = mongoose.model('CasinoGame', casinoGameSchema);

async function generateMissingImagesCSV() {
    console.log('Connecting to MongoDB...');
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/adxwins';

    try {
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        console.log('Querying for games without images...');
        const gamesWithoutImages = await CasinoGame.find({
            isActive: true, // Optional: Only check active games
            $or: [
                { icon: { $exists: false } },
                { icon: null },
                { icon: "" }
            ]
        }).select('name provider').lean().exec();

        console.log(`Found ${gamesWithoutImages.length} games without an image URL.`);

        if (gamesWithoutImages.length > 0) {
            const csvFilePath = path.join(__dirname, 'missing-images.csv');

            // CSV Header
            let csvContent = "Name,Provider\n";

            gamesWithoutImages.forEach(game => {
                // Escape quotes and commas in names
                const name = game.name ? `"${game.name.replace(/"/g, '""')}"` : 'Unknown';
                const provider = game.provider ? `"${game.provider.replace(/"/g, '""')}"` : 'Unknown';

                csvContent += `${name},${provider}\n`;
            });

            fs.writeFileSync(csvFilePath, csvContent, 'utf8');
            console.log(`\n✅ CSV successfully generated at: ${csvFilePath}`);
        } else {
            console.log('\n🎉 No missing images found! Your database is fully covered.');
        }

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

generateMissingImagesCSV();
