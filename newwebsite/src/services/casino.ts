import api from './api';

export interface CasinoGame {
    id: string;
    gameName: string;
    provider: string; // provider code
    providerSlug?: string; // mapped slug for images
    gameType: string;
    description: string;
    image?: string;
    status: boolean;
    // Add other fields as needed for the UI
    [key: string]: any;
}

export interface LaunchResponse {
    url: string;
}

export const casinoService = {
    getCategories: async (type?: 'live' | 'casino') => {
        const response = await api.get('/casino/categories', {
            params: { type }
        });
        return response.data;
    },

    getProviders: async (category?: string) => {
        const response = await api.get('/casino/providers-list', {
            params: { category }
        });
        const providers = response.data || [];
        return providers.filter((p: any) =>
            p.provider?.toLowerCase() !== 'igtech' &&
            p.name?.toLowerCase() !== 'igtech'
        );
    },

    getGames: async (provider?: string, category?: string, search?: string, page: number = 1, limit: number = 40, type?: string) => {
        // Backend returns: { games: [], total_pages: number, total_count: number }
        const response = await api.get('/casino/games', {
            params: { provider, category, search, page, limit, type } // Pass limit 40 default
        });
        const games = response.data.games || [];

        // Map backend snake_case fields to frontend expected format and filter out igtech
        const mappedGames = games
            .filter((g: any) =>
                g.provider?.toLowerCase() !== 'igtech' &&
                g.providerCode?.toLowerCase() !== 'igtech'
            )
            .map((g: any) => ({
                ...g,
                id: g.id,
                gameCode: g.gameCode || g.gameId || g.casinoGameId,
                gameName: g.gameName || g.name || g.game_name || "Unknown Game",
                name: g.gameName || g.name || g.game_name || "Unknown Game",
                provider: g.provider || g.providerCode,
                providerCode: g.providerCode || g.provider,
                providerSlug: g.providerSlug,
                banner: g.banner || g.image || g.logo_square || g.logo_round,
                image: g.banner || g.image || g.logo_square || g.logo_round,
                category: g.category || g.sub_category || g.gameType,
            }));

        return {
            games: mappedGames,
            totalPages: response.data.total_pages || response.data.totalPages || 1,
            totalCount: mappedGames.length // Could adjust totalCount, but usually pagination handles it
        };
    },

    launchGame: async (payload: { username?: string; provider: string; gameId: string; isLobby?: boolean; walletMode?: string }) => {
        const response = await api.post(`/casino/launch`, payload);
        return response.data;
    },

    getMyBets: async (limit: number = 20, gameCode?: string) => {
        const response = await api.get('/casino/my-bets', {
            params: { limit, gameCode }
        });
        return response.data;
    },

    /**
     * Fetch admin-pinned games for a section.
     * sections: popular | new | slots | live | table | crash | home | top
     * Returns the same shape as getGames() games array.
     */
    getSectionGames: async (section: string): Promise<any[]> => {
        try {
            const response = await api.get(`/casino/section/${section}`);
            const games = Array.isArray(response.data) ? response.data : [];
            return games.map((g: any) => ({
                ...g,
                id: g.id,
                gameCode: g.gameCode || g.gameId || '',
                gameName: g.gameName || g.name || 'Unknown Game',
                name: g.gameName || g.name || 'Unknown Game',
                provider: g.provider || g.providerCode,
                providerCode: g.providerCode || g.provider,
                providerSlug: g.providerSlug,
                banner: g.banner || g.image || '',
                image: g.banner || g.image || '',
            }));
        } catch {
            return [];
        }
    },
};
