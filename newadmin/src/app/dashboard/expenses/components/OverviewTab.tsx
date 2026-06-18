"use client";

import React, { useEffect, useState } from 'react';
import { getExpenseDashboardSummary } from '@/actions/expenses';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, TrendingUp, Layers, DollarSign, Wallet } from 'lucide-react';


export default function OverviewTab() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    useEffect(() => {
        const fetchSummary = async () => {
            setLoading(true);
            try {
                const res = await getExpenseDashboardSummary();
                setData(res);
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        };
        fetchSummary();
    }, []);

    if (loading) {
        return <div className="p-10 text-center text-slate-400 animate-pulse">Gathering financial insights...</div>;
    }

    if (!data) return <div className="text-red-400">Failed to load data.</div>;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1">
                    <p className="font-bold text-white mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }} className="flex justify-between gap-4">
                            <span>{entry.name}</span>
                            <span className="font-mono">{formatCurrency(entry.value)}</span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                    title="Net Fund Flow" 
                    value={formatCurrency(data.netFundFlow)} 
                    icon={Activity}
                    color={data.netFundFlow >= 0 ? 'emerald' : 'red'}
                    subtitle="Overall inflows vs outflows"
                />
                <KPICard 
                    title="Monthly Expenses (Approved)" 
                    value={formatCurrency(data.approvedThisMonth)} 
                    icon={DollarSign}
                    color="rose"
                    subtitle={`${data.pendingExpenses} pending review`}
                />
                <KPICard 
                    title="Active Investments" 
                    value={formatCurrency(data.totalInvestmentValue)} 
                    icon={TrendingUp}
                    color="indigo"
                    subtitle={`${data.activeInvestments} active portfolios`}
                />
                <KPICard 
                    title="Operational Cash" 
                    value="Dynamic" 
                    icon={Wallet}
                    color="blue"
                    subtitle="Calculated reserve"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold tracking-wide text-slate-300 uppercase mb-6 flex items-center gap-2">
                        <Layers size={16} className="text-violet-400" />
                        Inflow vs Outflow
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.last6Months} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="inflow" name="Inflow" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInflow)" />
                                <Area type="monotone" dataKey="outflow" name="Outflow" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorOutflow)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold tracking-wide text-slate-300 uppercase mb-6 flex items-center gap-2">
                        <Activity size={16} className="text-rose-400" />
                        Expense Trend
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.last6Months} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KPICard({ title, value, icon: Icon, color, subtitle }: { title: string, value: string | number, icon: any, color: string, subtitle?: string }) {
    const colorMap: Record<string, string> = {
        emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
        rose: "bg-rose-500/10 border-rose-500/20 text-rose-400",
        indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
        blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
        red: "bg-red-500/10 border-red-500/20 text-red-500"
    };

    return (
        <div className={`rounded-xl border p-5 transition-shadow hover:shadow-lg ${colorMap[color] || colorMap.emerald}`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{title}</p>
                    <h4 className="text-2xl font-bold font-mono tracking-tight">{value}</h4>
                </div>
                <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                    <Icon size={20} className="opacity-80" />
                </div>
            </div>
            {subtitle && (
                <p className="text-[11px] opacity-60 font-medium">↳ {subtitle}</p>
            )}
        </div>
    );
}
