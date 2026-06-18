"use client";

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { getManualAdjustmentsList } from '@/actions/finance';
import {
    Search,
    ArrowUpCircle,
    ArrowDownCircle,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Wallet,
    User,
    Clock,
    SlidersHorizontal,
} from 'lucide-react';

type AdjRow = {
    id: number;
    adminId: number;
    action: string;
    type: 'DEPOSIT' | 'WITHDRAWAL';
    amount: number;
    wallet: string;
    remarks: string;
    createdAt: Date | string;
    user: { id: number; username: string | null; email: string | null; balance: number; cryptoBalance: number } | null;
};

type PaginationInfo = { total: number; page: number; limit: number; totalPages: number };

const WALLET_LABELS: Record<string, string> = {
    fiat: 'Main Wallet',
    crypto: 'Crypto Wallet',
    casinoBonus: 'Casino Bonus',
    sportsBonus: 'Sports Bonus',
    cryptoBonus: 'Crypto Bonus',
};

const WALLET_COLORS: Record<string, string> = {
    fiat: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    crypto: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    casinoBonus: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    sportsBonus: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cryptoBonus: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

function formatDate(d: Date | string) {
    const dt = typeof d === 'string' ? new Date(d) : d;
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(dt);
}

function formatAmount(n: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
}

export default function ManualAdjustmentsPage() {
    const [rows, setRows] = useState<AdjRow[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({ total: 0, page: 1, limit: 20, totalPages: 0 });
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL');
    const [isPending, startTransition] = useTransition();

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback((page: number) => {
        startTransition(async () => {
            const res = await getManualAdjustmentsList(page, 20, debouncedSearch);
            if (res.success && res.data) {
                const filtered = typeFilter === 'ALL'
                    ? res.data as AdjRow[]
                    : (res.data as AdjRow[]).filter(r => r.type === typeFilter);
                setRows(filtered);
                setPagination(res.pagination!);
            }
        });
    }, [debouncedSearch, typeFilter]);

    useEffect(() => { load(1); }, [load]);

    const goPage = (p: number) => { if (p >= 1 && p <= pagination.totalPages) load(p); };

    const creditCount = rows.filter(r => r.type === 'DEPOSIT').length;
    const debitCount = rows.filter(r => r.type === 'WITHDRAWAL').length;
    const totalCredit = rows.filter(r => r.type === 'DEPOSIT').reduce((s, r) => s + r.amount, 0);
    const totalDebit = rows.filter(r => r.type === 'WITHDRAWAL').reduce((s, r) => s + r.amount, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Manual Adjustments</h1>
                    <p className="text-slate-400 text-sm mt-0.5">History of all manual credit / debit operations</p>
                </div>
                <button
                    onClick={() => load(pagination.page)}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={15} className={isPending ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-1">Total Records</p>
                    <p className="text-2xl font-bold text-white">{pagination.total}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-1">Credits (this page)</p>
                    <p className="text-2xl font-bold text-emerald-400">{creditCount}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatAmount(totalCredit)}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-1">Debits (this page)</p>
                    <p className="text-2xl font-bold text-red-400">{debitCount}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatAmount(totalDebit)}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-1">Net (this page)</p>
                    <p className={`text-2xl font-bold ${totalCredit - totalDebit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatAmount(totalCredit - totalDebit)}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search by username, email, remarks…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <SlidersHorizontal size={15} className="text-slate-500" />
                    {(['ALL', 'DEPOSIT', 'WITHDRAWAL'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTypeFilter(t)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                                typeFilter === t
                                    ? t === 'DEPOSIT'
                                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                        : t === 'WITHDRAWAL'
                                        ? 'bg-red-500/15 border-red-500/40 text-red-400'
                                        : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-400'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                        >
                            {t === 'ALL' ? 'All' : t === 'DEPOSIT' ? 'Credit' : 'Debit'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                {/* Loading overlay */}
                {isPending && rows.length === 0 && (
                    <div className="flex items-center justify-center h-48 text-slate-500 text-sm gap-2">
                        <RefreshCw size={16} className="animate-spin" /> Loading…
                    </div>
                )}

                {!isPending && rows.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
                        <Wallet size={32} className="opacity-30" />
                        <p className="text-sm">No manual adjustments found</p>
                    </div>
                )}

                {rows.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                                    <th className="text-left px-4 py-3 font-medium">#</th>
                                    <th className="text-left px-4 py-3 font-medium">
                                        <span className="flex items-center gap-1"><User size={13} />User</span>
                                    </th>
                                    <th className="text-left px-4 py-3 font-medium">Type</th>
                                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                                    <th className="text-left px-4 py-3 font-medium">Wallet</th>
                                    <th className="text-left px-4 py-3 font-medium">Remarks</th>
                                    <th className="text-left px-4 py-3 font-medium">
                                        <span className="flex items-center gap-1"><Clock size={13} />Date</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className={isPending ? 'opacity-50' : ''}>
                                {rows.map((row, idx) => (
                                    <tr
                                        key={row.id}
                                        className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition-colors"
                                    >
                                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                                            {(pagination.page - 1) * pagination.limit + idx + 1}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.user ? (
                                                <div>
                                                    <p className="text-white font-medium">{row.user.username ?? `User#${row.user.id}`}</p>
                                                    <p className="text-slate-500 text-xs">{row.user.email}</p>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500 italic text-xs">Unknown</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.type === 'DEPOSIT' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    <ArrowUpCircle size={12} /> Credit
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                                    <ArrowDownCircle size={12} /> Debit
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-mono font-semibold ${row.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {row.type === 'DEPOSIT' ? '+' : '−'}{formatAmount(row.amount)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${WALLET_COLORS[row.wallet] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                                {WALLET_LABELS[row.wallet] ?? row.wallet}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 max-w-xs truncate" title={row.remarks}>
                                            {row.remarks || <span className="italic text-slate-600">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                                            {formatDate(row.createdAt)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-slate-400">
                    <p>
                        Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}–
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => goPage(pagination.page - 1)}
                            disabled={pagination.page <= 1 || isPending}
                            className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                            const p = i + 1;
                            return (
                                <button
                                    key={p}
                                    onClick={() => goPage(p)}
                                    disabled={isPending}
                                    className={`w-8 h-8 rounded text-xs transition-colors ${
                                        p === pagination.page
                                            ? 'bg-indigo-600 text-white font-bold'
                                            : 'hover:bg-slate-700 text-slate-400'
                                    }`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => goPage(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages || isPending}
                            className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
