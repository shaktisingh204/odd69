import api from './api';

export interface PromoCard {
    _id?: string;
    title: string;
    subtitle?: string;
    tag?: string;
    buttonText: string;
    buttonLink?: string;
    bgImage?: string;
    charImage?: string; // Optional character image URL
    gradient?: string; // CSS gradient string
    isActive: boolean;
    order: number;
}

export const PromoCardService = {
    async getCards(onlyActive = false) {
        const response = await api.get(`/promo-cards?active=${onlyActive}`);
        return Array.isArray(response.data) ? response.data : [];
    },

    async createCard(data: any) {
        const response = await api.post('/promo-cards', data);
        return response.data;
    },

    async updateCard(id: string, data: any) {
        const response = await api.put(`/promo-cards/${id}`, data);
        return response.data;
    },

    async deleteCard(id: string) {
        const response = await api.delete(`/promo-cards/${id}`);
        return response.data;
    },
};
