
import api from './api';

export interface Bet {
    id: string;
    userId: number;
    eventId: string;
    eventName: string;
    marketId: string;
    marketName: string;
    selectionId: string;
    selectionName: string;
    selectedTeam?: string;
    odds: number;
    rate?: number;
    gtype?: string;
    marketType?: string;
    stake: number;
    originalStake?: number;
    potentialWin: number;
    originalPotentialWin?: number;
    status: 'PENDING' | 'WON' | 'LOST' | 'VOID' | 'CASHED_OUT';
    walletType?: string;               // which wallet was debited
    provider?: string;
    srSportId?: string;
    srMarketFullId?: string;
    srRunnerId?: string;
    srMarketName?: string;
    srRunnerName?: string;
    betType?: string;                  // 'back' | 'lay'
    settledReason?: string;            // human-readable settlement note
    cashoutValue?: number;             // amount received on cash out
    partialCashoutValue?: number;      // cumulative amount already realized from partial cash outs
    partialCashoutCount?: number;      // number of partial cash outs already taken
    cashedOutAt?: string;              // ISO timestamp of cash out
    lastPartialCashoutAt?: string;     // ISO timestamp of the latest partial cash out
    createdAt: string;
}

export interface PlaceBetPayload extends Partial<Bet> {
    rate?: number;
    marketType?: string;
}

export interface CashoutOffer {
    betId: string;
    status: 'AVAILABLE' | 'SUSPENDED' | 'UNAVAILABLE';
    cashoutValue?: number;
    currentOdds?: number;
    originalOdds?: number;
    stake?: number;
    potentialWin?: number;
    reason?: string;
    fullRefundEligible?: boolean;  // pre-match: offer 100% refund
    fullRefundValue?: number;      // = original stake
}

export interface CashoutResult {
    status: 'CASHED_OUT' | 'PARTIAL_CASHED_OUT' | 'PRICE_CHANGED';
    cashoutValue?: number;
    remainingStake?: number;
    newCashoutValue?: number;   // returned when status = PRICE_CHANGED
    currentOdds?: number;
    fraction?: number;
}

export const betsApi = {
    // Place a new bet
    placeBet: async (betData: PlaceBetPayload) => {
        const response = await api.post('/bets', betData);
        return response.data;
    },

    // Get my bets
    getMyBets: async (): Promise<Bet[]> => {
        const response = await api.get('/bets/my-bets');
        return response.data;
    },

    // Get cash out offer for a PENDING bet (read-only, no settlement)
    getCashoutOffer: async (betId: string): Promise<CashoutOffer> => {
        const response = await api.get(`/bets/${betId}/cashout-offer`);
        return response.data;
    },

    // Execute cash out — server re-computes value, credits wallet, settles bet
    executeCashout: async (
        betId: string,
        opts: {
            fraction?: number;
            clientExpectedValue?: number;
            fullRefund?: boolean;
        } = {},
    ): Promise<CashoutResult> => {
        const response = await api.post(`/bets/${betId}/cashout`, {
            fraction: opts.fraction ?? 1,
            clientExpectedValue: opts.clientExpectedValue,
            fullRefund: opts.fullRefund ?? false,
        });
        return response.data;
    },

    // Book bets (for non-logged in users)
    bookBets: async (bets: PlaceBetPayload[]): Promise<{ bookingId: string }> => {
        const response = await api.post('/bets/book', { bets });
        return response.data;
    },

    // Retrieve a booked bet
    getBookedBets: async (bookingId: string): Promise<{ bookingId: string, bets: any[], createdAt: string }> => {
        const response = await api.get(`/bets/book/${bookingId}`);
        return response.data;
    },
};
