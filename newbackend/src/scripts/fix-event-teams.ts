
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SportsService } from '../sports/sports.service';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Event } from '../sports/schemas/event.schema';

async function bootstrap() {
    console.log('Initializing NestJS context...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const connection = app.get(getConnectionToken()) as Connection;
    const eventModel = connection.model(Event.name);

    console.log('Fetching events without separate team fields...');
    const events = await eventModel.find({
        $or: [
            { home_team: { $exists: false } },
            { away_team: { $exists: false } }
        ]
    });

    console.log(`Found ${events.length} events to process.`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const event of events) {
        try {
            const e = event as any;
            const name = e.event_name;
            if (name && name.includes(' v ')) {
                const parts = name.split(' v ');
                if (parts.length >= 2) {
                    const home = parts[0].trim();
                    const away = parts[1].trim();

                    await eventModel.updateOne(
                        { _id: e._id },
                        { $set: { home_team: home, away_team: away } }
                    );
                    updatedCount++;
                    if (updatedCount % 100 === 0) console.log(`Updated ${updatedCount} events...`);
                }
            } else {
                // console.warn(`Skipping event with invalid name format: ${name}`);
            }
        } catch (e) {
            console.error(`Error updating event ${(event as any).event_id}:`, e);
            errorCount++;
        }
    }

    console.log(`\nFinished.`);
    console.log(`Successfully Updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);

    await app.close();
    process.exit(0);
}

bootstrap();
