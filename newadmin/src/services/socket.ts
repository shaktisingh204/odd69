import { io } from 'socket.io-client';
import api from './api';

// Use the same base URL as API but for websocket
// If api.ts has baseURL, we might want to extract it or just hardcode/env it.
// Assuming backend is at same host/port 
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'https://odd69.com/api';
// Note: If using path rewrite in next.js, socket might need specific path config.
// For now assuming standard.

const socket = io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket'],
    // If auth needed on handshake:
    auth: {
        token: typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    }
});

export default socket;
