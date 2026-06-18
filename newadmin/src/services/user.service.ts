import api from './api';

export interface User {
    id: number;
    username: string;
    email: string;
    phoneNumber: string;
    role: string;
    balance: number;
    exposure: number;
    bonus: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
    manager?: {
        id: number;
        username: string;
    };
    kycStatus?: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
    kycDocuments?: any[];
    depositLimit?: number;
    lossLimit?: number;
    selfExclusionUntil?: string;
}

export interface UserListResponse {
    users: User[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export const userService = {
    getUsers: async (page: number = 1, limit: number = 20, search: string = '', role: string = '') => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        if (search) params.append('search', search);
        if (role && role !== 'ALL') params.append('role', role);

        const response = await api.get<UserListResponse>(`/user/list?${params.toString()}`);
        return response.data;
    },

    createUser: async (userData: any) => {
        const response = await api.post('/user/create', userData);
        return response.data;
    },

    updateUser: async (id: number, userData: any) => {
        const response = await api.patch(`/user/${id}`, userData);
        return response.data;
    },

    deleteUser: async (id: number) => {
        const response = await api.delete(`/user/${id}`);
        return response.data;
    },

    getManagers: async () => {
        const response = await api.get<{ id: number, username: string }[]>('/user/managers');
        return response.data;
    },

    assignManager: async (userId: number, managerId: number) => {
        const response = await api.post('/user/assign-manager', { userId, managerId });
        return response.data;
    },

    addFunds: async (userId: number, amount: number, type: 'credit' | 'debit') => {
        const response = await api.post('/user/add-funds', { userId, amount, type });
        return response.data;
    },

    getUser: async (id: number) => {
        const response = await api.get<User>(`/user/${id}`);
        return response.data;
    },

    getUserTransactions: async (userId: number) => {
        // Define Transaction interface if needed, for now using any
        const response = await api.get<any[]>(`/transactions/user/${userId}`);
        return response.data;
    },

    getUserBets: async (userId: number) => {
        // Define Bet interface if needed, for now using any
        const response = await api.get<any[]>(`/bets/user/${userId}`);
        return response.data;
    },

    updateKycStatus: async (userId: number, status: string, reason?: string) => {
        const response = await api.patch('/user/kyc/status', { userId, status, reason });
        return response.data;
    },

    setRGLimits: async (userId: number, limits: any) => {
        const response = await api.patch('/user/rg/limits', { userId, ...limits });
        return response.data;
    }
};
