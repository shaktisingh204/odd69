"use client";

import React, { useEffect, useState } from "react";
import { getAdminLoginLogs } from "@/actions/admins";
import { Loader2, Globe } from "lucide-react";

export default function AdminLoginLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await getAdminLoginLogs(200);
            if (res.success) setLogs(res.data);
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Admin Login Logs</h1>
                    <p className="text-slate-400 mt-1">Audit log of all admin sign-ins and access attempts.</p>
                </div>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-[800px] w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-900/50 uppercase font-medium text-xs">
                            <tr>
                                <th className="px-4 py-4 sm:px-6">Admin</th>
                                <th className="px-4 py-4 sm:px-6">IP Address</th>
                                <th className="px-4 py-4 sm:px-6">User Agent</th>
                                <th className="px-4 py-4 sm:px-6">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                        Loading logs...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                        No login logs found.
                                    </td>
                                </tr>
                            ) : logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-4 sm:px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20">
                                                {(log.email || log.admin?.email || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">{log.email}</div>
                                                {log.admin?.username && (
                                                    <div className="text-xs text-slate-500">{log.admin.username}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 sm:px-6">
                                        <div className="flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-slate-500" />
                                            <span className="font-mono text-slate-300">{log.ipAddress}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 sm:px-6 max-w-xs">
                                        <div className="truncate text-xs text-slate-400 group relative">
                                            {log.userAgent}
                                            <div className="absolute hidden group-hover:block bottom-full left-0 mb-2 w-max max-w-sm bg-slate-900 border border-slate-700 text-slate-300 p-2 rounded text-xs shadow-xl z-10 break-words whitespace-normal">
                                                {log.userAgent}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 sm:px-6 whitespace-nowrap">
                                        <div className="text-slate-300">
                                            {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(log.createdAt))}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true }).format(new Date(log.createdAt))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
