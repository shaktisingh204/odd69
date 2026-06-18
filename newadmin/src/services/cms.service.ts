import api from './api';

// --- Promo Cards ---
export interface PromoCard {
    _id: string; // Mongo ID
    title: string;
    subtitle?: string;
    tag?: string;
    buttonText?: string;
    buttonLink?: string;
    bgImage?: string;
    charImage?: string; // Optional character image
    gradient?: string;
    isActive: boolean;
    order: number;
}

export interface CreatePromoCardDto extends Omit<PromoCard, '_id'> { }
export interface UpdatePromoCardDto extends Partial<CreatePromoCardDto> { }

// --- Home Categories ---
export interface HomeCategory {
    _id: string;
    title: string;
    subtitle?: string;
    description?: string;
    image?: string;
    link: string;
    isLarge: boolean;
    order: number;
    isActive: boolean;
    style?: any;
}

export interface CreateHomeCategoryDto extends Omit<HomeCategory, '_id'> { }
export interface UpdateHomeCategoryDto extends Partial<CreateHomeCategoryDto> { }

export const cmsService = {
    // Promo Cards
    getPromoCards: async (active?: boolean) => {
        const query = active !== undefined ? `?active=${active}` : '';
        const response = await api.get<PromoCard[]>(`/promo-cards${query}`);
        return response.data;
    },

    createPromoCard: async (data: CreatePromoCardDto) => {
        const response = await api.post<PromoCard>('/promo-cards', data);
        return response.data;
    },

    updatePromoCard: async (id: string, data: UpdatePromoCardDto) => {
        const response = await api.put<PromoCard>(`/promo-cards/${id}`, data);
        return response.data;
    },

    deletePromoCard: async (id: string) => {
        const response = await api.delete(`/promo-cards/${id}`);
        return response.data;
    },

    // Home Categories
    getCategories: async () => {
        const response = await api.get<HomeCategory[]>('/home-category');
        return response.data;
    },

    createCategory: async (data: CreateHomeCategoryDto) => {
        const response = await api.post<HomeCategory>('/home-category', data);
        return response.data;
    },

    updateCategory: async (id: string, data: UpdateHomeCategoryDto) => {
        // Backend uses PATCH for categories based on controller code
        const response = await api.patch<HomeCategory>(`/home-category/${id}`, data);
        return response.data;
    },

    deleteCategory: async (id: string) => {
        const response = await api.delete(`/home-category/${id}`);
        return response.data;
    }
};
