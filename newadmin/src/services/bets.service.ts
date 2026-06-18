import api from './api';

export interface Bet {
    id: string;
    userId: number;
    eventId: string;
    eventName: string;
    marketName: string;
    selectionName: string;
    odds: number;
    stake: number;
    potentialWin: number;
    status: string; // PENDING, WON, LOST, VOID
    betType: string;
    placedAt: string;
    createdAt: string;
}

export const betsService = {
    getAllBets: async (page: number = 1, limit: number = 20, filters: any = {}) => {
        const response = await api.post<{ bets: Bet[], pagination: any }>('/bets/all', { page, limit, filters });
        return response.data;
    },

    cancelBet: async (betId: string) => {
        const response = await api.post(`/bets/${betId}/cancel`);
        return response.data;
    },

    settleMarket: async (marketId: string, winningSelectionId: string, eventId?: string) => {
        const response = await api.post('/bets/settle', { marketId, winningSelectionId, eventId });
        return response.data;
    }
};
