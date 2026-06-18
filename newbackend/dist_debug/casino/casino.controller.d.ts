import { CasinoService } from './casino.service';
export declare class CasinoController {
    private readonly casinoService;
    constructor(casinoService: CasinoService);
    getCategories(): Promise<{
        id: string;
        name: string;
        count: number;
        originalNames: string[];
    }[]>;
    getProviders(category?: string): Promise<{
        id: number;
        name: string;
        provider: string;
        count: number;
    }[]>;
    getGames(provider: string, category: string, search: string): Promise<{
        id: number;
        gameCode: string;
        gameName: string;
        providerCode: string;
        gameType: string | null;
        banner: string;
    }[]>;
    launchGame(body: {
        username: string;
        provider: string;
        gameId: string;
        isLobby?: boolean;
    }): Promise<{
        url: any;
    }>;
    igtechWebhook(endpoint: string, body: any): Promise<{
        partnerKey: string;
        timestamp: string;
        userId: string;
        balance: number;
        status: {
            code: string;
            message: string;
        };
    }>;
}
