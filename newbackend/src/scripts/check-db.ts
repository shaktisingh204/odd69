import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/adxwins';

const CompetitionSchema = new mongoose.Schema({}, { strict: false, collection: 'competitions' });
const Competition = mongoose.model('Competition', CompetitionSchema);

const EventSchema = new mongoose.Schema({}, { strict: false, collection: 'events' });
const Event = mongoose.model('Event', EventSchema);

const SportSchema = new mongoose.Schema({}, { strict: false, collection: 'sports' });
const Sport = mongoose.model('Sport', SportSchema);

async function check() {
    console.log(`Connecting to ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    // 1. Sports Count
    const totalSports = await Sport.countDocuments();
    console.log(`\n--- Sports ---`);
    console.log(`Total: ${totalSports}`);

    // 2. Events Analysis
    const totalEvents = await Event.countDocuments();
    console.log(`\n--- Events ---`);
    console.log(`Total: ${totalEvents}`);

    if (totalEvents > 0) {
        // Pick a future event
        const futureEvent = await Event.findOne({ open_date: { $gte: new Date().toISOString() } }).lean() as any;

        if (futureEvent) {
            console.log('\n--- Sample Future Event ---');
            console.log(`Event Name: ${futureEvent.event_name}`);
            console.log(`Home Team: ${futureEvent.home_team}`);
            console.log(`Away Team: ${futureEvent.away_team}`);
            console.log(`Event ID: ${futureEvent.event_id}`);
            console.log(`Competition ID: ${futureEvent.competition_id}`);
            console.log(`Open Date: ${futureEvent.open_date} (Type: ${typeof futureEvent.open_date})`);

            // Check if this competition exists
            const comp = await Competition.findOne({ competition_id: futureEvent.competition_id }).lean() as any;
            if (comp) {
                console.log(`\n[SUCCESS] Found Linked Competition: ${comp.competition_name}`);
                console.log(`Sport ID: ${comp.sport_id}`);
                console.log(`Country: ${comp.country_code}`);

                // Check if Sport exists
                const sport = await Sport.findOne({ sport_id: comp.sport_id }).lean() as any;
                if (sport) {
                    console.log(`[SUCCESS] Found Linked Sport: ${sport.sport_name}`);
                } else {
                    console.log(`[FAIL] Sport ID ${comp.sport_id} NOT FOUND in Sports collection.`);
                }

            } else {
                console.log(`\n[FAIL] Competition ID ${futureEvent.competition_id} NOT FOUND in Competitions collection.`);
            }
        } else {
            console.log('No future events found specifically (despite count saying otherwise?)');
        }
    }

    await mongoose.disconnect();
}

check().catch(console.error);
