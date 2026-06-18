import api from './api';

export const settlementService = {
    /**
     * Manually trigger the auto-settlement cycle.
     * POST /settlement/trigger
     */
    triggerSettlement: async (): Promise<{ message: string; settled: number }> => {
        const response = await api.post('/settlement/trigger');
        return response.data;
    },

    /**
     * Remove poisoned SettledMarket records (settledBetCount=0) so they get retried.
     * DELETE /settlement/cleanup-zero-records
     */
    cleanupZeroRecords: async (): Promise<{ message: string; deletedCount: number }> => {
        const response = await api.delete('/settlement/cleanup-zero-records');
        return response.data;
    },

    /**
     * Get pending bets from the bets service (for summary display).
     * POST /bets/all with status filter
     */
    getPendingBets: async (page = 1, limit = 100) => {
        const response = await api.post('/bets/all', {
            page,
            limit,
            filters: { status: 'PENDING' }
        });
        return response.data as { bets: any[]; pagination: any };
    },

    /**
     * Manually settle a single bet as WON, LOST, or VOID.
     * POST /settlement/manual-settle-bet
     */
    manualSettleBet: async (betId: string, outcome: 'WON' | 'LOST' | 'VOID', note?: string): Promise<{ message: string }> => {
        const response = await api.post('/settlement/manual-settle-bet', { betId, outcome, note });
        return response.data;
    },
};

