"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
    Gamepad2, Copy, Check, Calendar, Loader2, AlertCircle, Search,
    ChevronLeft, ChevronRight, ShieldCheck,
} from 'lucide-react';
import { getHuiduUserAccounts, getHuiduUserHistory, type HuiduTxRecord } from '@/actions/casino';

interface UserHuiduPanelProps {
    userId: number;
}

const WALLET_LABELS: Record<string, { label: string; color: string }> = {
    main: { label: 'Main (INR)', color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' },
    crypto: { label: 'Crypto (USD)', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
    fiatBonus: { label: 'Fiat Bonus', color: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30' },
    cryptoBonus: { label: 'Crypto Bonus', color: 'bg-violet-500/10 text-violet-300 border-violet-500/30' },
};

function CopyChip({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            }}
            className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            title="Copy"
        >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
        </button>
    );
}

// Default to today (UTC) — HUIDU only allows same-day from/to
function todayUtcISO(): string {
    return new Date().toISOString().slice(0, 10);
}

// Convert "YYYY-MM-DD" → [startMs, endMs] for that UTC day
function dayBounds(iso: string): [number, number] {
    const start = Date.UTC(
        Number(iso.slice(0, 4)),
        Number(iso.slice(5, 7)) - 1,
        Number(iso.slice(8, 10)),
        0, 0, 0, 0,
    );
    const end = start + 86_399_000; // 23:59:59.000
    return [start, end];
}

export default function UserHuiduPanel({ userId }: UserHuiduPanelProps) {
    const [accounts, setAccounts] = useState<any | null>(null);
    const [accountsLoading, setAccountsLoading] = useState(true);
    const [accountsError, setAccountsError] = useState<string | null>(null);

    const [day, setDay] = useState<string>(todayUtcISO());
    const [records, setRecords] = useState<HuiduTxRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [totalMatched, setTotalMatched] = useState<number>(0);
    const [totalFetched, setTotalFetched] = useState<number>(0);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;

    // Load accounts on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setAccountsLoading(true);
            const res = await getHuiduUserAccounts(userId);
            if (cancelled) return;
            if (res.success) {
                setAccounts((res as any).accounts);
                setAccountsError(null);
            } else {
                setAccountsError((res as any).error || 'Failed to load HUIDU accounts');
            }
            setAccountsLoading(false);
        })();
        return () => { cancelled = true; };
    }, [userId]);

    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        setHistoryError(null);
        const [from, to] = dayBounds(day);
        const res = await getHuiduUserHistory(userId, { fromDate: from, toDate: to, pageNo: 1, pageSize: 5000 });
        if (res.success) {
            setRecords((res as any).records || []);
            setTotalMatched((res as any).totalMatched || 0);
            setTotalFetched((res as any).totalFetched || 0);
            setPage(1);
        } else {
            setRecords([]);
            setTotalMatched(0);
            setTotalFetched(0);
            setHistoryError((res as any).error || 'Failed to fetch HUIDU history');
        }
        setHistoryLoading(false);
    }, [userId, day]);

    const fmtAmt = (n: string | number, currency: string) => {
        const num = typeof n === 'string' ? parseFloat(n) : n;
        if (!Number.isFinite(num)) return '—';
        try {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: currency || 'INR',
                maximumFractionDigits: 2,
            }).format(num);
        } catch {
            return `${currency} ${num.toFixed(2)}`;
        }
    };

    const sliceStart = (page - 1) * PAGE_SIZE;
    const visible = records.slice(sliceStart, sliceStart + PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                    <Gamepad2 size={16} className="text-violet-400" />
                    <h3 className="text-sm font-bold text-white">HUIDU Casino Identity</h3>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">huidu.bet</span>
            </div>

            {/* Member accounts */}
            <div className="px-4 py-4 sm:px-5">
                {accountsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-3">
                        <Loader2 size={13} className="animate-spin" /> Loading HUIDU member accounts…
                    </div>
                ) : accountsError ? (
                    <div className="flex items-center gap-2 text-xs text-red-400">
                        <AlertCircle size={13} /> {accountsError}
                    </div>
                ) : accounts ? (
                    <div className="space-y-3">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                            Player Prefix: <span className="text-slate-300 font-mono normal-case">{accounts.prefix}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(['main', 'crypto', 'fiatBonus', 'cryptoBonus'] as const).map((k) => {
                                const id = accounts[k] as string;
                                const meta = WALLET_LABELS[k];
                                return (
                                    <div
                                        key={k}
                                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-slate-900/60 ${meta.color}`}
                                    >
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                                                {meta.label}
                                            </div>
                                            <div className="text-xs font-mono text-white truncate" title={id}>
                                                {id}
                                            </div>
                                        </div>
                                        <CopyChip value={id} />
                                    </div>
                                );
                            })}
                        </div>
                        {accounts.legacy && (
                            <details className="text-[11px] text-slate-500">
                                <summary className="cursor-pointer hover:text-slate-300">
                                    Show legacy underscore IDs (pre-fix sessions)
                                </summary>
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono">
                                    {Object.entries(accounts.legacy).map(([k, v]) => (
                                        <div key={k} className="flex items-center gap-2">
                                            <span className="opacity-60 w-20">{k}:</span>
                                            <span className="text-slate-300 truncate">{v as string}</span>
                                            <CopyChip value={v as string} />
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                ) : null}
            </div>

            {/* HUIDU live history query */}
            <div className="border-t border-slate-700/60 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-end gap-2 mb-3">
                    <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
                            <Calendar size={10} className="inline -mt-px mr-1" /> UTC Day (HUIDU same-day query)
                        </label>
                        <input
                            type="date"
                            value={day}
                            max={todayUtcISO()}
                            onChange={(e) => setDay(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <button
                        onClick={fetchHistory}
                        disabled={historyLoading}
                        className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                        {historyLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                        Fetch Live from HUIDU
                    </button>
                    <Link
                        href={`/dashboard/bets/casino/verify?day=${day}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        title="Open the verify page for this day"
                    >
                        <ShieldCheck size={12} /> Open Verify Page
                    </Link>
                    {records.length > 0 && (
                        <span className="text-[10px] text-slate-500 ml-auto">
                            {totalMatched} matched · {totalFetched} fetched from HUIDU
                        </span>
                    )}
                </div>

                {historyError && (
                    <div className="flex items-center gap-2 text-xs text-red-400 mb-3 p-2 rounded bg-red-500/5 border border-red-500/20">
                        <AlertCircle size={13} /> {historyError}
                    </div>
                )}

                {records.length === 0 && !historyLoading && !historyError && (
                    <div className="text-xs text-slate-500 py-2">
                        No HUIDU records loaded. Pick a day (last 60 days only) and click <b>Fetch Live from HUIDU</b>.
                        Note: HUIDU only allows same-day queries.
                    </div>
                )}

                {records.length > 0 && (
                    <>
                        <div className="overflow-x-auto rounded-lg border border-slate-700">
                            <table className="min-w-[900px] w-full text-xs">
                                <thead className="bg-slate-900/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Time (UTC)</th>
                                        <th className="px-3 py-2 text-left">Game UID</th>
                                        <th className="px-3 py-2 text-left">Wallet</th>
                                        <th className="px-3 py-2 text-left">Account</th>
                                        <th className="px-3 py-2 text-right">Bet</th>
                                        <th className="px-3 py-2 text-right">Win</th>
                                        <th className="px-3 py-2 text-left">Round</th>
                                        <th className="px-3 py-2 text-left">Serial</th>
                                        <th className="px-3 py-2 text-left">Verify</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {visible.map((r, i) => {
                                        const wt = r.wallet_type || 'unknown';
                                        const wallMeta = WALLET_LABELS[wt === 'crypto' ? 'crypto' : wt === 'fiatbonus' ? 'fiatBonus' : wt === 'cryptobonus' ? 'cryptoBonus' : 'main'];
                                        const verifyHref = `/dashboard/bets/casino/verify?txnId=${encodeURIComponent(r.serial_number)}&day=${day}&auto=1`;
                                        return (
                                            <tr key={`${r.serial_number}-${i}`} className="hover:bg-slate-700/20">
                                                <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{r.timestamp}</td>
                                                <td className="px-3 py-2 font-mono text-slate-300 truncate max-w-[140px]" title={r.game_uid}>{r.game_uid}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${wallMeta?.color || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                                        {wt}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-slate-400 truncate max-w-[120px]" title={r.member_account}>{r.member_account}</td>
                                                <td className="px-3 py-2 text-right font-mono text-emerald-400">{fmtAmt(r.bet_amount, r.currency_code)}</td>
                                                <td className="px-3 py-2 text-right font-mono text-sky-400">{fmtAmt(r.win_amount, r.currency_code)}</td>
                                                <td className="px-3 py-2 font-mono text-slate-500 truncate max-w-[110px]" title={r.game_round}>{r.game_round || '—'}</td>
                                                <td className="px-3 py-2 font-mono text-slate-500 truncate max-w-[110px]" title={r.serial_number}>{r.serial_number}</td>
                                                <td className="px-3 py-2">
                                                    <Link
                                                        href={verifyHref}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                                                        title="Verify against local DB on the verify page"
                                                    >
                                                        <ShieldCheck size={10} /> Verify
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-end gap-2 mt-3 text-xs text-slate-400">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="p-1.5 hover:bg-slate-700 rounded disabled:opacity-40"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span>Page {page} / {totalPages}</span>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="p-1.5 hover:bg-slate-700 rounded disabled:opacity-40"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
