'use client';
import { useEffect, useState, Suspense } from 'react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import WalletOverview from '@/components/profile/WalletOverview';
import { Calendar, Gamepad2, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Transaction {
    id: number;
    txn_id: string;
    amount: number;
    type: string;
    provider: string;
    game_code: string;
    wallet_type?: string;   // "fiat" | "crypto"
    timestamp: string;
}

import { getCurrencySymbol } from '@/utils/currency';

// Currency symbol helper — uses 'fiat' wallet symbol for fiat txns
const formatAmount = (amount: number, walletType?: string, fiatSymbol = '$') => {
    const symbol = walletType === 'crypto' ? '$' : fiatSymbol;
    return `${symbol}${amount.toFixed(2)}`;
};

function CasinoTransactionsContent() {
    const { token, user } = useAuth();
    const fiatSymbol = getCurrencySymbol('USD');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 20;

    const fetchTransactions = async (pageNo: number) => {
        if (!token) return;
        setLoading(true);
        try {
            const response = await api.get(`/user/casino-transactions?page=${pageNo}&limit=${limit}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data?.transactions) {
                setTransactions(response.data.transactions);
                setTotalPages(response.data.pagination.totalPages);
                setPage(pageNo);
            }
        } catch (error) {
            console.error("Failed to fetch transactions", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchTransactions(1);
    }, [token]);

    const formatDate = (d: string) => new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="space-y-6">
            {/* Back + Title */}
            <div>
                <Link href="/profile" className="inline-flex items-center gap-1 text-white/30 hover:text-white text-xs font-medium mb-3 transition-colors">
                    <ChevronLeft size={14} /> Back to Profile
                </Link>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Gamepad2 size={20} className="text-accent-purple" />
                    Casino Transactions
                </h1>
            </div>

            <WalletOverview />

            {/* Transactions */}
            <div className="bg-bg-modal rounded-xl border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white">Betting History</h2>
                    <span className="text-[10px] text-white/30 font-medium">Page {page}/{totalPages}</span>
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-bg-surface text-white/40 text-[11px] uppercase tracking-wider">
                                <th className="px-4 py-3 text-left font-semibold">Date</th>
                                <th className="px-4 py-3 text-left font-semibold">Game / Provider</th>
                                <th className="px-4 py-3 text-left font-semibold">Type</th>
                                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                                <th className="px-4 py-3 text-center font-semibold">TXN ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {loading ? (
                                <tr><td colSpan={5} className="py-12 text-center text-white/30 text-sm">Loading...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={5} className="py-12 text-center text-white/30 text-sm">No transactions found</td></tr>
                            ) : transactions.map(txn => (
                                <tr key={txn.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{formatDate(txn.timestamp)}</td>
                                    <td className="px-4 py-3">
                                        <div className="text-xs font-medium text-white">{txn.game_code}</div>
                                        <div className="text-[10px] text-accent-purple">{txn.provider}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${txn.type === 'WIN' ? 'bg-success-vivid/10 text-success-bright' :
                                                txn.type === 'BET' ? 'bg-warning-alpha-08 text-warning' :
                                                    'bg-white/[0.04] text-white/50'
                                                }`}>{txn.type}</span>
                                            {txn.wallet_type === 'crypto' && (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-accent-purple border border-orange-500/20">USD</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold text-sm ${txn.type === 'WIN' ? 'text-success-bright' :
                                        txn.type === 'BET' ? 'text-warning' : 'text-white'
                                        }`}>
                                        {txn.type === 'WIN' ? '+' : '-'}{formatAmount(txn.amount, txn.wallet_type, fiatSymbol)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-[10px] text-white/20 font-mono">{txn.txn_id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden divide-y divide-white/[0.04]">
                    {loading ? (
                        <div className="py-12 text-center text-white/30 text-sm">Loading...</div>
                    ) : transactions.length === 0 ? (
                        <div className="py-12 text-center text-white/30 text-sm">No transactions found</div>
                    ) : transactions.map(txn => (
                        <div key={txn.id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white truncate">{txn.game_code}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0 ${txn.type === 'WIN' ? 'bg-success-vivid/10 text-success-bright' :
                                        txn.type === 'BET' ? 'bg-warning-alpha-08 text-warning' :
                                            'bg-white/[0.04] text-white/50'
                                        }`}>{txn.type}</span>
                                    {txn.wallet_type === 'crypto' && (
                                        <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-orange-500/10 text-accent-purple border border-orange-500/20 flex-shrink-0">USD</span>
                                    )}
                                </div>
                                <div className="text-[10px] text-white/25 mt-0.5">{txn.provider} · {formatDate(txn.timestamp)}</div>
                            </div>
                            <span className={`text-sm font-bold flex-shrink-0 ${txn.type === 'WIN' ? 'text-success-bright' :
                                txn.type === 'BET' ? 'text-warning' : 'text-white'
                                }`}>
                                {txn.type === 'WIN' ? '+' : '-'}{formatAmount(txn.amount, txn.wallet_type, fiatSymbol)}
                            </span>
                        </div>
                    ))}                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-white/[0.05] flex justify-center items-center gap-4">
                        <button
                            disabled={page === 1 || loading}
                            onClick={() => fetchTransactions(page - 1)}
                            className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs text-white/40 font-medium">Page {page}</span>
                        <button
                            disabled={page === totalPages || loading}
                            onClick={() => fetchTransactions(page + 1)}
                            className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated disabled:opacity-30 transition-colors"
                        >
                            <ChevronRightIcon size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CasinoTransactionsPage() {
    return (
        <Suspense fallback={<div className="py-20 text-center text-white/30">Loading...</div>}>
            <CasinoTransactionsContent />
        </Suspense>
    );
}
