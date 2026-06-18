import axios from 'axios';

const api = axios.create({
    baseURL: typeof window === 'undefined' ? (process.env.API_URL || 'https://zeero.bet/api') : '/api', // Relative for client (rewrites), Absolute for SSR
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    // NOTE: The admin API token is NO LONGER sent from the client bundle.
    // It is injected server-side by src/middleware.ts for /api/* requests
    // from a server-only `ADMIN_API_TOKEN` env var. Exposing it via
    // NEXT_PUBLIC_* let every visitor make admin-guarded calls.
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
    try {
        const res = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                withCredentials: true,
            },
        );
        const newToken = res.data?.access_token;
        if (newToken) {
            localStorage.setItem('token', newToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            return newToken;
        }
        return null;
    } catch {
        return null;
    }
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error?.response?.status;
        const originalRequest = error?.config;

        // Only attempt refresh on 401, not 403, and not on the refresh endpoint itself
        if (
            typeof window !== 'undefined' &&
            status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !originalRequest.url?.includes('/auth/refresh')
        ) {
            originalRequest._retry = true;

            // Deduplicate concurrent refresh attempts
            if (!isRefreshing) {
                isRefreshing = true;
                refreshPromise = tryRefreshToken().finally(() => {
                    isRefreshing = false;
                    refreshPromise = null;
                });
            }

            const newToken = await refreshPromise;
            if (newToken) {
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                return api(originalRequest);
            }

            // Refresh failed — force logout
            localStorage.removeItem('token');
            localStorage.removeItem('auth_user');
            window.dispatchEvent(new CustomEvent('auth:logout'));
            return Promise.reject(error);
        }

        if (typeof window !== 'undefined' && (status === 401 || status === 403)) {
            localStorage.removeItem('token');
            localStorage.removeItem('auth_user');
            window.dispatchEvent(new CustomEvent('auth:logout'));
        }

        return Promise.reject(error);
    }
);

export default api;
