"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, Save, SlidersHorizontal, Check } from 'lucide-react';
import { getFantasyPointsSystems, upsertFantasyPointsSystem } from '@/actions/fantasy';

interface PointsSystem {
    _id?: string;
    format: string;
    run: number;
    boundary: number;
    six: number;
    halfCentury: number;
    century: number;
    duck: number;
    wicket: number;
    bowlingThreeWickets: number;
    bowlingFiveWickets: number;
    maiden: number;
    economyBonusBelow6: number;
    economyPenaltyAbove10: number;
    catch_points: number;
    stumping: number;
    runOut: number;
    playerOfTheMatch: number;
    captainMultiplier: number;
    viceCaptainMultiplier: number;
    playing11Bonus: number;
}

const FORMATS = ['T20', 'ODI', 'Test'] as const;

const DEFAULTS: PointsSystem = {
    format: 'T20',
    run: 1, boundary: 1, six: 2, halfCentury: 4, century: 8, duck: -2,
    wicket: 25, bowlingThreeWickets: 8, bowlingFiveWickets: 16, maiden: 12,
    economyBonusBelow6: -1, economyPenaltyAbove10: 1,
    catch_points: 8, stumping: 12, runOut: 6,
    playerOfTheMatch: 4,
    captainMultiplier: 2, viceCaptainMultiplier: 1.5, playing11Bonus: 4,
};

const SECTIONS: { title: string; fields: Array<{ key: keyof PointsSystem; label: string; hint?: string }> }[] = [
    {
        title: 'Batting', fields: [
            { key: 'run', label: 'Per run' },
            { key: 'boundary', label: 'Boundary bonus', hint: 'bonus per 4' },
            { key: 'six', label: 'Six bonus', hint: 'bonus per 6' },
            { key: 'halfCentury', label: '50 bonus' },
            { key: 'century', label: '100 bonus' },
            { key: 'duck', label: 'Duck', hint: 'out on 0 (batsmen only)' },
        ],
    },
    {
        title: 'Bowling', fields: [
            { key: 'wicket', label: 'Per wicket' },
            { key: 'bowlingThreeWickets', label: '3-wicket haul' },
            { key: 'bowlingFiveWickets', label: '5-wicket haul' },
            { key: 'maiden', label: 'Maiden over' },
            { key: 'economyBonusBelow6', label: 'Econ < 6 (per over)' },
            { key: 'economyPenaltyAbove10', label: 'Econ > 10 (per over)' },
        ],
    },
    {
        title: 'Fielding', fields: [
            { key: 'catch_points', label: 'Catch' },
            { key: 'stumping', label: 'Stumping' },
            { key: 'runOut', label: 'Run out' },
        ],
    },
    {
        title: 'Bonuses & Multipliers', fields: [
            { key: 'playerOfTheMatch', label: 'Player of the match' },
            { key: 'playing11Bonus', label: 'Starting XI bonus' },
            { key: 'captainMultiplier', label: 'Captain multiplier' },
            { key: 'viceCaptainMultiplier', label: 'Vice-captain multiplier' },
        ],
    },
];

export default function FantasyPointsSystemPage() {
    const [format, setFormat] = useState<(typeof FORMATS)[number]>('T20');
    const [draft, setDraft] = useState<PointsSystem>(DEFAULTS);
    const [all, setAll] = useState<Record<string, PointsSystem>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedOk, setSavedOk] = useState(false);
    const [err, setErr] = useState('');

    const load = async () => {
        setLoading(true);
        const res = await getFantasyPointsSystems();
        if (res.success && res.data) {
            const map: Record<string, PointsSystem> = {};
            (res.data as PointsSystem[]).forEach(p => { map[p.format] = p; });
            setAll(map);
            setDraft(map[format] || { ...DEFAULTS, format });
        }
        setLoading(false);
    };

    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    useEffect(() => {
        setDraft(all[format] || { ...DEFAULTS, format });
        setSavedOk(false);
    }, [format, all]);

    const handleSave = async () => {
        setSaving(true); setErr('');
        const { _id, ...payload } = draft;
        const res = await upsertFantasyPointsSystem(payload as any);
        setSaving(false);
        if (res.success) {
            setSavedOk(true);
            setTimeout(() => setSavedOk(false), 2000);
            await load();
        } else {
            setErr(res.error || 'Failed to save');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-brand-gold" />
        </div>
    );

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-5">

            <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2">
                    <SlidersHorizontal size={18} className="text-brand-gold" /> Fantasy Points System
                </h1>
                <p className="text-sm text-white/40 mt-0.5">Scoring rules used when calculating per-player fantasy points after a match. Changes apply to future settlements.</p>
            </div>

            {/* Format tabs */}
            <div className="flex gap-2 rounded-2xl bg-bg-elevated p-1 w-fit">
                {FORMATS.map(f => (
                    <button key={f} onClick={() => setFormat(f)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${format === f ? 'bg-brand-gold text-bg-base' : 'text-white/40 hover:text-white'}`}>
                        {f}
                        {!all[f] && <span className="ml-1 text-[9px] opacity-60">(defaults)</span>}
                    </button>
                ))}
            </div>

            {SECTIONS.map(sec => (
                <div key={sec.title} className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-5">
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-3">{sec.title}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {sec.fields.map(f => (
                            <div key={f.key}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1 block">
                                    {f.label}
                                    {f.hint && <span className="ml-1 opacity-60 normal-case font-medium">({f.hint})</span>}
                                </label>
                                <input type="number" step={f.key.includes('Multiplier') ? '0.1' : '1'}
                                    value={draft[f.key] as number}
                                    onChange={e => setDraft(d => ({ ...d, [f.key]: Number(e.target.value) }))}
                                    className="w-full bg-bg-base text-white text-sm font-mono rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {err && <p className="text-xs text-red-400">{err}</p>}

            <div className="flex items-center justify-end gap-2 sticky bottom-3">
                {savedOk && <span className="text-[12px] text-emerald-400 flex items-center gap-1"><Check size={12} /> Saved</span>}
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 bg-brand-gold text-bg-base px-5 py-2.5 rounded-xl font-black text-sm hover:bg-brand-gold/90 disabled:opacity-50 shadow-lg">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save {format} points
                </button>
            </div>
        </div>
    );
}
