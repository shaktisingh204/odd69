"use client";

import React, { useEffect, useState } from 'react';
import {
    getReferralRewards,
    createReferralReward,
    toggleReferralReward,
    deleteReferralReward,
} from '@/actions/internal-referral';
import {
    Gift, Plus, Trash2, ToggleLeft, ToggleRight,
    Loader2, Check, AlertTriangle, TrendingUp, Zap
} from 'lucide-react';

// ── Local type (mirrors Prisma ReferralReward shape) ─────────────────────────
interface ReferralRewardRow {
    id: number;
    name: string;
    description?: string | null;
    conditionType: string;
    conditionValue: number;
    rewardType: string;
    rewardAmount: number;
    isActive: boolean;
    createdAt?: string | Date;
}

const CONDITION_LABELS: Record<string, { label: string; desc: string; color: string }> = {
    SIGNUP: { label: 'On Sign Up', desc: 'Awarded when referee registers', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    DEPOSIT_FIRST: { label: 'First Deposit', desc: 'Awarded on referee\'s first deposit', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
    DEPOSIT_RECURRING: { label: 'Any Deposit ≥ ₹X', desc: 'Awarded for deposits above threshold', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    BET_VOLUME: { label: 'Bet Volume ≥ ₹X', desc: 'Awarded when referee bets above threshold', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
};

type FormState = Omit<ReferralRewardRow, 'id' | 'createdAt'>;

const DEFAULT_FORM: FormState = {
    name: '',
    description: '',
    conditionType: 'SIGNUP',
    conditionValue: 0,
    rewardType: 'FIXED',
    rewardAmount: 0,
    isActive: true,
};

export default function ReferralRewardsPage() {
    const [rules, setRules] = useState<ReferralRewardRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<FormState>(DEFAULT_FORM);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => { fetchRules(); }, []);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const result = await getReferralRewards();
            if (result.success) setRules(result.rewards as ReferralRewardRow[]);
        } catch (e) {
            console.error('Failed to fetch reward rules', e);
        } finally {
            setLoading(false);
        }
    };

    const flash = (msg: string, isError = false) => {
        if (isError) { setError(msg); setTimeout(() => setError(null), 4000); }
        else { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
    };

    const handleCreate = async () => {
        if (!form.name.trim()) { flash('Rule name is required', true); return; }
        if (form.rewardAmount <= 0) { flash('Reward amount must be > 0', true); return; }
        setSaving(true);
        try {
            const result = await createReferralReward({
                name: form.name,
                description: form.description || undefined,
                conditionType: form.conditionType as 'SIGNUP' | 'DEPOSIT_FIRST' | 'DEPOSIT_RECURRING' | 'BET_VOLUME',
                conditionValue: form.conditionValue,
                rewardType: form.rewardType as 'FIXED' | 'PERCENTAGE',
                rewardAmount: form.rewardAmount,
                isActive: form.isActive,
            });
            if (!result.success) { flash(result.error || 'Failed to create rule', true); return; }
            setForm(DEFAULT_FORM);
            setShowForm(false);
            flash('Reward rule created!');
            fetchRules();
        } catch (e: any) {
            flash(e?.message || 'Failed to create rule', true);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (rule: ReferralRewardRow) => {
        try {
            const result = await toggleReferralReward(rule.id, !rule.isActive);
            if (!result.success) { flash('Failed to toggle rule', true); return; }
            flash(`Rule ${rule.isActive ? 'disabled' : 'enabled'}`);
            fetchRules();
        } catch {
            flash('Failed to toggle rule', true);
        }
    };

    const handleDelete = async (rule: ReferralRewardRow) => {
        if (!confirm(`Delete "${rule.name}"? This cannot be undone.`)) return;
        try {
            const result = await deleteReferralReward(rule.id);
            if (!result.success) { flash(result.error || 'Failed to delete rule', true); return; }
            flash('Rule deleted');
            fetchRules();
        } catch {
            flash('Failed to delete rule', true);
        }
    };

    const needsConditionValue = ['DEPOSIT_RECURRING', 'BET_VOLUME'].includes(form.conditionType);

    return (
        <div className="space-y-8">
            {/* ── Header ── */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Gift className="text-orange-400" size={28} />
                        Referral Reward Rules
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Configure what bonuses the referrer earns when their friend performs an action.
                        Rules are matched automatically — create at least one to start paying out referrals.
                    </p>
                </div>
                <button
                    onClick={() => { setShowForm(v => !v); setForm(DEFAULT_FORM); }}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-5 py-2.5 rounded-lg transition-colors"
                >
                    <Plus size={18} />
                    New Rule
                </button>
            </div>

            {/* ── Alerts ── */}
            {error && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}
            {success && (
                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 text-sm">
                    <Check size={16} /> {success}
                </div>
            )}

            {/* ── How It Works Info ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(CONDITION_LABELS).map(([key, { label, desc, color }]) => (
                    <div key={key} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mb-2 ${color}`}>{label}</span>
                        <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
                    </div>
                ))}
            </div>

            {/* ── Create Form ── */}
            {showForm && (
                <div className="bg-slate-800 border border-orange-500/30 rounded-xl p-6 space-y-5">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <Zap size={18} className="text-orange-400" />
                        New Reward Rule
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Name */}
                        <div className="md:col-span-2">
                            <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">Rule Name *</label>
                            <input
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Sign Up Bonus, First Deposit Reward"
                                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-orange-500 transition-colors"
                            />
                        </div>

                        {/* Description */}
                        <div className="md:col-span-2">
                            <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">Description (optional)</label>
                            <input
                                value={form.description || ''}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Internal note about this rule"
                                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-orange-500 transition-colors"
                            />
                        </div>

                        {/* Trigger Event */}
                        <div>
                            <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">Trigger Event *</label>
                            <select
                                value={form.conditionType}
                                onChange={e => setForm(f => ({ ...f, conditionType: e.target.value as any, conditionValue: 0 }))}
                                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-orange-500 transition-colors"
                            >
                                <option value="SIGNUP">On Sign Up</option>
                                <option value="DEPOSIT_FIRST">First Deposit</option>
                                <option value="DEPOSIT_RECURRING">Any Deposit ≥ ₹X</option>
                                <option value="BET_VOLUME">Bet Volume ≥ ₹X</option>
                            </select>
                            <p className="text-slate-500 text-xs mt-1">{CONDITION_LABELS[form.conditionType].desc}</p>
                        </div>

                        {/* Condition Value — only for volume events */}
                        {needsConditionValue && (
                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">
                                    Minimum Amount (₹) *
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.conditionValue}
                                    onChange={e => setForm(f => ({ ...f, conditionValue: Number(e.target.value) }))}
                                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-orange-500 transition-colors"
                                />
                                <p className="text-slate-500 text-xs mt-1">Referee must deposit/bet at least this much</p>
                            </div>
                        )}

                        {/* Reward Type */}
                        <div>
                            <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">Reward Type *</label>
                            <select
                                value={form.rewardType}
                                onChange={e => setForm(f => ({ ...f, rewardType: e.target.value as any }))}
                                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-orange-500 transition-colors"
                            >
                                <option value="FIXED">Fixed Amount (₹)</option>
                                <option value="PERCENTAGE">% of Deposit/Bet</option>
                            </select>
                        </div>

                        {/* Reward Amount */}
                        <div>
                            <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">
                                {form.rewardType === 'FIXED' ? 'Reward Amount (₹) *' : 'Percentage (%) *'}
                            </label>
                            <input
                                type="number"
                                min={0}
                                step={form.rewardType === 'PERCENTAGE' ? '0.1' : '1'}
                                value={form.rewardAmount}
                                onChange={e => setForm(f => ({ ...f, rewardAmount: Number(e.target.value) }))}
                                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-orange-500 transition-colors"
                            />
                            {form.rewardType === 'PERCENTAGE' && (
                                <p className="text-slate-500 text-xs mt-1">e.g. 5 = 5% of the deposit amount</p>
                            )}
                        </div>
                    </div>

                    {/* Preview */}
                    {form.rewardAmount > 0 && (
                        <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-300">
                            <span className="text-slate-500">Preview: </span>
                            Referrer earns{' '}
                            <span className="text-green-400 font-bold">
                                {form.rewardType === 'FIXED' ? `₹${form.rewardAmount}` : `${form.rewardAmount}%`}
                            </span>{' '}
                            when their friend <span className="text-orange-400">{CONDITION_LABELS[form.conditionType].label.toLowerCase()}</span>
                            {needsConditionValue && form.conditionValue > 0 && (
                                <> with at least <span className="text-orange-400">₹{form.conditionValue}</span></>
                            )}.
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={handleCreate}
                            disabled={saving}
                            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-lg transition-colors"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            {saving ? 'Creating...' : 'Create Rule'}
                        </button>
                        <button
                            onClick={() => setShowForm(false)}
                            className="px-6 py-2.5 rounded-lg border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ── Rules Table ── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg">All Reward Rules</h3>
                    <span className="text-slate-500 text-sm">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
                        <Loader2 size={20} className="animate-spin" />
                        Loading rules...
                    </div>
                ) : rules.length === 0 ? (
                    <div className="py-16 text-center">
                        <Gift size={40} className="mx-auto text-slate-600 mb-3" />
                        <p className="text-slate-400 font-medium">No reward rules configured</p>
                        <p className="text-slate-600 text-sm mt-1">
                            Create at least one rule so referrers earn bonuses.
                        </p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="mt-4 inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors px-4 py-2 rounded-lg text-sm"
                        >
                            <Plus size={14} /> Create First Rule
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Rule</th>
                                    <th className="px-6 py-4">Trigger</th>
                                    <th className="px-6 py-4">Reward</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {rules.map(rule => {
                                    const cond = CONDITION_LABELS[rule.conditionType];
                                    return (
                                        <tr key={rule.id} className={`text-sm hover:bg-slate-700/30 transition-colors ${!rule.isActive ? 'opacity-50' : ''}`}>
                                            <td className="px-6 py-4">
                                                <p className="text-white font-medium">{rule.name}</p>
                                                {rule.description && <p className="text-slate-500 text-xs mt-0.5">{rule.description}</p>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold border ${cond.color}`}>
                                                    {cond.label}
                                                </span>
                                                {['DEPOSIT_RECURRING', 'BET_VOLUME'].includes(rule.conditionType) && rule.conditionValue > 0 && (
                                                    <p className="text-slate-500 text-xs mt-1">Min: ₹{rule.conditionValue}</p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-green-400 font-bold font-mono text-base">
                                                    {rule.rewardType === 'FIXED'
                                                        ? `₹${rule.rewardAmount}`
                                                        : `${rule.rewardAmount}%`}
                                                </span>
                                                <p className="text-slate-500 text-xs">{rule.rewardType === 'FIXED' ? 'Fixed payout' : 'Of deposit/bet'}</p>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${rule.isActive ? 'bg-green-500/15 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                                                    {rule.isActive ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleToggle(rule)}
                                                        title={rule.isActive ? 'Disable' : 'Enable'}
                                                        className={`p-2 rounded-lg transition-colors ${rule.isActive
                                                            ? 'text-green-400 hover:bg-green-500/10'
                                                            : 'text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                                                            }`}
                                                    >
                                                        {rule.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(rule)}
                                                        title="Delete"
                                                        className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Quick Start Guide ── */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <TrendingUp size={18} className="text-orange-400" />
                    Recommended Setup
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-400">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                        <div>
                            <p className="text-white font-medium">Sign Up Bonus</p>
                            <p>Trigger: <span className="text-blue-400">On Sign Up</span> · Reward: ₹50 Fixed</p>
                            <p>Referrer gets paid immediately when friend registers</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                        <div>
                            <p className="text-white font-medium">First Deposit Bonus</p>
                            <p>Trigger: <span className="text-green-400">First Deposit</span> · Reward: ₹100 Fixed or 5%</p>
                            <p>Paid when friend makes their first deposit</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                        <div>
                            <p className="text-white font-medium">Recurring Commission</p>
                            <p>Trigger: <span className="text-purple-400">Any Deposit ≥ ₹500</span> · Reward: 2%</p>
                            <p>Ongoing commission on every qualifying deposit</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
