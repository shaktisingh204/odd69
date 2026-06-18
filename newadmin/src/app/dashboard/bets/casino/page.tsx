"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getCasinoBets, getCasinoBetStats, getCasinoBetProviders } from '@/actions/bets';
import {
    Gamepad2, Search, RefreshCcw, ChevronLeft, ChevronRight,
    Loader2, X, Clock, CheckCircle, XCircle,
    TrendingDown, TrendingUp, Copy, Check, ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { UserPopup } from '@/components/shared/UserPopup';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CasinoBet {
    _id: string;
    id?: number;
    userId: number;
    username?: string;
    gameCode: string;
    gameName?: string;
    provider?: string;
    roundId?: string;
    txnId?: string;
    type?: string;          // BET | WIN | UPDATE
    walletType?: string;    // fiat | crypto
    betAmount: number;
    winAmount: number;
    amount?: number;
    status: string;
    currency: string;
    createdAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number, currency: string = 'INR') => {
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
    } catch {
        return `${currency} ${n.toFixed(2)}`;
    }
};

const fmtNum = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

function CopyChip({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    if (!value) return null;
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
            }}
            className="text-slate-500 hover:text-white transition-colors ml-1 inline-flex align-middle"
            title="Copy"
        >
            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
        </button>
    );
}

const WALLET_PILL: Record<string, string> = {
    fiat: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    crypto: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
};

const STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    CANCELLED: 'bg-slate-700 text-slate-400 border-slate-600',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
    PENDING: <Clock size={10} />,
    COMPLETED: <CheckCircle size={10} />,
    CANCELLED: <XCircle size={10} />,
};

const TXN_TYPES = ['ALL', 'BET', 'WIN'];

// ─── Stat Pill ──────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className={`flex flex-col gap-0.5 px-4 py-3 rounded-xl border bg-slate-800 ${color}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
            <span className="text-base font-black text-white">{value}</span>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function CasinoBetsContent() {
    const searchParams = useSearchParams();
    const [bets, setBets] = useState<CasinoBet[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [providers, setProviders] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [typeFilter, setTypeFilter] = useState('ALL'); // ALL | BET | WIN
    const [providerFilter, setProviderFilter] = useState('ALL');
    const [userIdFilter, setUserIdFilter] = useState('');

    const searchTimer = useRef<NodeJS.Timeout | undefined>(undefined);
    const LIMIT = 50;

    const loadData = useCallback(async (pg = 1) => {
        setLoading(true);
        try {
            const [res, st, prov] = await Promise.all([
                getCasinoBets(pg, LIMIT, { status: typeFilter, search, provider: providerFilter, userId: userIdFilter }),
                pg === 1 ? getCasinoBetStats() : Promise.resolve(null),
                pg === 1 ? getCasinoBetProviders() : Promise.resolve(null),
            ]);
            if (res.success) {
                setBets(res.data);
                setTotalPages(res.pagination.pages);
                setTotal(res.pagination.total);
            }
            if (st?.success && st.data) setStats(st.data);
            if (prov?.success) setProviders(prov.data);
        } finally {
            setLoading(false);
        }
    }, [search, typeFilter, providerFilter, userIdFilter]);

    useEffect(() => { setPage(1); loadData(1); }, [search, typeFilter, providerFilter, userIdFilter]);
    useEffect(() => { loadData(page); }, [page]);

    const handleSearch = (val: string) => {
        setSearchInput(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setSearch(val), 400);
    };

    const s = stats || {};

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-black text-white flex items-center gap-2">
                        <Gamepad2 size={20} className="text-violet-400" /> Casino Bets
                    </h1>
                    <p className="text-slate-400 text-xs mt-0.5">All casino game rounds played on the platform</p>
                </div>
                <button onClick={() => loadData(page)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-lg text-xs transition-colors">
                    <RefreshCcw size={13} /> Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <StatPill label="Total Transactions" value={fmtNum(s.total ?? 0)} color="border-slate-600 text-slate-300" />
                <StatPill label="Total Bet" value={fmt(s.totalBet ?? 0)} color="border-violet-500/20 text-violet-400" />
                <StatPill label="Total Win" value={fmt(s.totalWin ?? 0)} color="border-sky-500/20 text-sky-400" />
                <StatPill
                    label="House Edge"
                    value={fmt(s.houseEdge ?? 0)}
                    color={(s.houseEdge ?? 0) >= 0 ? 'border-emerald-500/20 text-emerald-400' : 'border-red-500/20 text-red-400'}
                />
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-48">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search game, username, round ID..."
                        className="w-full pl-8 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
                        value={searchInput}
                        onChange={e => handleSearch(e.target.value)}
                    />
                    {searchInput && (
                        <button onClick={() => { setSearchInput(''); setSearch(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Type filter */}
                <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                    className="px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-indigo-500">
                    {TXN_TYPES.map(t => <option key={t} value={t}>{t === 'ALL' ? 'All Types' : t}</option>)}
                </select>

                {/* Provider */}
                <select value={providerFilter} onChange={e => { setProviderFilter(e.target.value); setPage(1); }}
                    className="px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-indigo-500">
                    <option value="ALL">All Providers</option>
                    {providers.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                {/* User ID */}
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="User ID..."
                    className="w-28 px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
                    value={userIdFilter}
                    onChange={e => setUserIdFilter(e.target.value.replace(/\D/g, ''))}
                />

                <span className="text-xs text-slate-500 ml-auto">{fmtNum(total)} rounds</span>
            </div>

            {/* Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={28} className="animate-spin text-violet-400" />
                    </div>
                ) : bets.length === 0 ? (
                    <div className="text-center py-14">
                        <Gamepad2 size={36} className="text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400 font-semibold">No casino bets found</p>
                        <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1400px] text-sm">
                            <thead>
                                <tr className="bg-slate-900/60 border-b border-slate-700">
                                    {['#', 'User', 'Game', 'Provider', 'Type', 'Wallet', 'Bet', 'Win', 'P&L', 'Round ID', 'Txn / Serial', 'Game Code', 'Date'].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {bets.map(bet => {
                                    const pnl = bet.winAmount - bet.betAmount;
                                    const currency = bet.currency || 'INR';
                                    const wallet = bet.walletType || (currency === 'USD' ? 'crypto' : 'fiat');
                                    const type = bet.type || (bet.betAmount > 0 ? 'BET' : 'WIN');
                                    const isBet = type === 'BET';
                                    const isWin = type === 'WIN';
                                    return (
                                        <tr key={bet._id} className="border-t border-slate-700/50 hover:bg-slate-700/20 transition-colors align-top">
                                            <td className="px-3 py-2.5 font-mono text-[10px] text-slate-600">{bet.id ?? bet._id}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="text-xs font-mono text-indigo-400">#{bet.userId}</div>
                                                {bet.username && (
                                                    <div className="mt-0.5">
                                                        <UserPopup
                                                            userId={bet.userId}
                                                            username={bet.username}
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="text-xs text-white font-medium max-w-[180px] truncate" title={bet.gameName}>
                                                    {bet.gameName || bet.gameCode}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs text-slate-400">{bet.provider || '—'}</span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                                                    isBet ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                                        : isWin ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        : 'bg-slate-700 text-slate-300 border-slate-600'
                                                }`}>
                                                    {type}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${WALLET_PILL[wallet] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                                    {wallet}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs font-mono text-emerald-400 whitespace-nowrap">{fmt(bet.betAmount, currency)}</span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs font-mono text-sky-400 whitespace-nowrap">{fmt(bet.winAmount, currency)}</span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className={`flex items-center gap-1 text-xs font-mono font-bold whitespace-nowrap ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {pnl >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                    {fmt(Math.abs(pnl), currency)}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-[10px] font-mono text-slate-400 max-w-[140px] truncate block" title={bet.roundId}>
                                                    {bet.roundId || '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-[10px] font-mono text-slate-400 max-w-[160px] truncate inline-block align-middle" title={bet.txnId}>
                                                    {bet.txnId || '—'}
                                                </span>
                                                {bet.txnId && <CopyChip value={bet.txnId} />}
                                                {bet.txnId && (
                                                    <Link
                                                        href={`/dashboard/bets/casino/verify?txnId=${encodeURIComponent(bet.txnId)}&day=${new Date(bet.createdAt).toISOString().slice(0, 10)}&auto=1`}
                                                        className="ml-1.5 inline-flex items-center align-middle text-emerald-400 hover:text-emerald-300"
                                                        title="Verify against HUIDU"
                                                    >
                                                        <ShieldCheck size={11} />
                                                    </Link>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-[10px] font-mono text-slate-500 max-w-[120px] truncate inline-block align-middle" title={bet.gameCode}>
                                                    {bet.gameCode}
                                                </span>
                                                <CopyChip value={bet.gameCode} />
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <span className="text-[10px] text-slate-500">
                                                    {new Date(bet.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-700">
                    <span className="text-xs text-slate-400">{fmtNum(total)} total rounds</span>
                    <div className="flex items-center gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                            className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs text-white px-1">Page {page} / {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                            className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CasinoBetsPage() {
    return (
        <Suspense fallback={<div className="py-20 flex justify-center"><Loader2 className="animate-spin text-violet-500" size={32} /></div>}>
            <CasinoBetsContent />
        </Suspense>
    );
}
