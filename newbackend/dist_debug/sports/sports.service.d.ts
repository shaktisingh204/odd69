import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
export declare class SportsService {
    private readonly httpService;
    private readonly prisma;
    private readonly logger;
    private readonly API_URL;
    constructor(httpService: HttpService, prisma: PrismaService);
    syncCompetitions(): Promise<void>;
    syncEvents(): Promise<void>;
    getCompetitions(): Promise<({
        events: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            competition_id: string;
            event_id: string;
            event_name: string;
            open_date: Date;
            timezone: string | null;
            score1: string | null;
            score2: string | null;
            match_info: string | null;
            match_status: string | null;
            home_team: string | null;
            away_team: string | null;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        competition_id: string;
        competition_name: string;
        sport_id: number | null;
    })[]>;
    getEvents(sportId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        competition_id: string;
        event_id: string;
        event_name: string;
        open_date: Date;
        timezone: string | null;
        score1: string | null;
        score2: string | null;
        match_info: string | null;
        match_status: string | null;
        home_team: string | null;
        away_team: string | null;
    }[]>;
    getLiveEvents(): Promise<({
        markets: ({
            marketOdds: {
                id: number;
                updatedAt: Date;
                event_id: string;
                event_name: string | null;
                market_id: string;
                runner1: string | null;
                runner2: string | null;
                status: string | null;
                inplay: boolean | null;
                back0_price: number | null;
                back0_size: number | null;
                lay0_price: number | null;
                lay0_size: number | null;
                back1_price: number | null;
                back1_size: number | null;
                lay1_price: number | null;
                lay1_size: number | null;
                back2_price: number | null;
                back2_size: number | null;
                lay2_price: number | null;
                lay2_size: number | null;
            }[];
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            event_id: string;
            event_name: string | null;
            market_id: string;
            market_name: string;
            runner1: string | null;
            runner2: string | null;
            draw: string | null;
            start_time: Date | null;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        competition_id: string;
        event_id: string;
        event_name: string;
        open_date: Date;
        timezone: string | null;
        score1: string | null;
        score2: string | null;
        match_info: string | null;
        match_status: string | null;
        home_team: string | null;
        away_team: string | null;
    })[]>;
}
