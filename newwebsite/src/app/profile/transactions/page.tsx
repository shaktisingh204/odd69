'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import WalletOverview from '@/components/profile/WalletOverview';
import { formatCurrencyParts, formatTransactionAmount, isCryptoTransaction } from '@/utils/transactionCurrency';
import {
    ArrowDownLeft,
    ArrowUpRight,
    RefreshCw,
    ChevronLeft,
    ArrowLeftRight,
    Search,
    ReceiptText,
    Gift,
    Sparkles,
    ShieldPlus,
    ShieldMinus,
    Trophy,
} from 'lucide-react';
import Link from 'next/link';

interface Transaction {
    id: number;
    userId: number;
    type: string;
    amount: number;
    status: string;
    paymentMethod?: string;
    transactionId?: string;
    utr?: string;
    remarks?: string;
    paymentDetails?: Record<string, unknown>;
    createdAt: string;
}

type FilterType = 'ALL' | 'DEPOSIT' | 'WITHDRAWAL' | 'BONUS' | 'FANTASY';
type FilterStatus = 'ALL' | 'PENDING' | 'PROCESSED' | 'APPROVED' | 'COMPLETED';

const statusCls: Record<string, string> = {
    APPROVED: 'bg-success-alpha-10 text-success-bright',
    COMPLETED: 'bg-success-alpha-10 text-success-bright',
    PROCESSED: 'bg-info-alpha-10 text-brand-gold',
    PROCESSING: 'bg-info-alpha-10 text-brand-gold',
    REJECTED: 'bg-danger-alpha-10 text-danger',
    PENDING: 'bg-warning-alpha-08 text-warning-bright',
};

const DEPOSIT_TYPES = new Set(['DEPOSIT', 'ADMIN_DEPOSIT']);
const WITHDRAWAL_TYPES = new Set(['WITHDRAWAL', 'ADMIN_WITHDRAWAL']);
const BONUS_TYPES = new Set(['BONUS', 'BONUS_CONVERT', 'BONUS_TYPE_SWITCH', 'BONUS_DEBIT', 'REFUND', 'REFERRAL_BONUS']);
const FANTASY_TYPES = new Set(['FANTASY_ENTRY', 'FANTASY_WINNING']);
const HIDDEN_TRANSACTION_TYPES = new Set(['BET', 'BET_PLACE', 'BONUS_CONVERT_REVERSED']);
const CREDIT_TYPES = new Set([
    'DEPOSIT',
    'ADMIN_DEPOSIT',
    'BONUS',
    'BONUS_CONVERT',
    'BONUS_TYPE_SWITCH',
    'BONUS_DEBIT',
    'REFUND',
    'REFERRAL_BONUS',
    'BET_WIN',
    'BET_REFUND',
    'BET_CASHOUT',
    'FANTASY_WINNING',
]);
const DEBIT_TYPES = new Set([
    'WITHDRAWAL',
    'ADMIN_WITHDRAWAL',
    'BONUS_DEBIT',
    'BET_LOSS',
    'BET_VOID_DEBIT',
    'BET',
    'BET_PLACE',
    'FANTASY_ENTRY',
]);

function isLegacyCashout(txn: Transaction) {
    return DEPOSIT_TYPES.has(txn.type) && String(txn.remarks || '').toLowerCase().includes('cashout');
}

function getAllocationLabels(txn: Transaction): string[] {
    const allocations = txn.paymentDetails?.allocations;
    if (!Array.isArray(allocations)) return [];

    return allocations
        .map((allocation) =>
            typeof (allocation as { walletLabel?: unknown })?.walletLabel === 'string'
                ? String((allocation as { walletLabel?: string }).walletLabel)
                : '',
        )
        .filter(Boolean);
}

function getTypeMeta(txn: Transaction) {
    const source = String(txn.paymentDetails?.source || '').toUpperCase();
    const sourcePrefix =
        source === 'DICE' ? 'Dice '
            : source === 'MINES' ? 'Mines '
                : source === 'AVIATOR' ? 'Aviator '
                    : source === 'LIMBO' ? 'Limbo '
                : '';

    if (txn.type === 'BET_CASHOUT' || isLegacyCashout(txn)) {
        return {
            label:
                source === 'MINES' ? 'Mines Cashout'
                    : source === 'AVIATOR' ? 'Aviator Cashout'
                        : source === 'LIMBO' ? 'Limbo Cashout'
                            : 'Bet Cashout',
            className: 'text-brand-gold',
            iconBg: 'bg-brand-gold/10',
            icon: <ArrowLeftRight className="w-4.5 h-4.5 text-brand-gold" />,
        };
    }

    if (txn.type === 'BET_WIN') {
        return {
            label: `${sourcePrefix}Win`,
            className: 'text-success-bright',
            iconBg: 'bg-success-alpha-10',
            icon: <Sparkles className="w-4.5 h-4.5 text-success-bright" />,
        };
    }

    if (txn.type === 'BET_LOSS') {
        return {
            label: `${sourcePrefix}Loss`,
            className: 'text-danger',
            iconBg: 'bg-danger-alpha-10',
            icon: <ShieldMinus className="w-4.5 h-4.5 text-danger" />,
        };
    }

    if (txn.type === 'BET_VOID_DEBIT') {
        return {
            label: 'Void Adjustment',
            className: 'text-danger',
            iconBg: 'bg-danger-alpha-10',
            icon: <ShieldMinus className="w-4.5 h-4.5 text-danger" />,
        };
    }

    if (txn.type === 'BET_REFUND') {
        return {
            label: String(txn.paymentDetails?.tag || '').toUpperCase() === 'EARLY_SIX_REFUND' ? 'Early Six Refund' : 'Bet Refund',
            className: 'text-brand-gold',
            iconBg: 'bg-brand-gold/10',
            icon: <ShieldPlus className="w-4.5 h-4.5 text-brand-gold" />,
        };
    }

    if (DEPOSIT_TYPES.has(txn.type)) {
        return {
            label: txn.type === 'ADMIN_DEPOSIT' ? 'Manual Credit' : 'Deposit',
            className: 'text-success-bright',
            iconBg: 'bg-success-alpha-10',
            icon: <ArrowDownLeft className="w-4.5 h-4.5 text-success-bright" />,
        };
    }

    if (WITHDRAWAL_TYPES.has(txn.type)) {
        return {
            label: txn.type === 'ADMIN_WITHDRAWAL' ? 'Manual Debit' : 'Withdrawal',
            className: 'text-danger',
            iconBg: 'bg-danger-alpha-10',
            icon: <ArrowUpRight className="w-4.5 h-4.5 text-danger" />,
        };
    }

    if (txn.type === 'BONUS_CONVERT') {
        return {
            label: 'Bonus Converted',
            className: 'text-brand-gold',
            iconBg: 'bg-brand-gold/10',
            icon: <Sparkles className="w-4.5 h-4.5 text-brand-gold" />,
        };
    }

    if (txn.type === 'BONUS_DEBIT') {
        return {
            label: 'Bonus Deduction',
            className: 'text-danger',
            iconBg: 'bg-danger-alpha-10',
            icon: <ShieldMinus className="w-4.5 h-4.5 text-danger" />,
        };
    }

    if (txn.type === 'BONUS_TYPE_SWITCH') {
        return {
            label: 'Bonus Type Switch',
            className: 'text-accent-purple',
            iconBg: 'bg-violet-500/10',
            icon: <RefreshCw className="w-4.5 h-4.5 text-accent-purple" />,
        };
    }

    if (txn.type === 'REFUND') {
        const isEarlySixRefund =
            String(txn.paymentDetails?.tag || '').toUpperCase() === 'EARLY_SIX_REFUND' ||
            String(txn.paymentDetails?.source || '').toUpperCase() === 'FIRST_OVER_SIX_CASHBACK';
        const isBonusWallet =
            String(txn.paymentDetails?.walletType || '').toLowerCase() === 'bonus_wallet' ||
            String(txn.paymentMethod || '').toUpperCase() === 'BONUS_WALLET';

        return {
            label: isEarlySixRefund ? 'Early Six Refund' : isBonusWallet ? 'Cashback Bonus' : 'Refund',
            className: 'text-brand-gold',
            iconBg: 'bg-brand-gold/10',
            icon: <ShieldPlus className="w-4.5 h-4.5 text-brand-gold" />,
        };
    }

    if (txn.type === 'BONUS') {
        return {
            label: 'Bonus',
            className: 'text-warning-bright',
            iconBg: 'bg-warning-alpha-08',
            icon: <Gift className="w-4.5 h-4.5 text-warning-bright" />,
        };
    }

    if (txn.type === 'REFERRAL_BONUS') {
        return {
            label: 'Referral Bonus',
            className: 'text-warning-bright',
            iconBg: 'bg-warning-alpha-08',
            icon: <Gift className="w-4.5 h-4.5 text-warning-bright" />,
        };
    }

    if (txn.type === 'FANTASY_ENTRY') {
        return {
            label: 'Fantasy Entry',
            className: 'text-danger',
            iconBg: 'bg-danger-alpha-10',
            icon: <Trophy className="w-4.5 h-4.5 text-danger" />,
        };
    }

    if (txn.type === 'FANTASY_WINNING') {
        return {
            label: 'Fantasy Winning',
            className: 'text-success-bright',
            iconBg: 'bg-success-alpha-10',
            icon: <Trophy className="w-4.5 h-4.5 text-success-bright" />,
        };
    }

    return {
        label: txn.type.replace(/_/g, ' '),
        className: 'text-white',
        iconBg: 'bg-white/[0.04]',
        icon: <ShieldMinus className="w-4.5 h-4.5 text-white/60" />,
    };
}

function TxIcon({ txn }: { txn: Transaction }) {
    const meta = getTypeMeta(txn);
    return (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg}`}>
            {meta.icon}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${statusCls[status] || 'bg-white/[0.04] text-white/40'}`}>
            {status}
        </span>
    );
}

const fmtDate = (d: string) =>
    new Date(d).toLocaleString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

const fmtAmt = (txn: Transaction, fiatCurrency = 'USD') => {
    const sign = DEBIT_TYPES.has(txn.type) ? '−' : CREDIT_TYPES.has(txn.type) ? '+' : '+';
    return `${sign}${formatTransactionAmount(txn.amount, txn, fiatCurrency)}`;
};

function resolveMethod(txn: Transaction): string {
    const pd = txn.paymentDetails;
    const allocationLabels = getAllocationLabels(txn);
    if (allocationLabels.length > 1) return 'MULTI_WALLET';
    if (pd?.method) return (pd.method as string).toUpperCase();
    const pm = (txn.paymentMethod || '').toLowerCase();
    if (pm === 'main_wallet' || pm === 'fiat_wallet') return 'MAIN_WALLET';
    if (pm === 'crypto_wallet') return 'CRYPTO_WALLET';
    if (pm === 'bonus_wallet') return 'BONUS_WALLET';
    if (pm.includes('manual')) return 'MANUAL';
    if (pm.includes('upi') || pm.includes('gateway')) return 'UPI';
    if (pm.includes('bank') || pm.includes('neft') || pm.includes('imps')) return 'BANK';
    if (pm.includes('crypto') || pm.includes('now')) return 'CRYPTO';
    if (pm.includes('bonus')) return 'BONUS';
    return txn.paymentMethod || '';
}

function getMethodLabel(txn: Transaction) {
    const pd = txn.paymentDetails;
    const method = resolveMethod(txn);
    const walletLabel = typeof pd?.walletLabel === 'string' ? pd.walletLabel : '';

    if (isLegacyCashout(txn)) {
        return 'Main Wallet';
    }

    if (method === 'UPI') {
        const upiId = pd?.upiId || pd?.acctNo || pd?.receive_account;
        const name = pd?.holderName || pd?.acctName || pd?.receive_name;
        if (upiId) return `UPI · ${name ? name + ' · ' : ''}${upiId}`;
        return 'UPI';
    }
    if (method === 'MAIN_WALLET') {
        return walletLabel || 'Main Wallet';
    }
    if (method === 'MULTI_WALLET') {
        const labels = getAllocationLabels(txn);
        return labels.length > 0 ? labels.join(' + ') : 'Multi Wallet';
    }
    if (method === 'BONUS_WALLET') {
        return walletLabel || 'Bonus Wallet';
    }
    if (method === 'CRYPTO_WALLET') {
        return walletLabel || 'Crypto Wallet';
    }
    if (method === 'BANK') {
        const acc = pd?.accountNo || pd?.acctNo;
        const ifsc = pd?.ifsc || pd?.acctCode;
        const name = pd?.holderName || pd?.acctName;
        if (acc) return `Bank · ${name ? name + ' · ' : ''}${acc}${ifsc ? ' · ' + ifsc : ''}`;
        return 'Bank Transfer';
    }
    if (method === 'CRYPTO') {
        const addr = typeof pd?.address === 'string' ? pd.address : '';
        const coin =
            typeof pd?.coinLabel === 'string' ? pd.coinLabel
                : typeof pd?.coin === 'string' ? pd.coin
                    : 'Crypto';
        if (addr) return `${coin} · ${addr.slice(0, 8)}…${addr.slice(-6)}`;
        return coin;
    }
    if (method === 'MANUAL') {
        const accountTag = typeof pd?.accountTag === 'string' ? pd.accountTag : '';
        if (accountTag) return accountTag;
        const upiId = pd?.upiId || pd?.acctNo || pd?.receive_account;
        if (upiId) return `Manual UPI · ${upiId}`;
        return 'Manual';
    }
    if (method === 'BONUS') {
        return pd?.source === 'MATCH_LOSS_CASHBACK' ? 'Match Cashback' : 'Bonus Wallet';
    }
    if (txn.paymentMethod) return txn.paymentMethod;
    if (pd?.acctNo) return `${pd.acctName || ''} · ${pd.acctNo}`;
    return '—';
}

function getDetailLine(txn: Transaction): string | null {
    const walletLabel = typeof txn.paymentDetails?.walletLabel === 'string' ? txn.paymentDetails.walletLabel : '';
    const destinationWallet = typeof txn.paymentDetails?.destinationWallet === 'string'
        ? txn.paymentDetails.destinationWallet.replace(/_/g, ' ').toLowerCase()
        : '';
    const allocationLabels = getAllocationLabels(txn);

    if (isLegacyCashout(txn)) return 'Early settlement credited to Main Wallet';
    if (txn.type === 'BET_CASHOUT') {
        if (allocationLabels.length > 1) {
            return `Split back into ${allocationLabels.join(' + ')}`;
        }
        return walletLabel ? `Credited to ${walletLabel}` : 'Early settlement credited to your wallet';
    }
    if (txn.type === 'BET_WIN') return walletLabel ? `Credited to ${walletLabel}` : 'Bet settled as a win';
    if (txn.type === 'BET_REFUND') return walletLabel ? `Returned to ${walletLabel}` : 'Stake returned to your wallet';
    if (txn.type === 'BET_VOID_DEBIT') return walletLabel ? `Deducted from ${walletLabel}` : 'Previous settlement reversed';
    if (txn.type === 'BONUS_CONVERT') {
        if (walletLabel && destinationWallet) {
            return `${walletLabel} moved to ${destinationWallet}`;
        }
        return 'Bonus balance moved to a withdrawable wallet';
    }
    if (txn.type === 'BONUS' && walletLabel) return `Credited to ${walletLabel}`;
    return null;
}

function getRefNo(txn: Transaction): string | null {
    const pd = txn.paymentDetails;
    if (pd?.bankUtr) return String(pd.bankUtr);
    if (txn.transactionId) return txn.transactionId;
    if (txn.utr) return txn.utr;
    if (pd?.orderNo) return String(pd.orderNo);
    if (pd?.transferId) return String(pd.transferId);
    if (pd?.referenceId) return String(pd.referenceId);
    return null;
}


function getMetaBadge(txn: Transaction): string | null {
    const bonusCode = txn.paymentDetails?.bonusCode;
    if (bonusCode) return `Promo ${String(bonusCode)}`;
    if (txn.type === 'BET_CASHOUT' || isLegacyCashout(txn)) return 'Early settlement';
    if (txn.type === 'BET_WIN') return 'Settled as win';
    if (txn.type === 'BET_LOSS') return 'Settled as loss';
    if (txn.type === 'BET_VOID_DEBIT') return 'Settlement reversed';
    if (txn.type === 'BET_REFUND') return 'Stake refunded';
    if (txn.type === 'BONUS') return 'Bonus Credit';
    if (txn.type === 'REFERRAL_BONUS') return 'Referral Reward';
    if (txn.type === 'BONUS_CONVERT') return 'Converted to Main Wallet';
    if (txn.type === 'BONUS_TYPE_SWITCH') return 'Switched Bonus Type';
    if (txn.type === 'REFUND') return 'Cashback / Refund';
    if (txn.type === 'FANTASY_ENTRY') return 'Fantasy Contest';
    if (txn.type === 'FANTASY_WINNING') return 'Fantasy Prize';
    return null;
}


export default function TransactionsPage() {
    const { user, token } = useAuth();
    const fiatCurrency = 'USD';
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<FilterType>('ALL');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
    const [search, setSearch] = useState('');

    const fetchTransactions = useCallback(async () => {
        if (!user || !token) return;
        setLoading(true);
        try {
            const res = await api.get(`/transactions/my/${user.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data) setTransactions(res.data);
        } catch (e) {
            console.error('Failed to fetch transactions', e);
        } finally {
            setLoading(false);
        }
    }, [user, token]);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const filtered = transactions.filter((txn) => {
        if (HIDDEN_TRANSACTION_TYPES.has(txn.type)) return false;
        if (typeFilter === 'DEPOSIT' && (!DEPOSIT_TYPES.has(txn.type) || isLegacyCashout(txn))) return false;
        if (typeFilter === 'WITHDRAWAL' && !WITHDRAWAL_TYPES.has(txn.type)) return false;
        if (typeFilter === 'BONUS' && !BONUS_TYPES.has(txn.type)) return false;
        if (typeFilter === 'FANTASY' && !FANTASY_TYPES.has(txn.type)) return false;

        if (statusFilter !== 'ALL') {
            if (txn.status !== statusFilter) return false;
        }

        if (search) {
            const q = search.toLowerCase();
            const ref = (getRefNo(txn) || '').toLowerCase();
            const method = getMethodLabel(txn).toLowerCase();
            const badge = (getMetaBadge(txn) || '').toLowerCase();
            const remarks = (txn.remarks || '').toLowerCase();
            const typeLabel = getTypeMeta(txn).label.toLowerCase();

            if (!ref.includes(q) && !method.includes(q) && !badge.includes(q) && !remarks.includes(q) && !typeLabel.includes(q)) {
                return false;
            }
        }

        return true;
    });

    const totalDeposited = transactions.reduce(
        (totals, txn) => {
            if (DEPOSIT_TYPES.has(txn.type) && !isLegacyCashout(txn) && ['APPROVED', 'COMPLETED'].includes(txn.status)) {
                if (isCryptoTransaction(txn)) {
                    totals.crypto += txn.amount;
                } else {
                    totals.fiat += txn.amount;
                }
            }
            return totals;
        },
        { fiat: 0, crypto: 0 },
    );
    const totalWithdrawn = transactions.reduce(
        (totals, txn) => {
            if (WITHDRAWAL_TYPES.has(txn.type) && ['APPROVED', 'COMPLETED'].includes(txn.status)) {
                if (isCryptoTransaction(txn)) {
                    totals.crypto += txn.amount;
                } else {
                    totals.fiat += txn.amount;
                }
            }
            return totals;
        },
        { fiat: 0, crypto: 0 },
    );
    const pending = transactions.filter((txn) => txn.status === 'PENDING').length;

    return (
        <div className="space-y-5">
            <div>
                <Link href="/profile" className="inline-flex items-center gap-1 text-white/30 hover:text-white text-xs font-medium mb-3 transition-colors">
                    <ChevronLeft size={13} /> Back to Profile
                </Link>
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <ArrowLeftRight size={18} className="text-warning" />
                        Financial Transactions
                    </h1>
                    <button
                        onClick={fetchTransactions}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors disabled:opacity-40"
                    >
                        <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            <WalletOverview />

            <div className="grid grid-cols-3 gap-3">
                {[
                    {
                        label: 'Total Deposited',
                        value: formatCurrencyParts(totalDeposited, fiatCurrency),
                        color: 'text-success-bright',
                        bg: 'bg-success-alpha-10',
                    },
                    {
                        label: 'Total Withdrawn',
                        value: formatCurrencyParts(totalWithdrawn, fiatCurrency),
                        color: 'text-danger',
                        bg: 'bg-red-500/6',
                    },
                    {
                        label: 'Pending',
                        value: pending,
                        color: 'text-warning-bright',
                        bg: 'bg-amber-500/6',
                    },
                ].map((card) => (
                    <div key={card.label} className={`${card.bg} border border-white/[0.04] rounded-xl p-3 text-center`}>
                        <div className={`text-base font-black ${card.color}`}>{card.value}</div>
                        <div className="text-[9px] text-white/25 uppercase tracking-wider mt-0.5">{card.label}</div>
                    </div>
                ))}
            </div>

            <div className="bg-bg-modal rounded-xl border border-white/[0.06] p-3 flex flex-col sm:flex-row gap-3 overflow-hidden">
                <div className="flex gap-1.5 bg-white/[0.03] p-0.5 rounded-lg overflow-x-auto scrollbar-hide shrink-0">
                    {(['ALL', 'DEPOSIT', 'WITHDRAWAL', 'BONUS', 'FANTASY'] as FilterType[]).map((filterValue) => (
                        <button
                            key={filterValue}
                            onClick={() => setTypeFilter(filterValue)}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${typeFilter === filterValue
                                ? 'bg-orange-500 text-white shadow-[0_0_8px_rgba(249,115,22,0.4)]'
                                : 'text-white/30 hover:text-white'}`}
                        >
                            {filterValue === 'ALL' ? 'All'
                                : filterValue === 'DEPOSIT' ? 'Deposits'
                                : filterValue === 'WITHDRAWAL' ? 'Withdrawals'
                                : filterValue === 'FANTASY' ? 'Fantasy'
                                : 'Bonuses'}
                        </button>
                    ))}
                </div>

                <div className="flex gap-1.5 bg-white/[0.03] p-0.5 rounded-lg overflow-x-auto scrollbar-hide shrink-0">
                    {(['ALL', 'PENDING', 'PROCESSED', 'APPROVED', 'COMPLETED'] as FilterStatus[]).map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${statusFilter === status
                                ? 'bg-white/[0.08] text-white'
                                : 'text-white/25 hover:text-white'}`}
                        >
                            {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>

                <div className="relative flex-1 min-w-0">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by UTR, promo, method…"
                        className="w-full bg-white/[0.03] border border-white/[0.04] rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/15 focus:outline-none focus:border-orange-500/30 transition-all"
                    />
                </div>
            </div>

            <div className="bg-bg-modal rounded-xl border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                    <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <ReceiptText size={13} className="text-warning" /> Transaction History
                    </h2>
                    <span className="text-[10px] text-white/25">{filtered.length} of {transactions.length}</span>
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-bg-odd69 text-white/30 text-[10px] uppercase tracking-wider">
                                <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                                <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                                <th className="px-4 py-2.5 text-left font-semibold">Method</th>
                                <th className="px-4 py-2.5 text-left font-semibold">Ref / Details</th>
                                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                                <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-14 text-center text-white/25 text-sm">
                                        <RefreshCw className="inline w-4 h-4 animate-spin mr-2" /> Loading…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-14 text-center text-white/20 text-sm">
                                        No transactions match your filters
                                    </td>
                                </tr>
                            ) : filtered.map((txn) => {
                                const meta = getTypeMeta(txn);
                                const metaBadge = getMetaBadge(txn);
                                const detailLine = getDetailLine(txn);

                                return (
                                    <tr key={txn.id} className="hover:bg-white/[0.018] transition-colors">
                                        <td className="px-4 py-3 text-white/35 text-[11px] whitespace-nowrap">{fmtDate(txn.createdAt)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${meta.className}`}>
                                                {meta.icon}
                                                {meta.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[11px] text-white/50 max-w-[140px] truncate">{getMethodLabel(txn)}</td>
                                        <td className="px-4 py-3">
                                            {getRefNo(txn)
                                                ? <span className="text-[10px] font-mono text-white/30">{getRefNo(txn)}</span>
                                                : <span className="text-white/15">—</span>}
                                            {detailLine && (
                                                <div className="text-[10px] text-white/45 mt-1">{detailLine}</div>
                                            )}
                                            {metaBadge && (
                                                <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-warning-alpha-08 border border-amber-500/20 text-[9px] font-bold text-warning-bright">
                                                    <Gift size={9} />
                                                    {metaBadge}
                                                </div>
                                            )}
                                            {txn.remarks && <div className="text-[9px] text-warning-bright/60 mt-0.5 italic">{txn.remarks}</div>}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold text-sm ${meta.className}`}>
                                            {fmtAmt(txn, fiatCurrency)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <StatusBadge status={txn.status} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="md:hidden divide-y divide-white/[0.04]">
                    {loading ? (
                        <div className="py-14 text-center text-white/25 text-sm">
                            <RefreshCw className="inline w-4 h-4 animate-spin mr-2" /> Loading…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-14 text-center text-white/20 text-sm">No transactions match your filters</div>
                    ) : filtered.map((txn) => {
                        const meta = getTypeMeta(txn);
                        const metaBadge = getMetaBadge(txn);
                        const detailLine = getDetailLine(txn);

                        return (
                            <div key={txn.id} className="px-4 py-3.5 flex items-start gap-3">
                                <TxIcon txn={txn} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-xs font-bold ${meta.className}`}>{meta.label}</span>
                                        <span className={`text-sm font-black ${meta.className}`}>{fmtAmt(txn, fiatCurrency)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-white/25">{fmtDate(txn.createdAt)}</span>
                                        <StatusBadge status={txn.status} />
                                    </div>
                                    {getMethodLabel(txn) !== '—' && (
                                        <div className="text-[10px] text-white/35 mt-1 truncate">{getMethodLabel(txn)}</div>
                                    )}
                                    {getRefNo(txn) && (
                                        <div className="text-[9px] font-mono text-white/20 mt-0.5 truncate">Ref: {getRefNo(txn)}</div>
                                    )}
                                    {detailLine && (
                                        <div className="text-[10px] text-white/45 mt-1">{detailLine}</div>
                                    )}
                                    {metaBadge && (
                                        <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-warning-alpha-08 border border-amber-500/20 text-[9px] font-bold text-warning-bright">
                                            <Gift size={9} />
                                            {metaBadge}
                                        </div>
                                    )}
                                    {txn.remarks && (
                                        <div className="text-[9px] text-warning-bright/60 mt-0.5 italic">{txn.remarks}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
