"use client";

import React, { useState } from 'react';
import { approveWithdrawal, rejectWithdrawal } from '@/actions/finance';
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle, Check, X } from 'lucide-react';
import { formatTransactionAmount } from '@/utils/transactionCurrency';

interface TransactionsTableProps {
    transactions: TransactionRow[];
    loading: boolean;
    onRefresh: () => void;
}

interface TransactionRow {
    id: number;
    type: string;
    amount: number;
    status: string;
    paymentMethod?: string | null;
    utr?: string | null;
    paymentDetails?: Record<string, unknown> | null;
    createdAt: Date | string;
    user?: {
        username?: string | null;
        email?: string | null;
    } | null;
}

export default function TransactionsTable({ transactions, loading, onRefresh }: TransactionsTableProps) {
    const [processingId, setProcessingId] = useState<number | null>(null);

    const handleAction = async (id: number, action: 'approve' | 'reject') => {
        if (!confirm(`Are you sure you want to ${action} this transaction?`)) return;
        setProcessingId(id);
        try {
            // Hardcoded adminId for now, ideally from auth context
            const adminId = 1;
            if (action === 'approve') {
                await approveWithdrawal(id, adminId, 'Approved by Admin');
            } else {
                await rejectWithdrawal(id, adminId, 'Rejected by Admin');
            }
            onRefresh();
        } catch (error) {
            console.error(`Failed to ${action} transaction`, error);
            alert(`Failed to ${action} transaction`);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading transactions...</div>;
    }

    if (transactions.length === 0) {
        return <div className="p-8 text-center text-slate-500">No transactions found.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-800 text-slate-200 uppercase font-medium">
                    <tr>
                        <th className="px-4 py-4 sm:px-6">User</th>
                        <th className="px-4 py-4 sm:px-6">Type</th>
                        <th className="px-4 py-4 sm:px-6">Amount</th>
                        <th className="px-4 py-4 sm:px-6">Method / UTR</th>
                        <th className="px-4 py-4 sm:px-6">Status</th>
                        <th className="px-4 py-4 sm:px-6">Date</th>
                        <th className="px-4 py-4 text-right sm:px-6">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-4 sm:px-6">
                                <div>
                                    <p className="font-medium text-white">{tx.user?.username || 'Unknown'}</p>
                                    <p className="text-xs">{tx.user?.email}</p>
                                </div>
                            </td>
                            <td className="px-4 py-4 sm:px-6">
                                <span className={`flex items-center gap-2 font-medium ${tx.type === 'DEPOSIT' || tx.type === 'ADMIN_DEPOSIT' ? 'text-emerald-400' : 'text-red-400'
                                    }`}>
                                    {tx.type === 'DEPOSIT' || tx.type === 'ADMIN_DEPOSIT' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                    {tx.type}
                                </span>
                            </td>
                            <td className="px-4 py-4 font-mono text-white sm:px-6">
                                {formatTransactionAmount(tx.amount, tx)}
                            </td>
                            <td className="px-4 py-4 sm:px-6">
                                {tx.paymentMethod}
                                {tx.utr && <span className="block text-xs text-slate-500 truncate max-w-[100px]" title={tx.utr}>UTR: {tx.utr}</span>}
                            </td>
                            <td className="px-4 py-4 sm:px-6">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
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
                            <td className="px-4 py-4 text-right sm:px-6">
                                {tx.status === 'PENDING' && (
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleAction(tx.id, 'approve')}
                                            disabled={processingId === tx.id}
                                            className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors"
                                            title="Approve"
                                        >
                                            <Check size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleAction(tx.id, 'reject')}
                                            disabled={processingId === tx.id}
                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                            title="Reject"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
