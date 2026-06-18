import api from './api';

export interface PromoCard {
    _id: string;
    title: string;
    subtitle?: string;
    description?: string;
    termsAndConditions?: string;
    category?: string;
    tag?: string;
    promoCode?: string;
    minDeposit?: number;
    bonusPercentage?: number;
    expiryDate?: string;
    buttonText?: string;
    buttonLink?: string;
    bgImage?: string;
    charImage?: string;
    gradient?: string;
    isActive: boolean;
    isFeatured?: boolean;
    order: number;
}

export const promoApi = {
    getActivePromoCards: async (): Promise<PromoCard[]> => {
        try {
            const response = await api.get('/promo-cards?active=true');
            return response.data;
        } catch (error) {
            console.error("Error fetching promo cards:", error);
            return [];
        }
    }
};
