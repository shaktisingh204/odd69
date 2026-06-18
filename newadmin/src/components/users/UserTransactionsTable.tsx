"use client";

import React from 'react';
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle, Trash2, Loader2 } from 'lucide-react';
import { formatTransactionAmount } from '@/utils/transactionCurrency';

interface Transaction {
    id: number;
    amount: number;
    type: string;
    status: string;
    paymentMethod: string;
    wallet_type?: string;
    utr?: string;
    remarks?: string | null;
    paymentDetails?: Record<string, unknown> | null;
    createdAt: string;
}

interface UserTransactionsTableProps {
    transactions: Transaction[];
    onDeleteTransaction?: (transactionId: number) => void | Promise<void>;
    deletingTransactionId?: number | null;
}

function isCreditTransaction(tx: Transaction) {
    return ['DEPOSIT', 'ADMIN_DEPOSIT', 'REFUND', 'BET_REFUND', 'BET_WIN', 'BET_CASHOUT', 'BONUS', 'BONUS_CONVERT', 'BONUS_TYPE_SWITCH'].includes(tx.type);
}

function getTransactionLabel(tx: Transaction) {
    const source = String(tx.paymentDetails?.source || '').toUpperCase();
    const isEarlySixRefund =
        tx.type === 'REFUND' &&
        (
            String(tx.paymentDetails?.tag || '').toUpperCase() === 'EARLY_SIX_REFUND' ||
            String(tx.paymentDetails?.source || '').toUpperCase() === 'FIRST_OVER_SIX_CASHBACK'
        );

    if (isEarlySixRefund) return 'Early Six Refund';
    if (tx.type === 'BET_WIN' && source === 'AVIATOR') return 'Aviator Win';
    if (tx.type === 'BET_WIN' && source === 'LIMBO') return 'Limbo Win';
    if (tx.type === 'BET_LOSS' && source === 'AVIATOR') return 'Aviator Loss';
    if (tx.type === 'BET_LOSS' && source === 'LIMBO') return 'Limbo Loss';
    if (tx.type === 'BET_CASHOUT' && source === 'AVIATOR') return 'Aviator Cashout';
    if (tx.type === 'BET_CASHOUT' && source === 'LIMBO') return 'Limbo Cashout';
    if (tx.type === 'BONUS_DEBIT') return 'Bonus Deduction';

    return tx.type.replace(/_/g, ' ');
}

function getMethodLabel(tx: Transaction) {
    const allocations = Array.isArray(tx.paymentDetails?.allocations)
        ? tx.paymentDetails.allocations
        : [];
    const allocationLabels = allocations
        .map((allocation) =>
            allocation && typeof allocation === 'object' && 'walletLabel' in allocation
                ? String((allocation as { walletLabel?: unknown }).walletLabel || '')
                : '',
        )
        .filter(Boolean);

    if (allocationLabels.length > 1) return allocationLabels.join(' + ');
    if (allocationLabels.length === 1) return allocationLabels[0];
    if (typeof tx.paymentDetails?.walletLabel === 'string' && tx.paymentDetails.walletLabel) {
        return tx.paymentDetails.walletLabel;
    }
    return tx.paymentMethod || '—';
}

export default function UserTransactionsTable({ transactions, onDeleteTransaction, deletingTransactionId }: UserTransactionsTableProps) {
    const visibleTransactions = (transactions || []).filter((tx) => tx.type !== 'BONUS_CONVERT_REVERSED');

    if (visibleTransactions.length === 0) {
        return <div className="p-8 text-center text-slate-500 bg-slate-800 rounded-lg">No transactions found.</div>;
    }

    return (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
                <h3 className="font-semibold text-white">Recent Transactions</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900/50 uppercase font-medium text-xs">
                        <tr>
                            <th className="px-4 py-3 sm:px-6">Type</th>
                            <th className="px-4 py-3 sm:px-6">Amount</th>
                            <th className="px-4 py-3 sm:px-6">Method</th>
                            <th className="px-4 py-3 sm:px-6">Status</th>
                            <th className="px-4 py-3 sm:px-6">Date</th>
                            {onDeleteTransaction && <th className="px-4 py-3 text-right sm:px-6">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {visibleTransactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-700/30">
                                <td className="px-4 py-4 sm:px-6">
                                    <span className={`flex items-center gap-2 font-medium ${isCreditTransaction(tx) ? 'text-emerald-400' : 'text-red-400'
                                        }`}>
                                        {isCreditTransaction(tx) ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                        {getTransactionLabel(tx)}
                                    </span>
                                </td>
                                <td className="px-4 py-4 font-mono text-white sm:px-6">
                                    {formatTransactionAmount(tx.amount, tx)}
                                </td>
                                <td className="px-4 py-4 sm:px-6">
                                    {getMethodLabel(tx)}
                                    {tx.utr && <span className="block text-xs text-slate-500 truncate max-w-[100px]" title={tx.utr}>UTR: {tx.utr}</span>}
                                </td>
                                <td className="px-4 py-4 sm:px-6">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 w-fit ${tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                            tx.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                                                'bg-red-500/10 text-red-400'
                                        }`}>
                                        {tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? <CheckCircle size={12} /> :
                                            tx.status === 'PENDING' ? <Clock size={12} /> : <XCircle size={12} />}
                                        {tx.status}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-xs sm:px-6">
                                    {new Date(tx.createdAt).toLocaleString()}
                                </td>
                                {onDeleteTransaction && (
                                    <td className="px-4 py-4 text-right sm:px-6">
                                        <button
                                            type="button"
                                            onClick={() => onDeleteTransaction(tx.id)}
                                            disabled={deletingTransactionId === tx.id}
                                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 px-2.5 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                        >
                                            {deletingTransactionId === tx.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                            Delete Log
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
