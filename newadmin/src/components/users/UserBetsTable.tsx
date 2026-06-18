"use client";

import React, { useState } from 'react';
import { Edit2, X, CheckCircle, XCircle, Loader2, DollarSign, Copy } from 'lucide-react';

interface Bet {
    _id?: string;
    id?: string;
    eventName: string;
    marketName: string;
    selectionName: string;
    odds: number;
    stake: number;
    potentialWin: number;
    status: string; // PENDING, WON, LOST, VOID
    betType?: string;
    walletType?: string; // 'fiat' | 'crypto'
    settledReason?: string;
    settledAt?: string;
    cashoutValue?: number;
    createdAt: string;
}

interface EditWinPayload {
    betId: string;
    userId: number;
    currentWin: number;
}

interface UserBetsTableProps {
    bets: Bet[];
    onEditWin?: (payload: EditWinPayload & { newWin: number; remarks: string; createTx: boolean }) => Promise<{ success: boolean; error?: string }>;
    userId?: number;
}

export default function UserBetsTable({ bets, onEditWin, userId }: UserBetsTableProps) {
    const [editTarget, setEditTarget] = useState<{ betId: string; currentWin: number } | null>(null);
    const [newWin, setNewWin] = useState('');
    const [remarks, setRemarks] = useState('');
    const [createTx, setCreateTx] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editMsg, setEditMsg] = useState<{ text: string; ok: boolean } | null>(null);

    if (!bets || bets.length === 0) {
        return <div className="p-8 text-center text-slate-500 bg-slate-800 rounded-lg">No bets history found.</div>;
    }

    const fmtINR = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    const fmtUSD = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    const formatAmount = (amount: number, walletType?: string) =>
        walletType === 'crypto' ? fmtUSD(amount) : fmtINR(amount);

    const getBetReason = (bet: Bet) => {
        if (bet.settledReason?.trim()) return bet.settledReason.trim();
        if (bet.status === 'PENDING') return 'Awaiting market settlement.';
        if (bet.status === 'VOID') return 'Bet was voided and the stake was refunded.';
        if (bet.status === 'CASHED_OUT') {
            return bet.cashoutValue
                ? `Bet was cashed out for ${formatAmount(bet.cashoutValue, bet.walletType)} before final settlement.`
                : 'Bet was cashed out before final settlement.';
        }

        const selection = bet.selectionName || 'your selection';
        if (bet.status === 'WON') {
            return `Won on ${selection}${bet.betType === 'lay' ? ' (Lay)' : ' (Back)'}.`;
        }
        if (bet.status === 'LOST') {
            return `Lost on ${selection}${bet.betType === 'lay' ? ' (Lay)' : ' (Back)'}.`;
        }
        return 'Settlement details unavailable.';
    };

    const openEditModal = (bet: Bet) => {
        const id = bet._id || bet.id || '';
        setEditTarget({ betId: id, currentWin: Number(bet.potentialWin ?? 0) });
        setNewWin(String(Number(bet.potentialWin ?? 0)));
        setRemarks('');
        setCreateTx(true);
        setEditMsg(null);
    };

    const handleSaveEdit = async () => {
        if (!editTarget || !onEditWin || !userId) return;
        const parsed = parseFloat(newWin);
        if (isNaN(parsed) || parsed < 0) {
            setEditMsg({ text: 'Enter a valid win amount (≥ 0).', ok: false });
            return;
        }
        setSaving(true);
        setEditMsg(null);
        const res = await onEditWin({
            betId: editTarget.betId,
            userId,
            currentWin: editTarget.currentWin,
            newWin: parsed,
            remarks,
            createTx,
        });
        setSaving(false);
        if (res.success) {
            setEditMsg({ text: 'Bet win amount updated successfully.', ok: true });
            setTimeout(() => setEditTarget(null), 1200);
        } else {
            setEditMsg({ text: res.error || 'Failed to update.', ok: false });
        }
    };

    return (
        <>
            {/* ─── Edit Win Modal ─── */}
            {editTarget && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md rounded-xl border border-emerald-600/30 bg-slate-800 p-5 shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <DollarSign size={18} className="text-emerald-400" />
                                Edit Winning Amount
                            </h3>
                            <button
                                onClick={() => setEditTarget(null)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Current value */}
                            <div className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-700 px-4 py-2.5 text-sm">
                                <span className="text-slate-400">Current Win Amount</span>
                                <span className="font-mono font-semibold text-white">{formatAmount(editTarget.currentWin)}</span>
                            </div>

                            {/* New value input */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                                    New Win Amount (INR)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={newWin}
                                    onChange={e => setNewWin(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none"
                                    autoFocus
                                />
                                {newWin !== '' && !isNaN(parseFloat(newWin)) && (
                                    <p className="mt-1.5 text-xs text-slate-500">
                                        Difference:{' '}
                                        <span className={parseFloat(newWin) - editTarget.currentWin >= 0 ? 'text-emerald-400 font-mono' : 'text-red-400 font-mono'}>
                                            {parseFloat(newWin) - editTarget.currentWin >= 0 ? '+' : ''}{formatAmount(parseFloat(newWin) - editTarget.currentWin)}
                                        </span>
                                    </p>
                                )}
                            </div>

                            {/* Remarks */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                                    Admin Remarks
                                </label>
                                <input
                                    type="text"
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                    placeholder="Reason for adjustment..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                                />
                            </div>

                            {/* Transaction log checkbox */}
                            <label className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-300 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={createTx}
                                    onChange={e => setCreateTx(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                                />
                                <span>
                                    Credit/Debit difference to user wallet &amp; create transaction log
                                    <span className="block text-xs text-slate-500 mt-0.5">
                                        A Transaction record will be created and the user&apos;s fiat wallet will be updated by the difference.
                                    </span>
                                </span>
                            </label>

                            {/* Status message */}
                            {editMsg && (
                                <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs border ${editMsg.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                    {editMsg.ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
                                    {editMsg.text}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setEditTarget(null)}
                                    disabled={saving}
                                    className="flex-1 py-2.5 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors text-sm disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveEdit}
                                    disabled={saving || !onEditWin}
                                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Bets Table ─── */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="font-semibold text-white">Sports Bets History</h3>
                    {onEditWin && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Edit2 size={11} /> Click the pencil to edit winning amounts
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-[1100px] w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-900/50 uppercase font-medium text-xs">
                            <tr>
                                <th className="px-4 py-3 sm:px-6">Event / Market</th>
                                <th className="px-4 py-3 sm:px-6">Selection</th>
                                <th className="px-4 py-3 sm:px-6">Reason</th>
                                <th className="px-4 py-3 text-right sm:px-6">Odds</th>
                                <th className="px-4 py-3 text-right sm:px-6">Stake</th>
                                <th className="px-4 py-3 text-right sm:px-6">Win Amount</th>
                                <th className="px-4 py-3 text-right sm:px-6">P/L</th>
                                <th className="px-4 py-3 sm:px-6">Status</th>
                                <th className="px-4 py-3 sm:px-6">Timeline</th>
                                <th className="px-4 py-3 sm:px-6">Bet ID</th>
                                {onEditWin && <th className="px-4 py-3 sm:px-6">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {bets.map((bet) => {
                                const betId = bet._id || bet.id || '';
                                return (
                                    <tr key={betId} className="hover:bg-slate-700/30">
                                        <td className="px-4 py-4 sm:px-6">
                                            <p className="text-white font-medium truncate max-w-[200px]">{bet.eventName}</p>
                                            <p className="text-xs text-slate-500">{bet.marketName}</p>
                                        </td>
                                        <td className="px-4 py-4 text-indigo-300 font-medium sm:px-6">
                                            {bet.selectionName}
                                        </td>
                                        <td className="px-4 py-4 sm:px-6">
                                            <p className="max-w-[280px] whitespace-normal text-xs leading-5 text-slate-300">
                                                {getBetReason(bet)}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono text-amber-400 sm:px-6">
                                            {bet.odds.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono text-white sm:px-6">
                                            {formatAmount(bet.stake, bet.walletType)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono text-emerald-300 sm:px-6">
                                            {formatAmount(bet.potentialWin, bet.walletType)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono sm:px-6">
                                            {bet.status === 'WON' ? (
                                                <span className="text-emerald-400">+{formatAmount(bet.potentialWin - bet.stake, bet.walletType)}</span>
                                            ) : bet.status === 'LOST' ? (
                                                <span className="text-red-400">-{formatAmount(bet.stake, bet.walletType)}</span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-4 sm:px-6">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${bet.status === 'WON' ? 'bg-emerald-500/10 text-emerald-400' :
                                                bet.status === 'LOST' ? 'bg-red-500/10 text-red-400' :
                                                    bet.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                                                        'bg-slate-500/10 text-slate-400'
                                                }`}>
                                                {bet.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-xs sm:px-6">
                                            <div className="space-y-1">
                                                <p>Placed: {new Date(bet.createdAt).toLocaleString()}</p>
                                                {bet.settledAt && (
                                                    <p className="text-slate-500">Settled: {new Date(bet.settledAt).toLocaleString()}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 sm:px-6">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-slate-400 select-all" title={betId}>
                                                    {betId.substring(0, 8)}...
                                                </span>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(betId)}
                                                    className="p-1 rounded-md bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                                                    title="Copy Bet ID"
                                                >
                                                    <Copy size={13} />
                                                </button>
                                            </div>
                                        </td>
                                        {onEditWin && (
                                            <td className="px-4 py-4 sm:px-6">
                                                <button
                                                    onClick={() => openEditModal(bet)}
                                                    title="Edit winning amount"
                                                    className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
