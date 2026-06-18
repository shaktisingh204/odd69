
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SportsService } from '../sports/sports.service';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Competition } from '../sports/schemas/competition.schema';

async function bootstrap() {
    console.log('Initializing NestJS context...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const sportsService = app.get(SportsService);
    const connection = app.get(getConnectionToken()) as Connection;
    const competitionModel = connection.model(Competition.name);

    console.log('Triggering SyncAll via SportsService...');
    try {
        await sportsService.syncAll();
        console.log('SyncAll initiated/completed (check logs).');
    } catch (e) {
        console.error('SyncAll failed:', e);
    }

    // Wait a bit just in case async operations are lingering if syncAll returns early
    console.log('Waiting 10s for DB operations...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const count = await competitionModel.countDocuments();
    console.log(`Competition Count in DB: ${count}`);

    if (count > 0) {
        const sample = await competitionModel.findOne().lean();
        console.log('Sample Competition:', sample);
    } else {
        console.warn('DB is still empty!');
    }

    await app.close();
    process.exit(0);
}

bootstrap();
