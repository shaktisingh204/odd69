"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
    getBonuses, createBonus, updateBonus, deleteBonus, toggleBonus,
    getBonusStats, getBonusRedemptions, adminForfeitBonus, adminCompleteBonus, adminGiveBonus,
    purgeBackfillRepairBonuses
} from '@/actions/marketing';
import {
    Gift, Plus, Trash2, Edit3, ToggleLeft, ToggleRight, Search,
    ChevronLeft, ChevronRight, RefreshCcw, X, Check,
    Loader2, DollarSign, Ban, Zap, AlertTriangle, Info, UserPlus, Eraser
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bonus {
    _id: string;
    code: string;
    type: string;         // CASINO | SPORTS (display category)
    applicableTo: string; // CASINO | SPORTS | BOTH — which bets count for wagering
    currency: string;     // CRYPTO | INR | BOTH
    title: string;
    description: string;
    amount: number;
    percentage: number;
    minDeposit: number;
    minDepositFiat?: number;
    minDepositCrypto?: number;
    maxBonus: number;
    wageringRequirement: number;
    expiryDays: number;   // days user has after activation to complete wagering
    isActive: boolean;
    showOnSignup: boolean;
    forFirstDepositOnly: boolean;
    usageCount: number;
    usageLimit: number;
    validFrom?: string;
    validUntil?: string;
    createdAt: string;
}

interface BonusStats {
    active: number;
    completed: number;
    forfeited: number;
    totalBonusValue: number;
    totalWageringDone: number;
    totalWageringRequired: number;
}

const BONUS_TYPES = [
    { value: 'CASINO', label: '🎰 Casino', desc: 'Display category: Casino game bonuses' },
    { value: 'SPORTS', label: '⚽ Sports', desc: 'Display category: Sports betting bonuses' },
];

const APPLICABLE_TO_OPTIONS = [
    { value: 'CASINO', label: '🎰 Casino Only', desc: 'Only casino bets count toward wagering' },
    { value: 'SPORTS', label: '⚽ Sports Only', desc: 'Only sports bets count toward wagering' },
    { value: 'BOTH', label: '✦ Both', desc: 'Both casino and sports bets count toward wagering' },
];

const BONUS_CURRENCIES = [
    { value: 'INR', label: '₹ INR / Fiat', desc: 'Applies to INR / UPI deposits' },
    { value: 'CRYPTO', label: '₿ Crypto', desc: 'Applies to crypto deposits' },
    { value: 'BOTH', label: '✦ Both', desc: 'Applies to any deposit currency' },
];

const defaultForm = {
    code: '', type: 'CASINO', applicableTo: 'CASINO', currency: 'INR', title: '', description: '',
    amount: 0, percentage: 0, minDeposit: 0, minDepositFiat: 0, minDepositCrypto: 0, maxBonus: 0,
    wageringRequirement: 10, expiryDays: 30, usageLimit: 0,
    isActive: true, showOnSignup: false, forFirstDepositOnly: true,
    validFrom: '', validUntil: '',
};

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const toSafeNumber = (value: unknown) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

const getResolvedMinimumDeposit = (
    bonus: Pick<Bonus, 'minDeposit' | 'minDepositFiat' | 'minDepositCrypto'>,
    currency: 'INR' | 'CRYPTO',
) => {
    if (currency === 'CRYPTO' && bonus.minDepositCrypto != null) return toSafeNumber(bonus.minDepositCrypto);
    if (currency === 'INR' && bonus.minDepositFiat != null) return toSafeNumber(bonus.minDepositFiat);
    return toSafeNumber(bonus.minDeposit);
};

const getMinimumDepositDetails = (bonus: Pick<Bonus, 'currency' | 'minDeposit' | 'minDepositFiat' | 'minDepositCrypto'>) => {
    const fiatMinimum = getResolvedMinimumDeposit(bonus, 'INR');
    const cryptoMinimum = getResolvedMinimumDeposit(bonus, 'CRYPTO');

    if (bonus.currency === 'CRYPTO') {
        return {
            signupText: cryptoMinimum > 0 ? `$${cryptoMinimum}` : 'any crypto amount',
            previewRows: cryptoMinimum > 0 ? [{ label: 'Crypto Min Deposit', value: `$${cryptoMinimum}` }] : [],
            tableRows: cryptoMinimum > 0 ? [`Crypto: $${cryptoMinimum}`] : [],
        };
    }

    if (bonus.currency === 'BOTH') {
        return {
            signupText: fiatMinimum > 0 || cryptoMinimum > 0
                ? `${fiatMinimum > 0 ? `₹${fiatMinimum} fiat` : 'no fiat minimum'} / ${cryptoMinimum > 0 ? `$${cryptoMinimum} crypto` : 'no crypto minimum'}`
                : 'any amount',
            previewRows: [
                ...(fiatMinimum > 0 ? [{ label: 'Fiat Min Deposit', value: `₹${fiatMinimum}` }] : []),
                ...(cryptoMinimum > 0 ? [{ label: 'Crypto Min Deposit', value: `$${cryptoMinimum}` }] : []),
            ],
            tableRows: [
                ...(fiatMinimum > 0 ? [`Fiat: ₹${fiatMinimum}`] : []),
                ...(cryptoMinimum > 0 ? [`Crypto: $${cryptoMinimum}`] : []),
            ],
        };
    }

    return {
        signupText: fiatMinimum > 0 ? `₹${fiatMinimum}` : 'any amount',
        previewRows: fiatMinimum > 0 ? [{ label: 'Fiat Min Deposit', value: `₹${fiatMinimum}` }] : [],
        tableRows: fiatMinimum > 0 ? [`Fiat: ₹${fiatMinimum}`] : [],
    };
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BonusesPage() {
    const [activeTab, setActiveTab] = useState<'templates' | 'redemptions'>('templates');
    const [bonuses, setBonuses] = useState<Bonus[]>([]);
    const [stats, setStats] = useState<BonusStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);

    const [modal, setModal] = useState<{ open: boolean; editing: Bonus | null }>({ open: false, editing: null });
    const [form, setForm] = useState({ ...defaultForm });
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const [redemptions, setRedemptions] = useState<any[]>([]);
    const [redemptionPage, setRedemptionPage] = useState(1);
    const [redemptionTotal, setRedemptionTotal] = useState(0);
    const [redemptionStatus, setRedemptionStatus] = useState('ALL');
    const [redemptionSearch, setRedemptionSearch] = useState('');
    const [redemptionLoading, setRedemptionLoading] = useState(false);

    // ── Give Bonus Modal ──────────────────────────────────────────────────────────
    const [giveModal, setGiveModal] = useState(false);
    const [giveUserId, setGiveUserId] = useState('');
    const [giveMode, setGiveMode] = useState<'TEMPLATE' | 'DIRECT'>('TEMPLATE');
    const [giveBonusCode, setGiveBonusCode] = useState('');
    const [giveCustomAmount, setGiveCustomAmount] = useState('');
    const [giveBonusType, setGiveBonusType] = useState<'FIAT_BONUS' | 'CASINO_BONUS' | 'SPORTS_BONUS' | 'CRYPTO_BONUS'>('CASINO_BONUS');
    const [giveDirectTitle, setGiveDirectTitle] = useState('');
    const [giveWageringRequirement, setGiveWageringRequirement] = useState('');
    const [giveError, setGiveError] = useState('');
    const [giveLoading, setGiveLoading] = useState(false);
    const [giveSuccess, setGiveSuccess] = useState<string | null>(null);
    const [purging, setPurging] = useState(false);

    const LIMIT = 20;

    const fetchBonuses = useCallback(async () => {
        setLoading(true);
        const res = await getBonuses();
        if (res.success) setBonuses(res.data);
        setLoading(false);
    }, []);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        const res = await getBonusStats();
        if (res.success && res.data) setStats(res.data);
        setStatsLoading(false);
    }, []);

    const fetchRedemptions = useCallback(async () => {
        setRedemptionLoading(true);
        const res = await getBonusRedemptions({
            page: redemptionPage, limit: LIMIT,
            status: redemptionStatus === 'ALL' ? undefined : redemptionStatus,
            search: redemptionSearch || undefined,
        });
        if (res.success && res.data) {
            setRedemptions((res.data as any).redemptions || []);
            setRedemptionTotal((res.data as any).total ?? (res.data as any).pagination?.total ?? 0);
        }
        setRedemptionLoading(false);
    }, [redemptionPage, redemptionStatus, redemptionSearch]);

    useEffect(() => { fetchBonuses(); fetchStats(); }, [fetchBonuses, fetchStats]);
    useEffect(() => { if (activeTab === 'redemptions') fetchRedemptions(); }, [activeTab, fetchRedemptions]);

    const openCreate = () => { setForm({ ...defaultForm }); setFormError(''); setModal({ open: false, editing: null }); setTimeout(() => setModal({ open: true, editing: null }), 0); };
    const openEdit = (b: Bonus) => {
        const currency = (b as any).currency || 'INR';
        const legacyMinDeposit = toSafeNumber(b.minDeposit);
        setForm({
            code: b.code, type: b.type, applicableTo: (b as any).applicableTo || 'BOTH',
            currency,
            title: b.title, description: b.description || '',
            amount: b.amount, percentage: b.percentage, minDeposit: legacyMinDeposit,
            minDepositFiat: b.minDepositFiat ?? (currency === 'CRYPTO' ? 0 : legacyMinDeposit),
            minDepositCrypto: b.minDepositCrypto ?? (currency === 'INR' ? 0 : legacyMinDeposit),
            maxBonus: b.maxBonus, wageringRequirement: b.wageringRequirement,
            expiryDays: (b as any).expiryDays ?? 30,
            isActive: b.isActive, showOnSignup: b.showOnSignup, forFirstDepositOnly: b.forFirstDepositOnly,
            usageLimit: b.usageLimit,
            validFrom: b.validFrom ? b.validFrom.slice(0, 10) : '',
            validUntil: b.validUntil ? b.validUntil.slice(0, 10) : '',
        });
        setFormError('');
        setModal({ open: true, editing: b });
    };

    const handleSave = async () => {
        if (!form.code.trim()) { setFormError('Bonus Code is required'); return; }
        if (!form.title.trim()) { setFormError('Title is required'); return; }
        if (form.percentage === 0 && form.amount === 0) { setFormError('Set either a flat Amount or a Match %'); return; }
        if (form.wageringRequirement < 1) { setFormError('Wagering requirement must be at least 1x'); return; }

        setSaving(true);
        const minDepositFiat = toSafeNumber((form as any).minDepositFiat);
        const minDepositCrypto = toSafeNumber((form as any).minDepositCrypto);
        const legacyMinDeposit = (form as any).currency === 'CRYPTO' ? minDepositCrypto : minDepositFiat;
        const payload = {
            ...form,
            code: form.code.trim().toUpperCase(),
            minDeposit: legacyMinDeposit,
            minDepositFiat,
            minDepositCrypto,
            validFrom: form.validFrom || undefined,
            validUntil: form.validUntil || undefined,
        };

        const res = modal.editing
            ? await updateBonus(modal.editing._id, payload)
            : await createBonus(payload);

        if (res.success) {
            setModal({ open: false, editing: null });
            fetchBonuses();
            fetchStats();
        } else {
            setFormError(res.error || 'Failed to save bonus');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this bonus permanently? This cannot be undone.')) return;
        await deleteBonus(id);
        fetchBonuses();
        fetchStats();
    };

    const handleToggle = async (id: string) => {
        await toggleBonus(id);
        fetchBonuses();
    };

    const handleForfeit = async (id: number) => {
        if (!confirm('Forfeit this user bonus? Their bonus balance will be cleared.')) return;
        await adminForfeitBonus(id);
        fetchRedemptions();
        fetchStats();
    };

    const handlePurge = async () => {
        if (!confirm(
            '⚠️ DANGER: This will permanently delete ALL BACKFILL_ and REPAIR_ user bonus records from the database.\n\n' +
            'This cannot be undone. Continue?'
        )) return;
        setPurging(true);
        const res = await purgeBackfillRepairBonuses();
        setPurging(false);
        if (res.success) {
            alert(`✅ Purge complete — ${res.deletedCount} records deleted.`);
            fetchStats();
            if (activeTab === 'redemptions') fetchRedemptions();
        } else {
            alert('❌ Purge failed: ' + res.error);
        }
    };

    const handleComplete = async (id: number) => {
        if (!confirm('Force-complete this bonus? The bonus amount will be converted to real balance.')) return;
        await adminCompleteBonus(id);
        fetchRedemptions();
        fetchStats();
    };

    const handleGiveBonus = async () => {
        setGiveError('');
        setGiveSuccess(null);
        const uid = parseInt(giveUserId.trim());
        if (!uid || isNaN(uid)) { setGiveError('Enter a valid numeric User ID'); return; }
        if (giveMode === 'TEMPLATE' && !giveBonusCode.trim()) { setGiveError('Select or enter a bonus code'); return; }
        if (giveMode === 'DIRECT' && (!giveCustomAmount || parseFloat(giveCustomAmount) <= 0)) {
            setGiveError('Enter a valid direct bonus amount');
            return;
        }
        setGiveLoading(true);
        const customAmt = giveCustomAmount ? parseFloat(giveCustomAmount) : undefined;
        const wageringRequirement = giveWageringRequirement ? parseFloat(giveWageringRequirement) : undefined;

        const res = giveMode === 'TEMPLATE'
            ? await adminGiveBonus({
                userId: uid,
                bonusCode: giveBonusCode.trim().toUpperCase(),
                customAmount: customAmt,
            })
            : await adminGiveBonus({
                userId: uid,
                bonusType: giveBonusType,
                amount: customAmt,
                title: giveDirectTitle.trim() || undefined,
                wageringRequirement,
            });

        if (res.success) {
            const walletLabel = res.walletLabel || 'Bonus';
            setGiveSuccess(`✅ ${walletLabel} granted! ₹${res.bonusAmount} credited to user #${uid}`);
            setGiveUserId('');
            setGiveBonusCode('');
            setGiveCustomAmount('');
            setGiveDirectTitle('');
            setGiveWageringRequirement('');
            setGiveMode('TEMPLATE');
            setGiveBonusType('CASINO_BONUS');
            fetchStats();
        } else {
            setGiveError(res.error || 'Failed to give bonus');
        }
        setGiveLoading(false);
    };

    const typeBadge = (type: string, currency?: string) => {
        const typeMap: Record<string, [string, string]> = {
            CASINO: ['bg-purple-500/15 text-purple-400', '🎰 Casino'],
            SPORTS: ['bg-blue-500/15 text-blue-400', '⚽ Sports'],
        };
        const currMap: Record<string, [string, string]> = {
            INR: ['bg-emerald-500/15 text-emerald-400', '₹ INR'],
            CRYPTO: ['bg-amber-500/15 text-amber-400', '₿ Crypto'],
            BOTH: ['bg-slate-500/15 text-slate-400', '✦ Both'],
        };
        const [tcls, tlabel] = typeMap[type] || ['bg-slate-700 text-slate-400', type];
        const [ccls, clabel] = currMap[currency || 'INR'] || ['bg-slate-700 text-slate-400', currency || ''];
        return (
            <div className="flex flex-col gap-0.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tcls}`}>{tlabel}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ccls}`}>{clabel}</span>
            </div>
        );
    };

    const statusBadge = (status: string) => {
        const map: Record<string, string> = {
            ACTIVE: 'bg-blue-500/15 text-blue-400',
            COMPLETED: 'bg-emerald-500/15 text-emerald-400',
            FORFEITED: 'bg-red-500/15 text-red-400',
            PENDING_CONVERSION: 'bg-amber-500/15 text-amber-400',
        };
        return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${map[status] || 'bg-slate-700 text-slate-400'}`}>{status.replace('_', ' ')}</span>;
    };

    const f = (key: keyof typeof form, val: any) => setForm(prev => ({ ...prev, [key]: val }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Gift size={24} className="text-indigo-400" /> Bonus Management
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Create and manage bonuses. Welcome bonuses appear on the signup form.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { fetchBonuses(); fetchStats(); if (activeTab === 'redemptions') fetchRedemptions(); }}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 border border-slate-700 transition-colors">
                        <RefreshCcw size={16} />
                    </button>
                    <button onClick={handlePurge} disabled={purging}
                        title="Permanently delete all BACKFILL and REPAIR bonus records from DB"
                        className="flex items-center gap-2 px-4 py-2 bg-red-900/50 hover:bg-red-800/60 disabled:opacity-50 text-red-400 border border-red-700/50 rounded-lg text-sm font-semibold transition-colors">
                        {purging ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
                        Purge Backfill/Repair
                    </button>
                    <button onClick={() => { setGiveModal(true); setGiveError(''); setGiveSuccess(null); }}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">
                        <UserPlus size={16} /> Give Bonus
                    </button>
                    <button onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors">
                        <Plus size={16} /> Create Bonus
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Active Bonuses', value: statsLoading ? '…' : String(stats?.active ?? 0), icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Completed', value: statsLoading ? '…' : String(stats?.completed ?? 0), icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Forfeited', value: statsLoading ? '…' : String(stats?.forfeited ?? 0), icon: Ban, color: 'text-red-400', bg: 'bg-red-500/10' },
                    { label: 'Total Bonus Value', value: statsLoading ? '…' : fmt(stats?.totalBonusValue ?? 0), icon: DollarSign, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                ].map(s => (
                    <div key={s.label} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                        <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                            <s.icon size={16} className={s.color} />
                        </div>
                        <p className="text-xl font-bold text-white">{s.value}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700 w-fit">
                {(['templates', 'redemptions'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg capitalize transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                        {tab === 'templates' ? 'Bonus Templates' : 'User Redemptions'}
                    </button>
                ))}
            </div>

            {/* ── TEMPLATES TAB ── */}
            {activeTab === 'templates' && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
                    ) : bonuses.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                            <Gift size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-semibold">No bonuses yet</p>
                            <p className="text-sm mt-1 mb-4">Click "Create Bonus" to add your first one</p>
                            <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors">
                                <Plus size={14} className="inline mr-1" /> Create First Bonus
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-slate-500 uppercase bg-slate-900/40 border-b border-slate-700">
                                        <th className="px-4 py-3 text-left">Code / Title</th>
                                        <th className="px-4 py-3 text-left">Type</th>
                                        <th className="px-4 py-3 text-left">Value</th>
                                        <th className="px-4 py-3 text-left">Min Deposit</th>
                                        <th className="px-4 py-3 text-left">Wagering</th>
                                        <th className="px-4 py-3 text-center">On Signup</th>
                                        <th className="px-4 py-3 text-center">Active</th>
                                        <th className="px-4 py-3 text-center">Used</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {bonuses.map(b => {
                                        const minimumDepositDetails = getMinimumDepositDetails(b);
                                        return (
                                        <tr key={b._id} className="hover:bg-slate-700/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-mono font-bold text-indigo-300 text-xs">{b.code}</div>
                                                <div className="text-white text-sm mt-0.5">{b.title}</div>
                                            </td>
                                            <td className="px-4 py-3">{typeBadge(b.type, (b as any).currency)}</td>
                                            <td className="px-4 py-3 text-white text-xs">
                                                {b.percentage > 0
                                                    ? `${b.percentage}%${b.maxBonus > 0 ? ` (max ₹${b.maxBonus})` : ''}`
                                                    : `₹${b.amount}`}
                                            </td>
                                            <td className="px-4 py-3 text-slate-300 text-xs">
                                                {minimumDepositDetails.tableRows.length > 0 ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        {minimumDepositDetails.tableRows.map(row => <span key={row}>{row}</span>)}
                                                    </div>
                                                ) : <span className="text-slate-600">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-slate-300 text-xs">{b.wageringRequirement}x</td>
                                            <td className="px-4 py-3 text-center">
                                                {b.showOnSignup ? (
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <span className="text-emerald-400 text-[10px] font-bold">✓ Yes</span>
                                                        <span className={`text-[9px] ${b.forFirstDepositOnly ? 'text-blue-400' : 'text-emerald-400'}`}>
                                                            {b.forFirstDepositOnly ? 'On Deposit' : 'Instant'}
                                                        </span>
                                                    </div>
                                                ) : <span className="text-slate-600 text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleToggle(b._id)}>
                                                    {b.isActive
                                                        ? <ToggleRight size={22} className="text-emerald-400" />
                                                        : <ToggleLeft size={22} className="text-slate-600" />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-400 text-xs">
                                                {b.usageCount}{b.usageLimit > 0 ? `/${b.usageLimit}` : ''}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-center gap-1">
                                                    <button onClick={() => openEdit(b)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors" title="Edit">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(b._id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Delete">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── REDEMPTIONS TAB ── */}
            {activeTab === 'redemptions' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input type="text" placeholder="Search user or code…"
                                className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 w-64"
                                value={redemptionSearch}
                                onChange={e => { setRedemptionSearch(e.target.value); setRedemptionPage(1); }} />
                        </div>
                        <select value={redemptionStatus} onChange={e => { setRedemptionStatus(e.target.value); setRedemptionPage(1); }}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-indigo-500">
                            {['ALL', 'PENDING_CONVERSION', 'ACTIVE', 'COMPLETED', 'FORFEITED'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                        <button onClick={fetchRedemptions} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><RefreshCcw size={15} /></button>
                    </div>

                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        {redemptionLoading ? (
                            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
                        ) : redemptions.length === 0 ? (
                            <div className="text-center py-16 text-slate-500">
                                <p className="text-sm">No redemptions found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-slate-500 uppercase bg-slate-900/40 border-b border-slate-700">
                                            <th className="px-4 py-3 text-left">User</th>
                                            <th className="px-4 py-3 text-left">Bonus</th>
                                            <th className="px-4 py-3 text-left">Type</th>
                                            <th className="px-4 py-3 text-left">Deposit</th>
                                            <th className="px-4 py-3 text-left">Bonus Amt</th>
                                            <th className="px-4 py-3 text-left">Wagering Progress</th>
                                            <th className="px-4 py-3 text-left">Status</th>
                                            <th className="px-4 py-3 text-left">Date</th>
                                            <th className="px-4 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {redemptions.map((r: any) => {
                                            const progress = r.wageringRequired > 0
                                                ? Math.min(100, Math.floor((r.wageringDone / r.wageringRequired) * 100)) : 0;
                                            return (
                                                <tr key={r.id} className="hover:bg-slate-700/20 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="text-white font-medium">{r.user?.username || `#${r.userId}`}</div>
                                                        <div className="text-slate-500 text-xs">{r.user?.email || ''}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-mono text-indigo-300 text-xs">{r.bonusCode}</div>
                                                        <div className="text-slate-400 text-xs truncate max-w-[140px]">{r.bonusTitle}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${r.applicableTo === 'CASINO'
                                                            ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                                                            : r.applicableTo === 'SPORTS'
                                                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                                : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                                                            }`}>
                                                            {r.applicableTo === 'CASINO' ? '🎰 Casino' : r.applicableTo === 'SPORTS' ? '⚽ Sports' : '✦ Both'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-300 text-xs">
                                                        {r.depositAmount > 0 ? `₹${r.depositAmount}` : <span className="text-slate-600">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-emerald-400 font-semibold">₹{r.bonusAmount}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2 min-w-[120px]">
                                                            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
                                                            </div>
                                                            <span className="text-xs text-slate-400 whitespace-nowrap">{progress}%</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-600 mt-0.5">₹{r.wageringDone?.toFixed(0)} / ₹{r.wageringRequired?.toFixed(0)}</div>
                                                    </td>
                                                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                                                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                                                    <td className="px-4 py-3">
                                                    {(r.status === 'ACTIVE' || r.status === 'PENDING_CONVERSION') && (
                                                            <div className="flex justify-center gap-1">
                                                                <button onClick={() => handleComplete(r.id)}
                                                                    className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded text-xs font-semibold transition-colors">
                                                        {r.status === 'PENDING_CONVERSION' ? 'Approve' : 'Complete'}
                                                                </button>
                                                                <button onClick={() => handleForfeit(r.id)}
                                                                    className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs font-semibold transition-colors">
                                                                    {r.status === 'PENDING_CONVERSION' ? 'Reject' : 'Forfeit'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {redemptionTotal > LIMIT && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
                                <span className="text-sm text-slate-400">{redemptionTotal} total</span>
                                <div className="flex items-center gap-2">
                                    <button disabled={redemptionPage === 1} onClick={() => setRedemptionPage(p => p - 1)}
                                        className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded text-white transition-colors">
                                        <ChevronLeft size={14} />
                                    </button>
                                    <span className="text-sm text-white">Page {redemptionPage} / {Math.ceil(redemptionTotal / LIMIT)}</span>
                                    <button disabled={redemptionPage >= Math.ceil(redemptionTotal / LIMIT)} onClick={() => setRedemptionPage(p => p + 1)}
                                        className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded text-white transition-colors">
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── CREATE / EDIT MODAL ── */}
            {modal.open && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl flex flex-col">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
                            <h2 className="text-lg font-bold text-white">
                                {modal.editing ? `Edit: ${modal.editing.code}` : 'Create New Bonus'}
                            </h2>
                            <button onClick={() => setModal({ open: false, editing: null })}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                            {formError && (
                                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                                    <AlertTriangle size={16} /> {formError}
                                </div>
                            )}

                            {/* ── SECTION 1: Identity ── */}
                            <section>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">1. Identity</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Bonus Code <span className="text-red-400">*</span></label>
                                        <input type="text" placeholder="e.g. WELCOME100"
                                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 font-mono uppercase"
                                            value={form.code} onChange={e => f('code', e.target.value.toUpperCase().replace(/\s/g, ''))} />
                                        <p className="text-[10px] text-slate-600 mt-1">Unique code users enter or is auto-applied</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Display Category <span className="text-red-400">*</span></label>
                                        <select className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500"
                                            value={form.type} onChange={e => f('type', e.target.value)}>
                                            {BONUS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                        <p className="text-[10px] text-slate-600 mt-1">{BONUS_TYPES.find(t => t.value === form.type)?.desc}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Wagering Counts For <span className="text-red-400">*</span></label>
                                        <select className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500"
                                            value={(form as any).applicableTo || 'BOTH'} onChange={e => f('applicableTo' as any, e.target.value)}>
                                            {APPLICABLE_TO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                        <p className="text-[10px] text-slate-600 mt-1">{APPLICABLE_TO_OPTIONS.find(t => t.value === (form as any).applicableTo)?.desc}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Deposit Currency <span className="text-red-400">*</span></label>
                                        <select className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500"
                                            value={(form as any).currency || 'INR'} onChange={e => f('currency' as any, e.target.value)}>
                                            {BONUS_CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                        </select>
                                        <p className="text-[10px] text-slate-600 mt-1">{BONUS_CURRENCIES.find(c => c.value === (form as any).currency)?.desc}</p>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Title <span className="text-red-400">*</span></label>
                                    <input type="text" placeholder="e.g. 100% Welcome Deposit Bonus"
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500"
                                        value={form.title} onChange={e => f('title', e.target.value)} />
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Description <span className="text-slate-600 font-normal">(optional, shown to user)</span></label>
                                    <textarea placeholder="Brief description of the bonus offer…" rows={2}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 resize-none"
                                        value={form.description} onChange={e => f('description', e.target.value)} />
                                </div>
                            </section>

                            {/* ── SECTION 2: Bonus Value ── */}
                            <section>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">2. Bonus Value</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Match % <span className="text-slate-600">(0 = none)</span></label>
                                        <div className="relative">
                                            <input type="number" min={0} max={500}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 pr-7 text-white text-sm outline-none focus:border-indigo-500"
                                                value={form.percentage} onChange={e => f('percentage', +e.target.value)} />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-1">e.g. 100 = 100% deposit match</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Flat Amount ₹ <span className="text-slate-600">(0 = none)</span></label>
                                        <div className="relative">
                                            <input type="number" min={0}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 pr-7 text-white text-sm outline-none focus:border-indigo-500"
                                                value={form.amount} onChange={e => f('amount', +e.target.value)} />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">₹</span>
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-1">Fixed bonus for NO_DEPOSIT types</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Max Bonus Cap ₹ <span className="text-slate-600">(0 = unlimited)</span></label>
                                        <div className="relative">
                                            <input type="number" min={0}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 pr-7 text-white text-sm outline-none focus:border-indigo-500"
                                                value={form.maxBonus} onChange={e => f('maxBonus', +e.target.value)} />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">₹</span>
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-1">Maximum bonus that can be awarded</p>
                                    </div>
                                </div>
                            </section>

                            {/* ── SECTION 3: Conditions ── */}
                            <section>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">3. Conditions</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Minimum Fiat Deposit ₹ <span className="text-slate-600">(0 = none)</span></label>
                                        <div className="relative">
                                            <input type="number" min={0}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 pr-7 text-white text-sm outline-none focus:border-indigo-500"
                                                value={(form as any).minDepositFiat} onChange={e => f('minDepositFiat' as any, +e.target.value)} />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">₹</span>
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-1">Used for INR / UPI / fiat deposits</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Minimum Crypto Deposit $ <span className="text-slate-600">(0 = none)</span></label>
                                        <div className="relative">
                                            <input type="number" min={0}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 pr-7 text-white text-sm outline-none focus:border-indigo-500"
                                                value={(form as any).minDepositCrypto} onChange={e => f('minDepositCrypto' as any, +e.target.value)} />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-1">Used for crypto deposits</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Wagering Requirement <span className="text-red-400">*</span></label>
                                        <div className="relative">
                                            <input type="number" min={1}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 pr-6 text-white text-sm outline-none focus:border-indigo-500"
                                                value={form.wageringRequirement} onChange={e => f('wageringRequirement', +e.target.value)} />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">x</span>
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-1">Bonus × this = total to wager before withdraw</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Expiry Days <span className="text-red-400">*</span></label>
                                        <div className="relative">
                                            <input type="number" min={1} max={365}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 pr-12 text-white text-sm outline-none focus:border-indigo-500"
                                                value={(form as any).expiryDays ?? 30} onChange={e => f('expiryDays' as any, +e.target.value)} />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">days</span>
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-1">Days user has after activation to complete wagering</p>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Usage Limit <span className="text-slate-600">(0 = unlimited)</span></label>
                                    <input type="number" min={0}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500"
                                        value={form.usageLimit} onChange={e => f('usageLimit', +e.target.value)} />
                                    <p className="text-[10px] text-slate-600 mt-1">Max total redemptions across all users</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Valid From <span className="text-slate-600">(optional)</span></label>
                                        <input type="date"
                                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500"
                                            value={form.validFrom} onChange={e => f('validFrom', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Valid Until <span className="text-slate-600">(optional)</span></label>
                                        <input type="date"
                                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500"
                                            value={form.validUntil} onChange={e => f('validUntil', e.target.value)} />
                                    </div>
                                </div>
                            </section>

                            {/* ── SECTION 4: Display & Behaviour ── */}
                            <section>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">4. Display &amp; Behaviour</h3>
                                <div className="space-y-3">

                                    <Toggle
                                        label="Bonus is Active"
                                        desc="If off, no one can redeem this bonus"
                                        checked={form.isActive}
                                        onChange={v => f('isActive', v)}
                                        color="emerald"
                                    />

                                    <Toggle
                                        label="Show on Signup Form"
                                        desc="Users can select this bonus when registering"
                                        checked={form.showOnSignup}
                                        onChange={v => f('showOnSignup', v)}
                                        color="amber"
                                    />

                                    {form.showOnSignup && (
                                        <div className="ml-4 border-l-2 border-slate-700 pl-4">
                                            <Toggle
                                                label="Apply on First Successful Deposit"
                                                desc="If ON: bonus is applied automatically when user makes their first deposit (ideal for DEPOSIT type). If OFF: bonus is credited instantly after registration (NO_DEPOSIT type only)."
                                                checked={form.forFirstDepositOnly}
                                                onChange={v => f('forFirstDepositOnly', v)}
                                                color="violet"
                                            />
                                            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 mt-2 text-xs ${form.forFirstDepositOnly
                                                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
                                                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                                                }`}>
                                                <Info size={13} className="shrink-0 mt-0.5" />
                                                {form.forFirstDepositOnly
                                                    ? <span><strong>On Deposit:</strong> User selects this bonus during registration. When they deposit {getMinimumDepositDetails(form as any).signupText} or more for the first time, the bonus is automatically applied. Best for DEPOSIT type.</span>
                                                    : <span><strong>Instant:</strong> Bonus balance is credited immediately after registration — no deposit needed. Requires type NO_DEPOSIT with a flat ₹ amount set above.</span>
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Live Summary */}
                            {(form.code || form.title) && (
                                <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Preview</h3>
                                    <div className="text-sm space-y-1">
                                        <div className="flex justify-between"><span className="text-slate-400">Code</span><span className="font-mono font-bold text-indigo-300">{form.code || '—'}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Value</span><span className="text-white">{form.percentage > 0 ? `${form.percentage}% match${form.maxBonus > 0 ? ` (max ₹${form.maxBonus})` : ''}` : form.amount > 0 ? `₹${form.amount} flat` : '—'}</span></div>
                                        {getMinimumDepositDetails(form as any).previewRows.map(row => (
                                            <div key={row.label} className="flex justify-between">
                                                <span className="text-slate-400">{row.label}</span>
                                                <span className="text-white">{row.value}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between"><span className="text-slate-400">Wagering</span><span className="text-white">{form.percentage > 0 ? `${form.percentage}% of deposit × ${form.wageringRequirement}x` : `₹${form.amount} × ${form.wageringRequirement}x = ₹${form.amount * form.wageringRequirement} total to wager`}</span></div>
                                        {form.showOnSignup && <div className="flex justify-between"><span className="text-slate-400">Signup trigger</span><span className={form.forFirstDepositOnly ? 'text-blue-400' : 'text-emerald-400'}>{form.forFirstDepositOnly ? 'First deposit' : 'Instantly after register'}</span></div>}
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-900 sticky bottom-0">
                            <button onClick={() => setModal({ open: false, editing: null })}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                {modal.editing ? 'Save Changes' : 'Create Bonus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── GIVE BONUS MODAL ── */}
            {giveModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <UserPlus size={18} className="text-emerald-400" /> Give Bonus to User
                            </h2>
                            <button onClick={() => setGiveModal(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {giveError && (
                                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                                    <AlertTriangle size={15} /> {giveError}
                                </div>
                            )}
                            {giveSuccess && (
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-emerald-400 text-sm">
                                    <Check size={15} /> {giveSuccess}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Grant Mode</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setGiveMode('TEMPLATE')}
                                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${giveMode === 'TEMPLATE'
                                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                                                : 'border-slate-600 bg-slate-800 text-slate-300'
                                            }`}
                                    >
                                        Bonus Template
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setGiveMode('DIRECT')}
                                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${giveMode === 'DIRECT'
                                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                                                : 'border-slate-600 bg-slate-800 text-slate-300'
                                            }`}
                                    >
                                        Direct Wallet Bonus
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">User ID <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Enter numeric user ID (e.g. 42)"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500"
                                    value={giveUserId}
                                    onChange={e => setGiveUserId(e.target.value.replace(/[^0-9]/g, ''))}
                                />
                                <p className="text-[10px] text-slate-600 mt-1">Find the user ID from the Users section</p>
                            </div>

                            {giveMode === 'TEMPLATE' ? (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Bonus Template <span className="text-red-400">*</span></label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500"
                                        value={giveBonusCode}
                                        onChange={e => setGiveBonusCode(e.target.value)}
                                    >
                                        <option value="">— Select a bonus —</option>
                                        {bonuses.map(b => (
                                            <option key={b._id} value={b.code}>
                                                {b.code} — {b.title} ({b.percentage > 0 ? `${b.percentage}%` : `₹${b.amount}`}, {b.wageringRequirement}x wagering)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Bonus Wallet Type <span className="text-red-400">*</span></label>
                                        <select
                                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500"
                                            value={giveBonusType}
                                            onChange={e => setGiveBonusType(e.target.value as typeof giveBonusType)}
                                        >
                                            <option value="FIAT_BONUS">Fiat Bonus</option>
                                            <option value="CASINO_BONUS">Casino Bonus</option>
                                            <option value="SPORTS_BONUS">Sports Bonus</option>
                                            <option value="CRYPTO_BONUS">Crypto Bonus</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Title <span className="text-slate-500 font-normal">(optional)</span></label>
                                        <input
                                            type="text"
                                            placeholder="Manual bonus title"
                                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500"
                                            value={giveDirectTitle}
                                            onChange={e => setGiveDirectTitle(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                                    {giveMode === 'TEMPLATE'
                                        ? <>Custom Amount ₹ <span className="text-slate-500 font-normal">(optional — overrides template calculation)</span></>
                                        : <>Amount ₹ <span className="text-red-400">*</span></>}
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min={1}
                                        placeholder={giveMode === 'TEMPLATE' ? 'Leave blank to use template amount' : 'Enter direct bonus amount'}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 pr-7 text-white text-sm outline-none focus:border-emerald-500"
                                        value={giveCustomAmount}
                                        onChange={e => setGiveCustomAmount(e.target.value)}
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">₹</span>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-1">
                                    {giveMode === 'TEMPLATE'
                                        ? 'Use this to give an exact amount regardless of template %. Wagering is still applied.'
                                        : 'Direct wallet bonus credits immediately to the selected bonus wallet.'}
                                </p>
                            </div>

                            {giveMode === 'DIRECT' && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                                        Wagering Requirement x <span className="text-slate-500 font-normal">(optional, default 0x)</span>
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.1"
                                        placeholder="0"
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500"
                                        value={giveWageringRequirement}
                                        onChange={e => setGiveWageringRequirement(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2.5">
                                <Info size={13} className="text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-300/70">
                                    {giveMode === 'TEMPLATE'
                                        ? 'This bypasses validity, min deposit, and usage limits. The bonus is credited immediately with wagering requirements attached.'
                                        : 'Direct grants credit the chosen bonus wallet immediately and also appear in the user bonus/transaction history.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
                            <button onClick={() => setGiveModal(false)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleGiveBonus} disabled={giveLoading}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                                {giveLoading && <Loader2 size={14} className="animate-spin" />}
                                Give Bonus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Toggle Sub-Component ─────────────────────────────────────────────────────

function Toggle({ label, desc, checked, onChange, color = 'emerald' }: {
    label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; color?: string;
}) {
    const onColor = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', violet: 'bg-violet-500', blue: 'bg-blue-500' }[color] || 'bg-emerald-500';
    return (
        <button type="button" onClick={() => onChange(!checked)}
            className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all text-left ${checked ? 'border-slate-600 bg-slate-800' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}>
            <div>
                <div className="text-white text-sm font-semibold">{label}</div>
                {desc && <div className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</div>}
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors duration-200 relative flex-shrink-0 ${checked ? onColor : 'bg-slate-700'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-200 ${checked ? 'left-[22px]' : 'left-1'}`} />
            </div>
        </button>
    );
}
