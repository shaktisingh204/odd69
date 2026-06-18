import api from './api';

export interface ReferralReward {
    id?: number;
    name: string;
    description?: string;
    conditionType: 'SIGNUP' | 'DEPOSIT_FIRST' | 'DEPOSIT_RECURRING' | 'BET_VOLUME';
    conditionValue: number;
    rewardType: 'FIXED' | 'PERCENTAGE';
    rewardAmount: number;
    isActive: boolean;
    createdAt?: string;
}

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface AdminReferralUser {
    id: number;
    username: string;
    email: string;
    referralCode: string | null;
    referrer: {
        id: number;
        username: string;
        code: string | null;
    } | null;
    totalInvited: number;
    totalEarned: number;
    createdAt: string;
}

export interface AdminReferralUsersResponse {
    users: AdminReferralUser[];
    pagination: PaginationMeta;
}

export interface AdminReferralHistoryItem {
    id: number;
    referrer: string | null;
    referee: string | null;
    rewardName: string | null;
    condition: string | null;
    amount: number;
    status: string;
    createdAt: string;
}

export interface AdminReferralHistoryResponse {
    history: AdminReferralHistoryItem[];
    pagination: PaginationMeta;
}

export const ReferralService = {
    // Returns only active rules (public)
    getRewards: async (): Promise<ReferralReward[]> => {
        const response = await api.get('/referral/rewards');
        return response.data;
    },

    // Returns ALL rules including inactive (admin)
    getAllRewards: async (): Promise<ReferralReward[]> => {
        const response = await api.get('/referral/rewards/all');
        return response.data;
    },

    createReward: async (data: Omit<ReferralReward, 'id' | 'createdAt'>) => {
        const response = await api.post('/referral/reward', data);
        return response.data;
    },

    toggleReward: async (id: number) => {
        const response = await api.patch(`/referral/reward/${id}/toggle`);
        return response.data;
    },

    deleteReward: async (id: number) => {
        const response = await api.delete(`/referral/reward/${id}`);
        return response.data;
    },

    getAdminUsers: async (page = 1, limit = 20, search = ''): Promise<AdminReferralUsersResponse> => {
        const response = await api.get('/referral/admin/users', { params: { page, limit, search } });
        return response.data;
    },

    getAdminHistory: async (page = 1, limit = 20): Promise<AdminReferralHistoryResponse> => {
        const response = await api.get('/referral/admin/history', { params: { page, limit } });
        return response.data;
    },
};
