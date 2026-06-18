"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getMarketLiability } from '@/actions/sports';
import { getSettledBets, settleBetsByMarket, settleByMarketResult } from '@/actions/settlement';
import {
    Search, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
    Loader2, TrendingUp, TrendingDown, DollarSign, Activity,
    BarChart2, Users, ArrowUpRight,
    Info, RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OddsInfo {
    provider: 'SPORTRADAR' | string;
    acceptedOdds: number;
    submittedOdds: number | null;
    profit: number | null;
    marketType: string | null;
    oddsAdjusted: boolean;
}

interface MarketSelection {
    selectionId: string;
    selectionName: string;
    betCount: number;
    totalStake: number;
    totalPayout: number;
}

interface Market {
    marketId: string;
    marketName: string;
    eventId: string;
    eventName: string;
    marketTotalStake?: number;
    selections?: MarketSelection[];
}

interface SettledBet {
    id: string;
    eventId?: string;
    userId?: number;
    username?: string | null;
    eventName?: string;
    marketName?: string;
    selectionName?: string;
    displayMarketName?: string;
    displaySelectionName?: string;
    winnerName?: string;
    status: string;
    stake: number;
    potentialWin: number;
    odds?: number;
    betType?: string;
    settledReason?: string;
    settledAt?: string;
    createdAt: string;
    oddsInfo?: OddsInfo;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const fmtOdds = (n: number | null | undefined) =>
    n != null ? n.toFixed(2) : '—';

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        WON: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        LOST: 'bg-red-500/10 text-red-400 border-red-500/20',
        VOID: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
        CASHED_OUT: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    };
    const cls = map[status] || map.VOID;
    return (
        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
            {status}
        </span>
    );
}

// ─── KPI Stats Bar ────────────────────────────────────────────────────────────

function StatsBar({ bets }: { bets: SettledBet[] }) {
    const wonBets = bets.filter(b => b.status === 'WON');
    const lostBets = bets.filter(b => b.status === 'LOST');
    const totalStake = bets.reduce((s, b) => s + (b.stake || 0), 0);
    const totalPayout = wonBets.reduce((s, b) => s + (b.potentialWin || 0), 0);
    // House P&L: what house kept (lost stakes) - what house paid out (win profit)
    const houseKept = lostBets.reduce((s, b) => s + (b.stake || 0), 0);
    const housePaid = wonBets.reduce((s, b) => s + ((b.potentialWin || 0) - (b.stake || 0)), 0);
    const houseNet = houseKept - housePaid;

    const stats = [
        { label: 'Total Bets', value: bets.length, icon: BarChart2, color: 'text-white', suffix: '' },
        { label: 'Total Staked', value: fmt(totalStake), icon: DollarSign, color: 'text-amber-400', suffix: '' },
        { label: 'Total Paid Out', value: fmt(totalPayout), icon: ArrowUpRight, color: 'text-emerald-400', suffix: '' },
        { label: 'House P&L', value: fmt(Math.abs(houseNet)), icon: houseNet >= 0 ? TrendingUp : TrendingDown, color: houseNet >= 0 ? 'text-emerald-400' : 'text-red-400', suffix: houseNet >= 0 ? '▲' : '▼' },
        { label: 'Unique Players', value: new Set(bets.map(b => b.userId)).size, icon: Users, color: 'text-sky-400', suffix: '' },
        { label: 'Win Rate', value: `${bets.length > 0 ? Math.round((wonBets.length / bets.filter(b => b.status === 'WON' || b.status === 'LOST').length || 0) * 100) : 0}%`, icon: Activity, color: 'text-indigo-400', suffix: '' },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {stats.map(s => (
                <div key={s.label} className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                        <s.icon size={12} className="text-slate-400" />
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</span>
                    </div>
                    <p className={`text-base font-black tabular-nums ${s.color}`}>
                        {s.suffix} {s.value}
                    </p>
                </div>
            ))}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettlementPage() {
    const router = useRouter();
    const [markets, setMarkets] = useState<Market[]>([]);
    const [settledBets, setSettledBets] = useState<SettledBet[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
    const [settling, setSettling] = useState(false);
    const [srSettling, setSrSettling] = useState<string | null>(null); // eventId being SR-settled
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [expandedBet, setExpandedBet] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        void fetchMarkets();
    }, []);

    useEffect(() => {
        void fetchSettledHistory();
    }, [page]);

    const fetchMarkets = async () => {
        setLoading(true);
        try {
            const res = await getMarketLiability();
            if (res.success && res.data) {
                const list = (res.data as any[]).map(m => ({
                    marketId: m._id?.marketId || '',
                    marketName: m.marketName || '',
                    eventId: m._id?.eventId || '',
                    eventName: m.eventName || '',
                    marketTotalStake: m.marketTotalStake || 0,
                    selections: (m.selections || []).map((s: any) => ({
                        selectionId: String(s.selectionName || s.selectionId || ''),
                        selectionName: s.selectionName || '',
                        betCount: s.betCount || 0,
                        totalStake: s.totalStake || 0,
                        totalPayout: s.totalPayout || 0,
                    })),
                }));
                setMarkets(list);
            }
        } finally { setLoading(false); }
    };

    const fetchSettledHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await getSettledBets(page, 100);
            setSettledBets(res.success ? (res.data as SettledBet[]) : []);
            setTotalPages(res.pagination?.pages || 1);
        } finally { setHistoryLoading(false); }
    };

    const handleSrSettle = async (eventId: string, eventName: string) => {
        if (!confirm(`Auto-settle from the official result API for:\n"${eventName}"?\n\nThis will fetch published results and settle all pending bets. Irreversible.`)) return;
        setSrSettling(eventId);
        try {
            const res = await settleByMarketResult(eventId);
            if (res.success) {
                alert(`✅ Auto-settle complete: ${res.betsSettled ?? 0} bets settled across ${res.marketsProcessed ?? 0} market(s).${res.errors?.length ? '\n⚠️ ' + res.errors.join('\n') : ''}`);
                void Promise.all([fetchMarkets(), fetchSettledHistory()]);
            } else {
                alert(`❌ ${res.message}`);
            }
        } finally { setSrSettling(null); }
    };

    const handleSettle = async (selectionId: string, selectionName: string) => {
        if (!confirm(`Declare "${selectionName}" as WINNER? This is irreversible.`)) return;
        setSettling(true);
        try {
            const res = await settleBetsByMarket(
                selectedMarket?.marketId || '',
                selectionId,
                selectedMarket?.eventId,
            );
            if (res.success) {
                alert(`✅ Settled! ${res.settled ?? 0} bets processed.`);
                void Promise.all([fetchMarkets(), fetchSettledHistory()]);
                setSelectedMarket(null);
            } else {
                alert(res.message || 'Settlement failed.');
            }
        } finally { setSettling(false); }
    };

    const openSuperVoid = (eventId?: string, eventName?: string) => {
        const q = new URLSearchParams();
        if (eventId) q.set('eventId', eventId);
        if (eventName) q.set('eventName', eventName);
        const qs = q.toString();
        router.push(qs ? `/dashboard/sports/super-void?${qs}` : '/dashboard/sports/super-void');
    };

    // ── Filtered bets ─────────────────────────────────────────────────────────
    const filteredBets = useMemo(() => {
        const term = search.toLowerCase();
        return settledBets.filter(bet => {
            const matchText = !term || [
                bet.eventName, bet.displayMarketName || bet.marketName, bet.displaySelectionName || bet.selectionName,
                bet.username, String(bet.userId || ''), bet.settledReason,
            ].some(s => (s || '').toLowerCase().includes(term));

            const matchStatus = statusFilter === 'ALL' || bet.status === statusFilter;

            return matchText && matchStatus;
        });
    }, [settledBets, search, statusFilter]);

    const filteredMarkets = markets.filter(m =>
        m.eventName.toLowerCase().includes(search.toLowerCase()) ||
        m.marketName.toLowerCase().includes(search.toLowerCase())
    );

    const statusOptions = ['ALL', 'WON', 'LOST', 'VOID', 'CASHED_OUT'];

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Result Settlement</h1>
                    <p className="mt-1 text-sm text-slate-400">Settle markets, review results, and audit bet history.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setLoading(true); setHistoryLoading(true); setPage(1); void Promise.all([fetchMarkets(), fetchSettledHistory()]); }}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-600 transition"
                    >
                        <RefreshCw size={13} /> Refresh
                    </button>
                    <Link
                        href="/dashboard/sports/super-void"
                        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 transition"
                    >
                        <AlertTriangle size={15} /> Super Void
                    </Link>
                </div>
            </div>

            {/* ── KPI Stats ── */}
            {!historyLoading && <StatsBar bets={settledBets} />}

            {/* ── Search + Filters ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search event, market, player, reason…"
                        className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {/* Status filter */}
                <div className="flex gap-1.5 flex-wrap">
                    {statusOptions.map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                                statusFilter === s
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            }`}
                        >
                            {s === 'ALL' ? 'All Status' : s}
                        </button>
                    ))}
                </div>

            </div>

            {/* ── Pending Markets ── */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Activity size={15} className="text-amber-400" />
                    <h2 className="text-base font-bold text-white">Pending Markets</h2>
                    {markets.length > 0 && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                            {markets.length} active
                        </span>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 py-8 text-center justify-center text-slate-500 text-sm">
                        <Loader2 size={16} className="animate-spin" /> Loading…
                    </div>
                ) : filteredMarkets.length === 0 ? (
                    <div className="rounded-lg border border-slate-700 bg-slate-800/40 py-10 text-center text-sm text-slate-500">
                        No pending markets. All clear! 🎉
                    </div>
                ) : (
                    filteredMarkets.map(market => {
                        const isOpen = selectedMarket?.marketId === market.marketId;
                        const maxLiability = (market.selections || []).reduce((m, s) => Math.max(m, s.totalPayout), 0);

                        return (
                            <div key={market.marketId} className="rounded-xl border border-slate-700 bg-slate-800/70 overflow-hidden">
                                <button
                                    onClick={() => setSelectedMarket(isOpen ? null : market)}
                                    className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-700/30 transition"
                                >
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-white truncate">{market.eventName}</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">{market.marketName}</p>
                                        <p className="text-[10px] text-slate-600 mt-0.5">ID: {market.eventId}</p>
                                    </div>
                                    <div className="flex items-center gap-4 flex-shrink-0">
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-500">Volume</p>
                                            <p className="font-mono font-bold text-amber-400 text-sm">{fmt(market.marketTotalStake || 0)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-500">Max Liability</p>
                                            <p className="font-mono font-bold text-red-400 text-sm">{fmt(maxLiability)}</p>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); openSuperVoid(market.eventId, market.eventName); }}
                                            className="rounded border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold text-red-300 hover:bg-red-500/20 cursor-pointer"
                                        >
                                            Void
                                        </button>
                                        <button
                                            onClick={e => { e.stopPropagation(); void handleSrSettle(market.eventId, market.eventName); }}
                                            disabled={srSettling === market.eventId}
                                            className="rounded border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[10px] font-bold text-sky-300 hover:bg-sky-500/20 cursor-pointer disabled:opacity-50"
                                        >
                                            {srSettling === market.eventId ? '⏳' : '⚡'} Auto Settle
                                        </button>
                                        {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                    </div>
                                </button>

                                {isOpen && (
                                    <div className="border-t border-slate-700 bg-slate-900/50 p-4 space-y-3">
                                        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
                                            <AlertTriangle size={12} /> This action is irreversible. Verify the official result before settling.
                                        </div>
                                        <div className="grid gap-2">
                                            {(market.selections || []).map(sel => {
                                                const pct = market.marketTotalStake
                                                    ? Math.round((sel.totalStake / market.marketTotalStake) * 100)
                                                    : 0;
                                                return (
                                                    <div key={sel.selectionId} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700 gap-4">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-bold text-white text-sm">{sel.selectionName}</p>
                                                            <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-1.5">
                                                                <span className="flex items-center gap-1"><Users size={9} /> {sel.betCount} bets</span>
                                                                <span className="flex items-center gap-1"><DollarSign size={9} /> Stake: {fmt(sel.totalStake)}</span>
                                                                <span className="flex items-center gap-1 text-red-400/70"><ArrowUpRight size={9} /> Payout: {fmt(sel.totalPayout)}</span>
                                                                <span className="text-slate-600">{pct}% of volume</span>
                                                            </div>
                                                            {/* Mini stake bar */}
                                                            <div className="mt-2 h-1 rounded-full bg-slate-700">
                                                                <div className="h-1 rounded-full bg-indigo-500/60" style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleSettle(sel.selectionId, sel.selectionName)}
                                                            disabled={settling}
                                                            className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-bold text-white transition flex-shrink-0"
                                                        >
                                                            {settling ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                                            Set Winner
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── Settled Bets Table ── */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle size={15} className="text-emerald-400" />
                        <h2 className="text-base font-bold text-white">Settled Bets</h2>
                        <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                            {filteredBets.length} shown
                        </span>
                    </div>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Info size={10} /> Click any row to expand
                    </span>
                </div>

                {historyLoading ? (
                    <div className="flex items-center gap-2 justify-center py-12 text-slate-500 text-sm">
                        <Loader2 size={16} className="animate-spin" /> Loading settled bets…
                    </div>
                ) : filteredBets.length === 0 ? (
                    <div className="rounded-lg border border-slate-700 bg-slate-800/40 py-12 text-center text-sm text-slate-500">
                        No settled bets match your filters.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800">
                        <table className="min-w-[1200px] w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-700">
                                <tr>
                                    <th className="px-4 py-3">Event / Market / User</th>
                                    <th className="px-4 py-3">Selection</th>
                                    <th className="px-4 py-3 text-right">Odds</th>
                                    <th className="px-4 py-3 text-right">Stake</th>
                                    <th className="px-4 py-3 text-right">Profit</th>
                                    <th className="px-4 py-3 text-right">Total Return</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Settled</th>
                                    <th className="px-4 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {filteredBets.map(bet => {
                                    const info = bet.oddsInfo;
                                    const oddsAdjusted = info?.oddsAdjusted;
                                    const acceptedOdds = info?.acceptedOdds ?? bet.odds ?? 0;
                                    const submittedOdds = info?.submittedOdds;
                                    const profit = info?.profit ?? ((acceptedOdds - 1) * (bet.stake || 0));
                                    const totalReturn = bet.potentialWin || (bet.stake * acceptedOdds);
                                    const isExpanded = expandedBet === bet.id;
                                    const isWon = bet.status === 'WON';
                                    const isLost = bet.status === 'LOST';
                                    const marketName = bet.displayMarketName || bet.marketName || '—';
                                    const selectionName = bet.displaySelectionName || bet.selectionName || '—';

                                    return (
                                        <React.Fragment key={bet.id}>
                                            <tr
                                                className="hover:bg-slate-700/20 cursor-pointer transition-colors"
                                                onClick={() => setExpandedBet(isExpanded ? null : bet.id)}
                                            >
                                                {/* Event / Market */}
                                                <td className="px-4 py-3 align-top">
                                                    <p className="font-semibold text-white text-[12px] leading-tight">{bet.eventName || '—'}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{marketName}</p>
                                                    {(bet.username || bet.userId) && (
                                                        <p className="text-[10px] text-slate-600 mt-0.5">
                                                            {bet.username ? `@${bet.username}` : ''}{bet.userId ? ` · #${bet.userId}` : ''}
                                                        </p>
                                                    )}
                                                </td>

                                                {/* Selection */}
                                                <td className="px-4 py-3 align-top">
                                                    <p className="text-indigo-300 font-semibold text-[12px]">{selectionName}</p>
                                                </td>

                                                {/* Odds */}
                                                <td className="px-4 py-3 text-right align-top">
                                                    <p className="font-mono font-bold text-amber-400 text-[13px]">{fmtOdds(acceptedOdds)}</p>
                                                    {oddsAdjusted && submittedOdds != null && (
                                                        <p className="text-[9px] text-slate-500 mt-0.5 tabular-nums">
                                                            orig: {fmtOdds(submittedOdds)}
                                                            <span className="ml-1 text-amber-500/70">adjusted</span>
                                                        </p>
                                                    )}
                                                </td>

                                                {/* Stake */}
                                                <td className="px-4 py-3 text-right font-mono align-top text-white text-[12px]">
                                                    {fmt(bet.stake)}
                                                </td>

                                                {/* Profit */}
                                                <td className="px-4 py-3 text-right font-mono align-top">
                                                    <span className={isWon ? 'text-emerald-400 font-bold' : isLost ? 'text-red-400' : 'text-slate-500'}>
                                                        {isWon ? `+${fmt(profit)}` : isLost ? `-${fmt(bet.stake)}` : fmt(profit)}
                                                    </span>
                                                </td>

                                                {/* Total Return */}
                                                <td className="px-4 py-3 text-right font-mono align-top">
                                                    <span className={isWon ? 'text-emerald-300 font-bold' : 'text-slate-500'}>
                                                        {isWon ? fmt(totalReturn) : '—'}
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td className="px-4 py-3 align-top">
                                                    <StatusBadge status={bet.status} />
                                                </td>

                                                {/* Settled */}
                                                <td className="px-4 py-3 align-top text-[10px] text-slate-400">
                                                    {bet.settledAt
                                                        ? new Date(bet.settledAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                                        : new Date(bet.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </td>

                                                {/* Action */}
                                                <td className="px-4 py-3 align-top">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); openSuperVoid(bet.eventId, bet.eventName); }}
                                                        className="rounded border border-red-500/25 bg-red-500/8 px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/15"
                                                    >
                                                        Void Event
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* ── Expanded detail row ── */}
                                            {isExpanded && (
                                                <tr className="bg-slate-900/40">
                                                    <td colSpan={9} className="px-6 py-4">
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
                                                            {/* Bet ID */}
                                                            <div>
                                                                <p className="text-slate-500 mb-0.5">Bet ID</p>
                                                                <p className="font-mono text-slate-300 text-[10px] break-all">{bet.id}</p>
                                                            </div>
                                                            {/* Placed at */}
                                                            <div>
                                                                <p className="text-slate-500 mb-0.5">Placed At</p>
                                                                <p className="text-slate-300">{new Date(bet.createdAt).toLocaleString()}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-slate-500 mb-0.5">Market</p>
                                                                <p className="text-slate-300">{marketName}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-slate-500 mb-0.5">Selection</p>
                                                                <p className="text-slate-300">{selectionName}</p>
                                                            </div>
                                                            {bet.winnerName && (
                                                                <div>
                                                                    <p className="text-slate-500 mb-0.5">Result</p>
                                                                    <p className="text-emerald-300 font-semibold">{bet.winnerName}</p>
                                                                </div>
                                                            )}
                                                            {/* Accepted odds */}
                                                            <div>
                                                                <p className="text-slate-500 mb-0.5">Accepted Odds</p>
                                                                <p className="font-mono font-bold text-amber-400">{fmtOdds(acceptedOdds)}</p>
                                                            </div>
                                                            {/* Submitted odds */}
                                                            {submittedOdds != null && (
                                                                <div>
                                                                    <p className="text-slate-500 mb-0.5">Submitted Odds</p>
                                                                    <p className={`font-mono ${oddsAdjusted ? 'text-orange-400' : 'text-slate-300'}`}>
                                                                        {fmtOdds(submittedOdds)}
                                                                        {oddsAdjusted && <span className="ml-1 text-[9px] text-orange-400/70">(adjusted)</span>}
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {/* Stake breakdown */}
                                                            <div>
                                                                <p className="text-slate-500 mb-0.5">Stake → Profit → Return</p>
                                                                <p className="font-mono text-slate-300">
                                                                    {fmt(bet.stake)}
                                                                    <span className="text-slate-600 mx-1">→</span>
                                                                    <span className="text-emerald-400">{fmt(profit)}</span>
                                                                    <span className="text-slate-600 mx-1">→</span>
                                                                    <span className="text-sky-400">{fmt(totalReturn)}</span>
                                                                </p>
                                                            </div>
                                                            {/* Settlement reason */}
                                                            {bet.settledReason && (
                                                                <div className="col-span-full">
                                                                    <p className="text-slate-500 mb-0.5">Settlement Reason</p>
                                                                    <p className="text-slate-300 leading-relaxed">
                                                                        {bet.settledReason}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 py-4">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-slate-400 font-medium">Page {page} of {totalPages}</span>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
