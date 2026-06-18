"use client";

import React, { useEffect, useState, useTransition } from 'react';
import { getWageringSummary, clearAllUsersWagering } from '@/actions/wagering';
import {
    AlertTriangle,
    RefreshCw,
    ShieldAlert,
    Gift,
    Users,
    Activity,
    Eraser,
    CheckCircle2,
    X,
} from 'lucide-react';

type SummaryData = {
    totalUsers: number;
    usersWithPendingWagering: number;
    activeBonuses: number;
    totals: {
        wageringRequired: number;
        wageringDone: number;
        casinoBonusWageringRequired: number;
        casinoBonusWageringDone: number;
        sportsBonusWageringRequired: number;
        sportsBonusWageringDone: number;
        depositWageringRequired: number;
        depositWageringDone: number;
    };
};

function fmtAmount(n: number) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}

const CONFIRM_PHRASE = 'CLEAR WAGERING';

export default function ClearWageringPage() {
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Confirm modal state
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [result, setResult] = useState<
        | { success: true; usersAffected: number; bonusesCompleted: number }
        | { success: false; error: string }
        | null
    >(null);

    const loadSummary = () => {
        startTransition(async () => {
            const res = await getWageringSummary();
            if (res.success && res.data) setSummary(res.data);
            setLoading(false);
        });
    };

    useEffect(() => {
        loadSummary();
    }, []);

    const handleClear = () => {
        if (confirmText !== CONFIRM_PHRASE) return;
        startTransition(async () => {
            const res = await clearAllUsersWagering();
            if (res.success && res.data) {
                setResult({
                    success: true,
                    usersAffected: res.data.usersAffected,
                    bonusesCompleted: res.data.bonusesCompleted,
                });
                setShowConfirm(false);
                setConfirmText('');
                loadSummary();
            } else {
                setResult({ success: false, error: res.error || 'Unknown error' });
            }
        });
    };

    const closeConfirm = () => {
        if (isPending) return;
        setShowConfirm(false);
        setConfirmText('');
    };

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Eraser size={22} className="text-red-400" />
                        Clear User Wagering
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Zero out wagering requirements for every user and mark all active bonuses as completed.
                    </p>
                </div>
                <button
                    onClick={loadSummary}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={15} className={isPending ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Danger banner */}
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                        <ShieldAlert size={20} className="text-red-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-red-400">Destructive admin action</p>
                        <p className="text-[13px] text-red-300/70 mt-1 leading-relaxed">
                            This clears wagering progress for <strong>every user</strong> on the platform and unlocks their active bonuses so they can withdraw. There is no per-user undo — make sure you really intend to run this before confirming.
                        </p>
                    </div>
                </div>
            </div>

            {/* Summary cards */}
            {loading ? (
                <div className="text-center py-10 text-slate-500">Loading wagering summary…</div>
            ) : summary ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                                <Users size={13} /> Total Users
                            </div>
                            <p className="text-2xl font-bold text-white">{fmtAmount(summary.totalUsers)}</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                                <Activity size={13} /> Users w/ Pending Wagering
                            </div>
                            <p className="text-2xl font-bold text-amber-400">{fmtAmount(summary.usersWithPendingWagering)}</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                                <Gift size={13} /> Active Bonuses
                            </div>
                            <p className="text-2xl font-bold text-purple-400">{fmtAmount(summary.activeBonuses)}</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                                <AlertTriangle size={13} /> Total Required
                            </div>
                            <p className="text-2xl font-bold text-red-400">₹{fmtAmount(summary.totals.wageringRequired)}</p>
                        </div>
                    </div>

                    {/* Detailed breakdown */}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Aggregate Wagering Breakdown</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <BreakdownRow
                                label="Overall Wagering"
                                required={summary.totals.wageringRequired}
                                done={summary.totals.wageringDone}
                            />
                            <BreakdownRow
                                label="Deposit Wagering"
                                required={summary.totals.depositWageringRequired}
                                done={summary.totals.depositWageringDone}
                            />
                            <BreakdownRow
                                label="Casino Bonus Wagering"
                                required={summary.totals.casinoBonusWageringRequired}
                                done={summary.totals.casinoBonusWageringDone}
                            />
                            <BreakdownRow
                                label="Sports Bonus Wagering"
                                required={summary.totals.sportsBonusWageringRequired}
                                done={summary.totals.sportsBonusWageringDone}
                            />
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-10 text-red-400">Failed to load wagering summary.</div>
            )}

            {/* Action card */}
            <div className="bg-slate-800 border border-red-500/30 rounded-xl p-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-base font-bold text-white">Ready to clear all wagering?</p>
                        <p className="text-xs text-slate-400 mt-1">
                            All 8 wagering fields on every user row will be set to 0 and all ACTIVE UserBonus rows will be marked COMPLETED.
                        </p>
                    </div>
                    <button
                        onClick={() => { setShowConfirm(true); setResult(null); }}
                        disabled={isPending || loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm transition-colors"
                    >
                        <Eraser size={16} />
                        Clear Wagering For All Users
                    </button>
                </div>
            </div>

            {/* Success/error banner */}
            {result && (
                <div className={`rounded-xl border p-4 flex items-start gap-3 ${
                    result.success
                        ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-300'
                        : 'bg-red-500/5 border-red-500/30 text-red-300'
                }`}>
                    {result.success ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
                    <div className="text-sm">
                        {result.success ? (
                            <>
                                <p className="font-bold">Wagering cleared successfully.</p>
                                <p className="text-[12px] opacity-80 mt-0.5">
                                    Reset counters on <strong>{fmtAmount(result.usersAffected)}</strong> users and marked{' '}
                                    <strong>{fmtAmount(result.bonusesCompleted)}</strong> active bonuses as completed.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="font-bold">Failed to clear wagering.</p>
                                <p className="text-[12px] opacity-80 mt-0.5">{result.error}</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Confirmation modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeConfirm}>
                    <div
                        className="relative w-full max-w-lg bg-slate-900 border border-red-500/40 rounded-2xl shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
                                    <ShieldAlert size={20} className="text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Confirm Clear Wagering</h3>
                                    <p className="text-[11px] text-slate-500 mt-0.5">This action cannot be undone.</p>
                                </div>
                            </div>
                            <button
                                onClick={closeConfirm}
                                disabled={isPending}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            <p className="text-sm text-slate-300 leading-relaxed">
                                You are about to clear wagering requirements for{' '}
                                <strong className="text-white">{summary ? fmtAmount(summary.totalUsers) : 'all'}</strong> users
                                {summary && (
                                    <>
                                        {' '}and mark{' '}
                                        <strong className="text-white">{fmtAmount(summary.activeBonuses)}</strong> active bonuses as completed
                                    </>
                                )}.
                            </p>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Type <code className="bg-slate-800 text-red-400 px-1.5 py-0.5 rounded text-[11px] font-mono">{CONFIRM_PHRASE}</code> to confirm:
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    disabled={isPending}
                                    placeholder={CONFIRM_PHRASE}
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-red-500/50 rounded-lg p-2.5 text-white text-sm outline-none placeholder-slate-600 disabled:opacity-50 font-mono"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-950/50 border-t border-slate-800">
                            <button
                                onClick={closeConfirm}
                                disabled={isPending}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClear}
                                disabled={isPending || confirmText !== CONFIRM_PHRASE}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-colors"
                            >
                                {isPending ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Clearing…
                                    </>
                                ) : (
                                    <>
                                        <Eraser size={14} />
                                        Yes, clear wagering
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function BreakdownRow({ label, required, done }: { label: string; required: number; done: number }) {
    const pct = required > 0 ? Math.min(100, Math.round((done / required) * 100)) : 0;
    return (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-white">₹{fmtAmount(done)}</span>
                <span className="text-xs text-slate-500">of ₹{fmtAmount(required)}</span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="text-[10px] text-slate-600 mt-1">{pct}% completed</p>
        </div>
    );
}
