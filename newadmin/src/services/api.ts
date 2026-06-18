import axios from 'axios';

// On the client we always go through Next.js /api so that src/middleware.ts
// can inject the server-only admin token (ADMIN_API_TOKEN). On the server
// (SSR / server actions) we can call the backend directly using a server-only
// env var (BACKEND_URL) and the admin token is likewise server-side only.
const api = axios.create({
    baseURL:
        typeof window === 'undefined'
            ? process.env.BACKEND_URL || 'http://localhost:9828/api'
            : '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    // Ensure headers exist
    config.headers = config.headers || {};

    // Add JWT Token
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // NOTE: The admin API token is NO LONGER read from NEXT_PUBLIC_ADMIN_API_TOKEN
    // and is NOT sent from the client bundle. On the client, requests hit /api/*
    // and src/middleware.ts injects the token server-side from ADMIN_API_TOKEN.
    // On the server (SSR/server actions), inject it directly here.
    if (typeof window === 'undefined') {
        const adminToken = process.env.ADMIN_API_TOKEN;
        if (adminToken) {
            config.headers['x-admin-token'] = adminToken;
        }
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.error('API Unauthorized (401):', {
                url: error.config?.url,
                method: error.config?.method,
                hasAuthHeader: !!error.config?.headers?.Authorization,
                hasAdminToken: !!error.config?.headers?.['x-admin-token']
            });
            // Optional: Handle logout if needed
            // if (typeof window !== 'undefined') localStorage.removeItem('token');
        }
        return Promise.reject(error);
    }
);

export default api;
