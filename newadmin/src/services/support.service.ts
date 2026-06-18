import api from './api';
import socket from './socket';

export interface SupportMessage {
    id: number;
    ticketId: number;
    sender: 'USER' | 'ADMIN';
    message: string;
    createdAt: string;
}

export interface SupportTicket {
    id: number;
    userId: number;
    user?: { username: string };
    status: 'OPEN' | 'CLOSED';
    subject: string;
    createdAt: string;
    updatedAt: string;
    messages?: SupportMessage[];
}

export const supportService = {
    getAllTickets: async (): Promise<SupportTicket[]> => {
        const response = await api.get('/support/admin/tickets');
        return response.data;
    },

    getTicket: async (id: number): Promise<SupportTicket> => {
        const response = await api.get(`/support/ticket/${id}`);
        return response.data;
    },

    // Send via API (fallback/init)
    sendMessageApi: async (ticketId: number, message: string, sender: 'ADMIN') => {
        const response = await api.post('/support/message', { ticketId, message, sender });
        return response.data;
    },

    // Socket methods
    joinAdminSupport: () => {
        socket.emit('adminJoinSupport');
    },

    // Broadcast-only: message is already saved, just notify other clients
    broadcastMessage: (ticketId: number, message: any) => {
        socket.emit('broadcastSupportMessage', { ticketId, message });
    }
};
