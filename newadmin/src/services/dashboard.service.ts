import api from './api';

export interface DashboardStats {
    users: {
        total: number;
        active: number;
    };
    financials: {
        totalDeposits: number;
        totalWithdrawals: number;
        ggr: number;
    };
    bets: {
        total: number;
        active: number;
    };
}

export const dashboardService = {
    getStats: async () => {
        const response = await api.get<DashboardStats>('/dashboard/stats');
        return response.data;
    },
    getAlerts: async () => {
        const response = await api.get<{ id: string, type: string, message: string, timestamp: string }[]>('/dashboard/alerts');
        return response.data;
    }
};
