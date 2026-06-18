import api from './api';

export interface HomeCategory {
    _id?: string;
    id?: string;
    title: string;
    subtitle?: string;
    description?: string;
    image?: string;
    link: string;
    isLarge: boolean;
    order: number;
    isActive: boolean;
    style?: any;
    createdAt?: string;
    updatedAt?: string;
}

export const HomeCategoryService = {
    async getAll() {
        const response = await api.get('/home-category');
        return Array.isArray(response.data) ? response.data : [];
    },

    async getById(id: string) {
        const response = await api.get(`/home-category/${id}`);
        return response.data;
    },

    async create(data: any) {
        const response = await api.post('/home-category', data);
        return response.data;
    },

    async update(id: string, data: any) {
        const response = await api.patch(`/home-category/${id}`, data);
        return response.data;
    },

    async delete(id: string) {
        await api.delete(`/home-category/${id}`);
    }
};
