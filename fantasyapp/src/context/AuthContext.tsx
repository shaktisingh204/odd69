import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getProfile, login as apiLogin, register as apiRegister } from '@/services/fantasy';

interface User {
  id: string;
  name: string;
  phone: string;
  balance: number;
  fantasyBalance?: number;
  avatar?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: { phone: string; password: string; name: string; referralCode?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (storedToken?: string) => {
    try {
      const t = storedToken ?? (await SecureStore.getItemAsync('fantasy_token'));
      if (!t) return;
      const res = await getProfile();
      setUser(res.data);
      setToken(t);
    } catch {
      await SecureStore.deleteItemAsync('fantasy_token').catch(() => {});
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    loadUser().finally(() => setLoading(false));
  }, [loadUser]);

  const login = useCallback(async (phone: string, password: string) => {
    const res = await apiLogin(phone, password);
    const { access_token } = res.data;
    await SecureStore.setItemAsync('fantasy_token', access_token);
    await loadUser(access_token);
  }, [loadUser]);

  const register = useCallback(async (data: { phone: string; password: string; name: string; referralCode?: string }) => {
    const res = await apiRegister(data);
    const { access_token } = res.data;
    await SecureStore.setItemAsync('fantasy_token', access_token);
    await loadUser(access_token);
  }, [loadUser]);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('fantasy_token').catch(() => {});
    setUser(null);
    setToken(null);
  }, []);

  const refreshUser = useCallback(() => loadUser(), [loadUser]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
