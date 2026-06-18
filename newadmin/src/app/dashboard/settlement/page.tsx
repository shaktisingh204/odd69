"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getPendingBets, getSettledBets, manualSettleBet, getSettlementStats, settleEventMatchOdds, settleByMarketResult, clearAllBets } from "@/actions/settlement";

type Outcome = 'WON' | 'LOST' | 'VOID';

interface ConfirmState {
    bet: any;
    outcome: Outcome;
}

const STYLES: Record<Outcome, { btn: string; badge: string; label: string; detail: (bet: any) => string }> = {
    WON:  {
        btn:    'bg-green-600 hover:bg-green-500',
        badge:  'bg-green-500/20 text-green-300 border-green-500/40',
        label:  '✅ WON',
        detail: (b) => {
            const isBonus = String(b.betSource || '').includes('sportsBonus');
            const wallet = isBonus ? 'Sports Bonus Wallet' : 'Main Wallet';
            return `Will credit ₹${b.potentialWin?.toFixed(2)} to ${wallet}.`;
        },
    },
    LOST: {
        btn:    'bg-red-700 hover:bg-red-600',
        badge:  'bg-red-500/20 text-red-300 border-red-500/40',
        label:  '❌ LOST',
        detail: () => `No credit. Exposure released.`,
    },
    VOID: {
        btn:    'bg-zinc-600 hover:bg-zinc-500',
        badge:  'bg-zinc-500/20 text-zinc-300 border-zinc-500/40',
        label:  '↩ VOID',
        detail: (b) => {
            const isBonus = String(b.betSource || '').includes('sportsBonus');
            const bonusAmt = Number(b.bonusStakeAmount || 0);
            const mainAmt = Number(b.walletStakeAmount || 0) || Math.max(0, Number(b.stake || 0) - bonusAmt);
            if (isBonus && bonusAmt > 0 && mainAmt > 0) {
                return `Will refund ₹${bonusAmt.toFixed(2)} to Sports Bonus Wallet + ₹${mainAmt.toFixed(2)} to Main Wallet.`;
            }
            if (isBonus && bonusAmt > 0) {
                return `Will refund ₹${b.stake?.toFixed(2)} stake to Sports Bonus Wallet.`;
            }
            return `Will refund ₹${b.stake?.toFixed(2)} stake to Main Wallet.`;
        },
    },
};

export default function SettlementPage() {
    const [bets, setBets]           = useState<any[]>([]);
    const [settledBets, setSettledBets] = useState<any[]>([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [stats, setStats]         = useState<{ pending: number; wonToday: number; lostToday: number } | null>(null);
    const [eventSettlementLoading, setEventSettlementLoading] = useState<string | null>(null);
    const [srSettling, setSrSettling] = useState<string | null>(null);
    const [srSettleResult, setSrSettleResult] = useState<{
        success: boolean;
        message?: string;
        marketsProcessed?: number;
        betsSettled?: number;
        errors?: string[];
        eventId?: string;
    } | null>(null);

    // Confirm modal
    const [confirm, setConfirm]     = useState<ConfirmState | null>(null);
    const [note, setNote]           = useState('');
    const [settling, setSettling]   = useState(false);
    const [settleMsg, setSettleMsg] = useState<{ ok: boolean; text: string } | null>(null);

    // Clear-all-bets flow
    const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
    const [clearTyped, setClearTyped] = useState('');
    const [clearing, setClearing] = useState(false);
    const [clearMsg, setClearMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const closeClearModal = () => {
        if (clearing) return;
        setClearStep(0);
        setClearTyped('');
        setClearMsg(null);
    };

    const handleClearAllBets = async () => {
        setClearing(true);
        const res = await clearAllBets();
        setClearMsg({ ok: res.success, text: res.message });
        if (res.success) {
            await load();
            setTimeout(() => { closeClearModal(); }, 1500);
        }
        setClearing(false);
    };

    const [page, setPage]           = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const [betsRes, settledRes, statsRes] = await Promise.all([
            getPendingBets(page, 100),
            getSettledBets(1, 100),
            getSettlementStats(),
        ]);
        if (!betsRes.success) {
            setError('Failed to load pending bets.');
        } else {
            setBets(betsRes.data);
            setTotalPages(betsRes.pagination?.pages || 1);
        }
        if (settledRes.success) {
            setSettledBets(settledRes.data);
        }
        if (statsRes.success) setStats(statsRes.data);
        setLoading(false);
    }, [page]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void load();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [load]);

    const openConfirm = (bet: any, outcome: Outcome) => {
        setConfirm({ bet, outcome });
        setNote(`Manual ${outcome} by admin`);
        setSettleMsg(null);
    };

    const handleSettle = async () => {
        if (!confirm) return;
        setSettling(true);
        const res = await manualSettleBet(confirm.bet._id, confirm.outcome, note);
        setSettleMsg({ ok: res.success, text: res.message });
        if (res.success) {
            setBets(prev => prev.filter(b => b._id !== confirm.bet._id));
            setStats(prev => prev ? { ...prev, pending: Math.max(0, prev.pending - 1) } : prev);
            setTimeout(() => { setConfirm(null); setSettleMsg(null); }, 1200);
        }
        setSettling(false);
    };

    const isMatchOddsBet = (bet: any) => {
        if (bet.provider === 'sportradar') {
            const mkt = String(bet.srMarketFullId || bet.marketId);
            return mkt === '340' || mkt === '1' || String(bet.marketName || '').toLowerCase().includes('winner');
        }

        const gtype = String(bet.gtype || '').toLowerCase();
        const marketName = String(bet.marketName || bet.computedMarketName || '').toLowerCase();
        const mname = String(bet.mname || '').toLowerCase();

        // Exclude known non-match-odds types
        if (['session', 'fancy', 'fancy2', 'khado', 'meter', 'oddeven', 'other fancy'].includes(gtype)) {
            return false;
        }
        if (mname.includes('fancy')) {
            return false;
        }

        // Match odds detection - broadened to catch more formats
        return (
            marketName.includes('match odds') ||
            marketName.includes('match_odds') ||
            marketName.includes('matchodds') ||
            marketName.includes('winner') ||
            mname.includes('match odds') ||
            mname.includes('match_odds') ||
            gtype === 'match' ||
            // If it's a bookmaker bet with a team selection, also treat as settleable by team
            mname.includes('bookmaker')
        );
    };

    const formatSrMarketName = (bet: any) => {
        return String(bet.displayMarketName || bet.srMarketName || bet.marketName || bet.srMarketFullId || bet.marketId || '').trim();
    };

    const formatSrRunnerName = (bet: any) => {
        return String(bet.displaySelectionName || bet.srRunnerName || bet.selectionName || bet.selectedTeam || bet.srRunnerId || bet.selectionId || '').trim();
    };

    const getMatchOddsSelections = (eventName: string, eventBets: any[]) => {
        const selectionsByName = new Map<string, { selectionId: string; selectionName: string }>();

        eventBets
            .filter(isMatchOddsBet)
            .forEach((bet) => {
                const selectionName = String(
                    bet.provider === 'sportradar' 
                        ? formatSrRunnerName(bet)
                        : (bet.selectionName || bet.selectedTeam || bet.selectionId || ''),
                ).trim();
                if (!selectionName) return;

                const betSelectionId = String(bet.provider === 'sportradar' && bet.srRunnerId ? bet.srRunnerId : (bet.selectionId || ''));

                const key = selectionName.toLowerCase();
                const existing = selectionsByName.get(key);
                if (!existing || (!existing.selectionId && betSelectionId)) {
                    selectionsByName.set(key, {
                        selectionId: betSelectionId,
                        selectionName,
                    });
                }
            });


        return Array.from(selectionsByName.values());
    };

    const handleSettleMatchOddsEvent = async (
        eventId: string,
        eventName: string,
        winningSelectionId: string,
        winningSelectionName: string,
    ) => {
        if (!window.confirm(`Settle Match Odds for "${eventName}" with winner "${winningSelectionName}"?`)) return;

        setEventSettlementLoading(eventId);
        const res = await settleEventMatchOdds(eventId, winningSelectionId, winningSelectionName);
        if (res.success) {
            await load();
        } else {
            alert(res.message || 'Failed to settle Match Odds event');
        }
        setEventSettlementLoading(null);
    };

    const handleSrSettle = async (eventId: string, eventName: string) => {
        if (!window.confirm(`Auto-settle from the official result API for:\n"${eventName}"?\n\nThis will fetch published results and settle all pending bets. Irreversible.`)) return;
        setSrSettling(eventId);
        try {
            const res = await settleByMarketResult(eventId);
            setSrSettleResult({ ...res, eventId });
            if (res.success) {
                await load();
            }
        } finally { setSrSettling(null); }
    };

    // Group by event
    const byEvent: Record<string, { name: string; bets: any[] }> = {};
    for (const bet of bets) {
        const key = bet.eventId || 'unknown';
        if (!byEvent[key]) byEvent[key] = { name: bet.eventName || key, bets: [] };
        byEvent[key].bets.push(bet);
    }
    const eventEntries = Object.entries(byEvent);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6 space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Settlement Management</h1>
                    <p className="text-gray-400 text-sm mt-0.5">
                        Auto-settlement cron runs every 2 min. Manually override any pending bet below.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/sports/super-void"
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                    >
                        Super Void
                    </Link>
                    <button
                        onClick={() => { setClearStep(1); setClearTyped(''); setClearMsg(null); }}
                        className="rounded-lg border border-red-600/50 bg-red-600/20 px-3 py-1.5 text-xs font-bold text-red-200 transition hover:bg-red-600/30"
                    >
                        🗑 Clear All Bets
                    </button>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
                    >
                        {loading ? "Loading…" : "↺ Refresh"}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-500/40 text-red-300 rounded-lg px-4 py-3 text-sm">
                    ⚠️ {error}
                </div>
            )}

            {/* Stats bar */}
            {stats && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Pending', value: stats.pending, color: 'text-orange-400' },
                        { label: 'Won Today', value: stats.wonToday, color: 'text-green-400' },
                        { label: 'Lost Today', value: stats.lostToday, color: 'text-red-400' },
                    ].map(s => (
                        <div key={s.label} className="bg-gray-800 border border-white/10 rounded-xl p-4 text-center">
                            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Pending bets */}
            <div className="bg-gray-800 rounded-xl border border-white/10 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                    <span className="text-sm font-semibold">⏳ Pending Bets</span>
                    <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
                        {bets.length}
                    </span>
                </div>

                {loading ? (
                    <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
                ) : eventEntries.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-12">✅ No pending bets.</p>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {eventEntries.map(([eventId, { name, bets: evBets }]) => {
                            const matchOddsSelections = getMatchOddsSelections(name, evBets);
                            const hasPendingMatchOddsBets = evBets.some(isMatchOddsBet);
                            const hasMatchOddsButtons = hasPendingMatchOddsBets && matchOddsSelections.length >= 2;

                            return (
                            <div key={eventId}>
                                {/* Event header */}
                                <div className="flex flex-col gap-3 px-5 py-3 bg-gray-700/40 border-b border-white/[0.04]">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-semibold text-white/80 flex-1 truncate">{name}</span>
                                        <span className="text-[11px] text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                                            {evBets.length} bet{evBets.length !== 1 ? 's' : ''}
                                        </span>
                                        {evBets.some((b: any) => b.provider === 'sportradar' || eventId.startsWith('sr:match:')) && (
                                            <button
                                                onClick={() => void handleSrSettle(eventId, name)}
                                                disabled={srSettling === eventId}
                                                className="rounded border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-bold text-sky-300 hover:bg-sky-500/20 cursor-pointer disabled:opacity-50"
                                            >
                                                {srSettling === eventId ? '⏳' : '⚡'} Auto Settle
                                            </button>
                                        )}
                                    </div>
                                    {hasMatchOddsButtons && (
                                        <div className="flex flex-wrap gap-2">
                                            {matchOddsSelections.map((selection) => (
                                                <button
                                                    key={selection.selectionId}
                                                    onClick={() => handleSettleMatchOddsEvent(
                                                        eventId,
                                                        name,
                                                        selection.selectionId,
                                                        selection.selectionName,
                                                    )}
                                                    disabled={eventSettlementLoading === eventId}
                                                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                                                >
                                                    {eventSettlementLoading === eventId ? 'Settling…' : `${selection.selectionName} Won`}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Bet grid */}
                                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 bg-gray-900/30">
                                    {evBets.map((bet: any) => (
                                        <div key={bet._id} className="p-4 flex flex-col rounded-xl border border-white/5 bg-gray-800/80 shadow-sm hover:border-white/10 transition-colors">
                                            {/* Info */}
                                            <div className="flex-1 min-w-0 pb-3">
                                                {(bet.username || bet.userId) && (
                                                    <p className="mb-2 text-[11px] text-gray-400 truncate bg-black/20 rounded px-2 py-0.5 inline-block">
                                                        {bet.username ? `@${bet.username}` : 'Unknown user'}
                                                        {bet.userId ? ` · User #${bet.userId}` : ''}
                                                    </p>
                                                )}
                                                {bet.provider === 'sportradar' ? (
                                                    <div className="flex flex-col gap-1 mb-2">
                                                        <p className="text-[13px] text-white/90 font-semibold truncate leading-snug">
                                                            {formatSrMarketName(bet)}
                                                        </p>
                                                        <p className="text-[12px] text-white/70 truncate">
                                                            <span className="text-white/40 mr-1">Selection:</span> 
                                                            <span className="text-white/90 font-bold">{formatSrRunnerName(bet)}</span>
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[9px] text-gray-500 font-mono">
                                                            <span className="bg-white/5 px-1 rounded">MKT: {bet.srMarketFullId || bet.marketId}</span>
                                                            <span className="bg-white/5 px-1 rounded">RUN: {bet.srRunnerId || bet.selectionId}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mb-2">
                                                        <p className="text-[13px] text-white/90 font-semibold truncate mb-1">
                                                            {bet.marketName}
                                                        </p>
                                                        <p className="text-[12px] text-white/70 truncate">
                                                            <span className="text-white/40 mr-1">Selection:</span> 
                                                            <span className="text-white/90 font-bold">{bet.selectionName || bet.marketName}</span>
                                                        </p>
                                                    </div>
                                                )}
                                                
                                                {/* Stake / Return */}
                                                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-black/20 rounded-lg p-2.5">
                                                    <div>
                                                        <p className="text-gray-500 mb-0.5 font-medium">Odds & Stake</p>
                                                        <p className="text-white/90 font-mono">@{bet.odds} × ₹{bet.stake}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 mb-0.5 font-medium">Potential Win</p>
                                                        <p className="text-green-400 font-bold font-mono">₹{bet.potentialWin?.toFixed(2)}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between mt-3">
                                                    {String(bet.betSource || '').includes('sportsBonus') ? (
                                                        <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">🎁 Sports Bonus</span>
                                                    ) : <span />}
                                                    <span className="font-mono text-[9px] text-white/20 select-all">ID:{String(bet._id).slice(-8)}</span>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex gap-2 flex-shrink-0 pt-3 border-t border-white/5 mt-auto">
                                                {(['WON', 'LOST', 'VOID'] as Outcome[]).map(o => (
                                                    <button
                                                        key={o}
                                                        onClick={() => openConfirm(bet, o)}
                                                        className={`flex-1 text-[11px] font-bold px-2 py-2 rounded-lg transition-all ${STYLES[o].btn}`}
                                                    >
                                                        {STYLES[o].label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )})}
                    </div>
                )}
            </div>

            {/* Past bets */}
            <div className="bg-gray-800 rounded-xl border border-white/10 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                    <span className="text-sm font-semibold">Past Bets</span>
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        {settledBets.length}
                    </span>
                </div>

                {loading ? (
                    <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
                ) : settledBets.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-12">No past bets found.</p>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {settledBets.map((bet: any) => {
                            const statusClass =
                                bet.status === 'WON'
                                    ? 'bg-green-500/15 text-green-300 border-green-500/30'
                                    : bet.status === 'LOST'
                                        ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                        : bet.status === 'CASHED_OUT'
                                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                            : 'bg-white/10 text-gray-300 border-white/10';

                            return (
                                <div key={bet.id || bet._id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,2fr)_auto]">
                                    <div className="min-w-0 space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-white truncate">{bet.eventName || 'Unknown event'}</p>
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>
                                                {bet.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-300 truncate">{formatSrMarketName(bet)}</p>
                                        <p className="text-xs text-gray-400 truncate">
                                            Selection: <span className="text-white/80">{formatSrRunnerName(bet)}</span>
                                            {bet.winnerName ? (
                                                <>
                                                    <span className="mx-1.5 text-white/20">•</span>
                                                    Result: <span className="text-emerald-300">{bet.winnerName}</span>
                                                </>
                                            ) : null}
                                        </p>
                                        {(bet.username || bet.userId) && (
                                            <p className="text-[11px] text-gray-500">
                                                {bet.username ? `@${bet.username}` : 'Unknown user'}
                                                {bet.userId ? ` · User #${bet.userId}` : ''}
                                            </p>
                                        )}
                                        {bet.settledReason && (
                                            <p className="text-[11px] leading-relaxed text-gray-400">{bet.settledReason}</p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs lg:min-w-[260px]">
                                        <div>
                                            <p className="text-gray-500">Odds</p>
                                            <p className="font-mono text-white/80">@{Number(bet.oddsInfo?.acceptedOdds ?? bet.odds ?? 0).toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Stake</p>
                                            <p className="font-mono text-white/80">₹{Number(bet.stake || 0).toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Return</p>
                                            <p className="font-mono text-emerald-300">₹{Number(bet.potentialWin || 0).toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Settled</p>
                                            <p className="text-white/80">
                                                {new Date(bet.settledAt || bet.createdAt).toLocaleString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 py-4">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="px-4 py-2 rounded-xl bg-gray-800 border border-white/10 text-sm font-semibold text-white/80 disabled:opacity-30 hover:bg-gray-700 transition"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-gray-400 font-medium">Page {page} of {totalPages}</span>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className="px-4 py-2 rounded-xl bg-gray-800 border border-white/10 text-sm font-semibold text-white/80 disabled:opacity-30 hover:bg-gray-700 transition"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* ── Confirm Modal ─────────────────────────────────────────── */}
            {confirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                    <div className="bg-gray-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <h3 className="text-base font-bold">
                            Settle bet as{' '}
                            <span className={`inline-block px-2 py-0.5 rounded border text-sm ${STYLES[confirm.outcome].badge}`}>
                                {STYLES[confirm.outcome].label}
                            </span>
                        </h3>

                        {/* Bet summary */}
                        <div className="bg-gray-700/60 rounded-xl p-3 text-xs space-y-1">
                            <p className="text-white/80 font-medium">{confirm.bet.eventName}</p>
                            {(confirm.bet.username || confirm.bet.userId) && (
                                <p className="text-gray-300">
                                    {confirm.bet.username ? `@${confirm.bet.username}` : 'Unknown user'}
                                    {confirm.bet.userId ? ` · User #${confirm.bet.userId}` : ''}
                                </p>
                            )}
                            {confirm.bet.provider === 'sportradar' ? (
                                <div className="pt-1">
                                    <span className="text-gray-300 font-medium">{formatSrMarketName(confirm.bet)}</span>
                                    <div className="mt-1 text-gray-400">
                                        <span className="text-gray-500 mr-1">Selection:</span> 
                                        <span className="text-gray-300 font-semibold">{formatSrRunnerName(confirm.bet)}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-400">{confirm.bet.marketName}{confirm.bet.selectionName && ` → ${confirm.bet.selectionName}`}</p>
                            )}
                            <div className="flex gap-4 text-gray-300 pt-1">
                                <span>@ {confirm.bet.odds}</span>
                                <span>Stake: ₹{confirm.bet.stake}</span>
                                <span className="text-green-400">Win: ₹{confirm.bet.potentialWin?.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Outcome implication */}
                        <p className={`text-xs px-3 py-2 rounded-lg border ${STYLES[confirm.outcome].badge}`}>
                            {STYLES[confirm.outcome].detail(confirm.bet)}
                        </p>

                        {/* Note */}
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Admin note</label>
                            <input
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="w-full bg-gray-700 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                                placeholder="Reason for manual override…"
                            />
                        </div>

                        {settleMsg && (
                            <p className={`text-xs px-3 py-2 rounded-lg ${settleMsg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
                                {settleMsg.ok ? '✅ ' : '❌ '}{settleMsg.text}
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirm(null)}
                                disabled={settling}
                                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold disabled:opacity-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSettle}
                                disabled={settling}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all ${STYLES[confirm.outcome].btn}`}
                            >
                                {settling ? "Settling…" : `Confirm ${confirm.outcome}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Clear All Bets Modal (2-step confirmation) ─────────────────────── */}
            {clearStep > 0 && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
                    <div className="bg-gray-800 border border-red-500/40 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <h3 className="text-base font-bold text-red-300 flex items-center gap-2">
                            ⚠️ {clearStep === 1 ? 'Delete ALL bets?' : 'Are you ABSOLUTELY sure?'}
                        </h3>

                        {clearStep === 1 ? (
                            <p className="text-sm text-gray-300 leading-relaxed">
                                This will permanently delete <span className="font-bold text-red-300">every bet</span> from the database — pending, settled, won, lost, and voided. This action is <span className="font-bold">irreversible</span>.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-300 leading-relaxed">
                                    Last chance. To confirm, type <span className="font-mono font-bold text-red-300">DELETE ALL BETS</span> below.
                                </p>
                                <input
                                    autoFocus
                                    value={clearTyped}
                                    onChange={e => setClearTyped(e.target.value)}
                                    disabled={clearing}
                                    className="w-full bg-gray-900 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                                    placeholder="DELETE ALL BETS"
                                />
                            </div>
                        )}

                        {clearMsg && (
                            <p className={`text-xs px-3 py-2 rounded-lg ${clearMsg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
                                {clearMsg.ok ? '✅ ' : '❌ '}{clearMsg.text}
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={closeClearModal}
                                disabled={clearing}
                                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold disabled:opacity-50 transition-all"
                            >
                                Cancel
                            </button>
                            {clearStep === 1 ? (
                                <button
                                    onClick={() => setClearStep(2)}
                                    className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-bold text-white transition-all"
                                >
                                    Yes, continue
                                </button>
                            ) : (
                                <button
                                    onClick={handleClearAllBets}
                                    disabled={clearing || clearTyped !== 'DELETE ALL BETS'}
                                    className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                    {clearing ? 'Deleting…' : 'Delete everything'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── SR Settle Result Modal ─────────────────────────────────────────── */}
            {srSettleResult && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                    <div className="bg-gray-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                        {/* Header */}
                        <div className={`px-6 py-4 border-b border-white/10 ${srSettleResult.success ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                            <h3 className={`text-lg font-bold flex items-center gap-2 ${srSettleResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                {srSettleResult.success ? '✅ Settlement Successful' : '❌ Settlement Failed'}
                            </h3>
                            <p className="text-gray-300 text-sm mt-1">{srSettleResult.message}</p>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-4">
                            {srSettleResult.success && (
                                <div className="flex gap-4">
                                    <div className="flex-1 bg-gray-900 border border-white/5 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-black text-white">{srSettleResult.betsSettled ?? 0}</p>
                                        <p className="text-xs text-gray-400 uppercase mt-1">Bets Settled</p>
                                    </div>
                                    <div className="flex-1 bg-gray-900 border border-white/5 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-black text-white">{srSettleResult.marketsProcessed ?? 0}</p>
                                        <p className="text-xs text-gray-400 uppercase mt-1">Markets Processed</p>
                                    </div>
                                </div>
                            )}

                            {srSettleResult.errors && srSettleResult.errors.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-gray-300 flex justify-between">
                                        <span>Action Logs / Errors</span>
                                        <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{srSettleResult.errors.length}</span>
                                    </h4>
                                    <div className="bg-[#0D1117] border border-red-500/30 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-[11px] text-red-300 opacity-90 space-y-1">
                                        {srSettleResult.errors.map((err, i) => (
                                            <div key={i} className="pb-1 border-b border-red-500/10 last:border-0">{err}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/10 bg-gray-900/50 flex justify-end">
                            <button
                                onClick={() => setSrSettleResult(null)}
                                className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold text-white transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
