"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    getUserProfile, getUserTransactionsDirect, getUserCasinoTransactions,
    updateUserStatus, updateUserProfile, resetUserPassword,
    assignManager, getManagersList, deleteUser, getUserSportsBets, convertBonusType, deleteUserTransactionLog,
    updateSportsBetWinningAmount,
} from '@/actions/users';
import { createManualAdjustment as financeManualAdjustment } from '@/actions/finance';
import { adminGiveBonus } from '@/actions/marketing';
import { fmtUSD } from '@/utils/transactionCurrency';
import UserProfileHeader from '@/components/users/UserProfileHeader';
import UserTransactionsTable from '@/components/users/UserTransactionsTable';
import UserBetsTable from '@/components/users/UserBetsTable';
import UserCasinoTable from '@/components/users/UserCasinoTable';
import UserHuiduPanel from '@/components/users/UserHuiduPanel';
import VerificationTab from '@/components/users/VerificationTab';
import ResponsibleGamblingTab from '@/components/users/ResponsibleGamblingTab';
import {
    Loader2, ArrowLeft, Activity, CreditCard, FileText, Shield, ShieldCheck,
    ArrowUpRight, ArrowDownRight, CheckCircle, XCircle, Wallet, Save,
    Gamepad2, ChevronLeft, ChevronRight, X, Edit2, KeyRound, UserCog, Trash2, RefreshCw, Ban, UserCheck, AlertTriangle, Gift
} from 'lucide-react';
import Link from 'next/link';

type Toast = { msg: string; type: 'success' | 'error' };
type TabId = 'overview' | 'transactions' | 'bets' | 'casino' | 'verification' | 'rg' | 'notes';
type AdjustmentTarget = 'fiat' | 'crypto' | 'casinoBonus' | 'sportsBonus' | 'cryptoBonus';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency: string) {
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserProfilePage() {
    const params = useParams();
    const router = useRouter();
    const identifier = params.id as string;
    const [userId, setUserId] = useState<number | null>(null);

    // Core data
    const [user, setUser] = useState<any | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [txPagination, setTxPagination] = useState({ total: 0, page: 1, totalPages: 1 });
    const [bets, setBets] = useState<any[]>([]);
    const [casinoTxns, setCasinoTxns] = useState<any[]>([]);
    const [casinoPagination, setCasinoPagination] = useState({ total: 0, page: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);

    // Tabs
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    // Wallet Actions
    const [walletAmount, setWalletAmount] = useState('');
    const [walletType, setWalletType] = useState<'credit' | 'debit'>('credit');
    const [walletTarget, setWalletTarget] = useState<AdjustmentTarget>('fiat');
    const [walletRemarks, setWalletRemarks] = useState('');
    const [walletSkipLog, setWalletSkipLog] = useState(false);
    const [walletLoading, setWalletLoading] = useState(false);
    const [walletMsg, setWalletMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [deleteTxnLoadingId, setDeleteTxnLoadingId] = useState<number | null>(null);

    // Notes (localStorage)
    const [notes, setNotes] = useState('');
    const [notesSaving, setNotesSaving] = useState(false);

    // Ban
    const [banLoading, setBanLoading] = useState(false);
    const [showBanConfirm, setShowBanConfirm] = useState(false);
    const [banReason, setBanReason] = useState('');

    // Delete loading
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Toast
    const [toast, setToast] = useState<Toast | null>(null);
    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Edit Modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ email: '', phoneNumber: '', role: '', currency: '', country: '' });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');

    // Password Reset Modal
    const [showPwModal, setShowPwModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [pwLoading, setPwLoading] = useState(false);
    const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

    // Bonus conversion
    const [bonusConvertLoading, setBonusConvertLoading] = useState(false);
    const [bonusLoading, setBonusLoading] = useState(false);
    const [bonusForm, setBonusForm] = useState({
        bonusType: 'CASINO_BONUS' as 'FIAT_BONUS' | 'CASINO_BONUS' | 'SPORTS_BONUS' | 'CRYPTO_BONUS',
        amount: '',
        title: '',
        wageringRequirement: '0',
    });

    // Manager Assignment
    const [managers, setManagers] = useState<any[]>([]);
    const [selectedManager, setSelectedManager] = useState<string>('');
    const [managerLoading, setManagerLoading] = useState(false);

    // ─── Fetch data ───────────────────────────────────────────────────────────

    const fetchUser = useCallback(async () => {
        if (!identifier) return null;
        const res = await getUserProfile(identifier);
        if (res.success && res.user) {
            setUser(res.user);
            setUserId(res.user.id);
            setTransactions((res.user as any).transactions || []);
            setCasinoTxns((res.user as any).casinoTransactions || []);
            setSelectedManager(String((res.user as any).managerId || ''));
            const savedNotes = localStorage.getItem(`user_notes_${res.user.id}`);
            if (savedNotes) setNotes(savedNotes);
            return res.user.id;
        }
        return null;
    }, [identifier]);

    const fetchTransactions = useCallback(async (page = 1) => {
        const res = await getUserTransactionsDirect(userId as number, page, 20);
        if (res.success) {
            setTransactions(res.transactions as any[]);
            setTxPagination({ total: res.pagination.total, page: res.pagination.page, totalPages: res.pagination.totalPages });
        }
    }, [userId]);

    const fetchCasino = useCallback(async (page = 1) => {
        const res = await getUserCasinoTransactions(userId as number, page, 20);
        if (res.success) {
            setCasinoTxns(res.transactions as any[]);
            setCasinoPagination({ total: res.pagination.total, page: res.pagination.page, totalPages: res.pagination.totalPages });
        }
    }, [userId]);

    const fetchBets = useCallback(async (uid: number) => {
        try {
            const res = await getUserSportsBets(uid);
            if (res.success) setBets(res.bets || []);
        } catch { /* MongoDB bets — failure is non-fatal */ }
    }, []);

    const loadAll = useCallback(async () => {
        setLoading(true);
        const uid = await fetchUser();
        if (uid) {
            await fetchBets(uid);
        }
        setLoading(false);
    }, [fetchUser, fetchBets]);

    useEffect(() => {
        loadAll();
        getManagersList().then((list) => setManagers(list));
    }, [loadAll]);

    // When switching to transactions/casino tabs, load full paginated data
    useEffect(() => {
        if (activeTab === 'transactions') fetchTransactions(1);
        if (activeTab === 'casino') fetchCasino(1);
    }, [activeTab, fetchTransactions, fetchCasino]);

    // ─── Handlers ────────────────────────────────────────────────────────────

    const handleBanToggle = () => {
        if (!user) return;
        setShowBanConfirm(true);
        setBanReason('');
    };

    const handleConfirmBan = async () => {
        if (!user) return;
        const newBan = !user.isBanned;
        setBanLoading(true);
        const res = await updateUserStatus(userId as number, newBan, newBan ? banReason : undefined);
        if (res.success) {
            showToast(`User ${newBan ? 'banned' : 'unbanned'} successfully.`, 'success');
            setUser((u: any) => ({ ...u, isBanned: newBan }));
        } else {
            showToast('Failed to update user status.', 'error');
        }
        setBanLoading(false);
        setShowBanConfirm(false);
    };

    const handleDeleteUser = async () => {
        setDeleteLoading(true);
        const res = await deleteUser(userId as number);
        if (res.success) {
            showToast('User permanently deleted.', 'success');
            setShowDeleteConfirm(false);
            setTimeout(() => router.push('/dashboard/users'), 1200);
        } else {
            showToast(res.error || 'Failed to delete user.', 'error');
            setShowDeleteConfirm(false);
        }
        setDeleteLoading(false);
    };

    const handleOpenEdit = () => {
        if (!user) return;
        setEditForm({
            email: user.email || '',
            phoneNumber: user.phoneNumber || '',
            role: user.role || 'USER',
            currency: user.currency || 'INR',
            country: user.country || '',
        });
        setEditError('');
        setShowEditModal(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setEditLoading(true);
        setEditError('');
        const res = await updateUserProfile(userId as number, editForm);
        if (res.success) {
            showToast('Profile updated successfully.', 'success');
            setShowEditModal(false);
            await fetchUser();
        } else {
            setEditError(res.error || 'Failed to update.');
        }
        setEditLoading(false);
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwLoading(true);
        setPwMsg(null);
        const res = await resetUserPassword(userId as number, newPassword);
        if (res.success) {
            setPwMsg({ text: 'Password reset successfully.', ok: true });
            setNewPassword('');
        } else {
            setPwMsg({ text: res.error || 'Failed to reset password.', ok: false });
        }
        setPwLoading(false);
    };

    const handleAssignManager = async () => {
        setManagerLoading(true);
        const managerId = selectedManager ? Number(selectedManager) : null;
        const res = await assignManager(userId as number, managerId);
        if (res.success) {
            showToast('Manager assigned successfully.', 'success');
            await fetchUser();
        } else {
            showToast(res.error || 'Failed to assign manager.', 'error');
        }
        setManagerLoading(false);
    };

    const handleWalletAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !walletAmount) return;
        const isBonusTarget =
            walletTarget === 'casinoBonus' ||
            walletTarget === 'sportsBonus' ||
            walletTarget === 'cryptoBonus';
        if (isBonusTarget && walletType === 'credit') {
            showToast('Use Add Bonus below to credit a bonus wallet.', 'error');
            return;
        }
        setWalletLoading(true);
        setWalletMsg(null);
        const type = walletType === 'credit' ? 'DEPOSIT' : 'WITHDRAWAL';
        const amount = parseFloat(walletAmount);
        const res = await financeManualAdjustment(
            userId as number,
            type as any,
            amount,
            walletRemarks || `Manual ${walletType} to ${walletTarget} wallet by admin`,
            1,
            walletTarget,
            { skipTransactionLog: walletSkipLog },
        );
        if (res.success) {
            const amountLabel = walletTarget === 'crypto' || walletTarget === 'cryptoBonus'
                ? `$${amount.toFixed(2)}`
                : fmtCurrency(amount, user.currency || 'INR');
            const targetLabel = ({
                fiat: 'Main Wallet',
                crypto: 'Crypto Wallet',
                casinoBonus: 'Casino Bonus',
                sportsBonus: 'Sports Bonus',
                cryptoBonus: 'Crypto Bonus',
            } as const)[walletTarget];
            setWalletMsg({ text: `${walletType === 'credit' ? 'Credited' : 'Debited'} ${amountLabel} successfully.`, type: 'success' });
            showToast(`${walletType === 'credit' ? 'Credited' : 'Deducted'} ${amountLabel} ${walletType === 'credit' ? 'to' : 'from'} ${targetLabel}${walletSkipLog ? ' without transaction log' : ''}.`, 'success');
            setWalletAmount('');
            setWalletRemarks('');
            setWalletSkipLog(false);
            await Promise.all([fetchUser(), fetchTransactions(txPagination.page)]);
        } else {
            setWalletMsg({ text: res.error || 'Action failed.', type: 'error' });
        }
        setWalletLoading(false);
    };

    const handleDeleteTransaction = async (transactionId: number) => {
        if (!confirm('Delete this transaction log only? Wallet balances will not be changed.')) return;

        setDeleteTxnLoadingId(transactionId);
        const res = await deleteUserTransactionLog(userId as number, transactionId, 1);
        if (res.success) {
            showToast('Transaction log deleted.', 'success');
            await Promise.all([fetchUser(), fetchTransactions(txPagination.page)]);
        } else {
            showToast(res.error || 'Failed to delete transaction log.', 'error');
        }
        setDeleteTxnLoadingId(null);
    };

    const handleEditBetWin = async (payload: {
        betId: string;
        userId: number;
        currentWin: number;
        newWin: number;
        remarks: string;
        createTx: boolean;
    }) => {
        const res = await updateSportsBetWinningAmount(
            payload.betId,
            payload.userId,
            payload.newWin,
            payload.createTx,
            payload.remarks,
        );
        if (res.success) {
            const txLogNote = (res as any).updatedTransactionLogs > 0
                ? ` · ${(res as any).updatedTransactionLogs} transaction log(s) updated`
                : '';
            showToast(
                `Win amount updated: ${fmtCurrency(payload.currentWin, currency)} → ${fmtCurrency(payload.newWin, currency)}${
                    payload.createTx && payload.newWin !== payload.currentWin
                        ? ` (wallet ${payload.newWin > payload.currentWin ? 'credited' : 'debited'} ${fmtCurrency(Math.abs(payload.newWin - payload.currentWin), currency)})`
                        : ''
                }${txLogNote}`,
                'success',
            );
            await fetchBets(userId as number);
            if (payload.createTx && payload.newWin !== payload.currentWin) {
                await fetchTransactions(txPagination.page);
                await fetchUser();
            }
        } else {
            showToast((res as any).error || 'Failed to update bet win amount.', 'error');
        }
        return res;
    };

    const handleSaveNotes = () => {
        setNotesSaving(true);
        localStorage.setItem(`user_notes_${userId}`, notes);
        setTimeout(() => setNotesSaving(false), 800);
    };

    const handleBonusConvert = async (from: 'CASINO' | 'SPORTS') => {
        const to = from === 'CASINO' ? 'Sports' : 'Casino';
        const fromLabel = from === 'CASINO' ? 'Casino' : 'Sports';
        if (!confirm(`Convert all ${fromLabel} bonus to ${to} bonus for ${user?.username}?`)) return;
        setBonusConvertLoading(true);
        const res = await convertBonusType(userId as number, from);
        if (res.success) {
            showToast(`Converted ₹${(res as any).amount?.toFixed(2)} from ${fromLabel} → ${to} bonus.`, 'success');
            await fetchUser();
        } else {
            showToast((res as any).error || 'Conversion failed.', 'error');
        }
        setBonusConvertLoading(false);
    };

    const handleGiveBonus = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = Number(bonusForm.amount);
        const wageringRequirement = Number(bonusForm.wageringRequirement || '0');

        if (!amount || amount <= 0) {
            showToast('Enter a valid bonus amount.', 'error');
            return;
        }

        setBonusLoading(true);
        const res = await adminGiveBonus({
            userId: userId as number,
            bonusType: bonusForm.bonusType,
            amount,
            title: bonusForm.title.trim() || undefined,
            wageringRequirement,
        });

        if (res.success) {
            showToast(`${res.walletLabel || 'Bonus'} added successfully.`, 'success');
            setBonusForm((prev) => ({
                ...prev,
                amount: '',
                title: '',
                wageringRequirement: '0',
            }));
            await fetchUser();
        } else {
            showToast(res.error || 'Failed to add bonus.', 'error');
        }
        setBonusLoading(false);
    };

    // ─── Loading / Not Found ──────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
        );
    }

    if (!user) {
        return <div className="text-center text-slate-500 mt-10">User not found.</div>;
    }

    const currency = user.currency || 'INR';
    const fmt = (n: number) => fmtCurrency(n, currency);

    const tabs: { id: TabId; label: string; icon: any }[] = [
        { id: 'overview', label: 'Overview', icon: null },
        { id: 'transactions', label: 'Transactions', icon: CreditCard },
        { id: 'bets', label: 'Bets', icon: Activity },
        { id: 'casino', label: 'Casino', icon: Gamepad2 },
        { id: 'verification', label: 'Verification', icon: ShieldCheck },
        { id: 'rg', label: 'Resp. Gambling', icon: Shield },
        { id: 'notes', label: 'Notes', icon: FileText },
    ];

    return (
        <div className="space-y-6 relative">
            {/* Toast */}
            {toast && (
                <div className={`fixed left-4 right-4 top-4 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg animate-in slide-in-from-top-4 sm:left-auto sm:right-6 sm:top-6 ${toast.type === 'success' ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-300' : 'bg-red-900/80 border-red-500/40 text-red-300'}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
                    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Edit2 size={18} className="text-indigo-400" /> Edit User</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Email</label>
                                    <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Phone</label>
                                    <input type="tel" value={editForm.phoneNumber} onChange={e => setEditForm(f => ({ ...f, phoneNumber: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Role</label>
                                    <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none">
                                        {['USER', 'AGENT', 'MASTER', 'MANAGER', 'SUPER_ADMIN', 'TECH_MASTER'].map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Currency</label>
                                    <input value={editForm.currency} onChange={e => setEditForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                                        maxLength={3} placeholder="INR"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none uppercase" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Country (ISO-2)</label>
                                <input value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value.toUpperCase() }))}
                                    maxLength={2} placeholder="IN"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none uppercase" />
                            </div>
                            {editError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2">
                                    <XCircle size={14} /> {editError}
                                </div>
                            )}
                            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors text-sm">Cancel</button>
                                <button type="submit" disabled={editLoading} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50">
                                    {editLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>

                        {/* Password reset section inside edit modal */}
                        <div className="mt-5 pt-5 border-t border-slate-700">
                            <div className="flex items-center gap-2 mb-3 text-slate-300 font-medium text-sm">
                                <KeyRound size={15} className="text-amber-400" /> Reset Password
                            </div>
                            <form onSubmit={handleResetPassword} className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    type="password"
                                    minLength={8}
                                    required
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="New password (min 8 chars)"
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
                                />
                                <button type="submit" disabled={pwLoading} className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                                    {pwLoading ? '...' : 'Reset'}
                                </button>
                            </form>
                            {pwMsg && (
                                <p className={`mt-2 text-xs flex items-center gap-1 ${pwMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {pwMsg.ok ? <CheckCircle size={12} /> : <XCircle size={12} />} {pwMsg.text}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md rounded-xl border border-red-600/40 bg-slate-800 p-4 shadow-2xl sm:p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/15 rounded-lg">
                                <Trash2 size={20} className="text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white">Permanently Delete User</h3>
                        </div>
                        <p className="text-slate-300 text-sm mb-2">
                            You are about to <span className="text-red-400 font-semibold">permanently delete</span> the account of:
                        </p>
                        <div className="bg-slate-900 rounded-lg px-4 py-2 mb-4 border border-slate-700">
                            <p className="text-white font-bold">{user.username}</p>
                            <p className="text-slate-400 text-xs">{user.email}</p>
                        </div>
                        <p className="text-slate-400 text-xs mb-5">
                            This action <span className="text-red-400 font-semibold">cannot be undone</span>. All data associated with this user will be permanently removed from the database.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleteLoading}
                                className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteUser}
                                disabled={deleteLoading}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deleteLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ban/Unban Confirm Modal */}
            {showBanConfirm && user && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className={`w-full max-w-md rounded-xl border ${user.isBanned ? 'border-emerald-600/40' : 'border-red-600/40'} bg-slate-800 p-4 shadow-2xl sm:p-6`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${user.isBanned ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                                {user.isBanned ? <UserCheck size={20} className="text-emerald-400" /> : <Ban size={20} className="text-red-400" />}
                            </div>
                            <h3 className="text-lg font-bold text-white">{user.isBanned ? 'Unban User' : 'Ban User'}</h3>
                        </div>

                        {user.isBanned ? (
                            <p className="text-slate-300 text-sm mb-5">
                                Restore access for <span className="text-white font-semibold">{user.username}</span>? They will be able to log in and use the platform again.
                            </p>
                        ) : (
                            <>
                                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-4">
                                    <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                                    <div className="text-xs text-red-300">
                                        <p className="font-semibold mb-0.5">This will immediately:</p>
                                        <ul className="list-disc list-inside text-red-400/80 space-y-0.5">
                                            <li>Block all login attempts</li>
                                            <li>Reject all API requests (active sessions)</li>
                                            <li>Prevent deposits, withdrawals, and bets</li>
                                        </ul>
                                    </div>
                                </div>
                                <div className="bg-slate-900 rounded-lg px-4 py-2 mb-4 border border-slate-700">
                                    <p className="text-white font-bold">{user.username}</p>
                                    <p className="text-slate-400 text-xs">{user.email}</p>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Ban Reason (optional)</label>
                                    <input
                                        type="text"
                                        value={banReason}
                                        onChange={e => setBanReason(e.target.value)}
                                        placeholder="e.g. Fraud, multiple accounts, abuse..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-red-500 focus:outline-none"
                                    />
                                </div>
                            </>
                        )}

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                onClick={() => setShowBanConfirm(false)}
                                disabled={banLoading}
                                className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmBan}
                                disabled={banLoading}
                                className={`flex-1 py-2.5 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 ${
                                    user.isBanned
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {banLoading ? <Loader2 size={16} className="animate-spin" /> : user.isBanned ? <UserCheck size={16} /> : <Ban size={16} />}
                                {banLoading ? 'Processing...' : user.isBanned ? 'Confirm Unban' : 'Confirm Ban'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Back link */}
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <Link href="/dashboard/users" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
                    <ArrowLeft size={16} /> Back to Users
                </Link>
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 sm:w-auto"
                >
                    <Trash2 size={14} /> Delete User
                </button>
            </div>

            {/* Profile Header */}
            <UserProfileHeader user={user} onEditClick={handleOpenEdit} onBanToggle={handleBanToggle} banLoading={banLoading} />

            {/* Tabs */}
            <div className="border-b border-slate-700">
                <nav className="flex gap-1 overflow-x-auto">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-3 px-3 text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${activeTab === tab.id ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                {Icon && <Icon size={13} />}
                                {tab.label}
                                {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t" />}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">

                {/* ─── OVERVIEW ─── */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Totals row — Casino profit, Sports profit, Deposits, Withdrawals */}
                        {(() => {
                            const u = user as any;
                            const casinoProfit = Number(u?.casinoProfit ?? 0);
                            const casinoBet = Number(u?.casinoTotalBet ?? 0);
                            const casinoWin = Number(u?.casinoTotalWin ?? 0);
                            const sportsProfit = Number(u?.sportsProfit ?? 0);
                            const sportsBet = Number(u?.sportsTotalBet ?? 0);
                            const sportsWin = Number(u?.sportsTotalWin ?? 0);
                            const totalDeposited = Number(u?.totalDeposited ?? 0);
                            const totalFiatDeposited = Number(u?.totalFiatDeposited ?? 0);
                            const totalCryptoDeposited = Number(u?.totalCryptoDeposited ?? 0);
                            const totalWithdrawn = Number(u?.totalWithdrawn ?? 0);
                            const totalFiatWithdrawn = Number(u?.totalFiatWithdrawn ?? 0);
                            const totalCryptoWithdrawn = Number(u?.totalCryptoWithdrawn ?? 0);
                            const cur = currency;
                            const signedClass = (v: number) =>
                                v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-slate-300';
                            const signed = (v: number) =>
                                `${v > 0 ? '+' : ''}${fmtCurrency(v, cur)}`;
                            return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Casino Profit */}
                                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Gamepad2 size={16} className="text-fuchsia-400" />
                                            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Casino Profit</h4>
                                        </div>
                                        <div className={`text-2xl font-bold font-mono ${signedClass(casinoProfit)}`}>
                                            {signed(casinoProfit)}
                                        </div>
                                        <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                                            <div>Bet: <span className="text-slate-300 font-mono">{fmtCurrency(casinoBet, cur)}</span></div>
                                            <div>Win: <span className="text-slate-300 font-mono">{fmtCurrency(casinoWin, cur)}</span></div>
                                        </div>
                                    </div>

                                    {/* Sports Profit */}
                                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Activity size={16} className="text-emerald-400" />
                                            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Sports Profit</h4>
                                        </div>
                                        <div className={`text-2xl font-bold font-mono ${signedClass(sportsProfit)}`}>
                                            {signed(sportsProfit)}
                                        </div>
                                        <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                                            <div>Bet: <span className="text-slate-300 font-mono">{fmtCurrency(sportsBet, cur)}</span></div>
                                            <div>Win: <span className="text-slate-300 font-mono">{fmtCurrency(sportsWin, cur)}</span></div>
                                        </div>
                                    </div>

                                    {/* Total Deposits */}
                                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ArrowDownRight size={16} className="text-sky-400" />
                                            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Deposits</h4>
                                        </div>
                                        <div className="text-2xl font-bold font-mono text-sky-300">
                                            {fmtCurrency(totalDeposited, cur)}
                                        </div>
                                        <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                                            <div>Fiat: <span className="text-slate-300 font-mono">{fmtCurrency(totalFiatDeposited, cur)}</span></div>
                                            <div>Crypto: <span className="text-slate-300 font-mono">{fmtUSD(totalCryptoDeposited)}</span></div>
                                        </div>
                                    </div>

                                    {/* Total Withdrawals */}
                                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ArrowUpRight size={16} className="text-amber-400" />
                                            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Withdrawals</h4>
                                        </div>
                                        <div className="text-2xl font-bold font-mono text-amber-300">
                                            {fmtCurrency(totalWithdrawn, cur)}
                                        </div>
                                        <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                                            <div>Fiat: <span className="text-slate-300 font-mono">{fmtCurrency(totalFiatWithdrawn, cur)}</span></div>
                                            <div>Crypto: <span className="text-slate-300 font-mono">{fmtUSD(totalCryptoWithdrawn)}</span></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Recent Transactions */}
                            <div>
                                <h3 className="text-base font-semibold text-white mb-3">Recent Transactions</h3>
                                <UserTransactionsTable
                                    transactions={transactions.slice(0, 5)}
                                    onDeleteTransaction={handleDeleteTransaction}
                                    deletingTransactionId={deleteTxnLoadingId}
                                />
                                <button onClick={() => setActiveTab('transactions')} className="text-sm text-indigo-400 hover:underline mt-2 block">View All →</button>
                            </div>
                            {/* Recent Bets */}
                            <div>
                                <h3 className="text-base font-semibold text-white mb-3">Recent Bets</h3>
                                <UserBetsTable bets={bets.slice(0, 5)} userId={userId as number} onEditWin={handleEditBetWin} />
                                <button onClick={() => setActiveTab('bets')} className="text-sm text-indigo-400 hover:underline mt-2 block">View All →</button>
                            </div>
                            {/* Recent Casino */}
                            <div>
                                <h3 className="text-base font-semibold text-white mb-3">Recent Casino Activity</h3>
                                <UserCasinoTable transactions={casinoTxns.slice(0, 5)} />
                                <button onClick={() => setActiveTab('casino')} className="text-sm text-indigo-400 hover:underline mt-2 block">View All →</button>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                            {/* Wallet Actions */}
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                                    <Wallet size={18} className="text-indigo-400" /> Wallet & Bonus Adjustments
                                </h3>
                                <form onSubmit={handleWalletAction} className="space-y-4">
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <button type="button" onClick={() => setWalletType('credit')}
                                            className={`py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${walletType === 'credit' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                            <ArrowDownRight size={16} /> Credit
                                        </button>
                                        <button type="button" onClick={() => setWalletType('debit')}
                                            className={`py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${walletType === 'debit' ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                            <ArrowUpRight size={16} /> Debit
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">Target</label>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            <button type="button" onClick={() => setWalletTarget('fiat')}
                                                className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${walletTarget === 'fiat' ? 'bg-sky-500/10 border-sky-500 text-sky-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                                Main Wallet ({currency})
                                            </button>
                                            <button type="button" onClick={() => setWalletTarget('crypto')}
                                                className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${walletTarget === 'crypto' ? 'bg-amber-500/10 border-amber-500 text-amber-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                                Crypto Wallet (USD)
                                            </button>
                                            <button type="button" onClick={() => setWalletTarget('casinoBonus')}
                                                className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${walletTarget === 'casinoBonus' ? 'bg-fuchsia-500/10 border-fuchsia-500 text-fuchsia-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                                Casino Bonus
                                            </button>
                                            <button type="button" onClick={() => setWalletTarget('sportsBonus')}
                                                className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${walletTarget === 'sportsBonus' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                                Sports Bonus
                                            </button>
                                            <button type="button" onClick={() => setWalletTarget('cryptoBonus')}
                                                className={`py-2.5 rounded-lg text-sm font-medium border transition-all sm:col-span-2 ${walletTarget === 'cryptoBonus' ? 'bg-violet-500/10 border-violet-500 text-violet-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                                Crypto Bonus
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">Amount ({walletTarget === 'crypto' || walletTarget === 'cryptoBonus' ? 'USD' : currency})</label>
                                        <input type="number" min="1" required value={walletAmount} onChange={e => setWalletAmount(e.target.value)} placeholder="0"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">Remarks</label>
                                        <input type="text" value={walletRemarks} onChange={e => setWalletRemarks(e.target.value)} placeholder="Reason..."
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none" />
                                    </div>
                                    <label className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={walletSkipLog}
                                            onChange={e => setWalletSkipLog(e.target.checked)}
                                            className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
                                        />
                                        <span>
                                            Apply without transaction log
                                            <span className="block text-xs text-slate-500">
                                                Wallet or bonus will still change, but no user history transaction row will be created.
                                            </span>
                                        </span>
                                    </label>
                                    {(walletTarget === 'casinoBonus' || walletTarget === 'sportsBonus' || walletTarget === 'cryptoBonus') && (
                                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                                            Bonus deductions also reduce matching active bonus rows and wagering counters. To add bonus, use the Add Bonus panel below.
                                        </div>
                                    )}
                                    {walletMsg && (
                                        <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${walletMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                            {walletMsg.type === 'success' ? <CheckCircle size={12} /> : <XCircle size={12} />} {walletMsg.text}
                                        </div>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={walletLoading || !walletAmount || ((walletTarget === 'casinoBonus' || walletTarget === 'sportsBonus' || walletTarget === 'cryptoBonus') && walletType === 'credit')}
                                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm">
                                        {walletLoading ? 'Processing...' : `Confirm ${walletType === 'credit' ? 'Credit' : 'Deduct'}`}
                                    </button>
                                </form>
                            </div>

                            {/* Bonus Type Conversion */}
                            {(() => {
                                const ubList: any[] = (user as any).userBonuses || [];
                                const activeUBs = ubList.filter((ub: any) => ub.status === 'ACTIVE');
                                const casinoUB = activeUBs
                                    .filter((ub: any) => ub.applicableTo === 'CASINO' || ub.applicableTo === 'BOTH')
                                    .reduce((s: number, ub: any) => s + parseFloat((ub.bonusAmount || 0).toString()), 0);
                                const sportsUB = activeUBs
                                    .filter((ub: any) => ub.applicableTo === 'SPORTS')
                                    .reduce((s: number, ub: any) => s + parseFloat((ub.bonusAmount || 0).toString()), 0);
                                // Prefer UserBonus records; fall back to wallet fields only.
                                // Do not infer convertible bonus from raw historical BONUS logs here.
                                const walletCasinoTotal =
                                    parseFloat((((user as any).casinoBonus || 0) as number).toString()) +
                                    parseFloat((((user as any).fiatBonus || 0) as number).toString());
                                const walletSportsTotal = parseFloat(((user as any).sportsBonus || 0).toString());
                                const walletCryptoTotal = parseFloat(((user as any).cryptoBonus || 0).toString());
                                const casinoTotal = casinoUB > 0
                                    ? casinoUB
                                    : walletCasinoTotal > 0
                                        ? walletCasinoTotal
                                        : 0;
                                const sportsTotal = sportsUB > 0 ? sportsUB : walletSportsTotal;
                                const cryptoTotal = walletCryptoTotal;
                                const totalBonus = casinoTotal + sportsTotal + cryptoTotal;
                                return (
                                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                                            <RefreshCw size={18} className="text-amber-400" /> Convert Bonus Type
                                        </h3>
                                        <p className="text-xs text-slate-500 mb-4">Move the user&apos;s entire active bonus from Casino to Sports or vice versa.</p>
                                        {totalBonus <= 0 ? (
                                            <p className="text-xs text-slate-500 italic text-center py-2">No active bonus balance to convert.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-1 gap-1 text-xs text-slate-400 mb-3">
                                                    <span>Casino: <span className="text-amber-300 font-mono font-bold">{fmt(casinoTotal)}</span></span>
                                                    <span>Sports: <span className="text-emerald-300 font-mono font-bold">{fmt(sportsTotal)}</span></span>
                                                    <span>Crypto: <span className="text-violet-300 font-mono font-bold">{fmtUSD(cryptoTotal)}</span></span>
                                                </div>
                                                <button
                                                    onClick={() => handleBonusConvert('CASINO')}
                                                    disabled={bonusConvertLoading || casinoTotal <= 0}
                                                    className="w-full py-2.5 bg-amber-600/10 border border-amber-500/30 hover:bg-amber-600/20 text-amber-300 rounded-lg transition-colors text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
                                                >
                                                    {bonusConvertLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                    Casino → Sports
                                                </button>
                                                <button
                                                    onClick={() => handleBonusConvert('SPORTS')}
                                                    disabled={bonusConvertLoading || sportsTotal <= 0}
                                                    className="w-full py-2.5 bg-emerald-600/10 border border-emerald-500/30 hover:bg-emerald-600/20 text-emerald-300 rounded-lg transition-colors text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
                                                >
                                                    {bonusConvertLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                    Sports → Casino
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Direct Bonus Credit */}
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                                    <Gift size={18} className="text-fuchsia-400" /> Add Bonus
                                </h3>
                                <p className="text-xs text-slate-500 mb-4">Credit a bonus directly from admin to this user.</p>
                                <form onSubmit={handleGiveBonus} className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">Bonus Wallet</label>
                                        <select
                                            value={bonusForm.bonusType}
                                            onChange={e => setBonusForm(prev => ({ ...prev, bonusType: e.target.value as typeof prev.bonusType }))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-fuchsia-500 focus:outline-none"
                                        >
                                            <option value="CASINO_BONUS">Casino Bonus (INR)</option>
                                            <option value="SPORTS_BONUS">Sports Bonus (INR)</option>
                                            <option value="FIAT_BONUS">Fiat Bonus (INR)</option>
                                            <option value="CRYPTO_BONUS">Crypto Bonus (USD)</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Amount</label>
                                            <input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={bonusForm.amount}
                                                onChange={e => setBonusForm(prev => ({ ...prev, amount: e.target.value }))}
                                                placeholder="0.00"
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:border-fuchsia-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Wagering (x)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={bonusForm.wageringRequirement}
                                                onChange={e => setBonusForm(prev => ({ ...prev, wageringRequirement: e.target.value }))}
                                                placeholder="0"
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:border-fuchsia-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">Title</label>
                                        <input
                                            type="text"
                                            value={bonusForm.title}
                                            onChange={e => setBonusForm(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder="Optional bonus title"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-fuchsia-500 focus:outline-none"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={bonusLoading}
                                        className="w-full py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {bonusLoading ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
                                        {bonusLoading ? 'Adding Bonus...' : 'Add Bonus'}
                                    </button>
                                </form>
                            </div>

                            {/* Manager Assignment */}
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                                    <UserCog size={18} className="text-indigo-400" /> Assign Manager
                                </h3>
                                <div className="space-y-3">
                                    <select
                                        value={selectedManager}
                                        onChange={e => setSelectedManager(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="">— No Manager —</option>
                                        {managers.map(m => (
                                            <option key={m.id} value={String(m.id)}>{m.username} ({m.role})</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAssignManager}
                                        disabled={managerLoading}
                                        className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                    >
                                        {managerLoading ? 'Assigning...' : 'Assign Manager'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                )}

                {/* ─── TRANSACTIONS ─── */}
                {activeTab === 'transactions' && (
                    <div className="space-y-4">
                        <UserTransactionsTable
                            transactions={transactions}
                            onDeleteTransaction={handleDeleteTransaction}
                            deletingTransactionId={deleteTxnLoadingId}
                        />
                        {txPagination.totalPages > 1 && (
                            <div className="flex flex-col gap-3 pt-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                                <span>{txPagination.total} total transactions</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => fetchTransactions(txPagination.page - 1)} disabled={txPagination.page <= 1}
                                        className="p-1.5 hover:bg-slate-700 rounded disabled:opacity-40"><ChevronLeft size={16} /></button>
                                    <span className="text-white">Page {txPagination.page} / {txPagination.totalPages}</span>
                                    <button onClick={() => fetchTransactions(txPagination.page + 1)} disabled={txPagination.page >= txPagination.totalPages}
                                        className="p-1.5 hover:bg-slate-700 rounded disabled:opacity-40"><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── BETS ─── */}
                {activeTab === 'bets' && <UserBetsTable bets={bets} userId={userId as number} onEditWin={handleEditBetWin} />}

                {/* ─── CASINO ─── */}
                {activeTab === 'casino' && (
                    <div className="space-y-4">
                        {userId && <UserHuiduPanel userId={userId} />}
                        <UserCasinoTable transactions={casinoTxns} />
                        {casinoPagination.totalPages > 1 && (
                            <div className="flex flex-col gap-3 pt-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                                <span>{casinoPagination.total} total casino transactions</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => fetchCasino(casinoPagination.page - 1)} disabled={casinoPagination.page <= 1}
                                        className="p-1.5 hover:bg-slate-700 rounded disabled:opacity-40"><ChevronLeft size={16} /></button>
                                    <span className="text-white">Page {casinoPagination.page} / {casinoPagination.totalPages}</span>
                                    <button onClick={() => fetchCasino(casinoPagination.page + 1)} disabled={casinoPagination.page >= casinoPagination.totalPages}
                                        className="p-1.5 hover:bg-slate-700 rounded disabled:opacity-40"><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── VERIFICATION ─── */}
                {activeTab === 'verification' && <VerificationTab user={user} onUpdate={fetchUser} />}

                {/* ─── RESPONSIBLE GAMBLING ─── */}
                {activeTab === 'rg' && <ResponsibleGamblingTab user={user} onUpdate={fetchUser} />}

                {/* ─── NOTES ─── */}
                {activeTab === 'notes' && (
                    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 sm:p-6">
                        <h3 className="font-semibold text-white mb-1">Staff Notes</h3>
                        <p className="text-xs text-slate-500 mb-4">Private notes — visible only to admins. Saved locally in this browser.</p>
                        <textarea
                            className="w-full h-48 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 resize-none"
                            placeholder="Add notes about this user..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                        <div className="mt-4 flex justify-start sm:justify-end">
                            <button onClick={handleSaveNotes} disabled={notesSaving}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 sm:w-auto">
                                <Save size={14} /> {notesSaving ? 'Saved!' : 'Save Note'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
