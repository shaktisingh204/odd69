'use client';

import { useEffect, useState } from 'react';
import api from '@/services/api';
import {
    defaultMaintenanceConfig,
    extractMaintenanceConfig,
    getMaintenanceMessage,
    isScopeBlocked,
    type MaintenanceConfig,
    type MaintenanceScope,
} from '@/lib/maintenance';
import { useAuth } from '@/context/AuthContext';

export function useSectionMaintenance(scope: MaintenanceScope, fallbackMessage: string) {
    const [config, setConfig] = useState<MaintenanceConfig>(defaultMaintenanceConfig);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const response = await api.get('/settings/public');
                if (cancelled) return;
                setConfig(extractMaintenanceConfig(response.data));
            } catch {
                if (cancelled) return;
                setConfig(defaultMaintenanceConfig);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, []);

    const { user, isAuthenticated } = useAuth();
    
    let isBlocked = isScopeBlocked(config, scope);
    if (isBlocked && isAuthenticated && user) {
        const username = typeof user.username === 'string' ? user.username.toLowerCase() : '';
        const email = typeof user.email === 'string' ? user.email.toLowerCase() : '';
        const hasAccess = config.allowedUsers.some(u => {
            const search = u.toLowerCase();
            return search === username || search === email;
        });

        if (hasAccess) {
            isBlocked = false;
        }
    }

    return {
        config,
        loading,
        blocked: isBlocked,
        message: getMaintenanceMessage(config, scope, fallbackMessage),
    };
}
