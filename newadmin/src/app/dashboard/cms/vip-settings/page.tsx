"use client";

import React, { useEffect, useState } from 'react';
import { Save, Settings, Loader2, Crown } from 'lucide-react';
import { getVipTierSettings, saveVipTierSettings } from '@/actions/settings';

interface TierConfig {
    key: string;
    name: string;
    color: string;
    lossbackPct: number;
    reloadBonusPct: number;
    priorityWithdrawal: boolean;
    dedicatedHost: boolean;
    freeWithdrawals: boolean;
    minDeposit: number;
}

const TIER_KEYS = ['SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const;

export default function VipSettingsPage() {
    const [tiers, setTiers] = useState<TierConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getVipTierSettings().then(res => {
            if (res.success && res.data) setTiers(res.data);
        }).finally(() => setLoading(false));
    }, []);

    const updateTier = (key: string, patch: Partial<TierConfig>) => {
        setTiers(prev => prev.map(t => t.key === key ? { ...t, ...patch } : t));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await saveVipTierSettings(tiers);
            if (res.success) alert('VIP tier settings saved!');
            else alert(res.error || 'Failed to save');
        } catch { alert('Failed to save'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin mx-auto" size={24} /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <Crown size={24} className="text-yellow-400" /> VIP Tier Settings
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Configure benefits and requirements for each VIP tier</p>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {tiers.map(tier => (
                    <div key={tier.key} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                        {/* Tier header */}
                        <div className="p-4 border-b border-slate-700 flex items-center gap-3" style={{ borderLeftColor: tier.color, borderLeftWidth: 4 }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-white" style={{ backgroundColor: tier.color + '20', color: tier.color }}>
                                {tier.key === 'DIAMOND' ? '💎' : tier.key === 'PLATINUM' ? '🏆' : tier.key === 'GOLD' ? '🥇' : '🥈'}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                                <p className="text-slate-500 text-xs">{tier.key} Tier</p>
                            </div>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Name & Color */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Display Name</label>
                                    <input type="text" value={tier.name} onChange={e => updateTier(tier.key, { name: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Color</label>
                                    <div className="flex gap-2">
                                        <input type="color" value={tier.color} onChange={e => updateTier(tier.key, { color: e.target.value })}
                                            className="w-10 h-10 rounded border border-slate-700 cursor-pointer bg-slate-900" />
                                        <input type="text" value={tier.color} onChange={e => updateTier(tier.key, { color: e.target.value })}
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm font-mono focus:border-indigo-500 outline-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Numeric fields */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Lossback %</label>
                                    <input type="number" min={0} max={100} value={tier.lossbackPct} onChange={e => updateTier(tier.key, { lossbackPct: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Reload Bonus %</label>
                                    <input type="number" min={0} max={100} value={tier.reloadBonusPct} onChange={e => updateTier(tier.key, { reloadBonusPct: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Min Deposit (₹)</label>
                                    <input type="number" min={0} value={tier.minDeposit} onChange={e => updateTier(tier.key, { minDeposit: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 outline-none" />
                                </div>
                            </div>

                            {/* Toggle fields */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { key: 'priorityWithdrawal' as const, label: 'Priority Withdrawal' },
                                    { key: 'dedicatedHost' as const, label: 'Dedicated Host' },
                                    { key: 'freeWithdrawals' as const, label: 'Free Withdrawals' },
                                ].map(toggle => (
                                    <label key={toggle.key} className="flex items-center gap-2 cursor-pointer bg-slate-900 rounded-lg p-2.5 border border-slate-700 hover:border-slate-600 transition-colors">
                                        <input type="checkbox" checked={tier[toggle.key]} onChange={e => updateTier(tier.key, { [toggle.key]: e.target.checked })}
                                            className="w-4 h-4 rounded accent-indigo-500" />
                                        <span className="text-xs text-slate-300 font-medium">{toggle.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Summary Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Settings size={18} className="text-slate-400" /> Tier Comparison
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left p-3 text-slate-400 font-bold">Benefit</th>
                                {tiers.map(t => (
                                    <th key={t.key} className="text-center p-3 font-bold" style={{ color: t.color }}>{t.name}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            <tr className="border-t border-slate-700/50">
                                <td className="p-3 text-slate-300">Min Deposit</td>
                                {tiers.map(t => <td key={t.key} className="p-3 text-center text-white font-bold">₹{t.minDeposit.toLocaleString()}</td>)}
                            </tr>
                            <tr className="border-t border-slate-700/50">
                                <td className="p-3 text-slate-300">Lossback</td>
                                {tiers.map(t => <td key={t.key} className="p-3 text-center text-white font-bold">{t.lossbackPct}%</td>)}
                            </tr>
                            <tr className="border-t border-slate-700/50">
                                <td className="p-3 text-slate-300">Reload Bonus</td>
                                {tiers.map(t => <td key={t.key} className="p-3 text-center text-white font-bold">{t.reloadBonusPct}%</td>)}
                            </tr>
                            <tr className="border-t border-slate-700/50">
                                <td className="p-3 text-slate-300">Priority Withdrawal</td>
                                {tiers.map(t => <td key={t.key} className="p-3 text-center">{t.priorityWithdrawal ? '✅' : '—'}</td>)}
                            </tr>
                            <tr className="border-t border-slate-700/50">
                                <td className="p-3 text-slate-300">Dedicated Host</td>
                                {tiers.map(t => <td key={t.key} className="p-3 text-center">{t.dedicatedHost ? '✅' : '—'}</td>)}
                            </tr>
                            <tr className="border-t border-slate-700/50">
                                <td className="p-3 text-slate-300">Free Withdrawals</td>
                                {tiers.map(t => <td key={t.key} className="p-3 text-center">{t.freeWithdrawals ? '✅' : '—'}</td>)}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
