"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, Save, Gift, Check } from 'lucide-react';
import { getBonusRules, upsertBonusRule } from '@/actions/fantasy-extras';

interface Rule {
    _id?: string;
    trigger: string;
    displayName: string;
    description: string;
    kind: 'flat' | 'percent';
    amount: number;
    maxPayout: number;
    minSpend: number;
    wageringMultiplier: number;
    isActive: boolean;
}

const DEFAULT_RULES: Rule[] = [
    { trigger: 'signup',           displayName: 'Signup Bonus',          description: 'Credited when a user signs up',                  kind: 'flat',    amount: 50, maxPayout: 0, minSpend: 0, wageringMultiplier: 2, isActive: true },
    { trigger: 'firstjoin',        displayName: 'First Contest Join',    description: 'On first paid fantasy contest join',             kind: 'flat',    amount: 25, maxPayout: 0, minSpend: 0, wageringMultiplier: 1, isActive: true },
    { trigger: 'cashback_loss',    displayName: 'Loss Cashback',         description: '% back when entry finishes in bottom 50%',       kind: 'percent', amount: 10, maxPayout: 100, minSpend: 0, wageringMultiplier: 1, isActive: false },
    { trigger: 'referrer',         displayName: 'Referral — Referrer',    description: 'Credited to referrer when referee joins',       kind: 'flat',    amount: 10, maxPayout: 0, minSpend: 0, wageringMultiplier: 0, isActive: true },
    { trigger: 'referee',          displayName: 'Referral — Referee',     description: 'Credited to referee on signup via link',         kind: 'flat',    amount: 5,  maxPayout: 0, minSpend: 0, wageringMultiplier: 1, isActive: true },
    { trigger: 'birthday',         displayName: 'Birthday Bonus',        description: 'Credited on user birthday',                      kind: 'flat',    amount: 100, maxPayout: 0, minSpend: 0, wageringMultiplier: 1, isActive: false },
    { trigger: 'deposit_match',    displayName: 'Deposit Match',         description: 'Match % on next deposit, capped',                kind: 'percent', amount: 25, maxPayout: 500, minSpend: 200, wageringMultiplier: 3, isActive: false },
    { trigger: 'firstjoin_weekly', displayName: 'Weekly First Join',     description: 'Free entry bonus once per week',                 kind: 'flat',    amount: 10, maxPayout: 0, minSpend: 0, wageringMultiplier: 1, isActive: false },
];

export default function BonusRulesPage() {
    const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [okId, setOkId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        const res = await getBonusRules();
        if (res.success && res.data) {
            const byTrigger = new Map<string, Rule>((res.data as Rule[]).map(r => [r.trigger, r]));
            setRules(DEFAULT_RULES.map(d => byTrigger.get(d.trigger) ?? d));
        }
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const saveOne = async (r: Rule) => {
        setSavingId(r.trigger);
        const res = await upsertBonusRule(r);
        setSavingId(null);
        if (res.success) { setOkId(r.trigger); setTimeout(() => setOkId(null), 1500); }
    };

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-brand-gold" /></div>;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-4">
            <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2"><Gift size={18} className="text-brand-gold" /> Bonus Rules</h1>
                <p className="text-sm text-white/40 mt-0.5">Triggered bonus payouts. Each row saves independently.</p>
            </div>

            <div className="space-y-3">
                {rules.map(r => (
                    <div key={r.trigger} className={`rounded-2xl border p-4 ${r.isActive ? 'border-white/[0.06] bg-bg-elevated' : 'border-white/[0.03] bg-bg-base opacity-70'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <p className="text-white text-sm font-black">{r.displayName} <span className="text-white/30 ml-2 font-mono text-[10px]">{r.trigger}</span></p>
                                <p className="text-[11px] text-white/40 mt-0.5">{r.description}</p>
                            </div>
                            <label className="flex items-center gap-2 text-[12px] text-white/60 cursor-pointer">
                                <input type="checkbox" checked={r.isActive}
                                    onChange={e => setRules(rs => rs.map(x => x.trigger === r.trigger ? { ...x, isActive: e.target.checked } : x))}
                                    className="accent-brand-gold" />
                                Active
                            </label>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <F label="Kind">
                                <select value={r.kind}
                                    onChange={e => setRules(rs => rs.map(x => x.trigger === r.trigger ? { ...x, kind: e.target.value as any } : x))}
                                    className="input">
                                    <option value="flat">flat</option>
                                    <option value="percent">percent</option>
                                </select>
                            </F>
                            <F label={r.kind === 'flat' ? 'Amount (₹)' : '% of spend'}>
                                <input type="number" value={r.amount}
                                    onChange={e => setRules(rs => rs.map(x => x.trigger === r.trigger ? { ...x, amount: Number(e.target.value) } : x))}
                                    className="input" />
                            </F>
                            <F label="Max payout (₹, 0=∞)">
                                <input type="number" value={r.maxPayout}
                                    onChange={e => setRules(rs => rs.map(x => x.trigger === r.trigger ? { ...x, maxPayout: Number(e.target.value) } : x))}
                                    className="input" />
                            </F>
                            <F label="Min spend">
                                <input type="number" value={r.minSpend}
                                    onChange={e => setRules(rs => rs.map(x => x.trigger === r.trigger ? { ...x, minSpend: Number(e.target.value) } : x))}
                                    className="input" />
                            </F>
                            <F label="Wagering ×">
                                <input type="number" step="0.5" value={r.wageringMultiplier}
                                    onChange={e => setRules(rs => rs.map(x => x.trigger === r.trigger ? { ...x, wageringMultiplier: Number(e.target.value) } : x))}
                                    className="input" />
                            </F>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-3">
                            {okId === r.trigger && <span className="text-[12px] text-emerald-400 flex items-center gap-1"><Check size={12} /> Saved</span>}
                            <button onClick={() => saveOne(r)} disabled={savingId === r.trigger}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-gold text-bg-base text-xs font-black hover:bg-brand-gold/90 disabled:opacity-50">
                                {savingId === r.trigger ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <style jsx>{`:global(.input){width:100%;background:#0b0d11;color:white;font-size:12px;font-weight:600;border-radius:10px;border:1px solid rgba(255,255,255,0.1);padding:6px 10px;outline:none}:global(.input:focus){border-color:rgba(234,179,8,0.5)}`}</style>
        </div>
    );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1 block">{label}</label>
            {children}
        </div>
    );
}
