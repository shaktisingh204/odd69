"use client";

import React, { useEffect, useState } from 'react';
import { Clock, Eye, Check, X, RefreshCcw, AlertCircle, Users, TrendingUp, BadgeCheck, XCircle, Loader2, ChevronDown, Star } from 'lucide-react';
import { getVipApplications, getVipStats, reviewVipApplication } from '@/actions/settings';

type VipStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'TRANSFER_REQUESTED';

interface VipApplication {
    id: number;
    status: VipStatus;
    message?: string;
    currentPlatform?: string;
    platformUsername?: string;
    monthlyVolume?: number;
    reviewNotes?: string;
    reviewedAt?: string;
    ipAddress?: string;
    createdAt: string;
    user: {
        id: number;
        username: string;
        email?: string;
        phoneNumber?: string;
        balance: number;
        totalDeposited: number;
        totalWagered: number;
        vipTier: string;
        createdAt: string;
        kycStatus: string;
    };
}

interface Stats {
    total: number;
    pending: number;
    underReview: number;
    approved: number;
    rejected: number;
    transfer: number;
}

const STATUS_CONFIG: Record<VipStatus, { label: string; icon: any; color: string; bg: string; border: string }> = {
    PENDING: { label: 'Pending', icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    UNDER_REVIEW: { label: 'Under Review', icon: AlertCircle, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    APPROVED: { label: 'Approved', icon: BadgeCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    REJECTED: { label: 'Rejected', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    TRANSFER_REQUESTED: { label: 'Transfer Req.', icon: RefreshCcw, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
};

function StatusBadge({ status }: { status: VipStatus }) {
    const c = STATUS_CONFIG[status];
    const Icon = c.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${c.bg} ${c.border} ${c.color}`}>
            <Icon size={11} /> {c.label}
        </span>
    );
}

export default function VipApplicationsPage() {
    const [applications, setApplications] = useState<VipApplication[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedApp, setSelectedApp] = useState<VipApplication | null>(null);
    const [reviewStatus, setReviewStatus] = useState<string>('APPROVED');
    const [reviewNotes, setReviewNotes] = useState('');
    const [assignedTier, setAssignedTier] = useState('SILVER');
    const [reviewing, setReviewing] = useState(false);

    const fetchData = async (pg = page, status = filterStatus) => {
        setLoading(true);
        try {
            const [appsRes, statsRes] = await Promise.all([
                getVipApplications(pg, 20, status || undefined),
                getVipStats(),
            ]);
            if (appsRes.success && appsRes.data) {
                setApplications(appsRes.data.applications);
                setTotalPages(appsRes.data.pages);
            }
            if (statsRes.success && statsRes.data) {
                setStats(statsRes.data);
            }
        } catch (err) {
            console.error('Failed to load VIP applications', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleFilterChange = (status: string) => {
        setFilterStatus(status);
        setPage(1);
        fetchData(1, status);
    };

    const handleReview = async () => {
        if (!selectedApp) return;
        setReviewing(true);
        try {
            const res = await reviewVipApplication(selectedApp.id, reviewStatus, reviewNotes || undefined, 1, reviewStatus === 'APPROVED' ? assignedTier : undefined);
            if (res.success) {
                setSelectedApp(null);
                setReviewNotes('');
                fetchData();
            } else {
                alert(res.error || 'Review failed');
            }
        } catch (err: any) {
            alert('Review failed');
        } finally {
            setReviewing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <Star size={24} className="text-yellow-400" /> VIP Applications
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Review and manage VIP membership applications</p>
                </div>
                <button onClick={() => fetchData()} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
                    <RefreshCcw size={16} /> Refresh
                </button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Total', value: stats.total, color: 'text-white', icon: Users },
                        { label: 'Pending', value: stats.pending, color: 'text-yellow-400', icon: Clock },
                        { label: 'Under Review', value: stats.underReview, color: 'text-blue-400', icon: AlertCircle },
                        { label: 'Approved', value: stats.approved, color: 'text-emerald-400', icon: BadgeCheck },
                        { label: 'Rejected', value: stats.rejected, color: 'text-red-400', icon: XCircle },
                        { label: 'Transfer Req.', value: stats.transfer, color: 'text-purple-400', icon: RefreshCcw },
                    ].map(s => {
                        const Icon = s.icon;
                        return (
                            <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                                <Icon size={20} className={`mx-auto mb-1 ${s.color}`} />
                                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                                <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { id: '', label: 'All' },
                    { id: 'PENDING', label: 'Pending' },
                    { id: 'UNDER_REVIEW', label: 'Under Review' },
                    { id: 'APPROVED', label: 'Approved' },
                    { id: 'REJECTED', label: 'Rejected' },
                    { id: 'TRANSFER_REQUESTED', label: 'Transfer' },
                ].map(f => (
                    <button key={f.id} onClick={() => handleFilterChange(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterStatus === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left p-3 text-slate-400 font-bold">User</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Status</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Platform</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Volume / Month</th>
                                <th className="text-left p-3 text-slate-400 font-bold">KYC</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Balance</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Applied At</th>
                                <th className="text-left p-3 text-slate-400 font-bold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="text-center py-12 text-slate-500"><Loader2 size={24} className="animate-spin mx-auto mb-2" />Loading...</td></tr>
                            ) : applications.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-12 text-slate-500">No applications found.</td></tr>
                            ) : applications.map(app => (
                                <tr key={app.id} className="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                    <td className="p-3">
                                        <div className="font-bold text-white">{app.user.username}</div>
                                        <div className="text-slate-500 text-xs">{app.user.email || app.user.phoneNumber}</div>
                                        <div className="text-slate-600 text-xs">ID #{app.user.id}</div>
                                    </td>
                                    <td className="p-3"><StatusBadge status={app.status} /></td>
                                    <td className="p-3">
                                        {app.currentPlatform ? (
                                            <div>
                                                <div className="text-white text-xs font-bold">{app.currentPlatform}</div>
                                                {app.platformUsername && <div className="text-slate-500 text-xs">@{app.platformUsername}</div>}
                                            </div>
                                        ) : <span className="text-slate-600 text-xs">—</span>}
                                    </td>
                                    <td className="p-3">
                                        {app.monthlyVolume ? (
                                            <span className="text-white text-xs">₹{app.monthlyVolume.toLocaleString()}</span>
                                        ) : <span className="text-slate-600 text-xs">—</span>}
                                    </td>
                                    <td className="p-3">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${app.user.kycStatus === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400' : app.user.kycStatus === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-slate-700 text-slate-400'}`}>
                                            {app.user.kycStatus}
                                        </span>
                                    </td>
                                    <td className="p-3 text-white text-xs">₹{app.user.balance.toLocaleString()}</td>
                                    <td className="p-3 text-slate-400 text-xs">{new Date(app.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td className="p-3">
                                        <button onClick={() => { setSelectedApp(app); setReviewStatus('APPROVED'); setReviewNotes(''); setAssignedTier('SILVER'); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors">
                                            <Eye size={12} /> Review
                                        </button>
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

            {/* Review Modal */}
            {selectedApp && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedApp(null)}>
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-700">
                            <h2 className="text-lg font-bold text-white">Review VIP Application #{selectedApp.id}</h2>
                            <p className="text-slate-400 text-sm mt-0.5">by {selectedApp.user.username}</p>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* User info summary */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                {[
                                    { label: 'Balance', value: `₹${selectedApp.user.balance.toLocaleString()}` },
                                    { label: 'Total Deposited', value: `₹${(selectedApp.user.totalDeposited || 0).toLocaleString()}` },
                                    { label: 'Total Wagered', value: `₹${(selectedApp.user.totalWagered || 0).toLocaleString()}` },
                                    { label: 'KYC', value: selectedApp.user.kycStatus },
                                    { label: 'Current VIP', value: selectedApp.user.vipTier || 'NONE' },
                                    { label: 'Platform', value: selectedApp.currentPlatform || '—' },
                                    { label: 'Monthly Vol.', value: selectedApp.monthlyVolume ? `₹${selectedApp.monthlyVolume.toLocaleString()}` : '—' },
                                    { label: 'User Since', value: new Date(selectedApp.user.createdAt).toLocaleDateString() },
                                ].map(item => (
                                    <div key={item.label} className="bg-slate-900 rounded-lg p-2.5">
                                        <div className="text-slate-500">{item.label}</div>
                                        <div className="text-white font-bold mt-0.5">{item.value}</div>
                                    </div>
                                ))}
                            </div>

                            {selectedApp.message && (
                                <div className="bg-slate-900 rounded-lg p-3">
                                    <p className="text-slate-400 text-xs font-bold mb-1">User's Message</p>
                                    <p className="text-slate-200 text-sm italic">"{selectedApp.message}"</p>
                                </div>
                            )}

                            {/* Decision */}
                            <div>
                                <label className="block text-slate-400 text-xs font-bold mb-2">Decision</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['APPROVED', 'UNDER_REVIEW', 'REJECTED'] as const).map(s => (
                                        <button key={s} onClick={() => setReviewStatus(s)}
                                            className={`py-2.5 rounded-lg text-xs font-black transition-colors border ${reviewStatus === s
                                                ? s === 'APPROVED' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                    : s === 'REJECTED' ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                                        : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                                                : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>
                                            {s === 'UNDER_REVIEW' ? 'Under Review' : s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tier selection (only when approving) */}
                            {reviewStatus === 'APPROVED' && (
                                <div>
                                    <label className="block text-slate-400 text-xs font-bold mb-2">Assign VIP Tier</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { key: 'SILVER', label: '🥈 Silver', color: 'text-slate-300', activeBg: 'bg-slate-400/20 border-slate-400/40' },
                                            { key: 'GOLD', label: '🥇 Gold', color: 'text-amber-400', activeBg: 'bg-amber-500/20 border-amber-500/40' },
                                            { key: 'PLATINUM', label: '🏆 Platinum', color: 'text-purple-400', activeBg: 'bg-purple-500/20 border-purple-500/40' },
                                            { key: 'DIAMOND', label: '💎 Diamond', color: 'text-blue-400', activeBg: 'bg-blue-500/20 border-blue-500/40' },
                                        ].map(t => (
                                            <button key={t.key} onClick={() => setAssignedTier(t.key)}
                                                className={`py-2 rounded-lg text-xs font-black transition-colors border ${assignedTier === t.key ? `${t.activeBg} ${t.color}` : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-slate-400 text-xs font-bold mb-1">Internal Notes <span className="font-normal opacity-60">— optional, shown to user if rejected</span></label>
                                <textarea rows={3} value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                                    maxLength={500}
                                    placeholder="Reason for rejection / internal notes..."
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 outline-none resize-none" />
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-700 flex gap-3">
                            <button onClick={() => setSelectedApp(null)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-bold text-sm transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleReview} disabled={reviewing}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-black text-sm transition-all disabled:opacity-60 ${reviewStatus === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : reviewStatus === 'REJECTED' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                                {reviewing ? <Loader2 size={16} className="animate-spin" /> : reviewStatus === 'APPROVED' ? <Check size={16} /> : reviewStatus === 'REJECTED' ? <X size={16} /> : <AlertCircle size={16} />}
                                {reviewing ? 'Saving...' : `Mark as ${reviewStatus === 'UNDER_REVIEW' ? 'Under Review' : reviewStatus}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
