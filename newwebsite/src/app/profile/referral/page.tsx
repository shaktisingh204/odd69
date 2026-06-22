"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { ReferralService, ReferralStats, ReferralHistoryItem } from '@/services/referral.service';
import {
    Copy,
    Users,
    DollarSign,
    Gift,
    Loader2,
    CheckCircle2,
    TrendingUp,
    Share2,
    Link2,
    Clock,
    Award,
    ArrowUpRight,
    ChevronRight,
    Zap,
    QrCode,
    X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useModal } from '@/context/ModalContext';
import { getCurrencySymbol } from '@/utils/currency';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}

function getEventLabel(type: string) {
    const map: Record<string, string> = {
        SIGNUP: 'Sign Up Bonus',
        DEPOSIT_FIRST: 'First Deposit',
        DEPOSIT_RECURRING: 'Deposit Bonus',
        BET_VOLUME: 'Betting Volume',
    };
    return map[type] || type;
}

function getEventColor(type: string) {
    const map: Record<string, string> = {
        SIGNUP: 'text-brand-gold bg-brand-gold/10 border-brand-gold/20',
        DEPOSIT_FIRST: 'text-green-400 bg-green-500/10 border-green-500/20',
        DEPOSIT_RECURRING: 'text-accent-purple bg-orange-500/10 border-orange-500/20',
        BET_VOLUME: 'text-warning bg-warning-alpha-08 border-orange-500/20',
    };
    return map[type] || 'text-text-muted bg-text-faint/10 border-gray-500/20';
}

// ─── QR Code Modal ─────────────────────────────────────────────────────────────

function QRCodeModal({ url, onClose }: { url: string; onClose: () => void }) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=1a1a1a&color=E37D32&margin=15`;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={onClose}
        >
            <div
                className="bg-bg-modal border border-white/[0.06] rounded-2xl p-8 text-center max-w-sm w-full shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white font-bold text-lg">Scan to Join</h3>
                    <button
                        onClick={onClose}
                        className="text-text-faint hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="bg-white rounded-xl p-3 inline-block mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="Referral QR Code" width={180} height={180} />
                </div>
                <p className="text-text-muted text-sm">Share this QR code so friends can join instantly</p>
            </div>
        </div>
    );
}

// ─── Step Card ─────────────────────────────────────────────────────────────────

function StepCard({ step, icon: Icon, title, desc, color }: {
    step: string;
    icon: React.ElementType;
    title: string;
    desc: string;
    color: string;
}) {
    return (
        <div className="relative flex flex-col items-center text-center p-6 rounded-2xl bg-bg-modal border border-white/[0.04] group hover:border-[#ff7a1a]/30 transition-all duration-300 hover:bg-bg-modal">
            <div className={`absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-brand-gold text-white shadow-lg shadow-orange-900/30`}>
                {step}
            </div>
            <div className={`mt-4 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${color} group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={28} />
            </div>
            <h4 className="text-white font-bold mb-2">{title}</h4>
            <p className="text-text-muted text-sm leading-relaxed">{desc}</p>
        </div>
    );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor, highlight = false }: {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
    iconBg: string;
    iconColor: string;
    highlight?: boolean;
}) {
    return (
        <div className={`rounded-2xl p-6 flex items-center gap-5 border transition-all duration-300 ${highlight
            ? 'bg-gradient-to-br from-[#ff7a1a]/15 to-[#C4B5FD]/5 border-[#ff7a1a]/25 hover:border-[#ff7a1a]/50'
            : 'bg-bg-modal border-white/[0.04] hover:border-white/[0.06]'
            }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
                <Icon size={28} />
            </div>
            <div className="min-w-0">
                <p className="text-text-muted text-xs uppercase tracking-wider font-medium mb-1">{label}</p>
                <p className={`text-2xl font-bold truncate ${highlight ? 'text-[#ff7a1a]' : 'text-white'}`}>{value}</p>
                {sub && <p className="text-text-faint text-xs mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ReferralPage() {
    const { token, loading: authLoading, user } = useAuth();
    const fiatSymbol = getCurrencySymbol('USD');
    const { openLogin, openRegister } = useModal();
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showQR, setShowQR] = useState(false);
    const [referralLink, setReferralLink] = useState('');

    useEffect(() => {
        if (stats?.referralCode && typeof window !== 'undefined') {
            setReferralLink(`${window.location.origin}/auth/signup?ref=${stats.referralCode}`);
        }
    }, [stats?.referralCode]);

    const fetchStats = useCallback(async () => {
        if (!token) return;
        try {
            const data = await ReferralService.getStats(token);
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch referral stats:', err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchStats();
        } else {
            const timer = setTimeout(() => setLoading(false), 1500);
            return () => clearTimeout(timer);
        }
    }, [token, fetchStats]);

    const copyLink = () => {
        if (!referralLink) return;
        navigator.clipboard.writeText(referralLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
    };

    const copyCode = () => {
        if (!stats?.referralCode) return;
        navigator.clipboard.writeText(stats.referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleGenerate = async () => {
        if (!token) return;
        setGenerating(true);
        setError(null);
        try {
            const res = await ReferralService.generateCode(token);
            if (res.code) {
                setStats(prev =>
                    prev
                        ? { ...prev, referralCode: res.code }
                        : {
                            referralCode: res.code,
                            totalInvited: 0,
                            totalEarnings: 0,
                            pendingEarnings: 0,
                            recentReferrals: [],
                            recentHistory: [],
                        }
                );
            } else {
                setError('Failed to generate code. Please try again.');
            }
        } catch (err: unknown) {
            const message =
                typeof err === 'object' &&
                    err !== null &&
                    'response' in err &&
                    typeof err.response === 'object' &&
                    err.response !== null &&
                    'data' in err.response &&
                    typeof err.response.data === 'object' &&
                    err.response.data !== null &&
                    'message' in err.response.data &&
                    typeof err.response.data.message === 'string'
                    ? err.response.data.message
                    : 'Server error. Please try again.';
            setError(message);
        } finally {
            setGenerating(false);
        }
    };

    const shareWhatsApp = () => {
        if (!referralLink) return;
        window.open(`https://wa.me/?text=${encodeURIComponent(`🎰 Join me on ODD69 — the #1 betting platform! Use my link and get a bonus: ${referralLink}`)}`, '_blank');
    };

    const shareTwitter = () => {
        if (!referralLink) return;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`🎰 Join ODD69 with my referral link and get a signup bonus! ${referralLink}`)}`, '_blank');
    };

    // Auth loading skeleton
    if (authLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-2 border-[#ff7a1a]/20" />
                    <div className="absolute inset-0 rounded-full border-2 border-[#ff7a1a] border-t-transparent animate-spin" />
                    <Gift className="absolute inset-0 m-auto text-[#ff7a1a]" size={24} />
                </div>
                <p className="text-text-faint text-sm animate-pulse">Loading your referral dashboard...</p>
            </div>
        );
    }

    // Not logged in — show auth gate
    if (!token) {
        return (
            <div className="min-h-[560px] flex flex-col items-center justify-center text-center px-4">
                {/* Decorative glow */}
                <div className="absolute w-72 h-72 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center max-w-sm">
                    {/* Icon */}
                    <div className="w-20 h-20 rounded-2xl bg-brand-gold/10 border border-[#ff7a1a]/20 flex items-center justify-center mb-6">
                        <Gift size={36} className="text-[#ff7a1a]" />
                    </div>

                    {/* Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/10 border border-[#ff7a1a]/20 text-[#ff7a1a] text-xs font-bold uppercase tracking-wider mb-4">
                        <Zap size={11} />
                        Referral Program
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">Refer &amp; Earn</h2>
                    <p className="text-text-muted text-sm leading-relaxed mb-8">
                        Invite your friends to play on ODD69 and earn real rewards.
                        Get bonuses every time a friend signs up and deposits!
                        <br /><br />
                        <span className="text-[#ff7a1a] font-medium">Please log in or create an account</span> to access your personal referral link and dashboard.
                    </p>

                    {/* Benefit bullets */}
                    <div className="w-full bg-bg-modal border border-white/[0.04] rounded-xl p-4 mb-8 text-left space-y-2.5">
                        {[
                            { icon: Users, text: 'Track every friend you invite in real-time' },
                            { icon: DollarSign, text: 'Earn cash rewards for every deposit they make' },
                            { icon: TrendingUp, text: 'No cap — invite unlimited friends and earn more' },
                        ].map(({ icon: Icon, text }, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm text-text-secondary">
                                <div className="w-6 h-6 rounded-full bg-brand-gold/10 flex items-center justify-center shrink-0">
                                    <Icon size={11} className="text-[#ff7a1a]" />
                                </div>
                                {text}
                            </div>
                        ))}
                    </div>

                    {/* CTA buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <button
                            onClick={openLogin}
                            className="flex-1 py-3 px-6 rounded-xl border border-white/[0.06] bg-white/[0.04] hover:bg-white/[0.08] text-white font-bold text-sm transition-all"
                        >
                            Log In
                        </button>
                        <button
                            onClick={openRegister}
                            className="flex-1 py-3 px-6 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-white font-bold text-sm transition-all shadow-lg shadow-orange-900/30"
                        >
                            Create Account
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-2 border-[#ff7a1a]/20" />
                    <div className="absolute inset-0 rounded-full border-2 border-[#ff7a1a] border-t-transparent animate-spin" />
                    <Gift className="absolute inset-0 m-auto text-[#ff7a1a]" size={24} />
                </div>
                <p className="text-text-faint text-sm animate-pulse">Loading your referral dashboard...</p>
            </div>
        );
    }

    return (
        <>
            {showQR && referralLink && (
                <QRCodeModal url={referralLink} onClose={() => setShowQR(false)} />
            )}

            <div className="space-y-6 pb-8">

                {/* ─── Hero Banner ─── */}
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.04]">
                    {/* Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#141018] via-[#0F1016] to-[#0C0D12]" />
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-gold/8 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />
                    <Gift className="absolute right-6 bottom-4 opacity-[0.04] text-white" size={200} />

                    <div className="relative z-10 p-6 md:p-8">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-gold/10 border border-[#ff7a1a]/20 text-[#ff7a1a] text-xs font-bold uppercase tracking-wider mb-4">
                            <Zap size={12} />
                            <span>Referral Program</span>
                        </div>

                        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1.5">Refer &amp; Earn</h1>
                        <p className="text-text-muted max-w-lg mb-6 text-sm leading-relaxed">
                            Invite your friends to play on ODD69 and earn real rewards. Get bonuses every time a friend signs up and deposits!
                        </p>

                        {/* Referral Link Card */}
                        <div className="bg-black/30 backdrop-blur-md rounded-xl border border-white/[0.05] p-4 max-w-xl">
                            <label className="text-[10px] text-text-faint uppercase tracking-[0.15em] font-semibold mb-2 block">
                                Your Unique Referral Link
                            </label>

                            {stats?.referralCode ? (
                                <>
                                    {/* Link display */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="flex-1 min-w-0 flex items-center gap-2 bg-white/[0.04] rounded-lg px-3 py-2.5 border border-white/[0.05]">
                                            <Link2 size={14} className="text-[#ff7a1a] shrink-0" />
                                            <span className="text-[#ff7a1a] font-mono text-sm truncate">{referralLink}</span>
                                        </div>
                                        <button
                                            onClick={copyLink}
                                            className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 flex items-center gap-2 shrink-0 ${linkCopied
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-brand-gold hover:bg-brand-gold-hover text-white shadow-lg shadow-orange-900/30'
                                                }`}
                                        >
                                            {linkCopied ? (
                                                <><CheckCircle2 size={16} /> Copied!</>
                                            ) : (
                                                <><Copy size={16} /> Copy</>
                                            )}
                                        </button>
                                    </div>

                                    {/* Code + actions row */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-3 py-1.5 border border-white/[0.05]">
                                            <span className="text-text-faint text-xs">Code:</span>
                                            <span className="text-white font-mono font-bold text-sm tracking-widest">{stats.referralCode}</span>
                                            <button onClick={copyCode} className={`p-1 rounded transition-colors ${copied ? 'text-green-400' : 'text-text-faint hover:text-white'}`}>
                                                {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => setShowQR(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.05] text-text-muted hover:text-white hover:bg-white/[0.08] transition-all text-xs"
                                        >
                                            <QrCode size={13} /> QR Code
                                        </button>

                                        <button
                                            onClick={shareWhatsApp}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all text-xs"
                                        >
                                            <Share2 size={13} /> WhatsApp
                                        </button>

                                        <button
                                            onClick={shareTwitter}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-gold/10 border border-brand-gold/20 text-brand-gold hover:bg-brand-gold/20 transition-all text-xs"
                                        >
                                            <Share2 size={13} /> Twitter/X
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <span className="text-text-faint text-sm italic">No referral link generated yet</span>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={generating}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/30"
                                    >
                                        {generating ? (
                                            <><Loader2 size={16} className="animate-spin" /> Generating...</>
                                        ) : (
                                            <><Zap size={16} /> Generate Link</>
                                        )}
                                    </button>
                                </div>
                            )}

                            {error && (
                                <p className="mt-2 text-danger text-xs flex items-center gap-1">
                                    ⚠️ {error}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── Stats Grid ─── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                        icon={Users}
                        label="Friends Invited"
                        value={String(stats?.totalInvited ?? 0)}
                        sub={stats?.totalInvited === 1 ? '1 active referral' : `${stats?.totalInvited ?? 0} active referrals`}
                        iconBg="bg-brand-gold/10"
                        iconColor="text-brand-gold"
                    />
                    <StatCard
                        icon={DollarSign}
                        label="Total Earned"
                        value={`${fiatSymbol}${(stats?.totalEarnings ?? 0).toFixed(2)}`}
                        sub="Credited to wallet"
                        iconBg="bg-green-500/10"
                        iconColor="text-green-400"
                        highlight
                    />
                    <StatCard
                        icon={Clock}
                        label="Pending Earnings"
                        value={`${fiatSymbol}${(stats?.pendingEarnings ?? 0).toFixed(2)}`}
                        sub="Processing now"
                        iconBg="bg-warning-alpha-08"
                        iconColor="text-warning-bright"
                    />
                </div>

                {/* ─── How It Works ─── */}
                <div className="bg-bg-deep rounded-2xl border border-white/[0.04] p-6">
                    <h2 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                        <TrendingUp size={18} className="text-[#ff7a1a]" />
                        How It Works
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
                        <StepCard
                            step="1"
                            icon={Share2}
                            title="Share Your Link"
                            desc="Copy your unique referral link and share it via WhatsApp, social media, or directly with friends."
                            color="bg-brand-gold/10 text-[#ff7a1a]"
                        />
                        <StepCard
                            step="2"
                            icon={Users}
                            title="Friends Sign Up"
                            desc="Your friends register using your link or code. They get a bonus, and you're linked as their referrer."
                            color="bg-brand-gold/10 text-brand-gold"
                        />
                        <StepCard
                            step="3"
                            icon={Award}
                            title="You Earn Rewards"
                            desc="Automatically receive bonuses when your friends deposit or place bets. No limits on earnings!"
                            color="bg-green-500/10 text-green-400"
                        />
                    </div>
                </div>

                {/* ─── Recent Referrals Table ─── */}
                <div className="bg-bg-deep rounded-2xl border border-white/[0.04] overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
                        <h2 className="text-white font-bold text-lg flex items-center gap-2">
                            <Users size={18} className="text-[#ff7a1a]" />
                            My Referrals
                            {(stats?.totalInvited ?? 0) > 0 && (
                                <span className="ml-1 px-2 py-0.5 rounded-full bg-brand-gold/15 text-[#ff7a1a] text-xs font-bold">
                                    {stats?.totalInvited}
                                </span>
                            )}
                        </h2>
                    </div>

                    {stats?.recentReferrals && stats.recentReferrals.length > 0 ? (
                        <div className="divide-y divide-white/[0.04]">
                            {/* Header */}
                            <div className="grid grid-cols-12 px-6 py-3 text-[10px] text-text-faint uppercase tracking-wider font-semibold">
                                <div className="col-span-5">User</div>
                                <div className="col-span-3">Joined</div>
                                <div className="col-span-2 text-right">Earned</div>
                                <div className="col-span-2 text-right">Status</div>
                            </div>
                            {stats.recentReferrals.map((ref) => (
                                <div
                                    key={ref.id}
                                    className="grid grid-cols-12 items-center px-6 py-4 hover:bg-white/[0.02] transition-colors group"
                                >
                                    {/* Avatar + Name */}
                                    <div className="col-span-5 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff7a1a]/30 to-[#ff7a1a]/10 flex items-center justify-center text-[#ff7a1a] font-bold text-sm shrink-0 border border-[#ff7a1a]/20">
                                            {ref.username?.substring(0, 2).toUpperCase() || '??'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white font-medium text-sm truncate">{ref.username}</p>
                                            <p className="text-text-faint text-xs">{getEventLabel(ref.rewardType)}</p>
                                        </div>
                                    </div>

                                    {/* Date */}
                                    <div className="col-span-3">
                                        <p className="text-text-muted text-sm">{timeAgo(ref.createdAt)}</p>
                                        <p className="text-text-faint text-xs">{formatDate(ref.createdAt)}</p>
                                    </div>

                                    {/* Earned */}
                                    <div className="col-span-2 text-right">
                                        <p className={`font-bold text-sm ${ref.totalEarned > 0 ? 'text-green-400' : 'text-text-faint'}`}>
                                            {ref.totalEarned > 0 ? `+${fiatSymbol}${ref.totalEarned.toFixed(2)}` : '—'}
                                        </p>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2 text-right">
                                        <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20">
                                            Active
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-16 text-center">
                            <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                                <Users size={28} className="text-text-faint" />
                            </div>
                            <p className="text-text-muted font-medium mb-1">No referrals yet</p>
                            <p className="text-text-faint text-sm">Share your link to start earning!</p>
                            {stats?.referralCode && (
                                <button
                                    onClick={copyLink}
                                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold/10 text-[#ff7a1a] hover:bg-brand-gold/20 transition-colors text-sm font-medium border border-[#ff7a1a]/20"
                                >
                                    <Copy size={14} />
                                    Copy Referral Link
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── Reward History Table ─── */}
                {stats?.recentHistory && stats.recentHistory.length > 0 && (
                    <div className="bg-bg-deep rounded-2xl border border-white/[0.04] overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
                            <h2 className="text-white font-bold text-lg flex items-center gap-2">
                                <Award size={18} className="text-[#ff7a1a]" />
                                Reward History
                            </h2>
                        </div>

                        <div className="divide-y divide-white/[0.04]">
                            {/* Header */}
                            <div className="grid grid-cols-12 px-6 py-3 text-[10px] text-text-faint uppercase tracking-wider font-semibold">
                                <div className="col-span-4">Referee</div>
                                <div className="col-span-3">Reward</div>
                                <div className="col-span-2">Date</div>
                                <div className="col-span-2 text-right">Amount</div>
                                <div className="col-span-1 text-right">Status</div>
                            </div>
                            {stats.recentHistory.map((item: ReferralHistoryItem) => (
                                <div
                                    key={item.id}
                                    className="grid grid-cols-12 items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors"
                                >
                                    <div className="col-span-4">
                                        <p className="text-white text-sm font-medium">{item.refereeUsername}</p>
                                    </div>
                                    <div className="col-span-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getEventColor(item.eventType)}`}>
                                            {getEventLabel(item.eventType)}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-text-muted text-xs">{formatDate(item.createdAt)}</p>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <p className="text-green-400 font-bold text-sm">+{fiatSymbol}{item.amount.toFixed(2)}</p>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <span className={`inline-block w-2 h-2 rounded-full ${item.status === 'COMPLETED' ? 'bg-green-400' :
                                            item.status === 'PENDING' ? 'bg-amber-400' : 'bg-red-400'
                                            }`} title={item.status} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Benefits CTA ─── */}
                <div className="relative overflow-hidden rounded-2xl border border-[#ff7a1a]/15 bg-gradient-to-br from-[#100C08] via-[#0F1016] to-[#0C0D12] p-6 md:p-8">
                    <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none">
                        <Gift size={250} />
                    </div>
                    <div className="relative z-10 max-w-lg">
                        <h3 className="text-white font-bold text-xl mb-3">Why Refer Friends?</h3>
                        <ul className="space-y-2.5 mb-6">
                            {[
                                { icon: DollarSign, text: 'Earn cash rewards for each successful referral — no cap on earnings' },
                                { icon: TrendingUp, text: 'Track every sign-up, deposit, and earned bonus in real-time' },
                                { icon: Zap, text: 'Instant reward credit to your wallet as soon as conditions are met' },
                            ].map(({ icon: Icon, text }, i) => (
                                <li key={i} className="flex items-start gap-3 text-text-secondary text-sm">
                                    <div className="w-5 h-5 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0 mt-0.5">
                                        <Icon size={10} className="text-[#ff7a1a]" />
                                    </div>
                                    {text}
                                </li>
                            ))}
                        </ul>
                        {stats?.referralCode ? (
                            <button
                                onClick={copyLink}
                                className="inline-flex items-center gap-2 bg-brand-gold hover:bg-brand-gold-hover text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-orange-900/30 text-sm"
                            >
                                <Copy size={15} />
                                {linkCopied ? 'Link Copied!' : 'Copy Referral Link'}
                                <ChevronRight size={15} />
                            </button>
                        ) : (
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="inline-flex items-center gap-2 bg-brand-gold hover:bg-brand-gold-hover text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-orange-900/30 text-sm disabled:opacity-50"
                            >
                                {generating ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                                {generating ? 'Generating...' : 'Generate My Link'}
                                <ArrowUpRight size={15} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
