"use client";

import React, { useEffect, useState } from 'react';
import { getAuditLogs, getSystemHealth } from '@/actions/settings';
// import { auditService, AuditLog, SystemHealth } from '@/services/audit.service';
import { Activity, Server, Clock, Download, RefreshCw, Layers } from 'lucide-react';

export default function AuditPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [health, setHealth] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Auto-refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [logsRes, healthRes] = await Promise.all([
                getAuditLogs(),
                getSystemHealth()
            ]);

            if (logsRes.success) setLogs(logsRes.data || []);
            if (healthRes.success) setHealth(healthRes.data || null);
        } catch (error) {
            console.error("Failed to fetch audit data", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white mb-6">System Health & Audits</h1>

            {/* Health Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatusCard
                    title="Database"
                    status={health?.database || 'UNKNOWN'}
                    icon={<Layers className={health?.database === 'UP' ? 'text-green-400' : 'text-red-400'} />}
                />
                <StatusCard
                    title="Redis"
                    status={health?.redis || 'UNKNOWN'}
                    icon={<Server className={health?.redis === 'UP' ? 'text-green-400' : 'text-red-400'} />}
                />
                <InfoCard
                    title="Uptime"
                    value={health ? formatUptime(health.uptime) : 'Loading...'}
                    icon={<Clock className="text-blue-400" />}
                />
                <InfoCard
                    title="Latency"
                    value={health ? `${health.latency}ms` : 'Loading...'}
                    icon={<Activity className="text-yellow-400" />}
                />
            </div>

            {/* Audit Logs Timeline */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">Recent Admin Actions</h2>
                    <button onClick={fetchData} className="text-slate-400 hover:text-white">
                        <RefreshCw size={18} />
                    </button>
                </div>

                <div className="space-y-4">
                    {logs.map(log => (
                        <div key={log.id} className="flex gap-4 p-4 border-b border-slate-700 last:border-0 hover:bg-slate-750 transition-colors">
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20"></div>
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-medium">{formatAction(log.action)}</p>
                                <p className="text-sm text-slate-400 mt-1">
                                    Admin #{log.adminId} • <span className="font-mono text-xs bg-slate-700 px-1 rounded">{log.ipAddress || 'Unknown IP'}</span>
                                </p>
                                {log.details && (
                                    <pre className="mt-2 text-xs bg-slate-900 p-2 rounded text-slate-300 overflow-x-auto">
                                        {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                )}
                            </div>
                            <div className="text-xs text-slate-500 whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleString()}
                            </div>
                        </div>
                    ))}
                    {logs.length === 0 && !loading && (
                        <p className="text-slate-500 text-center py-8">No recent audit logs found.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatusCard({ title, status, icon }: { title: string, status: string, icon: React.ReactNode }) {
    const isUp = status === 'UP';
    return (
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 flex items-center justify-between">
            <div>
                <p className="text-slate-400 text-sm mb-1">{title}</p>
                <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${isUp ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <span className={`font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>{status}</span>
                </div>
            </div>
            {icon}
        </div>
    );
}

function InfoCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
    return (
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 flex items-center justify-between">
            <div>
                <p className="text-slate-400 text-sm mb-1">{title}</p>
                <p className="font-bold text-white text-lg">{value}</p>
            </div>
            {icon}
        </div>
    );
}

function formatUptime(seconds: number) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    return `${d}d ${h}h ${m}m`;
}

function formatAction(action: string) {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
