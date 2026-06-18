import api from './api';

export interface Transaction {
    id: number;
    amount: number;
    type: string; // DEPOSIT, WITHDRAWAL, BET_PLACE, BET_WIN, etc.
    status: string; // PENDING, COMPLETED, FAILED, APPROVED, REJECTED
    paymentMethod: string;
    utr?: string;
    proof?: string;
    createdAt: string;
    user: {
        username: string;
        email: string;
    };
    remarks?: string;
}

export interface TransactionListResponse {
    transactions: Transaction[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export const transactionService = {
    getTransactions: async (page: number = 1, limit: number = 20, type: string = 'ALL', status: string = 'ALL', search: string = '') => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        if (type && type !== 'ALL') params.append('type', type);
        if (status && status !== 'ALL') params.append('status', status);
        if (search) params.append('search', search);

        const response = await api.get<TransactionListResponse>(`/transactions/all?${params.toString()}`);
        return response.data;
    },

    approveTransaction: async (id: number, adminId: number, remarks?: string) => {
        const response = await api.post(`/transactions/${id}/approve`, { adminId, remarks });
        return response.data;
    },

    rejectTransaction: async (id: number, adminId: number, remarks?: string) => {
        const response = await api.post(`/transactions/${id}/reject`, { adminId, remarks });
        return response.data;
    }
};
