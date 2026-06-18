import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma.service';
export declare class CasinoService {
    private usersService;
    private prisma;
    private readonly CASINO_AUTH_URL;
    private readonly CASINO_API_URL;
    private readonly PARTNER_KEY_LKR;
    private readonly PARTNER_KEY_INR;
    private readonly LKR_PROVIDERS;
    private readonly INR_PROVIDERS;
    constructor(usersService: UsersService, prisma: PrismaService);
    expandCategorySearch(category: string): any;
    getProvidersHub(category?: string): Promise<{
        id: number;
        name: string;
        provider: string;
        count: number;
    }[]>;
    getGamesByProviderHub(provider: string, category?: string, search?: string): Promise<{
        id: number;
        gameCode: string;
        gameName: string;
        providerCode: string;
        gameType: string | null;
        banner: string;
    }[]>;
    getCategoriesHub(): Promise<{
        id: string;
        name: string;
        count: number;
        originalNames: string[];
    }[]>;
    getGameUrlHub(username: string, provider: string, gameId: string, isLobby?: boolean): Promise<{
        url: any;
    }>;
    igtechCallbackHub(endpoint: string, body: any): Promise<{
        partnerKey: string;
        timestamp: string;
        userId: string;
        balance: number;
        status: {
            code: string;
            message: string;
        };
    }>;
    private generateResponse;
}
