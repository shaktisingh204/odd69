import api from './api';

export interface ReferralReferee {
    id: number;
    username: string;
    createdAt: string;
    totalEarned: number;
    lastActivity: string;
    rewardType: string;
}

export interface ReferralHistoryItem {
    id: number;
    refereeUsername: string;
    eventType: string;
    rewardName: string;
    amount: number;
    status: string;
    createdAt: string;
}

export interface ReferralStats {
    referralCode: string | null;
    totalInvited: number;
    totalEarnings: number;
    pendingEarnings: number;
    recentReferrals: ReferralReferee[];
    recentHistory: ReferralHistoryItem[];
}

export const ReferralService = {
    getStats: async (token?: string | null): Promise<ReferralStats> => {
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const response = await api.get('/referral/stats', config);
        return response.data;
    },

    applyCode: async (code: string) => {
        const response = await api.post('/referral/apply', { code });
        return response.data;
    },

    generateCode: async (token: string): Promise<{ code: string }> => {
        const response = await api.post('/referral/generate', {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    }
};
