import api from './api';

export interface CasinoGame {
    id: string;
    gameCode: string;
    name: string;
    provider: string;
    category?: string;
    image?: string;
    isActive: boolean;
    isPopular?: boolean;
    isNewGame?: boolean;
    priority?: number;
}

export interface CasinoProvider {
    _id: string;
    name: string;
    code: string;
    isActive: boolean;
    priority?: number;
}

export interface CasinoCategory {
    _id: string;
    name: string;
    slug: string;
    isActive: boolean;
    priority?: number;
}

export const casinoService = {
    // Games
    getGames: async (page = 1, limit = 20, search?: string, provider?: string, category?: string) => {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
        if (search) params.append('search', search);
        if (provider) params.append('provider', provider);
        if (category) params.append('category', category);

        const response = await api.get<{ games: CasinoGame[], total: number, totalPages: number }>(`/admin/games-list?${params.toString()}`);
        return response.data;
    },

    updateGame: async (id: string, data: Partial<CasinoGame>) => {
        const response = await api.patch(`/admin/update/${id}`, data);
        return response.data;
    },

    syncGames: async () => {
        const response = await api.post('/admin/games/sync');
        return response.data;
    },

    // Providers
    getProviders: async () => {
        const response = await api.get<CasinoProvider[]>('/admin/providers');
        return response.data;
    },

    toggleProvider: async (id: string, isActive: boolean) => {
        const response = await api.put(`/admin/providers/${id}`, { isActive });
        return response.data;
    },

    // Categories
    getCategories: async () => {
        const response = await api.get<CasinoCategory[]>('/admin/categories-list');
        return response.data;
    },

    toggleCategory: async (id: string, isActive: boolean) => {
        const response = await api.put(`/admin/categories/${id}`, { isActive });
        return response.data;
    }
};
