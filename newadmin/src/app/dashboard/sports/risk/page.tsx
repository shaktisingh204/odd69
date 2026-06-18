"use client";

import React, { useEffect, useState } from 'react';
import { getMarketLiability } from '@/actions/sports';
import { AlertTriangle, TrendingUp, Activity, ArrowUpRight, DollarSign } from 'lucide-react';

interface MarketLiability {
    _id: { eventId: string, marketId: string };
    eventName: string;
    marketName: string;
    marketTotalStake: number;
    worstCaseLiability: number;
    selections: {
        selectionName: string;
        totalStake: number;
        totalPayout: number;
        betCount: number;
    }[];
}

export default function RiskDashboard() {
    const [exposure, setExposure] = useState<MarketLiability[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchExposure();
        const interval = setInterval(fetchExposure, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const fetchExposure = async () => {
        try {
            const res = await getMarketLiability();
            if (res.success && res.data) {
                setExposure(res.data);
            }
        } catch (error) {
            console.error("Failed to fetch exposure", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && exposure.length === 0) return <div className="p-8 text-center text-slate-500">Loading risk data...</div>;

    const totalLiability = exposure.reduce((acc, curr) => acc + curr.worstCaseLiability, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Risk Management</h1>
                    <p className="text-slate-400 mt-1">Real-time liability monitoring by event.</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg flex items-center gap-3">
                    <div className="p-1.5 bg-red-500 rounded text-white">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-red-400 uppercase font-bold">Total Liability</p>
                        <p className="text-xl font-mono text-white font-bold">₹{totalLiability.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {exposure.map((market, i) => (
                    <div key={i} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                        <div className="p-4 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    {market.eventName}
                                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-normal">{market.marketName}</span>
                                </h3>
                                <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                                    <span className="flex items-center gap-1"><DollarSign size={14} /> Vol: ₹{market.marketTotalStake}</span>
                                    {market.worstCaseLiability > 0 &&
                                        <span className="flex items-center gap-1 text-red-400 font-bold"><ArrowUpRight size={14} /> Liability: ₹{market.worstCaseLiability}</span>
                                    }
                                </div>
                            </div>
                        </div>

                        <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {market.selections.map((sel, j) => {
                                    // Calculate liability if this selection wins
                                    // Net Payout = TotalPayout - MarketTotalStake
                                    const netResult = sel.totalPayout - market.marketTotalStake;
                                    const isLiability = netResult > 0;

                                    return (
                                        <div key={j} className={`p-3 rounded border ${isLiability ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-white">{sel.selectionName}</span>
                                                <span className="text-xs text-slate-500">{sel.betCount} bets</span>
                                            </div>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Total Stake</span>
                                                    <span className="text-slate-200">₹{sel.totalStake}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Payout</span>
                                                    <span className="text-slate-200">₹{sel.totalPayout}</span>
                                                </div>
                                                <div className="pt-2 mt-2 border-t border-slate-700/50 flex justify-between font-bold">
                                                    <span className={isLiability ? 'text-red-400' : 'text-emerald-400'}>
                                                        {isLiability ? 'House Loses' : 'House Wins'}
                                                    </span>
                                                    <span className={isLiability ? 'text-red-400' : 'text-emerald-400'}>
                                                        ₹{Math.abs(netResult).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {exposure.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-500 bg-slate-800 rounded-lg border border-slate-700">
                    <Activity size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No active bets found.</p>
                </div>
            )}
        </div>
    );
}
