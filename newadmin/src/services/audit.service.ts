import api from './api';

export interface AuditLog {
    id: number;
    adminId: number;
    action: string;
    details: any;
    ipAddress: string;
    createdAt: string;
}

export interface SystemHealth {
    database: string;
    redis: string;
    uptime: number;
    latency: number;
    timestamp: string;
}

export const auditService = {
    getLogs: async (): Promise<AuditLog[]> => {
        // Need to add audit endpoint to backend first? 
        // Or reuse existing logic if any.
        // Wait, I haven't created an AuditController yet.
        // I should probably add it to HealthModule or a separate AuditModule.
        // For now let's assume I will add it to HealthModule for simplicity or create new.
        // Let's create a dedicated AuditController in HealthModule for now.
        const response = await api.get('/health/audit-logs');
        return response.data;
    },

    getSystemHealth: async (): Promise<SystemHealth> => {
        const response = await api.get('/health/status');
        return response.data;
    }
};
