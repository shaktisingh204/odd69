"use client";

import React, { useEffect, useState } from 'react';
import { getReportsData } from '@/actions/reports';
import { BarChart3, TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';

interface ReportData {
    financial: { date: string, deposits: number, withdrawals: number, ggr: number }[];
    players: { date: string, count: number }[];
}

export default function ReportsPage() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const res = await getReportsData();
            if (res.success && res.data) {
                setData(res.data);
            }
        } catch (error) {
            console.error("Failed to fetch reports", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading reports...</div>;

    if (!data) return <div className="p-8 text-center text-red-500">Failed to load data.</div>;

    // Helper to calc max value for bar scaling
    const maxGGR = Math.max(...data.financial.map(d => Math.abs(d.ggr)), 1);
    const maxPlayers = Math.max(...data.players.map(d => d.count), 1);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Analytics & Reporting</h1>
                    <p className="text-slate-400 mt-1">Financial performance and player growth over the last 30 days.</p>
                </div>
                <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                    <button className="px-3 py-1 bg-indigo-600 text-white rounded text-sm font-medium">Last 30 Days</button>
                    {/* Placeholder for future date ranges */}
                </div>
            </div>

            {/* Financial Chart */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <DollarSign size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-white">Financial Performance (GGR)</h2>
                </div>

                <div className="h-64 flex items-end gap-1 md:gap-2">
                    {data.financial.map((item, i) => {
                        const heightPercent = Math.max((Math.abs(item.ggr) / maxGGR) * 100, 5); // min 5% height
                        const isPositive = item.ggr >= 0;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center group relative">
                                <div
                                    className={`w-full rounded-t ${isPositive ? 'bg-emerald-500/50 group-hover:bg-emerald-400' : 'bg-red-500/50 group-hover:bg-red-400'} transition-all`}
                                    style={{ height: `${heightPercent}%` }}
                                />
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-xs p-2 rounded border border-slate-700 whitespace-nowrap z-10">
                                    <div className="font-bold">{item.date}</div>
                                    <div className="text-emerald-400">Dep: {item.deposits}</div>
                                    <div className="text-red-400">Wdr: {item.withdrawals}</div>
                                    <div className={isPositive ? 'text-emerald-400' : 'text-red-400'}>GGR: {item.ggr}</div>
                                </div>
                                <div className="mt-2 text-[10px] text-slate-500 rotate-0 md:-rotate-45 truncate w-full text-center">
                                    {item.date.slice(5)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Player Growth Chart */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                        <Users size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-white">New Player Registrations</h2>
                </div>

                <div className="h-64 flex items-end gap-1 md:gap-2">
                    {data.players.map((item, i) => {
                        const heightPercent = (item.count / maxPlayers) * 100;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center group relative">
                                <div
                                    className="w-full rounded-t bg-blue-500/50 group-hover:bg-blue-400 transition-all"
                                    style={{ height: `${Math.max(heightPercent, 5)}%` }} // min 5%
                                />
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-xs p-2 rounded border border-slate-700 whitespace-nowrap z-10">
                                    <div className="font-bold">{item.date}</div>
                                    <div className="text-blue-400">New Users: {item.count}</div>
                                </div>
                                <div className="mt-2 text-[10px] text-slate-500 rotate-0 md:-rotate-45 truncate w-full text-center">
                                    {item.date.slice(5)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-slate-400 text-sm font-bold uppercase mb-4">Summary (30 Days)</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Total GGR</span>
                            <span className="text-emerald-400 font-mono font-bold">
                                {data.financial.reduce((acc, curr) => acc + curr.ggr, 0).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Total Deposits</span>
                            <span className="text-white font-mono font-bold">
                                {data.financial.reduce((acc, curr) => acc + curr.deposits, 0).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Total Withdrawals</span>
                            <span className="text-red-400 font-mono font-bold">
                                {data.financial.reduce((acc, curr) => acc + curr.withdrawals, 0).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between pt-4 border-t border-slate-700">
                            <span className="text-slate-400">New Players</span>
                            <span className="text-blue-400 font-mono font-bold">
                                {data.players.reduce((acc, curr) => acc + curr.count, 0)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
