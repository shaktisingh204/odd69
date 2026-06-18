"use client";

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { getTransactionsFiltered, processWithdrawal, approveWithdrawal, completeWithdrawal, rejectWithdrawal, revertWithdrawalToProcessed } from '@/actions/finance';
import {
    Clock, CheckCircle, XCircle, RefreshCcw, ChevronLeft, ChevronRight,
    Loader2, Search, Landmark, Smartphone, Bitcoin,
    Copy, Check, Eye, User, Receipt, Download, Calendar, DollarSign, SlidersHorizontal, X, Filter, Undo2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { formatCurrencyAmount, formatCurrencyParts, getTransactionDisplayCurrency, isCryptoTransaction } from '@/utils/transactionCurrency';
import { UserPopup } from '@/components/shared/UserPopup';

// ─── Helpers ────────────────────────────────────────────────────────────────

type WithdrawalDetails = {
    method?: string;
    holderName?: string;
    acctName?: string;
    receive_name?: string;
    upiId?: string;
    acctNo?: string;
    receive_account?: string;
    receiveAccount?: string;
    accountNo?: string;
    ifsc?: string;
    ifscCode?: string;
    acctCode?: string;
    bankName?: string;
    bank?: string;
    coinLabel?: string;
    network?: string;
    address?: string;
    coin?: string;
    currency?: string;
};

const fmtAmt = (n: number, currency?: string) => {
    return formatCurrencyAmount(n, currency === 'CRYPTO' ? 'USD' : currency || 'INR');
};

function CopyBtn({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="ml-1.5 text-slate-500 hover:text-slate-200 transition-colors"
            title="Copy"
        >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
    );
}

// ─── Method normaliser ──────────────────────────────────────────────────────
function resolveMethod(details: WithdrawalDetails | null, paymentMethod?: string | null): string {
    if (details?.method) return (details.method as string).toUpperCase();
    const pm = (paymentMethod || '').toLowerCase();
    if (pm.includes('upi') || pm.includes('gateway')) return 'UPI';
    if (pm.includes('bank') || pm.includes('neft') || pm.includes('imps')) return 'BANK';
    if (pm.includes('crypto') || pm.includes('bitcoin') || pm.includes('now')) return 'CRYPTO';
    return '';
}

// ─── Payment Details Panel ───────────────────────────────────────────────────

function PaymentDetails({ details, paymentMethod }: { details: WithdrawalDetails | null; paymentMethod?: string | null }) {
    if (!details || typeof details !== 'object') {
        if (paymentMethod) {
            return <span className="text-xs text-slate-400">{paymentMethod}</span>;
        }
        return <span className="text-slate-500 text-xs">N/A</span>;
    }

    const method = resolveMethod(details, paymentMethod);

    const holderName = details.holderName || details.acctName || details.receive_name || '—';
    const upiId = details.upiId || details.receive_account || details.receiveAccount || details.acctNo || null;
    const accountNo = details.accountNo || details.receive_account || details.receiveAccount || details.acctNo || null;
    const ifsc = details.ifsc || details.ifscCode || details.acctCode || null;
    const bankName = details.bankName || details.bank || null;

    if (method === 'UPI') {
        return (
            <div className="space-y-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full mb-1">
                    <Smartphone size={9} /> UPI
                </span>
                <div className="text-xs space-y-0.5">
                    <p><span className="text-slate-500">Name:</span> <span className="text-white font-medium">{holderName}</span></p>
                    <p className="flex items-center">
                        <span className="text-slate-500">UPI ID:</span>
                        <span className="text-green-300 font-mono ml-1">{upiId || '—'}</span>
                        {upiId && <CopyBtn text={upiId} />}
                    </p>
                </div>
            </div>
        );
    }

    if (method === 'BANK') {
        return (
            <div className="space-y-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full mb-1">
                    <Landmark size={9} /> Bank Transfer
                </span>
                <div className="text-xs space-y-0.5">
                    <p><span className="text-slate-500">Name:</span> <span className="text-white font-medium">{holderName}</span></p>
                    {bankName && <p><span className="text-slate-500">Bank:</span> <span className="text-white">{bankName}</span></p>}
                    <p className="flex items-center">
                        <span className="text-slate-500">Acc:</span>
                        <span className="text-blue-300 font-mono ml-1">{accountNo || '—'}</span>
                        {accountNo && <CopyBtn text={accountNo} />}
                    </p>
                    <p className="flex items-center">
                        <span className="text-slate-500">IFSC:</span>
                        <span className="text-blue-300 font-mono ml-1 uppercase">{ifsc || '—'}</span>
                        {ifsc && <CopyBtn text={ifsc} />}
                    </p>
                </div>
            </div>
        );
    }

    if (method === 'CRYPTO') {
        return (
            <div className="space-y-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-full mb-1">
                    <Bitcoin size={9} /> {details.coinLabel || 'Crypto'} ({details.network || ''})
                </span>
                <div className="text-xs">
                    <p className="flex items-center gap-1">
                        <span className="text-slate-500">Address:</span>
                        <span className="text-orange-300 font-mono break-all ml-1 max-w-[200px] text-[10px]">{details.address || '—'}</span>
                        {details.address && <CopyBtn text={details.address} />}
                    </p>
                    <p><span className="text-slate-500">Coin:</span> <span className="text-white ml-1">{details.coin || '—'}</span></p>
                </div>
            </div>
        );
    }

    return (
        <span className="text-slate-400 text-xs">{paymentMethod || 'Manual'}</span>
    );
}

// ─── Detail Drawer ───────────────────────────────────────────────────────────

type WithdrawalTx = {
    id: number;
    amount: number;
    status: string;
    createdAt: Date | string;
    paymentMethod: string | null;
    transactionId: string | null;
    utr: string | null;
    remarks: string | null;
    paymentDetails: WithdrawalDetails | null;
    user: { username: string | null; email: string | null; phoneNumber: string | null };
};

function DetailDrawer({ tx, onClose }: { tx: WithdrawalTx; onClose: () => void }) {
    const d = tx.paymentDetails || {};
    const isCrypto = (d.method || '').toUpperCase() === 'CRYPTO';
    const currency = d.currency || (isCrypto ? 'USD' : 'INR');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Eye size={18} className="text-amber-400" /> Withdrawal #{tx.id}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="space-y-4 text-sm">
                    {/* User */}
                    <div className="bg-slate-900/60 rounded-xl p-3 space-y-1">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">User</p>
                        <p className="flex items-center gap-2 text-white font-medium">
                            <User size={14} className="text-slate-400" /> {tx.user?.username || '—'}
                        </p>
                        <p className="text-slate-400 text-xs ml-5">{tx.user?.email}</p>
                        {tx.user?.phoneNumber && <p className="text-slate-400 text-xs ml-5">{tx.user.phoneNumber}</p>}
                    </div>

                    {/* Amount */}
                    <div className="bg-slate-900/60 rounded-xl p-3">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Amount</p>
                        <p className="text-2xl font-bold text-red-400">{fmtAmt(tx.amount, currency)}</p>
                    </div>

                    {/* Payment Details */}
                    <div className="bg-slate-900/60 rounded-xl p-3">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Payment Details</p>
                        <PaymentDetails details={tx.paymentDetails} paymentMethod={tx.paymentMethod} />
                    </div>

                    {/* Meta */}
                    <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-900/60 p-3 text-xs sm:grid-cols-2">
                        <div>
                            <p className="text-slate-500">Requested</p>
                            <p className="text-white">{new Date(tx.createdAt).toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                            <p className="text-slate-500">Status</p>
                            <p className={`font-bold ${
                                tx.status === 'PENDING' ? 'text-amber-400'
                                : tx.status === 'PROCESSED' || tx.status === 'PROCESSING' ? 'text-blue-400'
                                : tx.status === 'APPROVED' ? 'text-purple-400'
                                : tx.status === 'COMPLETED' ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}>
                                {tx.status}
                            </p>
                        </div>
                        {tx.transactionId && (
                            <div className="col-span-2">
                                <p className="text-slate-500">Transaction ID</p>
                                <p className="text-emerald-300 font-mono flex items-center gap-1">
                                    {tx.transactionId} <CopyBtn text={tx.transactionId} />
                                </p>
                            </div>
                        )}
                        {tx.remarks && (
                            <div className="col-span-2">
                                <p className="text-slate-500">Remarks</p>
                                <p className="text-white">{tx.remarks}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Approve Modal ───────────────────────────────────────────────────────────

type GatewayChoice = 'upi2' | 'upi3' | 'upi4' | 'upi5' | 'nexpay' | 'manual';

const GATEWAY_OPTIONS: { key: GatewayChoice; label: string; desc: string; enabled: boolean }[] = [
    { key: 'upi2', label: 'UPI Gateway 2', desc: 'Auto-payout via Payment2 API. Completed on webhook.', enabled: true },
    { key: 'upi3', label: 'UPI Gateway 3 (iPayment)', desc: 'Auto-payout via iPayment API. Completed on webhook.', enabled: true },
    { key: 'upi4', label: 'UPI Gateway 4 (Silkpay)', desc: 'Auto-payout via Silkpay API. Completed on webhook.', enabled: true },
    { key: 'upi5', label: 'UPI Gateway 5 (RezorPay)', desc: 'Auto-payout via RezorPay API. Completed on webhook.', enabled: true },
    { key: 'nexpay', label: 'NexPay (Bank Transfer)', desc: 'Auto-payout via NexPay IMPS/NEFT. Completed on webhook.', enabled: true },
    { key: 'manual', label: 'Manual / External', desc: 'Marks as Approved. You can mark it Completed in the next step.', enabled: true },
];

function ApproveModal({
    tx,
    onConfirm,
    onClose,
    loading,
}: {
    tx: WithdrawalTx;
    onConfirm: (txnId: string, senderUpiId: string | undefined, gateway: GatewayChoice) => void;
    onClose: () => void;
    loading: boolean;
}) {
    const [txnId, setTxnId] = useState('');
    const [upiAccounts, setUpiAccounts] = useState<any[]>([]);
    const [selectedUpi, setSelectedUpi] = useState<string>('');
    const [gateway, setGateway] = useState<GatewayChoice>('upi2');

    useEffect(() => {
        import('@/actions/expenses').then(m => m.getUpiAccounts()).then(data => {
            setUpiAccounts(data.filter((d:any) => d.isActive));
        });
    }, []);

    const d = tx.paymentDetails || {};
    const isCrypto = (d.method || '').toUpperCase() === 'CRYPTO';
    const currency = d.currency || (isCrypto ? 'USD' : 'INR');

    return (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6">
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <CheckCircle size={20} className="text-emerald-400" /> Approve Withdrawal
                </h3>

                {/* Summary */}
                <div className="mt-3 mb-4 bg-slate-900/60 rounded-xl p-3 text-sm space-y-1">
                    <p className="text-slate-400">User: <span className="text-white font-medium">{tx.user?.username || '—'}</span></p>
                    <p className="text-slate-400">Amount: <span className="text-red-400 font-bold">{fmtAmt(tx.amount, currency)}</span></p>
                    <div className="pt-1">
                        <PaymentDetails details={tx.paymentDetails} paymentMethod={tx.paymentMethod} />
                    </div>
                </div>

                {/* Gateway picker */}
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Payout Gateway
                    </label>
                    <div className="space-y-2">
                        {GATEWAY_OPTIONS.map(opt => (
                            <label
                                key={opt.key}
                                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                    gateway === opt.key
                                        ? 'border-emerald-500/60 bg-emerald-500/10'
                                        : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
                                } ${!opt.enabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="gateway"
                                    value={opt.key}
                                    checked={gateway === opt.key}
                                    disabled={!opt.enabled}
                                    onChange={() => setGateway(opt.key)}
                                    className="mt-1 accent-emerald-500"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-white">{opt.label}</p>
                                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{opt.desc}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Transaction ID field */}
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Transaction ID / UTR / Reference <span className="text-slate-600 normal-case font-normal">(optional)</span>
                </label>
                <div className="relative">
                    <Receipt size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none placeholder-slate-600"
                        placeholder="e.g. UTR123456789 or TXID_abc…"
                        value={txnId}
                        onChange={e => setTxnId(e.target.value)}
                        autoFocus
                    />
                </div>
                <p className="text-[10px] text-slate-600 mt-1.5">This will be shown to the user in their transaction history and sent as a notification.</p>

                {/* Ledger Integration Picker */}
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
                    <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                        Corporate Ledger (Deduct From) *
                    </label>
                    <select
                        value={selectedUpi}
                        onChange={e => setSelectedUpi(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    >
                        <option value="">-- Do not log / External --</option>
                        {upiAccounts.map(u => (
                            <option key={u.upiId} value={u.upiId}>{u.name} ({u.upiId})</option>
                        ))}
                    </select>
                    <p className="text-[9px] text-slate-500 mt-1 leading-tight">If selected, the withdrawal amount will be automatically deducted from this gateway&apos;s balance in the Expenses Module.</p>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(txnId.trim(), selectedUpi, gateway)}
                        disabled={loading}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        {gateway === 'manual' ? 'Approve Withdrawal' : `Send via ${GATEWAY_OPTIONS.find(o => o.key === gateway)?.label || gateway}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Complete Modal (APPROVED → COMPLETED) ──────────────────────────────────

function CompleteModal({
    tx,
    onConfirm,
    onClose,
    loading,
}: {
    tx: WithdrawalTx;
    onConfirm: (txnId: string) => void;
    onClose: () => void;
    loading: boolean;
}) {
    const [txnId, setTxnId] = useState('');
    const d = tx.paymentDetails || {};
    const isCrypto = (d.method || '').toUpperCase() === 'CRYPTO';
    const currency = d.currency || (isCrypto ? 'USD' : 'INR');

    return (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6">
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <CheckCircle size={20} className="text-emerald-400" /> Complete Withdrawal
                </h3>
                <p className="text-slate-400 text-sm mb-4">Confirm that the payment has been sent and received.</p>

                {/* Summary */}
                <div className="mt-3 mb-4 bg-slate-900/60 rounded-xl p-3 text-sm space-y-1">
                    <p className="text-slate-400">User: <span className="text-white font-medium">{tx.user?.username || '—'}</span></p>
                    <p className="text-slate-400">Amount: <span className="text-red-400 font-bold">{fmtAmt(tx.amount, currency)}</span></p>
                    <div className="pt-1">
                        <PaymentDetails details={tx.paymentDetails} paymentMethod={tx.paymentMethod} />
                    </div>
                </div>

                {/* Transaction ID field */}
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Transaction ID / UTR / Reference <span className="text-slate-600 normal-case font-normal">(optional)</span>
                </label>
                <div className="relative">
                    <Receipt size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none placeholder-slate-600"
                        placeholder="e.g. UTR123456789 or TXID_abc…"
                        value={txnId}
                        onChange={e => setTxnId(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(txnId.trim())}
                        disabled={loading}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        Mark Completed
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function WithdrawalsContent() {
    const searchParams = useSearchParams();
    const [withdrawals, setWithdrawals] = useState<WithdrawalTx[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [methodFilter, setMethodFilter] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [amountMin, setAmountMin] = useState('');
    const [amountMax, setAmountMax] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
    const [summary, setSummary] = useState({ uniqueDepositors: 0, todayAmount: 0, todayCount: 0 });
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [viewTx, setViewTx] = useState<WithdrawalTx | null>(null);
    // Approve & Complete modal state
    const [showApproveModal, setShowApproveModal] = useState<WithdrawalTx | null>(null);
    const [showCompleteModal, setShowCompleteModal] = useState<WithdrawalTx | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleExportCSV = () => {
        // Trigger a browser download from the streaming API route. No server-action
        // payload limit — returns the FULL filtered result regardless of row count.
        const params = new URLSearchParams();
        params.set('type', 'WITHDRAWAL');
        if (search) params.set('search', search);
        if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
        if (methodFilter && methodFilter !== 'ALL') params.set('methodFilter', methodFilter);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        if (amountMin) params.set('amountMin', amountMin);
        if (amountMax) params.set('amountMax', amountMax);
        window.location.href = `/api/export/transactions?${params.toString()}`;
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTransactionsFiltered({
                page, limit: 15, search,
                status: statusFilter !== 'ALL' ? statusFilter : '',
                type: 'WITHDRAWAL',
                methodFilter,
                dateFrom, dateTo, amountMin, amountMax,
            });
            setWithdrawals(data.transactions as WithdrawalTx[]);
            setPagination(data.pagination);
            setSummary(data.summary || { uniqueDepositors: 0, todayAmount: 0, todayCount: 0 });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter, methodFilter, dateFrom, dateTo, amountMin, amountMax]);

    useEffect(() => {
        const t = setTimeout(fetchData, 300);
        return () => clearTimeout(t);
    }, [fetchData]);

    const handleProcess = async (id: number) => {
        setActionLoading(id);
        const res = await processWithdrawal(id, 1, 'Processed by admin');
        if (res.success) {
            showToast('Withdrawal marked as Processed.', 'success');
            fetchData();
            setSelectedIds(ids => ids.filter(i => i !== id));
        } else {
            showToast(res.error || 'Failed to process', 'error');
        }
        setActionLoading(null);
    };

    const handleApprove = async (id: number, txnId: string, senderUpiId: string | undefined, gateway: GatewayChoice = 'manual') => {
        setActionLoading(id);
        const gatewayLabel = GATEWAY_OPTIONS.find(o => o.key === gateway)?.label || gateway;
        const remarks = gateway === 'manual' ? 'Approved by admin' : `Sent to ${gatewayLabel}`;
        const res = await approveWithdrawal(id, 1, remarks, txnId || undefined, senderUpiId, gateway);
        if (res.success) {
            showToast(
                gateway === 'manual'
                    ? 'Withdrawal approved — user notified.'
                    : `Withdrawal sent to ${gatewayLabel}.`,
                'success'
            );
            fetchData();
            setSelectedIds(ids => ids.filter(i => i !== id));
        } else {
            showToast(res.error || 'Failed to approve', 'error');
        }
        setActionLoading(null);
        setShowApproveModal(null);
    };

    const handleComplete = async (id: number, txnId?: string) => {
        setActionLoading(id);
        const res = await completeWithdrawal(id, 1, 'Completed by admin', txnId || undefined);
        if (res.success) {
            showToast('Withdrawal marked as Completed — user notified.', 'success');
            fetchData();
        } else {
            showToast(res.error || 'Failed to complete', 'error');
        }
        setActionLoading(null);
        setShowCompleteModal(null);
    };

    const handleRevertToProcessed = async (id: number) => {
        if (!confirm('Move this withdrawal back to the Processed list so it can be retried? Use this when the NexPay bank transfer actually failed.')) return;
        setActionLoading(id);
        const res = await revertWithdrawalToProcessed(id, 1);
        if (res.success) {
            showToast('Withdrawal moved back to Processed.', 'success');
            fetchData();
        } else {
            showToast(res.error || 'Failed to revert withdrawal', 'error');
        }
        setActionLoading(null);
    };

    const handleReject = async (id: number, reason: string) => {
        setActionLoading(id);
        const res = await rejectWithdrawal(id, 1, reason || 'Rejected by admin');
        if (res.success) {
            showToast('Withdrawal rejected — funds refunded.', 'success');
            fetchData();
            setSelectedIds(ids => ids.filter(i => i !== id));
        } else {
            showToast(res.error || 'Failed to reject', 'error');
        }
        setActionLoading(null);
        setShowRejectModal(null);
        setRejectReason('');
    };

    const handleBulkProcess = async () => {
        if (!selectedIds.length) return;
        setBulkLoading(true);
        let ok = 0;
        for (const id of selectedIds) {
            const res = await processWithdrawal(id, 1, 'Bulk processed by admin');
            if (res.success) ok++;
        }
        showToast(`Processed ${ok} of ${selectedIds.length} withdrawals.`, ok === selectedIds.length ? 'success' : 'error');
        setSelectedIds([]);
        fetchData();
        setBulkLoading(false);
    };

    const toggleSelect = (id: number) =>
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    const toggleAll = () =>
        setSelectedIds(prev => prev.length === withdrawals.length ? [] : withdrawals.map(w => w.id));

    const pendingList = withdrawals.filter(w => w.status === 'PENDING');
    const totalPendingAmounts = pendingList.reduce(
        (totals, withdrawal) => {
            if (isCryptoTransaction(withdrawal)) {
                totals.crypto += withdrawal.amount;
            } else {
                totals.fiat += withdrawal.amount;
            }
            return totals;
        },
        { fiat: 0, crypto: 0 },
    );

    const methodBadge = (details: WithdrawalDetails | null, paymentMethod?: string | null) => {
        const m = resolveMethod(details, paymentMethod);
        if (m === 'UPI') return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                <Smartphone size={9} /> UPI
            </span>
        );
        if (m === 'BANK') return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                <Landmark size={9} /> Bank
            </span>
        );
        if (m === 'CRYPTO') return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-full">
                <Bitcoin size={9} /> {details?.coinLabel || 'Crypto'}
            </span>
        );
        return <span className="text-slate-500 text-xs">—</span>;
    };

    const statusBadge = (status: string) => {
        const map: Record<string, string> = {
            PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            PROCESSED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            APPROVED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
        };
        const cls = map[status] || 'bg-slate-700 text-slate-400 border-slate-600';
        const Icon = status === 'COMPLETED'
            ? CheckCircle
            : status === 'APPROVED'
                ? CheckCircle
                : status === 'REJECTED'
                    ? XCircle
                    : status === 'PROCESSED' || status === 'PROCESSING'
                        ? RefreshCcw
                        : Clock;
        return (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold border px-1.5 py-0.5 rounded-full ${cls}`}>
                <Icon size={9} /> {status}
            </span>
        );
    };

    return (
        <div className="space-y-6 pb-24">
            {/* Toast */}
            {toast && (
                <div className={`fixed left-4 right-4 top-4 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg transition-all sm:left-auto sm:right-6 sm:top-6 ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-300' : 'bg-red-900/90 border-red-500/40 text-red-300'}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Detail Drawer */}
            {viewTx && <DetailDrawer tx={viewTx} onClose={() => setViewTx(null)} />}

            {/* Approve Modal (PROCESSED → APPROVED) */}
            {showApproveModal && (
                <ApproveModal
                    tx={showApproveModal}
                    onConfirm={(txnId, senderUpiId, gateway) => handleApprove(showApproveModal.id, txnId, senderUpiId, gateway)}
                    onClose={() => setShowApproveModal(null)}
                    loading={actionLoading === showApproveModal.id}
                />
            )}

            {/* Complete Modal (APPROVED → COMPLETED) */}
            {showCompleteModal && (
                <CompleteModal
                    tx={showCompleteModal}
                    onConfirm={(txnId) => handleComplete(showCompleteModal.id, txnId)}
                    onClose={() => setShowCompleteModal(null)}
                    loading={actionLoading === showCompleteModal.id}
                />
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
                    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6">
                        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                            <XCircle size={20} className="text-red-400" /> Reject Withdrawal
                        </h3>
                        <p className="text-slate-400 text-sm mb-4">Provide a reason. The funds will be automatically refunded to the user&apos;s wallet.</p>
                        <textarea
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm h-24 resize-none focus:border-red-500 focus:outline-none"
                            placeholder="Reason for rejection..."
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                        />
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <button
                                onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
                                className="flex-1 py-2 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleReject(showRejectModal, rejectReason)}
                                disabled={!rejectReason.trim() || actionLoading === showRejectModal}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {actionLoading === showRejectModal ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                                Confirm Reject &amp; Refund
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Clock size={28} className="text-amber-400" /> Withdrawals
                    </h1>
                    <p className="text-slate-400 mt-1">Review and approve or reject user withdrawal requests.</p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                    {statusFilter === 'PENDING' && pendingList.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-center">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Pending Total</p>
                            <p className="text-lg font-bold text-amber-400">{formatCurrencyParts(totalPendingAmounts)}</p>
                        </div>
                    )}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Count</p>
                        <p className="text-lg font-bold text-white">{pagination.total}</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Today Withdraw</p>
                        <p className="text-lg font-bold text-white">{summary.todayCount}</p>
                        <p className="text-[11px] text-slate-500">requests today</p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-slate-300 transition-colors hover:bg-slate-700"
                        title="Refresh"
                    >
                        <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="space-y-3">
                {/* Primary row */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search by username, email, phone, UTR, TxnID, UPI ID, bank acc, IFSC, holder name, crypto addr…"
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500 text-sm"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5 items-center">
                        {['PENDING', 'PROCESSED', 'APPROVED', 'COMPLETED', 'REJECTED', 'ALL'].map(s => (
                            <button
                                key={s}
                                onClick={() => { setStatusFilter(s); setPage(1); }}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${statusFilter === s
                                    ? s === 'PENDING' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                                        : s === 'PROCESSED' ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                                            : s === 'APPROVED' ? 'bg-purple-500/15 border-purple-500/40 text-purple-400'
                                                : s === 'COMPLETED' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                                    : s === 'REJECTED' ? 'bg-red-500/15 border-red-500/40 text-red-400'
                                                        : 'bg-slate-600 border-slate-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                            >
                                {s}
                            </button>
                        ))}
                        <button
                            onClick={() => setShowAdvanced(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${showAdvanced ? 'bg-amber-600/20 border-amber-500/40 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                        >
                            <SlidersHorizontal size={12} /> Filters
                            {(dateFrom || dateTo || amountMin || amountMax || methodFilter !== 'ALL') && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />}
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-600/20 bg-amber-600/10 text-xs font-bold text-amber-400 hover:bg-amber-600/20 transition-colors"
                        >
                            <Download size={12} /> Export CSV
                        </button>
                        {(dateFrom || dateTo || amountMin || amountMax || methodFilter !== 'ALL' || search) && (
                            <button onClick={() => { setSearch(''); setMethodFilter('ALL'); setDateFrom(''); setDateTo(''); setAmountMin(''); setAmountMax(''); setPage(1); }} className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-red-400 text-xs transition-colors">
                                <X size={11} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Match count tag */}
                {!loading && (
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            (search || dateFrom || dateTo || amountMin || amountMax || methodFilter !== 'ALL')
                                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                                : 'bg-slate-700/60 border border-slate-700 text-slate-400'
                        }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                            {pagination.total.toLocaleString('en-IN')} matching withdrawal{pagination.total !== 1 ? 's' : ''}
                        </span>
                        {(search || dateFrom || dateTo || amountMin || amountMax || methodFilter !== 'ALL') && (
                            <span className="text-xs text-slate-600">searched across UTR, UPI ID, bank acc, IFSC, holder name, email, phone, crypto addr…</span>
                        )}
                    </div>
                )}

                {/* Advanced filters row */}
                {showAdvanced && (
                    <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap gap-4">
                        {/* Payment Method */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1"><Filter size={9} /> Method</label>
                            <div className="flex gap-1">
                                {['ALL', 'UPI', 'BANK', 'CRYPTO', 'MANUAL'].map(m => (
                                    <button key={m} onClick={() => { setMethodFilter(m); setPage(1); }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border ${methodFilter === m ? 'bg-amber-600/20 border-amber-500/40 text-amber-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}>
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Date From */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1"><Calendar size={9} /> From</label>
                            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500 [color-scheme:dark]" />
                        </div>
                        {/* Date To */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1"><Calendar size={9} /> To</label>
                            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500 [color-scheme:dark]" />
                        </div>
                        {/* Amount Min */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1"><DollarSign size={9} /> Min ₹</label>
                            <input type="number" min="0" placeholder="0" value={amountMin} onChange={e => { setAmountMin(e.target.value); setPage(1); }}
                                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500" />
                        </div>
                        {/* Amount Max */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1"><DollarSign size={9} /> Max ₹</label>
                            <input type="number" min="0" placeholder="∞" value={amountMax} onChange={e => { setAmountMax(e.target.value); setPage(1); }}
                                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500" />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Table ── */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-[1080px] w-full text-sm text-left">
                        <thead className="bg-slate-900/60 uppercase text-[10px] text-slate-500 font-bold tracking-wider">
                            <tr>
                                {statusFilter === 'PENDING' && (
                                    <th className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === withdrawals.length && withdrawals.length > 0}
                                            onChange={toggleAll}
                                            className="rounded accent-amber-500"
                                        />
                                    </th>
                                )}
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Amount</th>
                                <th className="px-4 py-3">Method</th>
                                <th className="px-4 py-3">Payment Details</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Txn ID</th>
                                <th className="px-4 py-3">Requested</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-14 text-center">
                                        <Loader2 className="animate-spin inline text-amber-400" size={28} />
                                        <p className="text-slate-500 text-sm mt-2">Loading withdrawals…</p>
                                    </td>
                                </tr>
                            ) : withdrawals.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-14 text-center">
                                        <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
                                        <p className="font-medium text-slate-300">All clear!</p>
                                        <p className="text-sm text-slate-500">No {statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} withdrawal requests.</p>
                                    </td>
                                </tr>
                            ) : (
                                withdrawals.map(tx => {
                                    const currency = getTransactionDisplayCurrency(tx);
                                    const isPending = tx.status === 'PENDING';
                                    return (
                                        <tr
                                            key={tx.id}
                                            className={`hover:bg-slate-700/20 transition-colors ${selectedIds.includes(tx.id) ? 'bg-amber-500/5' : ''}`}
                                        >
                                            {statusFilter === 'PENDING' && (
                                                <td className="px-4 py-4">
                                                    {isPending && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(tx.id)}
                                                            onChange={() => toggleSelect(tx.id)}
                                                            className="rounded accent-amber-500"
                                                        />
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-4 py-4">
                                                {tx.user?.username ? (
                                                    <UserPopup 
                                                        userId={tx.user.username} 
                                                    // Note: We're passing username as userId since withdrawal tx response 
                                                    // might not include user ID. UserPopup handles optional userId.
                                                        username={tx.user.username}
                                                    />
                                                ) : (
                                                    <p className="text-white font-medium">—</p>
                                                )}
                                                <p className="text-[11px] text-slate-500 mt-1">{tx.user?.email}</p>
                                                {tx.user?.phoneNumber && (
                                                    <p className="text-[11px] text-slate-500">{tx.user.phoneNumber}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="text-red-400 font-mono font-bold text-base">
                                                    {fmtAmt(tx.amount, currency)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                {methodBadge(tx.paymentDetails, tx.paymentMethod)}
                                            </td>
                                            <td className="px-4 py-4 max-w-[240px]">
                                                <PaymentDetails details={tx.paymentDetails} paymentMethod={tx.paymentMethod} />
                                            </td>
                                            <td className="px-4 py-4">
                                                {statusBadge(tx.status)}
                                                {tx.remarks && (
                                                    <p className="text-[10px] text-slate-500 mt-0.5 max-w-[120px] truncate" title={tx.remarks}>
                                                        {tx.remarks}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                {tx.transactionId
                                                    ? <span className="text-emerald-300 font-mono text-[11px] flex items-center gap-1">
                                                        {tx.transactionId} <CopyBtn text={tx.transactionId} />
                                                    </span>
                                                    : <span className="text-slate-600 text-xs">—</span>
                                                }
                                            </td>
                                            <td className="px-4 py-4 text-slate-400 text-xs whitespace-nowrap">
                                                {new Date(tx.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* View details */}
                                                    <button
                                                        onClick={() => setViewTx(tx)}
                                                        className="p-1.5 bg-slate-700/60 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye size={13} />
                                                    </button>
                                                    {/* PENDING → Process */}
                                                    {isPending && (
                                                        <button
                                                            onClick={() => handleProcess(tx.id)}
                                                            disabled={actionLoading === tx.id}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                                            title="Process"
                                                        >
                                                            {actionLoading === tx.id
                                                                ? <Loader2 size={11} className="animate-spin" />
                                                                : <RefreshCcw size={11} />
                                                            }
                                                            Process
                                                        </button>
                                                    )}
                                                    {/* PROCESSED → Approve (opens modal) */}
                                                    {tx.status === 'PROCESSED' && (
                                                        <button
                                                            onClick={() => setShowApproveModal(tx)}
                                                            disabled={actionLoading === tx.id}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                                            title="Approve"
                                                        >
                                                            {actionLoading === tx.id
                                                                ? <Loader2 size={11} className="animate-spin" />
                                                                : <CheckCircle size={11} />
                                                            }
                                                            Approve
                                                        </button>
                                                    )}
                                                    {/* APPROVED → Complete (opens modal) */}
                                                    {tx.status === 'APPROVED' && (
                                                        <button
                                                            onClick={() => setShowCompleteModal(tx)}
                                                            disabled={actionLoading === tx.id}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                                            title="Complete"
                                                        >
                                                            {actionLoading === tx.id
                                                                ? <Loader2 size={11} className="animate-spin" />
                                                                : <CheckCircle size={11} />
                                                            }
                                                            Complete
                                                        </button>
                                                    )}
                                                    {/* COMPLETED (NexPay) → Move back to Processed (for failed transfers) */}
                                                    {tx.status === 'COMPLETED' && /sent to nexpay/i.test(tx.remarks || '') && (
                                                        <button
                                                            onClick={() => handleRevertToProcessed(tx.id)}
                                                            disabled={actionLoading === tx.id}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                                            title="Move back to Processed (NexPay transfer failed)"
                                                        >
                                                            {actionLoading === tx.id
                                                                ? <Loader2 size={11} className="animate-spin" />
                                                                : <Undo2 size={11} />
                                                            }
                                                            Move to Processed
                                                        </button>
                                                    )}
                                                    {/* Reject — allowed from PENDING or PROCESSED */}
                                                    {(isPending || tx.status === 'PROCESSED') && (
                                                        <button
                                                            onClick={() => setShowRejectModal(tx.id)}
                                                            disabled={actionLoading === tx.id}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                                            title="Reject"
                                                        >
                                                            <XCircle size={11} /> Reject
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && withdrawals.length > 0 && (
                    <div className="flex flex-col gap-3 border-t border-slate-700 px-4 py-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                            Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, pagination.total)} of {pagination.total}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1.5 hover:bg-slate-700 rounded-lg disabled:opacity-40 transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-white font-medium px-1">
                                {page} / {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={page === pagination.totalPages}
                                className="p-1.5 hover:bg-slate-700 rounded-lg disabled:opacity-40 transition-colors"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-slate-900 px-4 py-4 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:flex-row sm:items-center sm:gap-5 sm:rounded-full sm:px-6 sm:py-3 sm:-translate-x-1/2">
                    <span className="text-white font-bold text-sm">{selectedIds.length} Selected</span>
                    <div className="hidden h-4 w-px bg-slate-700 sm:block" />
                    <button
                        onClick={handleBulkProcess}
                        disabled={bulkLoading}
                        className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                        {bulkLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
                        Process All
                    </button>
                    <button
                        onClick={() => setSelectedIds([])}
                        className="text-left text-sm text-slate-400 transition-colors hover:text-white"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}

export default function WithdrawalsPage() {
    return (
        <Suspense fallback={<div className="py-20 flex justify-center"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>}>
            <WithdrawalsContent />
        </Suspense>
    );
}
