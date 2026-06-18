import { BetsService } from './bets.service';
export declare class BetsController {
    private readonly betsService;
    constructor(betsService: BetsService);
    placeBet(req: any, betData: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        eventId: string;
        eventName: string;
        marketId: string;
        marketName: string;
        selectionId: string;
        selectionName: string;
        odds: number;
        stake: number;
        potentialWin: number;
        userId: number;
    }>;
    getMyBets(req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        eventId: string;
        eventName: string;
        marketId: string;
        marketName: string;
        selectionId: string;
        selectionName: string;
        odds: number;
        stake: number;
        potentialWin: number;
        userId: number;
    }[]>;
}
