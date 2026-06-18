"use client";

import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, RotateCcw, Copy, Check, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrencyAmount } from '@/utils/transactionCurrency';

interface CasinoTransaction {
    id: number;
    txn_id: string;
    amount: number;
    type: string;          // BET | WIN | UPDATE | (legacy: credit/debit/refund)
    provider: string;
    game_code: string;
    game_name?: string;
    round_id?: string;
    wallet_type: string;   // fiat | crypto
    timestamp: string;
    user_id?: number;
    username?: string;
}

interface UserCasinoTableProps {
    transactions: CasinoTransaction[];
}

function CopyBtn({ value }: { value: string }) {
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
            className="text-slate-500 hover:text-white transition-colors ml-1 inline-flex"
            title="Copy"
        >
            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
        </button>
    );
}

function classifyType(type: string): 'BET' | 'WIN' | 'REFUND' | 'UPDATE' {
    const t = (type || '').toUpperCase();
    if (t === 'WIN' || t === 'CREDIT') return 'WIN';
    if (t === 'BET' || t === 'DEBIT') return 'BET';
    if (t === 'REFUND') return 'REFUND';
    return 'UPDATE';
}

export default function UserCasinoTable({ transactions }: UserCasinoTableProps) {
    if (!transactions || transactions.length === 0) {
        return <div className="p-8 text-center text-slate-500 bg-slate-800 rounded-lg border border-slate-700">No casino transactions found.</div>;
    }

    return (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900/50 uppercase font-medium text-[10px] tracking-wider border-b border-slate-700">
                        <tr>
                            <th className="px-3 py-3">#</th>
                            <th className="px-3 py-3">Game</th>
                            <th className="px-3 py-3">Provider</th>
                            <th className="px-3 py-3">Type</th>
                            <th className="px-3 py-3 text-right">Amount</th>
                            <th className="px-3 py-3">Wallet</th>
                            <th className="px-3 py-3">Round / Txn ID</th>
                            <th className="px-3 py-3">Game Code</th>
                            <th className="px-3 py-3 whitespace-nowrap">Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {transactions.map((tx) => {
                            const kind = classifyType(tx.type);
                            const isWin = kind === 'WIN';
                            const isRefund = kind === 'REFUND';
                            const currency = tx.wallet_type === 'crypto' ? 'USD' : 'INR';
                            return (
                                <tr key={tx.id} className="hover:bg-slate-700/20 align-top">
                                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-600">{tx.id}</td>
                                    <td className="px-3 py-2.5">
                                        <p className="text-white font-medium text-xs leading-tight max-w-[180px] truncate" title={tx.game_name}>
                                            {tx.game_name || tx.game_code}
                                        </p>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-slate-400">{tx.provider || '—'}</td>
                                    <td className="px-3 py-2.5">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${isWin ? 'text-emerald-400' : isRefund ? 'text-amber-400' : kind === 'UPDATE' ? 'text-slate-400' : 'text-red-400'}`}>
                                            {isWin ? <ArrowDownLeft size={11} /> : isRefund ? <RotateCcw size={11} /> : kind === 'UPDATE' ? <TrendingDown size={11} /> : <ArrowUpRight size={11} />}
                                            {kind}
                                        </span>
                                    </td>
                                    <td className={`px-3 py-2.5 text-right font-mono font-semibold text-sm ${isWin ? 'text-emerald-400' : isRefund ? 'text-amber-400' : 'text-red-400'}`}>
                                        {isWin || isRefund ? '+' : '-'}
                                        {formatCurrencyAmount(tx.amount, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${tx.wallet_type === 'crypto' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                                            {tx.wallet_type}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="font-mono text-[10px] text-slate-300 max-w-[180px] truncate" title={tx.txn_id}>
                                            {tx.txn_id}
                                            <CopyBtn value={tx.txn_id} />
                                        </div>
                                        {tx.round_id && tx.round_id !== tx.txn_id && (
                                            <div className="font-mono text-[10px] text-slate-600 max-w-[180px] truncate mt-0.5" title={tx.round_id}>
                                                round: {tx.round_id}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500 max-w-[140px] truncate" title={tx.game_code}>
                                        {tx.game_code}
                                        <CopyBtn value={tx.game_code} />
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-slate-500">
                                        {new Date(tx.timestamp).toLocaleString('en-IN', {
                                            day: '2-digit', month: 'short', year: '2-digit',
                                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                                        })}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
