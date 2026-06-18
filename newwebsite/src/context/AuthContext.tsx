"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import api from "@/services/api";

interface AuthContextType {
    user: any;
    token: string | null;
    loading: boolean;
    login: (token: string, userData: any) => void;
    logout: () => void;
    refreshSession: () => Promise<void>;
    isAuthenticated: boolean;
}

const AUTH_USER_KEY = "auth_user";

/** Decode a JWT payload without verifying the signature (client-side only). */
function decodeJwtPayload(token: string): Record<string, any> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    } catch {
        return null;
    }
}

/** Returns true if the JWT has not yet expired (60s leeway). */
function isTokenAlive(token: string): boolean {
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 > Date.now() + 60_000;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<any>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const performLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem(AUTH_USER_KEY);
        setToken(null);
        setUser(null);
        delete api.defaults.headers.common['Authorization'];
    };

    useEffect(() => {
        const handleForcedLogout = () => {
            performLogout();
        };

        window.addEventListener('auth:logout', handleForcedLogout);
        return () => window.removeEventListener('auth:logout', handleForcedLogout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const storedToken = localStorage.getItem("token");

        if (storedToken && isTokenAlive(storedToken)) {
            setToken(storedToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            api.get('/auth/profile')
                .then(res => {
                    setUser(res.data);
                    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.data));
                })
                .catch(() => {
                    performLogout();
                })
                .finally(() => {
                    setLoading(false);
                });
            return;
        } else if (storedToken) {
            performLogout();
        }

        setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Proactive token refresh: check every 60s if token expires within 2 hours
    useEffect(() => {
        const interval = setInterval(() => {
            const currentToken = localStorage.getItem('token');
            if (!currentToken) return;

            // If token is already dead, force logout
            if (!isTokenAlive(currentToken)) {
                performLogout();
                return;
            }

            // If token expires within 2 hours, attempt refresh
            const payload = decodeJwtPayload(currentToken);
            if (payload && typeof payload.exp === 'number') {
                const twoHoursMs = 2 * 60 * 60 * 1000;
                const expiresAt = payload.exp * 1000;
                if (expiresAt - Date.now() < twoHoursMs) {
                    api.post('/auth/refresh')
                        .then(res => {
                            const newToken = res.data?.access_token;
                            if (newToken) {
                                localStorage.setItem('token', newToken);
                                setToken(newToken);
                                api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                            }
                        })
                        .catch(() => {
                            // Refresh failed — don't force logout yet, token might still be valid
                        });
                }
            }
        }, 60_000);

        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshSession = useCallback(async () => {
        if (!token) return;
        try {
            const res = await api.post('/auth/refresh');
            const newToken = res.data?.access_token;
            if (newToken) {
                localStorage.setItem('token', newToken);
                setToken(newToken);
                api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            }
        } catch {
            // refresh failed, don't force logout yet — token might still be valid
        }
    }, [token]);

    const login = (newToken: string, userData: any) => {
        localStorage.setItem("token", newToken);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    };

    const logout = () => {
        performLogout();
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, refreshSession, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
