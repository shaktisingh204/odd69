
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SportsService } from '../sports/sports.service';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Event } from '../sports/schemas/event.schema';
import { Market } from '../sports/schemas/market.schema';
import { Model } from 'mongoose';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const sportsService = app.get(SportsService);
    const eventModel = app.get<Model<Event>>(getModelToken(Event.name));
    const marketModel = app.get<Model<Market>>(getModelToken(Market.name));
    const logger = new Logger('VerifyMatchDetails');

    let matchId = process.argv[2];

    if (!matchId) {
        logger.log('No match ID provided. Searching for ANY match with markets in DB...');

        // Find a market first, then get its event
        const market = await marketModel.findOne({});
        if (market) {
            matchId = market.event_id;
            logger.log(`Found market ${market.market_name} linked to match ID: ${matchId}`);
        } else {
            logger.error('No markets found in DB at all.');
            return;
        }
    }

    try {
        logger.log(`Fetching details for match ${matchId}...`);
        const details = await sportsService.getMatchDetails(matchId);

        if (!details) {
            logger.error('Match not found');
            return;
        }

        logger.log(`Match: ${details.event_name}`);
        logger.log(`Markets found: ${details.markets?.length || 0}`);

        if (details.markets) {
            details.markets.forEach((m: any) => {
                logger.log(`- Market: ${m.market_name} (ID: ${m.market_id})`);
                logger.log(`  Odds: ${JSON.stringify(m.marketOdds)}`);
                if (m.marketOdds && m.marketOdds.length > 0) {
                    logger.log(`  [SUCCESS] Odds found for market ${m.market_name}`);
                } else {
                    logger.log(`  [WARNING] No odds found for market ${m.market_name}`);
                }
            });
        }

    } catch (error) {
        logger.error('Error:', error);
    } finally {
        await app.close();
        process.exit(0);
    }
}

bootstrap();
