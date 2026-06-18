"use client";

import React, { useEffect, useState } from 'react';
import { Users, Search, RefreshCcw, Loader2, Crown, ChevronDown } from 'lucide-react';
import { getVipMembers, getVipMemberStats, updateUserVipTier } from '@/actions/settings';

type VipTier = 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

const TIER_CONFIG: Record<VipTier, { label: string; color: string; bg: string; border: string; emoji: string }> = {
    SILVER:   { label: 'Silver',   color: 'text-slate-300',  bg: 'bg-slate-400/10',  border: 'border-slate-400/20', emoji: '🥈' },
    GOLD:     { label: 'Gold',     color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20', emoji: '🥇' },
    PLATINUM: { label: 'Platinum', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', emoji: '🏆' },
    DIAMOND:  { label: 'Diamond',  color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',  emoji: '💎' },
};

function TierBadge({ tier }: { tier: VipTier }) {
    const c = TIER_CONFIG[tier];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${c.bg} ${c.border} ${c.color}`}>
            {c.emoji} {c.label}
        </span>
    );
}

interface Member {
    id: number;
    username: string;
    email?: string;
    phoneNumber?: string;
    vipTier: VipTier;
    balance: number;
    totalDeposited: number;
    totalWagered: number;
    kycStatus: string;
    createdAt: string;
}

interface Stats { silver: number; gold: number; platinum: number; diamond: number; total: number }

export default function VipMembersPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterTier, setFilterTier] = useState('ALL');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [changingTier, setChangingTier] = useState<number | null>(null);

    const fetchData = async (pg = page, tier = filterTier, q = search) => {
        setLoading(true);
        try {
            const [membersRes, statsRes] = await Promise.all([
                getVipMembers(pg, 20, tier !== 'ALL' ? tier : undefined, q || undefined),
                getVipMemberStats(),
            ]);
            if (membersRes.success && membersRes.data) {
                setMembers(membersRes.data.members);
                setTotalPages(membersRes.data.pages);
            }
            if (statsRes.success && statsRes.data) setStats(statsRes.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleFilterChange = (tier: string) => {
        setFilterTier(tier);
        setPage(1);
        fetchData(1, tier, search);
    };

    const handleSearch = () => {
        setPage(1);
        fetchData(1, filterTier, search);
    };

    const handleTierChange = async (userId: number, newTier: string) => {
        setChangingTier(userId);
        try {
            const res = await updateUserVipTier(userId, newTier);
            if (res.success) fetchData();
            else alert(res.error || 'Failed to update tier');
        } catch { alert('Failed to update tier'); }
        finally { setChangingTier(null); }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <Crown size={24} className="text-yellow-400" /> VIP Members
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Manage VIP members and their tier assignments</p>
                </div>
                <button onClick={() => fetchData()} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
                    <RefreshCcw size={16} /> Refresh
                </button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                        <Users size={20} className="mx-auto mb-1 text-white" />
                        <div className="text-2xl font-black text-white">{stats.total}</div>
                        <div className="text-slate-500 text-xs mt-0.5">Total VIPs</div>
                    </div>
                    {(['SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as VipTier[]).map(tier => {
                        const c = TIER_CONFIG[tier];
                        return (
                            <div key={tier} className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-slate-600 transition-colors"
                                onClick={() => handleFilterChange(tier)}>
                                <span className="text-xl">{c.emoji}</span>
                                <div className={`text-2xl font-black ${c.color}`}>{stats[tier.toLowerCase() as keyof Stats]}</div>
                                <div className="text-slate-500 text-xs mt-0.5">{c.label}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Search + Filter */}
            <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Search by username or email..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div className="flex gap-2">
                    {['ALL', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'].map(t => (
                        <button key={t} onClick={() => handleFilterChange(t)}
                            className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${filterTier === t ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                            {t === 'ALL' ? 'All' : TIER_CONFIG[t as VipTier]?.emoji + ' ' + TIER_CONFIG[t as VipTier]?.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left p-3 text-slate-400 font-bold">User</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Tier</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Balance</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Total Deposited</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Total Wagered</th>
                                <th className="text-left p-3 text-slate-400 font-bold">KYC</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Joined</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Change Tier</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="text-center py-12 text-slate-500"><Loader2 size={24} className="animate-spin mx-auto mb-2" />Loading...</td></tr>
                            ) : members.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-12 text-slate-500">No VIP members found.</td></tr>
                            ) : members.map(m => (
                                <tr key={m.id} className="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                    <td className="p-3">
                                        <div className="font-bold text-white">{m.username}</div>
                                        <div className="text-slate-500 text-xs">{m.email || m.phoneNumber}</div>
                                        <div className="text-slate-600 text-xs">ID #{m.id}</div>
                                    </td>
                                    <td className="p-3"><TierBadge tier={m.vipTier} /></td>
                                    <td className="p-3 text-white text-xs font-bold">₹{m.balance.toLocaleString()}</td>
                                    <td className="p-3 text-emerald-400 text-xs font-bold">₹{m.totalDeposited.toLocaleString()}</td>
                                    <td className="p-3 text-blue-400 text-xs font-bold">₹{m.totalWagered.toLocaleString()}</td>
                                    <td className="p-3">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${m.kycStatus === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                                            {m.kycStatus}
                                        </span>
                                    </td>
                                    <td className="p-3 text-slate-400 text-xs">{new Date(m.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td className="p-3">
                                        <div className="relative">
                                            <select
                                                value={m.vipTier}
                                                disabled={changingTier === m.id}
                                                onChange={e => handleTierChange(m.id, e.target.value)}
                                                className="appearance-none bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 pr-8 text-white text-xs font-bold focus:border-indigo-500 outline-none cursor-pointer disabled:opacity-50"
                                            >
                                                <option value="SILVER">🥈 Silver</option>
                                                <option value="GOLD">🥇 Gold</option>
                                                <option value="PLATINUM">🏆 Platinum</option>
                                                <option value="DIAMOND">💎 Diamond</option>
                                                <option value="NONE">❌ Revoke VIP</option>
                                            </select>
                                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <button key={i} onClick={() => { setPage(i + 1); fetchData(i + 1); }}
                            className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${page === i + 1 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                            {i + 1}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
