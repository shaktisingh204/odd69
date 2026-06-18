"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, Save, Sparkles, Check, Plus, Trash2 } from 'lucide-react';
import { getStreakSchedule, updateStreakSchedule, getStreakLeaders } from '@/actions/fantasy-extras';

interface Reward { day: number; amount: number; type: 'bonus' | 'cash' | 'powerup'; powerupType?: string }

interface StreakRow { _id: string; userId: number; currentStreak: number; longestStreak: number; lastClaimDate: string; totalDaysClaimed: number; lifetimeRewardAmount: number }

export default function StreaksPage() {
    const [schedule, setSchedule] = useState<Reward[]>([]);
    const [leaders, setLeaders] = useState<StreakRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ok, setOk] = useState(false);

    const load = async () => {
        setLoading(true);
        const [a, b] = await Promise.all([getStreakSchedule(), getStreakLeaders()]);
        if (a.success && (a.data as any)?.schedule) setSchedule((a.data as any).schedule);
        if (b.success && b.data) setLeaders(b.data as StreakRow[]);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const save = async () => {
        setSaving(true);
        const res = await updateStreakSchedule(schedule);
        setSaving(false);
        if (res.success) { setOk(true); setTimeout(() => setOk(false), 1500); }
    };

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-brand-gold" /></div>;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-5">
            <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2"><Sparkles size={18} className="text-brand-gold" /> Daily Streak Rewards</h1>
                <p className="text-sm text-white/40 mt-0.5">Reward ladder for consecutive-day login streaks. Repeats after final row.</p>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40">Ladder</h2>
                    <button onClick={() => setSchedule(s => [...s, { day: s.length + 1, amount: 10, type: 'bonus' }])}
                        className="flex items-center gap-1 text-[11px] font-black text-brand-gold hover:text-white"><Plus size={12} /> Add Day</button>
                </div>
                <div className="space-y-2">
                    {schedule.map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="w-14 text-[11px] text-white/30 font-mono">Day {r.day || i + 1}</span>
                            <select value={r.type}
                                onChange={e => setSchedule(s => s.map((x, idx) => idx === i ? { ...x, type: e.target.value as any } : x))}
                                className="input w-32">
                                <option value="bonus">bonus</option>
                                <option value="cash">cash</option>
                                <option value="powerup">powerup</option>
                            </select>
                            <input type="number" value={r.amount}
                                onChange={e => setSchedule(s => s.map((x, idx) => idx === i ? { ...x, amount: Number(e.target.value) } : x))}
                                placeholder="Amount" className="input flex-1" />
                            {r.type === 'powerup' && (
                                <input value={r.powerupType || ''}
                                    onChange={e => setSchedule(s => s.map((x, idx) => idx === i ? { ...x, powerupType: e.target.value } : x))}
                                    placeholder="Powerup type" className="input flex-1" />
                            )}
                            <button onClick={() => setSchedule(s => s.filter((_, idx) => idx !== i))}
                                className="p-2 rounded-lg text-red-400/40 hover:text-red-400"><Trash2 size={12} /></button>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-end gap-2 mt-4">
                    {ok && <span className="text-[12px] text-emerald-400 flex items-center gap-1"><Check size={12} /> Saved</span>}
                    <button onClick={save} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-gold text-bg-base text-xs font-black hover:bg-brand-gold/90 disabled:opacity-50">
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save ladder
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-5">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-3">Top streaks</h2>
                {leaders.length === 0 ? (
                    <p className="text-[11px] text-white/25 text-center py-6">No streak data yet.</p>
                ) : (
                    <div className="space-y-1 max-h-[420px] overflow-auto">
                        {leaders.map((l, i) => (
                            <div key={l._id} className="flex items-center gap-2 text-[12px] py-1.5 border-b border-white/5 last:border-0">
                                <span className="w-8 text-white/30 font-mono text-[10px]">#{i + 1}</span>
                                <span className="text-white/70 flex-1 font-mono">User #{l.userId}</span>
                                <span className="text-brand-gold font-black">🔥 {l.currentStreak}</span>
                                <span className="text-white/30 text-[10px]">best {l.longestStreak}</span>
                                <span className="text-emerald-400/70 font-mono text-[10px]">₹{l.lifetimeRewardAmount}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`:global(.input){background:#0b0d11;color:white;font-size:12px;font-weight:600;border-radius:10px;border:1px solid rgba(255,255,255,0.1);padding:6px 10px;outline:none}:global(.input:focus){border-color:rgba(234,179,8,0.5)}`}</style>
        </div>
    );
}
