"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getDashboardOverviewByRange } from '@/actions/dashboard';
import { fmtUSD } from '@/utils/transactionCurrency';
import Link from 'next/link';
import {
    Loader2, TrendingUp, Users, DollarSign, Clock, Bell, AlertTriangle,
    CheckCircle, ArrowUpRight, ArrowDownRight, RefreshCcw,
    UserPlus, Wallet, Shield, CreditCard, Target, Zap, Activity, Gift,
    Calendar, ChevronDown, SlidersHorizontal, Bitcoin, UserCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

type DashboardChartPoint = {
    date: string;
    deposits: number;
    withdrawals: number;
    ggr: number;
};

type DashboardRecentTransaction = {
    id: number;
    type: string;
    amount: number;
    status: string;
    createdAt: string;
    user?: {
        username?: string | null;
        email?: string | null;
    } | null;
};

const EMPTY_OVERVIEW = {
    wallets: {
        totalUserBalance: 0,
        totalUserExposure: 0,
        mainWalletExposure: 0,
        bonusWalletExposure: 0,
        totalUserBonus: 0,
    },
    financials: {
        ggr: 0,
        totalDeposits: 0,
        depositCount: 0,
        gatewayDeposits: 0,
        gatewayCount: 0,
        manualDeposits: 0,
        manualCount: 0,
        cryptoDeposits: 0,
        cryptoCount: 0,
        totalWithdrawals: 0,
        withdrawalCount: 0,
        pendingWithdrawals: 0,
        pendingWithdrawalsAmount: 0,
        avgDeposit: 0,
        avgWithdrawal: 0,
    },
    users: {
        totalUsers: 0,
        newUsers: 0,
        activeUsers: 0,
        uniqueDepositors: 0,
        ftdCount: 0,
        ftdDepositAmount: 0,
        ftdRate: 0,
    },
    bets: {
        totalBets: 0,
        pendingBets: 0,
        wonBets: 0,
        lostBets: 0,
        betVolume: 0,
    },
    chart: [] as DashboardChartPoint[],
    recentTransactions: [] as DashboardRecentTransaction[],
};

// ─── Date Range Helpers ───────────────────────────────────────────────────────

/** Returns YYYY-MM-DD based on LOCAL time — NOT UTC (avoids timezone rollback) */
function toDateInputVal(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

const PRESETS = [
    { label: 'Today', days: 0 },
    { label: 'Yesterday', days: 1 },
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'This Month', days: -1 }, // special
];

function buildPreset(days: number): { from: Date; to: Date } {
    const now = new Date();
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);

    if (days === 0) {
        // Today
        const from = new Date(now);
        from.setHours(0, 0, 0, 0);
        return { from, to };
    }
    if (days === 1) {
        // Yesterday
        const from = new Date(now);
        from.setDate(from.getDate() - 1);
        from.setHours(0, 0, 0, 0);
        const yesterday = new Date(from);
        yesterday.setHours(23, 59, 59, 999);
        return { from, to: yesterday };
    }
    if (days === -1) {
        // This month
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from, to };
    }
    const from = new Date(now);
    from.setDate(from.getDate() - (days - 1));
    from.setHours(0, 0, 0, 0);
    return { from, to };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
    title, value, sub, icon: Icon, color, bg, href, alert = false, trend, badge
}: {
    title: string; value: string; sub: string; icon: LucideIcon;
    color: string; bg: string; href?: string; alert?: boolean;
    trend?: { value: string; positive: boolean };
    badge?: string;
}) {
    const inner = (
        <div className={`p-5 bg-slate-800 rounded-xl border transition-all group relative overflow-hidden
            ${alert ? 'border-amber-500/40 hover:border-amber-400/60' : 'border-slate-700 hover:border-indigo-500/40'}`}>
            {/* Background glow */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${bg} blur-xl`} />

            <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                    <div className={`p-2.5 rounded-lg ${bg}`}>
                        <Icon size={20} className={color} />
                    </div>
                    <div className="flex items-center gap-1.5">
                        {badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 uppercase tracking-wide">
                                {badge}
                            </span>
                        )}
                        {href && <ArrowUpRight size={15} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />}
                    </div>
                </div>
                <p className="text-2xl font-black text-white tracking-tight">{value}</p>
                <p className="text-slate-400 text-xs font-medium mt-0.5">{title}</p>
                <div className="flex items-center justify-between mt-2">
                    <p className={`text-xs font-semibold ${alert ? 'text-amber-400' : 'text-slate-500'}`}>{sub}</p>
                    {trend && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trend.positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                            {trend.positive ? '↑' : '↓'} {trend.value}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
    return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Mini Stat Row ────────────────────────────────────────────────────────────

function MiniStat({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
            <span className="text-xs text-slate-400">{label}</span>
            <span className={`text-xs font-bold ${color}`}>{value}</span>
        </div>
    );
}

// ─── Date Range Picker ────────────────────────────────────────────────────────

function DateRangePicker({
    from, to, onFromChange, onToChange, onPreset
}: {
    from: string; to: string;
    onFromChange: (v: string) => void;
    onToChange: (v: string) => void;
    onPreset: (f: Date, t: Date) => void;
}) {
    const [open, setOpen] = useState(false);
    const [activePreset, setActivePreset] = useState('Last 7 Days');

    const applyPreset = (label: string, days: number) => {
        const { from: f, to: t } = buildPreset(days);
        setActivePreset(label);
        onPreset(f, t);
        setOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:border-slate-600"
            >
                <Calendar size={15} className="text-indigo-400" />
                <span className="hidden sm:inline font-medium">{activePreset}</span>
                <span className="text-slate-500 text-xs hidden md:inline">
                    {from} → {to}
                </span>
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Select</p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {PRESETS.map(p => (
                            <button
                                key={p.label}
                                onClick={() => applyPreset(p.label, p.days)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border ${activePreset === p.label
                                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-slate-700 pt-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Custom Range</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-slate-500 mb-1 block">From</label>
                                <input
                                    type="date"
                                    value={from}
                                    max={to}
                                    onChange={e => { onFromChange(e.target.value); setActivePreset('Custom'); }}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 mb-1 block">To</label>
                                <input
                                    type="date"
                                    value={to}
                                    min={from}
                                    onChange={e => { onToChange(e.target.value); setActivePreset('Custom'); }}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setOpen(false)}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        Apply Range
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Deposit Split Card ───────────────────────────────────────────────────────

function DepositSplitCard({
    gatewayDeposits, gatewayCount,
    manualDeposits, manualCount,
    cryptoDeposits, cryptoCount,
    dateLabel,
}: {
    gatewayDeposits: number; gatewayCount: number;
    manualDeposits: number; manualCount: number;
    cryptoDeposits: number; cryptoCount: number;
    dateLabel: string;
}) {
    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 hover:border-violet-500/40 transition-all p-5 relative overflow-hidden group col-span-1 sm:col-span-2 xl:col-span-2">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-violet-500/5 blur-xl" />
            <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-2.5 rounded-lg bg-violet-500/10">
                        <DollarSign size={20} className="text-violet-400" />
                    </div>
                    <span className="text-[10px] text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full font-medium">{dateLabel}</span>
                </div>
                <p className="text-slate-400 text-xs font-medium mb-4">Deposit Breakdown</p>

                <div className="grid grid-cols-3 gap-2">
                    {/* Gateway (Fiat) */}
                    <Link href="/dashboard/finance/deposits" className="group/card bg-slate-900/60 rounded-xl p-3 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Gateway</span>
                        </div>
                        <p className="text-lg font-black text-emerald-400 leading-none">{fmt(gatewayDeposits)}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{fmtNum(gatewayCount)} txns</p>
                    </Link>

                    {/* Manual */}
                    <Link href="/dashboard/finance/adjustments" className="group/card bg-slate-900/60 rounded-xl p-3 border border-violet-500/20 hover:border-violet-500/40 transition-colors">
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">MAN Adj.</span>
                        </div>
                        <p className="text-lg font-black text-violet-400 leading-none">{fmt(manualDeposits)}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{fmtNum(manualCount)} txns</p>
                    </Link>

                    {/* Crypto */}
                    <Link href="/dashboard/finance/deposits?currency=CRYPTO" className="group/card bg-slate-900/60 rounded-xl p-3 border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Crypto</span>
                        </div>
                        <p className="text-lg font-black text-amber-400 leading-none">{fmtUSD(cryptoDeposits)}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{fmtNum(cryptoCount)} txns</p>
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
    const [overview, setOverview] = useState(EMPTY_OVERVIEW);
    const [loading, setLoading] = useState(true);

    // Date range state — default to last 7 days
    const initRange = buildPreset(7);
    const [fromDate, setFromDate] = useState(toDateInputVal(initRange.from));
    const [toDate, setToDate] = useState(toDateInputVal(initRange.to));
    const [dateLabel, setDateLabel] = useState('Last 7 Days');
    const [rangeLoading, setRangeLoading] = useState(false);
    const initialRangeRef = useRef({ from: toDateInputVal(initRange.from), to: toDateInputVal(initRange.to) });

    const loadDashboard = useCallback(async (
        from: string,
        to: string,
        label: string,
        options?: { initial?: boolean },
    ) => {
        const initial = options?.initial ?? false;
        if (initial) {
            setLoading(true);
        } else {
            setRangeLoading(true);
        }

        try {
            const result = await getDashboardOverviewByRange(from, to);
            if (result.success) {
                setOverview(result.data);
            } else {
                setOverview(EMPTY_OVERVIEW);
            }
            setDateLabel(label);
        } catch (e) {
            console.error(e);
        } finally {
            if (initial) {
                setLoading(false);
            } else {
                setRangeLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        void loadDashboard(initialRangeRef.current.from, initialRangeRef.current.to, 'Last 7 Days', { initial: true });
    }, [loadDashboard]);

    const handlePreset = (from: Date, to: Date, label?: string) => {
        const fromStr = toDateInputVal(from);
        const toStr = toDateInputVal(to);
        setFromDate(fromStr);
        setToDate(toStr);
        void loadDashboard(fromStr, toStr, label || 'Custom');
    };

    const handleCustomFrom = (v: string) => {
        setFromDate(v);
        void loadDashboard(v, toDate, 'Custom');
    };

    const handleCustomTo = (v: string) => {
        setToDate(v);
        void loadDashboard(fromDate, v, 'Custom');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="animate-spin text-indigo-500 mx-auto mb-3" size={40} />
                    <p className="text-slate-400 text-sm">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const financials = overview.financials;
    const users = overview.users;
    const bets = overview.bets;
    const wallets = overview.wallets;
    const chartData = overview.chart;
    const recentTransactions = overview.recentTransactions;

    return (
        <div className="space-y-4 sm:space-y-6">

            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Dashboard</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Date Range Picker */}
                    <DateRangePicker
                        from={fromDate}
                        to={toDate}
                        onFromChange={handleCustomFrom}
                        onToChange={handleCustomTo}
                        onPreset={(f, t) => {
                            // find matching label
                            const preset = PRESETS.find(p => {
                                const { from: pf, to: pt } = buildPreset(p.days);
                                return toDateInputVal(pf) === toDateInputVal(f) && toDateInputVal(pt) === toDateInputVal(t);
                            });
                            handlePreset(f, t, preset?.label || 'Custom');
                        }}
                    />
                    <button
                        onClick={() => void loadDashboard(fromDate, toDate, dateLabel)}
                        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700">
                        <RefreshCcw size={13} /> Refresh
                    </button>
                </div>
            </div>

            {/* ── Date Range Stats Banner ──────────────────────────────────── */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 flex flex-wrap items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal size={14} className="text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                        Range: {dateLabel}
                    </span>
                    {rangeLoading && <Loader2 size={12} className="animate-spin text-indigo-400" />}
                </div>
                <div className="flex flex-wrap gap-4">
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Gateway</p>
                        <p className="text-sm font-bold text-emerald-400">{fmt(financials.gatewayDeposits)}</p>
                    </div>
                    <div className="w-px bg-slate-700 self-stretch" />
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Manual Adj.</p>
                        <p className="text-sm font-bold text-violet-400">{fmt(financials.manualDeposits)}</p>
                    </div>
                    <div className="w-px bg-slate-700 self-stretch" />
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Crypto</p>
                        <p className="text-sm font-bold text-amber-400">{fmtUSD(financials.cryptoDeposits)}</p>
                    </div>
                    <div className="w-px bg-slate-700 self-stretch" />
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Withdrawals</p>
                        <p className="text-sm font-bold text-red-400">{fmt(financials.totalWithdrawals)}</p>
                    </div>
                    <div className="w-px bg-slate-700 self-stretch" />
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Net GGR</p>
                        <p className={`text-sm font-bold ${financials.ggr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt(financials.ggr)}
                        </p>
                    </div>
                    <div className="w-px bg-slate-700 self-stretch" />
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Depositors</p>
                        <p className="text-sm font-bold text-blue-400">{fmtNum(users.uniqueDepositors)}</p>
                    </div>
                    <div className="w-px bg-slate-700 self-stretch" />
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">FTD</p>
                        <p className="text-sm font-bold text-cyan-400">{fmtNum(users.ftdCount)}</p>
                    </div>
                </div>
            </div>

            {/* ── Main KPI Cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <KPICard
                    title="Gross Gaming Revenue"
                    value={fmt(financials.ggr)}
                    sub={`${fmtNum(financials.depositCount)} deposits · ${fmtNum(financials.withdrawalCount)} withdrawals`}
                    icon={TrendingUp}
                    color="text-emerald-400"
                    bg="bg-emerald-500/10"
                    trend={financials.ggr > 0
                        ? { value: 'Positive', positive: true }
                        : { value: 'Negative', positive: false }}
                />
                <KPICard
                    title="Total Users"
                    value={fmtNum(users.totalUsers)}
                    sub={`${fmtNum(users.activeUsers)} active · ${fmtNum(users.newUsers)} new in ${dateLabel}`}
                    icon={Users}
                    color="text-blue-400"
                    bg="bg-blue-500/10"
                    href="/dashboard/users"
                    trend={users.newUsers > 0 ? { value: `${fmtNum(users.newUsers)} new`, positive: true } : undefined}
                />
                <KPICard
                    title="FTD"
                    value={fmtNum(users.ftdCount)}
                    sub={`${fmt(users.ftdDepositAmount)} deposited`}
                    icon={UserPlus}
                    color="text-cyan-400"
                    bg="bg-cyan-500/10"
                    trend={users.ftdCount > 0 ? { value: fmtPct(users.ftdRate), positive: true } : undefined}
                />
                <KPICard
                    title="Deposits (Range)"
                    value={fmt(financials.totalDeposits)}
                    sub={`${fmtNum(financials.depositCount)} approved/completed`}
                    icon={DollarSign}
                    color="text-violet-400"
                    bg="bg-violet-500/10"
                    href="/dashboard/finance/deposits"
                />
                <KPICard
                    title="Pending Withdrawals"
                    value={String(financials.pendingWithdrawals)}
                    sub={`${fmt(financials.pendingWithdrawalsAmount)} awaiting approval`}
                    icon={Clock}
                    color="text-amber-400"
                    bg="bg-amber-500/10"
                    href="/dashboard/finance/withdrawals"
                    alert={financials.pendingWithdrawals > 0}
                />
            </div>

            {/* ── Deposit Breakdown + Crypto + Withdrawals + Depositors ──── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* Deposit split takes 2 columns */}
                <DepositSplitCard
                    gatewayDeposits={financials.gatewayDeposits}
                    gatewayCount={financials.gatewayCount}
                    manualDeposits={financials.manualDeposits}
                    manualCount={financials.manualCount}
                    cryptoDeposits={financials.cryptoDeposits}
                    cryptoCount={financials.cryptoCount}
                    dateLabel={dateLabel}
                />

                {/* Crypto Deposits KPI */}
                <KPICard
                    title="Crypto Deposits (Range)"
                    value={fmtUSD(financials.cryptoDeposits)}
                    sub={`${fmtNum(financials.cryptoCount)} transactions · ${dateLabel}`}
                    icon={Bitcoin}
                    color="text-amber-400"
                    bg="bg-amber-500/10"
                    href="/dashboard/finance/deposits?currency=CRYPTO"
                    badge="CRYPTO"
                    trend={financials.cryptoDeposits > 0 ? { value: `${fmtNum(financials.cryptoCount)} txns`, positive: true } : undefined}
                />

                {/* Withdrawals (Range) */}
                <KPICard
                    title="Withdrawals (Range)"
                    value={fmt(financials.totalWithdrawals)}
                    sub={`${fmtNum(financials.withdrawalCount)} approved · ${dateLabel}`}
                    icon={ArrowUpRight}
                    color="text-red-400"
                    bg="bg-red-500/10"
                    href="/dashboard/finance/withdrawals"
                    badge={dateLabel === 'Today' ? 'TODAY' : undefined}
                />
            </div>

            {/* ── Range Quick Stats ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl p-4 flex items-center gap-3 group hover:border-blue-500/50 transition-all">
                    <div className="p-2.5 rounded-xl bg-blue-500/20 flex-shrink-0">
                        <UserCheck size={20} className="text-blue-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-blue-300">{fmtNum(users.uniqueDepositors)}</p>
                        <p className="text-[11px] text-blue-400/80 font-semibold">Depositors</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{dateLabel}</p>
                    </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3 hover:border-indigo-500/30 transition-all">
                    <div className="p-2 rounded-lg bg-indigo-500/10 flex-shrink-0">
                        <ArrowDownRight size={16} className="text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-base">{fmt(financials.avgDeposit)}</p>
                        <p className="text-slate-400 text-[11px]">Average Deposit</p>
                    </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3 hover:border-orange-500/30 transition-all">
                    <div className="p-2 rounded-lg bg-orange-500/10 flex-shrink-0">
                        <ArrowUpRight size={16} className="text-orange-400" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-base">{fmt(financials.avgWithdrawal)}</p>
                        <p className="text-slate-400 text-[11px]">Average Withdrawal</p>
                    </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3 hover:border-sky-500/30 transition-all">
                    <div className="p-2 rounded-lg bg-sky-500/10 flex-shrink-0">
                        <Target size={16} className="text-sky-400" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-base">{fmtNum(bets.pendingBets)}</p>
                        <p className="text-slate-400 text-[11px]">Active Bets</p>
                    </div>
                </div>
            </div>

            {/* ── Secondary Stats Row ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'New Registrations', value: fmtNum(users.newUsers), icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Approved Withdrawals', value: fmtNum(financials.withdrawalCount), icon: ArrowUpRight, color: 'text-red-400', bg: 'bg-red-500/10' },
                    { label: 'Bet Volume', value: fmt(bets.betVolume), icon: Wallet, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: 'Total Bets (Range)', value: fmtNum(bets.totalBets), icon: Target, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                ].map(s => (
                    <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${s.bg} flex-shrink-0`}>
                            <s.icon size={16} className={s.color} />
                        </div>
                        <div>
                            <p className="text-white font-bold text-base">{s.value}</p>
                            <p className="text-slate-400 text-[11px]">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Wallet Snapshot ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    {
                        label: 'Total User Balance',
                        value: fmt(wallets.totalUserBalance),
                        icon: Wallet,
                        color: 'text-white',
                        bg: 'bg-white/5',
                        note: 'Current main fiat wallet total',
                    },
                    {
                        label: 'Main W. Exposure',
                        value: fmt(wallets.mainWalletExposure),
                        icon: Shield,
                        color: 'text-red-400',
                        bg: 'bg-red-500/10',
                        note: `Main wallet liability · total ${fmt(wallets.totalUserExposure)}`,
                    },
                    {
                        label: 'Bonus W. Exposure',
                        value: fmt(wallets.bonusWalletExposure),
                        icon: Shield,
                        color: 'text-rose-400',
                        bg: 'bg-rose-500/10',
                        note: 'Bonus wallet sports liability',
                    },
                    {
                        label: 'Total User Bonus',
                        value: fmt(wallets.totalUserBonus),
                        icon: Gift,
                        color: 'text-violet-300',
                        bg: 'bg-violet-500/10',
                        note: 'Fiat + casino + sports bonus',
                    },
                ].map((item) => (
                    <div key={item.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${item.bg} flex-shrink-0`}>
                            <item.icon size={16} className={item.color} />
                        </div>
                        <div>
                            <p className={`font-bold text-base ${item.color}`}>{item.value}</p>
                            <p className="text-[11px] text-slate-400">{item.label}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{item.note}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Chart + Side Panels ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Revenue Chart */}
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 sm:p-5 lg:col-span-2">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h3 className="text-base font-bold text-white">Revenue Overview</h3>
                            <p className="text-xs text-slate-400 mt-0.5">{dateLabel} — Deposits vs Withdrawals</p>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />Deposits</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Withdrawals</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />GGR</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="wdGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="ggrGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                            <Tooltip
                                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', fontSize: 12 }}
                                formatter={(value) => [fmt(Number(Array.isArray(value) ? value[0] : value ?? 0)), '']}
                            />
                            <Area type="monotone" dataKey="deposits" stroke="#6366f1" strokeWidth={2} fill="url(#depGrad)" name="Deposits" />
                            <Area type="monotone" dataKey="withdrawals" stroke="#ef4444" strokeWidth={2} fill="url(#wdGrad)" name="Withdrawals" />
                            <Area type="monotone" dataKey="ggr" stroke="#10b981" strokeWidth={2} fill="url(#ggrGrad)" name="GGR" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Right Panels */}
                <div className="space-y-4">
                    {/* Pending Action Alert */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                            <Bell size={15} className="text-amber-400" /> Pending Actions
                        </h3>
                        {financials.pendingWithdrawals > 0 ? (
                            <Link href="/dashboard/finance/withdrawals"
                                className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 transition-colors hover:bg-amber-500/15 sm:items-center">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={13} className="text-amber-400" />
                                    <div>
                                        <p className="text-sm text-amber-300 font-semibold">{financials.pendingWithdrawals} Withdrawals</p>
                                        <p className="text-xs text-amber-400/70">{fmt(financials.pendingWithdrawalsAmount)} pending</p>
                                    </div>
                                </div>
                                <ArrowUpRight size={14} className="text-amber-400" />
                            </Link>
                        ) : (
                            <p className="text-sm text-slate-500 flex items-center gap-2">
                                <CheckCircle size={14} className="text-emerald-400" /> All clear — nothing pending
                            </p>
                        )}
                    </div>

                    {/* Financial Summary */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                            <Wallet size={15} className="text-violet-400" /> Financials ({dateLabel})
                        </h3>
                        <MiniStat label="Gateway Deposits" value={fmt(financials.gatewayDeposits)} color="text-emerald-400" />
                        <MiniStat label="Manual Adj." value={fmt(financials.manualDeposits)} color="text-violet-400" />
                        <MiniStat label="Crypto Deposits" value={fmtUSD(financials.cryptoDeposits)} color="text-amber-400" />
                        <MiniStat label="Withdrawals" value={fmt(financials.totalWithdrawals)} color="text-red-400" />
                        <MiniStat label="Net GGR" value={fmt(financials.ggr)} color={financials.ggr >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                        <MiniStat label="Depositors" value={fmtNum(users.uniqueDepositors)} color="text-blue-400" />
                        <MiniStat label="Avg Deposit" value={fmt(financials.avgDeposit)} color="text-blue-300" />
                        <MiniStat label="Avg Withdrawal" value={fmt(financials.avgWithdrawal)} color="text-orange-400" />
                    </div>


                    {/* User & Bet Stats */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                            <UserPlus size={15} className="text-blue-400" /> Users & Bets
                        </h3>
                        <MiniStat label="Total Users" value={fmtNum(users.totalUsers)} />
                        <MiniStat label="Active Users" value={fmtNum(users.activeUsers)} color="text-emerald-400" />
                        <MiniStat label="New Registrations" value={fmtNum(users.newUsers)} color="text-blue-400" />
                        <MiniStat label="FTD" value={fmtNum(users.ftdCount)} color="text-cyan-400" />
                        <MiniStat label="FTD Deposited" value={fmt(users.ftdDepositAmount)} color="text-cyan-300" />
                        <MiniStat label="Total Bets" value={fmtNum(bets.totalBets)} />
                        <MiniStat label="Active Bets" value={fmtNum(bets.pendingBets)} color="text-sky-400" />
                        <MiniStat label="Bet Volume" value={fmt(bets.betVolume)} color="text-violet-400" />
                    </div>
                </div>
            </div>

            {/* ── Quick Actions ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {[
                    { href: '/dashboard/users', label: 'Users', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { href: '/dashboard/finance/withdrawals', label: 'Approvals', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { href: '/dashboard/finance/adjustments', label: 'Adjust Bal', icon: Wallet, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                    { href: '/dashboard/casino/games', label: 'Casino', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { href: '/dashboard/cms/vip-applications', label: 'VIP', icon: Shield, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                    { href: '/dashboard/finance/transactions', label: 'Transactions', icon: CreditCard, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                ].map(a => (
                    <Link key={a.href} href={a.href}
                        className="flex flex-col items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-center transition-all hover:border-slate-500 group">
                        <div className={`p-2 rounded-lg ${a.bg} group-hover:scale-110 transition-transform`}>
                            <a.icon size={16} className={a.color} />
                        </div>
                        <span className="text-xs text-slate-400 group-hover:text-white transition-colors">{a.label}</span>
                    </Link>
                ))}
            </div>

            {/* ── Recent Transactions ─────────────────────────────────────── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="flex flex-col gap-2 border-b border-slate-700 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <CreditCard size={16} className="text-indigo-400" /> Recent Transactions ({dateLabel})
                    </h3>
                    <Link href="/dashboard/finance/transactions" className="text-xs text-indigo-400 hover:text-indigo-300">
                        View All →
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-[640px] w-full text-sm">
                        <thead>
                            <tr className="text-[10px] text-slate-500 uppercase bg-slate-900/40 border-b border-slate-700">
                                <th className="px-4 py-3 text-left sm:px-5">User</th>
                                <th className="px-4 py-3 text-left sm:px-5">Type</th>
                                <th className="px-4 py-3 text-left sm:px-5">Amount</th>
                                <th className="px-4 py-3 text-left sm:px-5">Status</th>
                                <th className="px-4 py-3 text-left sm:px-5">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/40">
                            {recentTransactions.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">No transactions in the selected range.</td></tr>
                            )}
                            {recentTransactions.map((tx: DashboardRecentTransaction) => (
                                <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3 sm:px-5">
                                        <div className="text-white font-medium text-xs">{tx.user?.username || 'N/A'}</div>
                                        <div className="text-slate-500 text-[10px]">{tx.user?.email || ''}</div>
                                    </td>
                                    <td className="px-4 py-3 sm:px-5">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tx.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-400' :
                                                tx.type === 'WITHDRAWAL' ? 'bg-red-500/10 text-red-400' :
                                                    'bg-blue-500/10 text-blue-400'
                                            }`}>
                                            {tx.type === 'DEPOSIT' ? <ArrowDownRight size={9} /> : <ArrowUpRight size={9} />}
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className={`px-4 py-3 font-mono font-bold text-xs sm:px-5 ${tx.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {fmt(tx.amount)}
                                    </td>
                                    <td className="px-4 py-3 sm:px-5">
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${tx.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                                tx.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                                                    tx.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                                                        'bg-slate-700 text-slate-300'
                                            }`}>{tx.status}</span>
                                    </td>
                                    <td className="px-4 py-3 text-[10px] text-slate-400 sm:px-5">
                                        {new Date(tx.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
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
