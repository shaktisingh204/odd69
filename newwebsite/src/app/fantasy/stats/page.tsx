"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Trophy, Zap, Flame, Users, Crown, Bell, Gift } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FantasyShell from "@/components/fantasy/FantasyShell";
import api from "@/services/api";

interface Stats {
    totalEntries: number; totalSpent: number; totalWinnings: number; totalPoints: number;
    wins: number; netProfit: number; winRate: number;
    totalTeams: number;
    currentStreak: number; longestStreak: number;
    powerups: Array<{ type: string; count: number }>;
    unreadNotifications: number;
    referrals: number; referralEarned: number;
    seasonRank: { rank?: number; totalPoints: number; totalWinnings: number };
}

export default function FantasyStatsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [s, setS] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { if (!authLoading && !user) router.replace("/"); }, [authLoading, user, router]);

    useEffect(() => {
        if (!user) return;
        (async () => {
            setLoading(true);
            const res = await api.get("/fantasy/stats").catch(() => null);
            if (res?.data) setS(res.data as Stats);
            setLoading(false);
        })();
    }, [user]);

    if (authLoading || !user) return <div className="h-screen flex items-center justify-center bg-[#f5f6f8] text-gray-400 text-sm">Loading...</div>;

    return (
        <FantasyShell title="My Stats" subtitle="Fantasy journey" backHref="/fantasy">
            {loading || !s ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[#d13239]" /></div>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-2xl bg-gradient-to-br from-[#d13239] to-[#9b1921] text-white p-5 shadow-lg">
                        <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Net profit</p>
                        <p className={`text-4xl font-black mt-1 ${s.netProfit >= 0 ? 'text-white' : 'text-amber-200'}`}>
                            {s.netProfit >= 0 ? '+' : ''}${Math.abs(s.netProfit).toLocaleString("en-US")}
                        </p>
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            <Cell v={`$${s.totalSpent.toLocaleString("en-US")}`} l="Spent" />
                            <Cell v={`$${s.totalWinnings.toLocaleString("en-US")}`} l="Winnings" />
                            <Cell v={`${s.winRate}%`} l="Win rate" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Card icon={Trophy} label="Contests joined" value={s.totalEntries} hint={`${s.wins} wins`} />
                        <Card icon={Users} label="Teams built" value={s.totalTeams} />
                        <Card icon={Crown} label="Season rank" value={s.seasonRank.rank ? `#${s.seasonRank.rank}` : '—'} hint={`$${(s.seasonRank.totalWinnings || 0).toLocaleString("en-US")} won`} />
                        <Card icon={Flame} label="Current streak" value={s.currentStreak} hint={`best ${s.longestStreak}`} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <LinkCard href="/fantasy/streak" icon={Flame} label="Daily Streak" />
                        <LinkCard href="/fantasy/notifications" icon={Bell} label={`Alerts${s.unreadNotifications ? ` (${s.unreadNotifications})` : ''}`} />
                        <LinkCard href="/fantasy/leaderboard" icon={Crown} label="Leaderboard" />
                        <LinkCard href="/fantasy/refer" icon={Gift} label={`Referrals (${s.referrals})`} />
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-1.5"><Zap size={12} /> Powerups</h3>
                        {s.powerups.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2">None yet — earn via streaks or referrals.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {s.powerups.map(p => (
                                    <span key={p.type} className="inline-flex items-center gap-1.5 bg-[#d13239]/10 text-[#d13239] text-xs font-black px-3 py-1.5 rounded-full">
                                        {p.type} × {p.count}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </FantasyShell>
    );
}

function Cell({ v, l }: { v: string; l: string }) {
    return (
        <div className="bg-white/10 rounded-xl px-3 py-2">
            <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">{l}</p>
            <p className="text-white font-black text-sm">{v}</p>
        </div>
    );
}

function Card({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: React.ReactNode; hint?: string }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-gray-500 text-[11px] font-extrabold uppercase tracking-widest">
                <Icon size={13} /> {label}
            </div>
            <p className="text-gray-900 font-black text-xl mt-1">{value}</p>
            {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
        </div>
    );
}

function LinkCard({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
    return (
        <Link href={href} className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-[#d13239]/40 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#d13239]/10 text-[#d13239] flex items-center justify-center">
                <Icon size={16} />
            </div>
            <p className="text-gray-900 font-extrabold text-sm">{label}</p>
        </Link>
    );
}
