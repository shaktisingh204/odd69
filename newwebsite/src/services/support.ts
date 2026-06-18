import api from './api';
import { io, Socket } from 'socket.io-client';
import { getConfiguredSocketEndpoint } from '@/utils/socketUrl';

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
    status: 'OPEN' | 'CLOSED';
    subject: string;
    createdAt: string;
    updatedAt: string;
    messages?: SupportMessage[];
}

// ─── REST API ────────────────────────────────────────────────────────────────

export const supportApi = {
    createTicket: async (data: { subject: string; category?: string; message?: string }) => {
        const res = await api.post('/support/create', data);
        return res.data as SupportTicket;
    },

    getMyTickets: async () => {
        const res = await api.get('/support/my-tickets');
        return res.data as SupportTicket[];
    },

    getTicket: async (id: number) => {
        const res = await api.get(`/support/ticket/${id}`);
        return res.data as SupportTicket;
    },

    sendMessage: async (ticketId: number, message: string) => {
        const res = await api.post('/support/message', { ticketId, message });
        return res.data as SupportMessage;
    },

    getFaqs: async () => {
        const res = await api.get('/faq');
        return res.data;
    },
};

// ─── Socket ─────────────────────────────────────────────────────────────────

let _socket: Socket | null = null;

export function getSupportSocket(): Socket | null {
    if (!_socket) {
        const endpoint = getConfiguredSocketEndpoint();
        if (!endpoint) {
            return null;
        }
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        _socket = io(endpoint.url, {
            path: endpoint.path,
            withCredentials: true,
            transports: ['websocket'],
            auth: token ? { token } : undefined,
        });
    }
    return _socket;
}

export function joinSupportRoom(userId: number) {
    getSupportSocket()?.emit('joinSupport', { userId });
}

export function sendSocketMessage(ticketId: number, message: string) {
    getSupportSocket()?.emit('sendMessage', { ticketId, message, sender: 'USER' });
}

export function onNewMessage(cb: (msg: SupportMessage) => void): () => void {
    const socket = getSupportSocket();
    if (!socket) {
        return () => undefined;
    }

    socket.on('newMessage', cb);
    return () => { socket.off('newMessage', cb); };
}
