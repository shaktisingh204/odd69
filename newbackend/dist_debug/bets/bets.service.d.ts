import { PrismaService } from '../prisma.service';
export declare class BetsService {
    private prisma;
    constructor(prisma: PrismaService);
    placeBet(userId: number, betData: any): Promise<{
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
    getUserBets(userId: number): Promise<{
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
