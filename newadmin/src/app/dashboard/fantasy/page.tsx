"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Trophy, Calendar, Users, Receipt, SlidersHorizontal,
    Loader2, RefreshCw, TrendingUp, DollarSign, Radio, Flag,
} from 'lucide-react';
import { getFantasyStats, triggerFantasySync } from '@/actions/fantasy';

interface Stats {
    matches: { total: number; upcoming: number; live: number; completed: number };
    contests: { total: number; active: number };
    entries: { total: number; pending: number; settled: number };
    teams: { total: number };
    revenue: { gross: number; paid: number; net: number };
}

function formatMoney(n: number) {
    return '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function FantasyOverviewPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState('');

    const load = async () => {
        setLoading(true);
        const res = await getFantasyStats();
        if (res.success && res.data) setStats(res.data as Stats);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleSync = async () => {
        setSyncing(true); setSyncMsg('');
        const res = await triggerFantasySync();
        setSyncing(false);
        setSyncMsg(res.success ? 'Sync triggered. Matches will refresh shortly.' : (res.error || 'Sync failed.'));
        if (res.success) await load();
        setTimeout(() => setSyncMsg(''), 4000);
    };

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-brand-gold" />
        </div>
    );

    const s = stats!;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-black text-white flex items-center gap-2">
                        <Trophy size={20} className="text-brand-gold" /> Fantasy Cricket
                    </h1>
                    <p className="text-sm text-white/40 mt-0.5">Matches, contests, user teams and scoring.</p>
                </div>
                <button onClick={handleSync} disabled={syncing}
                    className="flex items-center gap-1.5 bg-brand-gold text-bg-base px-4 py-2 rounded-xl font-black text-sm hover:bg-brand-gold/90 transition-colors disabled:opacity-50">
                    {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Sync
                </button>
            </div>

            {syncMsg && (
                <div className="text-[12px] text-brand-gold/80 bg-brand-gold/5 border border-brand-gold/20 rounded-xl px-3 py-2">
                    {syncMsg}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Calendar} label="Matches" value={s.matches.total}
                    hint={`${s.matches.upcoming} up • ${s.matches.live} live • ${s.matches.completed} done`} />
                <StatCard icon={Trophy}  label="Contests" value={s.contests.total}
                    hint={`${s.contests.active} active`} />
                <StatCard icon={Receipt} label="Entries" value={s.entries.total}
                    hint={`${s.entries.pending} pending • ${s.entries.settled} settled`} />
                <StatCard icon={Users}   label="User Teams" value={s.teams.total} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <RevenueCard label="Entry Fees (Gross)" value={s.revenue.gross} tone="neutral" icon={DollarSign} />
                <RevenueCard label="Prize Paid Out"     value={s.revenue.paid}  tone="negative" icon={TrendingUp} />
                <RevenueCard label="Net"                 value={s.revenue.net}   tone={s.revenue.net >= 0 ? 'positive' : 'negative'} icon={DollarSign} />
            </div>

            {/* Quick links */}
            <div>
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-2">Manage</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <QuickLink href="/dashboard/fantasy/matches"       icon={Calendar}           title="Matches"         desc="View/sync cricket matches" />
                    <QuickLink href="/dashboard/fantasy/contests"      icon={Trophy}             title="Contests"        desc="Create & manage contests" />
                    <QuickLink href="/dashboard/fantasy/teams"         icon={Users}              title="User Teams"      desc="Inspect user playing XI" />
                    <QuickLink href="/dashboard/fantasy/entries"       icon={Receipt}            title="Entries"         desc="Contest joins & winnings" />
                    <QuickLink href="/dashboard/fantasy/points-system" icon={SlidersHorizontal}  title="Points System"   desc="Edit T20/ODI/Test scoring" />
                    <QuickLink href="/dashboard/fantasy/players"       icon={Radio}              title="Players"         desc="Search player profiles" />
                </div>
            </div>

            {/* Live matches hint */}
            {s.matches.live > 0 && (
                <div className="rounded-2xl bg-rose-500/5 border border-rose-500/20 p-4 flex items-center gap-3">
                    <Flag size={18} className="text-rose-400" />
                    <div>
                        <p className="text-sm font-black text-rose-200">{s.matches.live} live match{s.matches.live > 1 ? 'es' : ''} right now</p>
                        <p className="text-[11px] text-white/40">Live points update automatically. Check the Matches page for per-match status.</p>
                    </div>
                    <Link href="/dashboard/fantasy/matches?status=2"
                        className="ml-auto text-[11px] font-black text-rose-300 hover:text-white">View →</Link>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: number; hint?: string }) {
    return (
        <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated px-4 py-3.5">
            <div className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-widest">
                <Icon size={12} /> {label}
            </div>
            <p className="text-2xl font-black text-white mt-1.5">{value.toLocaleString('en-IN')}</p>
            {hint && <p className="text-[10px] text-white/30 mt-0.5">{hint}</p>}
        </div>
    );
}

function RevenueCard({ label, value, tone, icon: Icon }: { label: string; value: number; tone: 'positive' | 'negative' | 'neutral'; icon: React.ElementType }) {
    const toneClass = tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-rose-400' : 'text-white';
    return (
        <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated px-4 py-3.5">
            <div className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-widest">
                <Icon size={12} /> {label}
            </div>
            <p className={`text-2xl font-black mt-1.5 ${toneClass}`}>{formatMoney(value)}</p>
        </div>
    );
}

function QuickLink({ href, icon: Icon, title, desc }: { href: string; icon: React.ElementType; title: string; desc: string }) {
    return (
        <Link href={href}
            className="rounded-2xl border border-white/[0.06] bg-bg-elevated hover:border-brand-gold/30 hover:bg-bg-elevated transition-all p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-gold/10 text-brand-gold flex items-center justify-center flex-shrink-0">
                <Icon size={16} />
            </div>
            <div className="min-w-0">
                <p className="text-sm font-black text-white">{title}</p>
                <p className="text-[11px] text-white/35 mt-0.5">{desc}</p>
            </div>
        </Link>
    );
}
