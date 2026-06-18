import api from './api';

export interface Bonus {
    _id: string;
    code: string;
    type: 'DEPOSIT' | 'NO_DEPOSIT' | 'CASHBACK' | 'FREESPINS';
    title: string;
    description: string;
    imageUrl?: string;
    amount: number;
    percentage: number;
    minDeposit: number;
    minDepositFiat?: number;
    minDepositCrypto?: number;
    maxBonus: number;
    wageringRequirement: number;
    isActive: boolean;
    validFrom?: string;
    validUntil?: string;
    usageLimit: number;
    usageCount: number;
}

export const marketingService = {
    // Bonuses
    getBonuses: async () => {
        const response = await api.get<Bonus[]>('/admin/bonus');
        return response.data;
    },

    createBonus: async (data: Partial<Bonus>) => {
        const response = await api.post<Bonus>('/admin/bonus', data);
        return response.data;
    },

    updateBonus: async (id: string, data: Partial<Bonus>) => {
        const response = await api.put<Bonus>(`/admin/bonus/${id}`, data);
        return response.data;
    },

    deleteBonus: async (id: string) => {
        const response = await api.delete(`/admin/bonus/${id}`);
        return response.data;
    },

    toggleBonus: async (id: string) => {
        const response = await api.put(`/admin/bonus/${id}/toggle`, {});
        return response.data;
    }
};
