"use client";

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { getTransactionsFiltered, approveWithdrawal, rejectWithdrawal, approveDeposit, rejectDeposit } from '@/actions/finance';
import {
    Search, Filter, ChevronLeft, ChevronRight, RefreshCcw, CheckCircle, XCircle,
    Loader2, ArrowDownRight, ArrowUpRight, Receipt, Calendar, DollarSign, SlidersHorizontal,
    Download, X,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { formatTransactionAmount } from '@/utils/transactionCurrency';
import { UserPopup } from '@/components/shared/UserPopup';

type TransactionRow = {
    id: number;
    type: string;
    amount: number;
    status: string;
    paymentMethod?: string | null;
    paymentDetails?: Record<string, unknown> | null;
    transactionId?: string | null;
    utr?: string | null;
    remarks?: string | null;
    createdAt: Date | string;
    user?: { username?: string | null; email?: string | null; phoneNumber?: string | null } | null;
};

const formatCurrency = (tx: TransactionRow) => formatTransactionAmount(tx.amount, tx);

function isCreditTransaction(tx: TransactionRow) {
    return ['DEPOSIT', 'ADMIN_DEPOSIT', 'REFUND', 'BET_REFUND', 'BET_WIN', 'BET_CASHOUT', 'BONUS', 'BONUS_CONVERT', 'BONUS_TYPE_SWITCH'].includes(tx.type);
}

function getTransactionTypeLabel(tx: TransactionRow) {
    const isEarlySixRefund =
        tx.type === 'REFUND' &&
        (
            String(tx.paymentDetails?.tag || '').toUpperCase() === 'EARLY_SIX_REFUND' ||
            String(tx.paymentDetails?.source || '').toUpperCase() === 'FIRST_OVER_SIX_CASHBACK'
        );
    return isEarlySixRefund ? 'Early Six Refund' : tx.type.replace(/_/g, ' ');
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        COMPLETED: 'bg-emerald-500/10 text-emerald-400',
        APPROVED: 'bg-emerald-500/10 text-emerald-400',
        PENDING: 'bg-amber-500/10 text-amber-400',
        REJECTED: 'bg-red-500/10 text-red-400',
        FAILED: 'bg-red-500/10 text-red-400',
    };
    return (
        <span className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${styles[status] || 'bg-slate-700 text-slate-300'}`}>
            {status}
        </span>
    );
}

const PAYMENT_METHODS = ['ALL', 'UPI', 'BANK', 'CRYPTO', 'MANUAL'];
const STATUSES = ['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'];
const TYPES = ['ALL', 'DEPOSIT', 'WITHDRAWAL', 'ADMIN_DEPOSIT', 'ADMIN_WITHDRAWAL'];

function TransactionsContent() {
    const searchParams = useSearchParams();
    const [transactions, setTransactions] = useState<TransactionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [status, setStatus] = useState('ALL');
    const [type, setType] = useState('ALL');
    const [methodFilter, setMethodFilter] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [amountMin, setAmountMin] = useState('');
    const [amountMax, setAmountMax] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [showRejectModal, setShowRejectModal] = useState<{ id: number; type: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showDepositApproveModal, setShowDepositApproveModal] = useState<TransactionRow | null>(null);
    const [depositTxnId, setDepositTxnId] = useState('');

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTransactionsFiltered({
                page, limit: 20, search, status, type,
                methodFilter, dateFrom, dateTo, amountMin, amountMax,
            });
            setTransactions(data.transactions as TransactionRow[]);
            setPagination(data.pagination);
        } catch (error) {
            console.error("Failed to fetch transactions", error);
        } finally {
            setLoading(false);
        }
    }, [page, search, status, type, methodFilter, dateFrom, dateTo, amountMin, amountMax]);

    useEffect(() => {
        const debounce = setTimeout(() => { void fetchTransactions(); }, 300);
        return () => clearTimeout(debounce);
    }, [fetchTransactions]);

    const handleApproveWithdrawal = async (id: number) => {
        setActionLoading(id);
        const res = await approveWithdrawal(id, 1, 'Approved by admin');
        if (res.success) { showToast('Withdrawal approved!', 'success'); fetchTransactions(); }
        else showToast(res.error || 'Failed to approve', 'error');
        setActionLoading(null);
    };

    const handleApproveDeposit = async (id: number, txnId: string) => {
        setActionLoading(id);
        const res = await approveDeposit(id, 1, 'Approved by admin', txnId || undefined);
        if (res.success) { showToast('Deposit approved — balance credited!', 'success'); fetchTransactions(); }
        else showToast(res.error || 'Failed to approve', 'error');
        setActionLoading(null);
        setShowDepositApproveModal(null);
        setDepositTxnId('');
    };

    const handleReject = async (id: number, txType: string, reason: string) => {
        setActionLoading(id);
        const res = txType === 'DEPOSIT'
            ? await rejectDeposit(id, 1, reason || 'Rejected by admin')
            : await rejectWithdrawal(id, 1, reason || 'Rejected by admin');
        if (res.success) {
            showToast(txType === 'DEPOSIT' ? 'Deposit rejected.' : 'Withdrawal rejected. Funds refunded.', 'success');
            fetchTransactions();
        } else showToast(res.error || 'Failed to reject', 'error');
        setActionLoading(null);
        setShowRejectModal(null);
        setRejectReason('');
    };

    const handleExportCSV = () => {
        // Trigger a browser download from the streaming API route. Route handlers have
        // no server-action body-size limit, so this returns the FULL filtered result.
        const params = new URLSearchParams();
        if (type && type !== 'ALL') params.set('type', type);
        if (search) params.set('search', search);
        if (status && status !== 'ALL') params.set('status', status);
        if (methodFilter && methodFilter !== 'ALL') params.set('methodFilter', methodFilter);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        if (amountMin) params.set('amountMin', amountMin);
        if (amountMax) params.set('amountMax', amountMax);
        const url = `/api/export/transactions?${params.toString()}`;
        window.location.href = url;
    };

    const hasActiveFilters = dateFrom || dateTo || amountMin || amountMax || methodFilter !== 'ALL';
    const clearFilters = () => {
        setSearch(''); setStatus('ALL'); setType('ALL'); setMethodFilter('ALL');
        setDateFrom(''); setDateTo(''); setAmountMin(''); setAmountMax('');
        setPage(1);
    };

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed left-4 right-4 top-4 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg animate-in slide-in-from-top-4 sm:left-auto sm:right-6 sm:top-6 ${toast.type === 'success' ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-300' : 'bg-red-900/80 border-red-500/40 text-red-300'}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Deposit Approve Modal */}
            {showDepositApproveModal && (
                <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
                    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6">
                        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                            <CheckCircle size={20} className="text-emerald-400" /> Approve Deposit
                        </h3>
                        <div className="mt-3 mb-4 bg-slate-900/60 rounded-xl p-3 text-sm space-y-1">
                            <p className="text-slate-400">User: <span className="text-white font-medium">{showDepositApproveModal.user?.username || '—'}</span></p>
                            <p className="text-slate-400">Amount: <span className="text-emerald-400 font-bold">{formatCurrency(showDepositApproveModal)}</span></p>
                            {showDepositApproveModal.utr && <p className="text-slate-400">UTR: <span className="text-emerald-300 font-mono">{showDepositApproveModal.utr}</span></p>}
                        </div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            Transaction ID / UTR / Reference <span className="text-slate-600 normal-case font-normal">(optional)</span>
                        </label>
                        <div className="relative">
                            <Receipt size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none placeholder-slate-600"
                                placeholder="e.g. UTR123456789"
                                value={depositTxnId}
                                onChange={e => setDepositTxnId(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                            <button onClick={() => { setShowDepositApproveModal(null); setDepositTxnId(''); }} className="flex-1 py-2 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors text-sm">Cancel</button>
                            <button
                                onClick={() => handleApproveDeposit(showDepositApproveModal.id, depositTxnId.trim())}
                                disabled={actionLoading === showDepositApproveModal.id}
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {actionLoading === showDepositApproveModal.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                Confirm Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
                    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <XCircle size={20} className="text-red-400" /> Reject {showRejectModal.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}
                        </h3>
                        <p className="text-slate-400 text-sm mb-4">
                            {showRejectModal.type === 'WITHDRAWAL' ? "Funds will be refunded to the user's wallet automatically." : 'No balance changes will be made.'}
                        </p>
                        <textarea
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm h-24 resize-none focus:border-red-500 focus:outline-none"
                            placeholder="Reason for rejection..."
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                        />
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <button onClick={() => { setShowRejectModal(null); setRejectReason(''); }} className="flex-1 py-2 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors text-sm">Cancel</button>
                            <button onClick={() => handleReject(showRejectModal.id, showRejectModal.type, rejectReason)} disabled={!rejectReason.trim()} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50">Confirm Reject</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Financial Transactions</h1>
                    <p className="text-slate-400 mt-1">Monitor deposits, withdrawals, and system adjustments.</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <button onClick={handleExportCSV} className="flex items-center justify-center gap-2 rounded-lg border border-emerald-600/20 bg-emerald-600/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-600/20">
                        <Download size={14} /> Export CSV
                    </button>
                    <button onClick={() => void fetchTransactions()} className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700">
                        <RefreshCcw size={14} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {/* Primary row */}
                <div className="p-4 flex flex-col lg:flex-row gap-3">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search by UTR, TxnID, username, email, phone, UPI ID, bank acc, holder name, crypto addr, gateway, remarks…"
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-sm"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        {/* Status */}
                        <select
                            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                            value={status}
                            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                        >
                            {STATUSES.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Status' : s}</option>)}
                        </select>
                        {/* Type */}
                        <select
                            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                            value={type}
                            onChange={(e) => { setType(e.target.value); setPage(1); }}
                        >
                            {TYPES.map(t => <option key={t} value={t}>{t === 'ALL' ? 'All Types' : t.replace(/_/g, ' ')}</option>)}
                        </select>
                        {/* Toggle advanced */}
                        <button
                            onClick={() => setShowAdvanced(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${showAdvanced ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}
                        >
                            <SlidersHorizontal size={14} />
                            Filters {hasActiveFilters && <span className="ml-0.5 w-2 h-2 rounded-full bg-indigo-500 inline-block" />}
                        </button>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-red-400 text-sm transition-colors">
                                <X size={13} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Match count tag */}
                {!loading && (
                    <div className="px-4 pb-2 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            (search || hasActiveFilters)
                                ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300'
                                : 'bg-slate-700/60 border border-slate-700 text-slate-400'
                        }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                            {pagination.total.toLocaleString('en-IN')} matching record{pagination.total !== 1 ? 's' : ''}
                        </span>
                        {(search || hasActiveFilters) && (
                            <span className="text-xs text-slate-600">across UTR, TxnID, UPI ID, bank acc, holder name, email, phone, remarks, gateway…</span>
                        )}
                    </div>
                )}
                {/* Advanced row */}
                {showAdvanced && (
                    <div className="border-t border-slate-700 px-4 py-3 flex flex-wrap gap-3 bg-slate-900/40">
                        {/* Payment Method */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1">
                                <Filter size={9} /> Payment Method
                            </label>
                            <div className="flex gap-1.5">
                                {PAYMENT_METHODS.map(m => (
                                    <button
                                        key={m}
                                        onClick={() => { setMethodFilter(m); setPage(1); }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border ${methodFilter === m ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Date From */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1">
                                <Calendar size={9} /> Date From
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                            />
                        </div>
                        {/* Date To */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1">
                                <Calendar size={9} /> Date To
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                            />
                        </div>
                        {/* Amount Min */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1">
                                <DollarSign size={9} /> Min Amount
                            </label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={amountMin}
                                onChange={e => { setAmountMin(e.target.value); setPage(1); }}
                                className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        {/* Amount Max */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1">
                                <DollarSign size={9} /> Max Amount
                            </label>
                            <input
                                type="number"
                                min="0"
                                placeholder="∞"
                                value={amountMax}
                                onChange={e => { setAmountMax(e.target.value); setPage(1); }}
                                className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-[980px] w-full text-left text-sm">
                        <thead className="bg-slate-900/50 uppercase text-xs text-slate-500">
                            <tr>
                                <th className="px-4 py-3 sm:px-5">User</th>
                                <th className="px-4 py-3 sm:px-5">Type / Method</th>
                                <th className="px-4 py-3 sm:px-5">Amount</th>
                                <th className="px-4 py-3 sm:px-5">UTR / TxnID</th>
                                <th className="px-4 py-3 sm:px-5">Remarks</th>
                                <th className="px-4 py-3 sm:px-5">Status</th>
                                <th className="px-4 py-3 sm:px-5">Date</th>
                                <th className="px-4 py-3 text-right sm:px-5">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="animate-spin text-indigo-400 inline" size={24} /></td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={8} className="py-12 text-center text-slate-500">No transactions found.</td></tr>
                            ) : (
                                transactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-slate-700/20 transition-colors">
                                        <td className="px-4 py-3 sm:px-5">
                                            {tx.user?.username ? (
                                                <UserPopup 
                                                    userId={tx.user.username} 
                                                    username={tx.user.username}
                                                    email={tx.user.email}
                                                    phoneNumber={tx.user.phoneNumber}
                                                />
                                            ) : (
                                                <p className="text-white font-medium">N/A</p>
                                            )}
                                            <p className="text-xs text-slate-500 mt-1">{tx.user?.email}</p>
                                            {tx.user?.phoneNumber && <p className="text-xs text-slate-600">{tx.user.phoneNumber}</p>}
                                        </td>
                                        <td className="px-4 py-3 sm:px-5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${tx.type === 'WITHDRAWAL' || tx.type === 'ADMIN_WITHDRAWAL' ? 'bg-red-500/10 text-red-400' : isCreditTransaction(tx) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                {isCreditTransaction(tx) ? <ArrowDownRight size={10} /> : (tx.type === 'WITHDRAWAL' || tx.type === 'ADMIN_WITHDRAWAL') ? <ArrowUpRight size={10} /> : null}
                                                {getTransactionTypeLabel(tx)}
                                            </span>
                                            {tx.paymentMethod && <p className="mt-1 text-xs text-slate-500 truncate max-w-[120px]">{tx.paymentMethod}</p>}
                                        </td>
                                        <td className={`px-4 py-3 font-mono text-base font-bold sm:px-5 ${isCreditTransaction(tx) ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {formatCurrency(tx)}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-400 sm:px-5 max-w-[140px]">
                                            <div className="truncate">{tx.utr || tx.transactionId || '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400 sm:px-5 max-w-[140px]">
                                            <div className="truncate">{tx.remarks || '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 sm:px-5">
                                            <StatusBadge status={tx.status} />
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400 sm:px-5 whitespace-nowrap">
                                            {new Date(tx.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                        <td className="px-4 py-3 sm:px-5">
                                            {tx.status === 'PENDING' && (tx.type === 'WITHDRAWAL' || tx.type === 'DEPOSIT') ? (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => tx.type === 'DEPOSIT' ? setShowDepositApproveModal(tx) : handleApproveWithdrawal(tx.id)}
                                                        disabled={actionLoading === tx.id}
                                                        className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                                                    >
                                                        {actionLoading === tx.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />} Approve
                                                    </button>
                                                    <button onClick={() => setShowRejectModal({ id: tx.id, type: tx.type })} disabled={actionLoading === tx.id} className="flex items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50">
                                                        <XCircle size={10} /> Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="block text-right text-xs text-slate-600">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && transactions.length > 0 && (
                    <div className="flex flex-col gap-3 border-t border-slate-700 p-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                        <span>Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 hover:bg-slate-700 rounded disabled:opacity-50"><ChevronLeft size={18} /></button>
                            <span className="text-white font-medium">Page {page} of {pagination.totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="p-2 hover:bg-slate-700 rounded disabled:opacity-50"><ChevronRight size={18} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TransactionsPage() {
    return (
        <Suspense fallback={<div className="py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>}>
            <TransactionsContent />
        </Suspense>
    );
}
