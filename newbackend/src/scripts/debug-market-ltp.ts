
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SportsService } from '../sports/sports.service';
import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const sportsService = app.get(SportsService);
    const httpService = app.get(HttpService);
    const logger = new Logger('DebugMarketLTP');

    try {
        logger.log('Authenticating...');
        // Access private method via any or public wrapper if exists (it doesn't, but authenticate is public in the class I saw earlier... wait, let me check)
        // In the outline, authenticate was private? No, line 118: `private authenticate`... wait.
        // Let's check line 118 of sports.service.ts again.

        // If authenticate is private, I can't call it. But `importExchangeMarkets` is public.
        // I can try to find a valid match ID and call importExchangeMarkets, but that saves to DB. 
        // I want to see the RAW response.

        // Actually, looking at the previous specific view of sports.service.ts (lines 272+), I didn't see authenticate's access modifier clearly but in the outline it says `SportsService.authenticate`.
        // Let's assume I can use `bind` or just cast to any.


        const token = await (sportsService as any).authenticate();
        logger.log(`Token: Acquired`);

        if (!token) return;

        // 1. Get Sports from API manually to ensure we have a valid sport ID
        const apiUrl = process.env.MYZOSH_API_URL || "https://staging.myzosh.com/api";

        // Try getting cricket matches (sport_id 4 usually)
        let sportId = '4';

        // Get Tournaments
        logger.log(`Fetching tournaments for sport ${sportId}...`);
        const tournRes: any = await sportsService.getTournamentsFromApi(token, sportId);

        if (!tournRes?.data || tournRes.data.length === 0) {
            logger.error('No tournaments found.');
            return;
        }

        // Pick a tournament that looks active (has market count)
        const tour = tournRes.data.find((t: any) => t.market_count > 0) || tournRes.data[0];
        const tournamentId = tour.tournament_id;
        logger.log(`Selected Tournament: ${tour.tournament_name} (${tournamentId})`);

        // Get Matches
        logger.log(`Fetching matches for tournament ${tournamentId}...`);
        const matchesRes = await sportsService.getMatchesFromApi(token, sportId, tournamentId);

        if (!matchesRes?.data || matchesRes.data.length === 0) {
            logger.error('No matches found.');
            return;
        }

        const match = matchesRes.data[0];
        const matchId = match.match_id;
        logger.log(`Selected Match: ${match.match_name} (${matchId})`);

        // Get Markets
        const payload = {
            access_token: token,
            sport_id: sportId,
            tournament_id: tournamentId,
            match_id: matchId
        };

        const { data } = await firstValueFrom(
            httpService.post(`${apiUrl}/get_exch_markets`, payload)
        );

        logger.log('--- RAW MARKET DATA ---');
        logger.log(JSON.stringify(data, null, 2));
        logger.log('-----------------------');

    } catch (error) {
        logger.error('Error:', error);
    } finally {
        await app.close();
        process.exit(0);
    }
}

bootstrap();
