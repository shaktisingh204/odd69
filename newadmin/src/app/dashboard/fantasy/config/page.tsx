"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, Save, Settings, Check } from 'lucide-react';
import { getFantasyConfig, updateFantasyConfig } from '@/actions/fantasy-extras';

interface Config {
    creditCap: number; squadSize: number; maxPlayersFromOneTeam: number;
    minKeepers: number; maxKeepers: number;
    minBatsmen: number; maxBatsmen: number;
    minAllrounders: number; maxAllrounders: number;
    minBowlers: number; maxBowlers: number;
    maxTeamsPerMatch: number; defaultMultiEntryCap: number;
    platformFeePercent: number; maxBonusUsePercent: number; minWalletBalanceForJoin: number;
    signupBonus: number; firstJoinBonus: number; referrerBonus: number; refereeBonus: number;
    allowPrivateContests: boolean; allowTeamCloning: boolean; allowMultiEntry: boolean;
    allowPowerups: boolean; allowPromocodes: boolean; allowStreakRewards: boolean;
    lockOffsetMinutes: number;
    isMaintenanceMode: boolean; maintenanceMessage: string;
}

const SECTIONS = [
    { title: 'Team building', fields: ['creditCap', 'squadSize', 'maxPlayersFromOneTeam'] },
    { title: 'Role limits (min / max)', fields: ['minKeepers', 'maxKeepers', 'minBatsmen', 'maxBatsmen', 'minAllrounders', 'maxAllrounders', 'minBowlers', 'maxBowlers'] },
    { title: 'Entry & contest limits', fields: ['maxTeamsPerMatch', 'defaultMultiEntryCap', 'lockOffsetMinutes'] },
    { title: 'Economy', fields: ['platformFeePercent', 'maxBonusUsePercent', 'minWalletBalanceForJoin'] },
    { title: 'Bonus amounts', fields: ['signupBonus', 'firstJoinBonus', 'referrerBonus', 'refereeBonus'] },
] as const;

const TOGGLES: Array<{ key: keyof Config; label: string; hint?: string }> = [
    { key: 'allowPrivateContests', label: 'Private contests',        hint: 'Users can create invite-only contests' },
    { key: 'allowTeamCloning',     label: 'Team cloning',             hint: 'Clone existing team as starting point' },
    { key: 'allowMultiEntry',      label: 'Multi-entry contests',     hint: 'Same user joins with multiple teams' },
    { key: 'allowPowerups',        label: 'Powerups',                 hint: 'Consumable boosts (triple C, free entry…)' },
    { key: 'allowPromocodes',      label: 'Promocodes',               hint: 'Discount codes at checkout' },
    { key: 'allowStreakRewards',   label: 'Streak rewards',           hint: 'Daily check-in reward ladder' },
];

export default function FantasyConfigPage() {
    const [draft, setDraft] = useState<Config | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ok, setOk] = useState(false);
    const [err, setErr] = useState('');

    const load = async () => {
        setLoading(true);
        const res = await getFantasyConfig();
        if (res.success && res.data) setDraft(res.data as Config);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const handleSave = async () => {
        if (!draft) return;
        setSaving(true); setErr('');
        const res = await updateFantasyConfig(draft);
        setSaving(false);
        if (res.success) { setOk(true); setTimeout(() => setOk(false), 2000); }
        else setErr(res.error || 'Failed');
    };

    if (loading || !draft) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-brand-gold" />
        </div>
    );

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-5">
            <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2">
                    <Settings size={18} className="text-brand-gold" /> Fantasy Global Config
                </h1>
                <p className="text-sm text-white/40 mt-0.5">Platform-wide rules. Changes take effect immediately.</p>
            </div>

            {/* Maintenance banner */}
            <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-white text-sm font-black">Maintenance mode</p>
                        <p className="text-[11px] text-white/40">Blocks all fantasy join/create flows with an on-screen message.</p>
                    </div>
                    <button
                        onClick={() => setDraft(d => d ? { ...d, isMaintenanceMode: !d.isMaintenanceMode } : d)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${draft.isMaintenanceMode ? 'bg-rose-500 text-white' : 'bg-white/5 text-white/50'}`}>
                        {draft.isMaintenanceMode ? 'ON' : 'OFF'}
                    </button>
                </div>
                {draft.isMaintenanceMode && (
                    <input value={draft.maintenanceMessage}
                        onChange={e => setDraft(d => d ? { ...d, maintenanceMessage: e.target.value } : d)}
                        placeholder="Message shown to users"
                        className="mt-3 w-full bg-bg-base text-white text-sm rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50" />
                )}
            </div>

            {/* Feature toggles */}
            <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-5">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-3">Feature toggles</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {TOGGLES.map(t => (
                        <label key={t.key} className="flex items-start gap-3 py-2 cursor-pointer">
                            <input type="checkbox" checked={draft[t.key] as boolean}
                                onChange={e => setDraft(d => d ? { ...d, [t.key]: e.target.checked } : d)}
                                className="mt-1 accent-brand-gold" />
                            <span>
                                <span className="text-white text-[13px] font-black">{t.label}</span>
                                {t.hint && <span className="block text-[11px] text-white/30">{t.hint}</span>}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Numeric sections */}
            {SECTIONS.map(sec => (
                <div key={sec.title} className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-5">
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-3">{sec.title}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {sec.fields.map(f => (
                            <div key={f}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1 block">{f}</label>
                                <input type="number" step="1"
                                    value={(draft as any)[f]}
                                    onChange={e => setDraft(d => d ? ({ ...d, [f]: Number(e.target.value) }) : d)}
                                    className="w-full bg-bg-base text-white text-sm font-mono rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {err && <p className="text-xs text-red-400">{err}</p>}

            <div className="flex items-center justify-end gap-2 sticky bottom-3">
                {ok && <span className="text-[12px] text-emerald-400 flex items-center gap-1"><Check size={12} /> Saved</span>}
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 bg-brand-gold text-bg-base px-5 py-2.5 rounded-xl font-black text-sm hover:bg-brand-gold/90 disabled:opacity-50 shadow-lg">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save config
                </button>
            </div>
        </div>
    );
}
