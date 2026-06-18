"use client";

import React, { useState, Suspense, useEffect } from 'react';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import Footer from '@/components/layout/Footer';
import { vipApi, VipApplyDto, VipApplicationStatus, VipStatus } from '@/services/vip';
import { useAuth } from '@/context/AuthContext';

import { ChevronDown, ChevronUp, ArrowRight, Zap, RotateCcw, Gamepad2, Trophy, Wallet, Star, HeartHandshake, Headphones, Shield, Users, Layers, Check, Loader2, Clock, BadgeCheck, XCircle, AlertCircle, Send, Crown, Gem, Award, Diamond, Lock, Unlock, TrendingUp, Gift, Sparkles, X } from 'lucide-react';

// ─── TIER ICON COMPONENT ────────────────────────────────────────────────────────
const TIER_ICONS: Record<string, React.ElementType> = {
    SILVER: Award,
    GOLD: Crown,
    PLATINUM: Gem,
    DIAMOND: Diamond,
};

const TIER_META: Record<string, { name: string; color: string; glow: string; bgFrom: string; bgTo: string; borderColor: string; iconBg: string }> = {
    SILVER:   { name: 'Silver',   color: '#94A3B8', glow: 'shadow-slate-400/20',   bgFrom: 'from-slate-500/8',   bgTo: 'to-slate-600/3',   borderColor: 'border-slate-400/15', iconBg: 'bg-gradient-to-br from-slate-300/20 to-slate-500/10' },
    GOLD:     { name: 'Gold',     color: '#8B5CF6', glow: 'shadow-amber-400/25',   bgFrom: 'from-amber-500/8',   bgTo: 'to-amber-600/3',   borderColor: 'border-amber-400/15', iconBg: 'bg-gradient-to-br from-amber-300/20 to-amber-500/10' },
    PLATINUM: { name: 'Platinum', color: '#8B5CF6', glow: 'shadow-purple-400/25',  bgFrom: 'from-purple-500/8',  bgTo: 'to-purple-600/3',  borderColor: 'border-purple-400/15', iconBg: 'bg-gradient-to-br from-purple-300/20 to-purple-500/10' },
    DIAMOND:  { name: 'Diamond',  color: '#3B82F6', glow: 'shadow-blue-400/30',    bgFrom: 'from-blue-500/8',    bgTo: 'to-blue-600/3',    borderColor: 'border-blue-400/15', iconBg: 'bg-gradient-to-br from-blue-300/20 to-blue-500/10' },
};

// ─── VIP PERKS DATA ────────────────────────────────────────────────────────────
const VIP_PERKS = [
    { icon: Zap, color: 'from-yellow-500/20 to-orange-500/10', iconColor: 'text-yellow-400', title: 'Instant Lossback', description: 'Earn rewards back instantly as you play — no waiting, no conditions.' },
    { icon: RotateCcw, color: 'from-blue-500/20 to-blue-600/10', iconColor: 'text-brand-gold', title: 'Reload Bonuses', description: 'Receive rewards every day — the more you play, the higher you climb.' },
    { icon: Gamepad2, color: 'from-purple-500/20 to-purple-600/10', iconColor: 'text-accent-purple', title: 'Gameplay Bonuses', description: 'Play across different game types to unlock richer, exclusive rewards.' },
    { icon: Trophy, color: 'from-amber-500/20 to-amber-600/10', iconColor: 'text-warning-bright', title: 'Top Player Bonuses', description: 'Play at the top to unlock exclusive high-roller rewards and recognition.' },
    { icon: Wallet, color: 'from-success-primary/20 to-success-primary/10', iconColor: 'text-success-bright', title: 'Fee-Free D & W', description: 'All deposits and withdrawals are completely fee-free — fiat and crypto.' },
    { icon: Star, color: 'from-pink-500/20 to-pink-600/10', iconColor: 'text-pink-400', title: 'IRL VIP Events & Rewards', description: 'Exclusive real-world VIP experiences — events, gifts, and beyond.' },
    { icon: Headphones, color: 'from-teal-500/20 to-teal-600/10', iconColor: 'text-teal-400', title: 'Dedicated VIP Host', description: 'Personalised support whenever you need it, available around the clock.' },
];

const FAQS = {
    General: [
        { q: 'How do I become a VIP?', a: 'VIP status is invitation-based. We monitor consistent play and loyalty across all our platforms. If you qualify, our VIP team will reach out to you directly via email or in-platform notification.' },
        { q: 'What is the VIP Transfer?', a: 'If you hold VIP status at another premium gaming platform, you can transfer your status to Zeero instantly and unlock premium perks without having to start from scratch.' },
        { q: 'What makes the Zeero VIP Club different from others?', a: 'Our VIP program is truly personalised. There are no fixed levels or wagering ladders — we evaluate your activity holistically and tailor rewards that make a real difference, including real-world experiences.' },
        { q: 'Is there a minimum level required to apply?', a: 'No. Any player on Zeero can be considered for VIP status. We look at responsible, consistent gameplay rather than highest bets or fixed wager targets.' },
    ],
    Benefits: [
        { q: 'What is Instant Lossback?', a: 'Instant Lossback is a real-time reward that returns a percentage of net losses directly to your wallet as you play — not the next day, instantly.' },
        { q: 'How do Reload Bonuses work?', a: 'VIP members receive ongoing reload bonuses that grow as your activity and loyalty increase. These are credited regularly to your account, no deposit code required.' },
        { q: 'What are IRL VIP Events?', a: 'Real-world events exclusively for Zeero VIP members — sporting events, hospitality experiences, exclusive dinners, and merchandise gifts curated by our VIP team.' },
        { q: 'Are there truly no withdrawal fees for VIPs?', a: 'Yes — all deposits and withdrawals for VIP members are completely fee-free. This applies to all fiat payment methods and all supported cryptocurrencies.' },
    ],
};

// ─── FAQ Accordion ──────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className={`border rounded-xl transition-all duration-200 cursor-pointer ${open ? 'border-brand-gold/30 bg-bg-elevated' : 'border-white/[0.04] bg-bg-elevated/60 hover:border-white/[0.1]'}`} onClick={() => setOpen(!open)}>
            <div className="flex items-center justify-between p-4 gap-3">
                <span className={`font-bold text-sm md:text-base ${open ? 'text-brand-gold' : 'text-text-primary'}`}>{q}</span>
                {open ? <ChevronUp size={18} className="text-brand-gold flex-shrink-0" /> : <ChevronDown size={18} className="text-text-muted flex-shrink-0" />}
            </div>
            {open && <div className="px-4 pb-4 text-text-secondary text-sm leading-relaxed border-t border-white/[0.04] pt-3">{a}</div>}
        </div>
    );
}

// ─── Application Status Badge ────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { icon: any; label: string; color: string; bg: string }> = {
        PENDING: { icon: Clock, label: 'Application Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
        UNDER_REVIEW: { icon: AlertCircle, label: 'Under Review', color: 'text-brand-gold', bg: 'bg-brand-gold/10 border-brand-gold/20' },
        APPROVED: { icon: BadgeCheck, label: 'VIP Approved!', color: 'text-success-bright', bg: 'bg-success-alpha-10 border-success-primary/20' },
        REJECTED: { icon: XCircle, label: 'Application Declined', color: 'text-danger', bg: 'bg-danger-alpha-10 border-danger/20' },
        TRANSFER_REQUESTED: { icon: ArrowRight, label: 'Transfer Requested', color: 'text-accent-purple', bg: 'bg-purple-500/10 border-purple-500/20' },
    };
    const c = config[status] || config['PENDING'];
    const Icon = c.icon;
    return (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${c.bg}`}>
            <Icon size={16} className={c.color} />
            <span className={`font-bold text-sm ${c.color}`}>{c.label}</span>
        </div>
    );
}

// ─── VIP Member Dashboard ──────────────────────────────────────────────────────
function VipDashboard({ vipStatus }: { vipStatus: VipStatus }) {
    const meta = TIER_META[vipStatus.tier] || TIER_META['SILVER'];
    const TierIcon = TIER_ICONS[vipStatus.tier] || Award;
    const tier = vipStatus.tierConfig;

    return (
        <div className="px-4 md:px-8 lg:px-12 pb-8">
            <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${meta.bgFrom} ${meta.bgTo} border ${meta.borderColor} p-6 md:p-8 max-w-6xl mx-auto`}
                style={{ boxShadow: `0 8px 40px -8px ${meta.color}15, 0 0 0 1px ${meta.color}08` }}>
                {/* 3D glow orbs */}
                <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full blur-[80px] pointer-events-none" style={{ backgroundColor: meta.color + '12' }} />
                <div className="absolute -left-10 -bottom-10 w-32 h-32 rounded-full blur-[60px] pointer-events-none" style={{ backgroundColor: meta.color + '08' }} />

                <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
                    {/* 3D Tier icon */}
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl ${meta.iconBg} border ${meta.borderColor} flex items-center justify-center relative`}
                            style={{ boxShadow: `0 8px 24px -4px ${meta.color}25, inset 0 1px 0 ${meta.color}15` }}>
                            <TierIcon size={30} style={{ color: meta.color }} strokeWidth={1.8} />
                            <div className="absolute inset-0 rounded-2xl" style={{ background: `linear-gradient(135deg, ${meta.color}08, transparent 60%)` }} />
                        </div>
                        <div>
                            <p className="text-text-muted text-xs font-bold uppercase tracking-widest">Your VIP Tier</p>
                            <h2 className="text-2xl md:text-3xl font-black" style={{ color: meta.color }}>{meta.name}</h2>
                        </div>
                    </div>

                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 md:ml-auto">
                        {tier && (
                            <>
                                <div className="text-center bg-white/[0.03] rounded-xl p-3 border border-white/[0.04]"
                                    style={{ boxShadow: `0 2px 8px ${meta.color}06` }}>
                                    <div className="text-xl font-black" style={{ color: meta.color }}>{tier.lossbackPct}%</div>
                                    <div className="text-text-muted text-xs mt-0.5">Lossback</div>
                                </div>
                                <div className="text-center bg-white/[0.03] rounded-xl p-3 border border-white/[0.04]"
                                    style={{ boxShadow: `0 2px 8px ${meta.color}06` }}>
                                    <div className="text-xl font-black" style={{ color: meta.color }}>{tier.reloadBonusPct}%</div>
                                    <div className="text-text-muted text-xs mt-0.5">Reload Bonus</div>
                                </div>
                            </>
                        )}
                        <div className="text-center bg-white/[0.03] rounded-xl p-3 border border-white/[0.04]">
                            <div className="text-xl font-black text-text-primary">{(vipStatus.totalDeposited || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</div>
                            <div className="text-text-muted text-xs mt-0.5">Total Deposited</div>
                        </div>
                        <div className="text-center bg-white/[0.03] rounded-xl p-3 border border-white/[0.04]">
                            <div className="text-xl font-black text-text-primary">{(vipStatus.totalWagered || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</div>
                            <div className="text-text-muted text-xs mt-0.5">Total Wagered</div>
                        </div>
                    </div>
                </div>

                {tier && (
                    <div className="relative flex flex-wrap gap-2 mt-6">
                        {tier.freeWithdrawals && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-success-alpha-10 border border-success-primary/20 text-success-bright backdrop-blur-md">
                                <Check size={12} /> Free Withdrawals
                            </span>
                        )}
                        {tier.priorityWithdrawal && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-brand-gold/10 border border-brand-gold/20 text-brand-gold backdrop-blur-md">
                                <Zap size={12} /> Priority Withdrawal
                            </span>
                        )}
                        {tier.dedicatedHost && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400 backdrop-blur-md">
                                <Headphones size={12} /> Dedicated Host
                            </span>
                        )}
                    </div>
                )}

                {vipStatus.nextTier && (
                    <div className="relative mt-6 pt-5 border-t border-white/[0.04] flex items-center gap-3">
                        <TrendingUp size={16} className="text-brand-gold flex-shrink-0" />
                        <p className="text-text-muted text-sm">
                            <span className="text-text-primary font-bold">Next: {vipStatus.nextTier.name}</span> — {vipStatus.nextTier.lossbackPct}% lossback, {vipStatus.nextTier.reloadBonusPct}% reload bonus
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── 3D Tier Card ──────────────────────────────────────────────────────────────
function TierCard({ tierKey, isCurrent, isPast }: { tierKey: string; isCurrent: boolean; isPast: boolean }) {
    const meta = TIER_META[tierKey];
    const TierIcon = TIER_ICONS[tierKey];
    const tiers: Record<string, { lossback: string; reload: string; freeWd: boolean; priority: boolean; host: boolean; events: boolean }> = {
        SILVER:   { lossback: '5%',  reload: '2%',  freeWd: false, priority: false, host: false, events: false },
        GOLD:     { lossback: '10%', reload: '5%',  freeWd: true,  priority: true,  host: false, events: false },
        PLATINUM: { lossback: '15%', reload: '8%',  freeWd: true,  priority: true,  host: true,  events: true  },
        DIAMOND:  { lossback: '20%', reload: '12%', freeWd: true,  priority: true,  host: true,  events: true  },
    };
    const t = tiers[tierKey];

    return (
        <div className={`relative group rounded-2xl border transition-all duration-500 overflow-hidden
            ${isCurrent
                ? `${meta.borderColor} ring-2 scale-[1.02]`
                : isPast
                    ? 'border-white/[0.04] opacity-70'
                    : 'border-white/[0.04] hover:border-white/[0.06]'
            }`}
            style={isCurrent ? {
                boxShadow: `0 20px 60px -12px ${meta.color}20, 0 0 0 1px ${meta.color}15`,
            } : undefined}
        >
            {/* 3D card surface */}
            <div className={`relative bg-gradient-to-br ${meta.bgFrom} ${meta.bgTo} p-5 md:p-6`}>
                {/* Ambient light reflection */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent rounded-2xl pointer-events-none" />
                <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full blur-[50px] opacity-40 pointer-events-none" style={{ backgroundColor: meta.color }} />

                {/* Current tier indicator */}
                {isCurrent && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border backdrop-blur-md"
                        style={{ backgroundColor: meta.color + '15', borderColor: meta.color + '30', color: meta.color }}>
                        <BadgeCheck size={10} /> Current
                    </div>
                )}
                {isPast && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-text-muted bg-white/[0.04] border border-white/[0.04]">
                        <Check size={10} /> Achieved
                    </div>
                )}

                {/* Icon + Name */}
                <div className="relative flex flex-col items-center text-center mb-5">
                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl ${meta.iconBg} border ${meta.borderColor} flex items-center justify-center mb-3 transition-transform duration-500 group-hover:scale-110`}
                        style={{ boxShadow: `0 8px 24px -4px ${meta.color}20, inset 0 1px 0 ${meta.color}10` }}>
                        <TierIcon size={28} style={{ color: meta.color }} strokeWidth={1.8} />
                    </div>
                    <h3 className="text-lg md:text-xl font-black" style={{ color: meta.color }}>{meta.name}</h3>
                </div>

                {/* Benefits list */}
                <div className="relative space-y-2.5">
                    <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.04]">
                        <span className="text-text-muted text-xs font-medium flex items-center gap-1.5"><Zap size={11} className="opacity-50" /> Lossback</span>
                        <span className="text-text-primary text-sm font-black">{t.lossback}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.04]">
                        <span className="text-text-muted text-xs font-medium flex items-center gap-1.5"><Gift size={11} className="opacity-50" /> Reload Bonus</span>
                        <span className="text-text-primary text-sm font-black">{t.reload}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.04]">
                        <span className="text-text-muted text-xs font-medium flex items-center gap-1.5"><Wallet size={11} className="opacity-50" /> Free W/D</span>
                        {t.freeWd ? <Check size={14} className="text-success-bright" /> : <Lock size={12} className="text-text-muted/30" />}
                    </div>
                    <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.04]">
                        <span className="text-text-muted text-xs font-medium flex items-center gap-1.5"><Sparkles size={11} className="opacity-50" /> Priority</span>
                        {t.priority ? <Check size={14} className="text-success-bright" /> : <Lock size={12} className="text-text-muted/30" />}
                    </div>
                    <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.04]">
                        <span className="text-text-muted text-xs font-medium flex items-center gap-1.5"><Headphones size={11} className="opacity-50" /> VIP Host</span>
                        {t.host ? <Check size={14} className="text-success-bright" /> : <Lock size={12} className="text-text-muted/30" />}
                    </div>
                    <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.04]">
                        <span className="text-text-muted text-xs font-medium flex items-center gap-1.5"><Star size={11} className="opacity-50" /> IRL Events</span>
                        {t.events ? <Check size={14} className="text-success-bright" /> : <Lock size={12} className="text-text-muted/30" />}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Tier Progression Section ──────────────────────────────────────────────────
function TierProgression({ currentTier }: { currentTier?: string }) {
    const tierOrder = ['SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
    const currentIdx = currentTier ? tierOrder.indexOf(currentTier) : -1;

    return (
        <div className="px-4 md:px-8 lg:px-12 py-12">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-8">
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-gold mb-2">VIP Tiers</p>
                    <h2 className="text-2xl md:text-3xl font-black text-text-primary">
                        {currentTier && currentTier !== 'NONE'
                            ? <>You are at <span style={{ color: TIER_META[currentTier]?.color }}>{TIER_META[currentTier]?.name}</span> Level</>
                            : 'Unlock Exclusive VIP Levels'
                        }
                    </h2>
                    <p className="text-text-muted text-sm mt-2 max-w-lg mx-auto">
                        {currentTier && currentTier !== 'NONE'
                            ? 'Your tier is set by our VIP team based on your activity, deposits, and loyalty. Keep playing to unlock the next level.'
                            : 'Each tier is unlocked by our VIP team based on your stats and loyalty. Apply now and start your journey.'
                        }
                    </p>
                </div>

                {/* Progress bar — always visible */}
                <div className="flex items-start justify-between gap-0 mb-10 max-w-3xl mx-auto relative">
                    {/* Connecting line behind nodes */}
                    <div className="absolute top-6 left-[calc(12.5%)] right-[calc(12.5%)] h-[3px] bg-white/[0.06] rounded-full" />
                    <div className="absolute top-6 left-[calc(12.5%)] h-[3px] rounded-full transition-all duration-1000"
                        style={{
                            width: currentIdx >= 0 ? `${(currentIdx / (tierOrder.length - 1)) * 75}%` : '0%',
                            background: currentIdx >= 0 ? `linear-gradient(90deg, ${TIER_META[tierOrder[0]].color}80, ${TIER_META[tierOrder[Math.max(0, currentIdx)]].color}80)` : 'transparent',
                        }} />

                    {tierOrder.map((key, i) => {
                        const meta = TIER_META[key];
                        const TierIcon = TIER_ICONS[key];
                        const isActive = i <= currentIdx;
                        const isCurrent = key === currentTier;
                        return (
                            <div key={key} className="relative flex flex-col items-center flex-1">
                                {/* Crown above current tier */}
                                {isCurrent && (
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 animate-bounce" style={{ animationDuration: '2s' }}>
                                        <Crown size={18} style={{ color: meta.color }} fill={meta.color} strokeWidth={1.5} />
                                    </div>
                                )}

                                <div className={`relative z-10 w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${
                                    isCurrent
                                        ? `${meta.iconBg} scale-110`
                                        : isActive
                                            ? `${meta.iconBg} opacity-90`
                                            : 'bg-white/[0.03] border-white/[0.06] opacity-40'
                                }`}
                                    style={{
                                        borderColor: isActive ? meta.color + '40' : undefined,
                                        boxShadow: isCurrent ? `0 6px 24px -4px ${meta.color}35` : undefined,
                                    }}>
                                    <TierIcon size={20} style={{ color: isActive ? meta.color : undefined }} className={!isActive ? 'text-text-muted/30' : ''} strokeWidth={1.8} />
                                </div>

                                <span className={`text-[11px] font-bold mt-2.5 ${isCurrent ? '' : isActive ? 'text-text-secondary' : 'text-text-muted/30'}`}
                                    style={isCurrent ? { color: meta.color } : undefined}>
                                    {meta.name}
                                </span>

                                {/* Active dot */}
                                {isCurrent && (
                                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 animate-pulse" style={{ backgroundColor: meta.color }} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Tier cards grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {tierOrder.map(key => (
                        <TierCard
                            key={key}
                            tierKey={key}
                            isCurrent={key === currentTier}
                            isPast={currentIdx >= 0 && tierOrder.indexOf(key) < currentIdx}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Apply Modal ────────────────────────────────────────────────────────────────
function ApplyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (data: any) => void }) {
    const [form, setForm] = useState<VipApplyDto>({ message: '', currentPlatform: '', platformUsername: '', monthlyVolume: undefined });
    const [isTransfer, setIsTransfer] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const payload: VipApplyDto = {
                message: form.message || undefined,
                monthlyVolume: form.monthlyVolume || undefined,
            };
            if (isTransfer) {
                payload.currentPlatform = form.currentPlatform || undefined;
                payload.platformUsername = form.platformUsername || undefined;
            }
            const result = await vipApi.apply(payload);
            onSuccess(result);
        } catch (err: any) {
            const msg = err?.response?.data?.message;
            setError(typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join('. ') : 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-bg-elevated border border-white/[0.06] rounded-2xl w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-white/[0.04] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center"
                        style={{ boxShadow: '0 4px 12px -2px rgba(139,92,246,0.03)' }}>
                        <Star size={20} className="text-brand-gold fill-brand-gold" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-text-primary">Apply for VIP</h2>
                        <p className="text-text-muted text-xs">Our team reviews every application personally</p>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-bg-base/50 rounded-xl border border-white/[0.04] hover:border-brand-gold/20 transition-colors">
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${isTransfer ? 'bg-brand-gold' : 'bg-white/[0.08]'}`}>
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isTransfer ? 'left-6' : 'left-1'}`} />
                            <input type="checkbox" checked={isTransfer} onChange={e => setIsTransfer(e.target.checked)} className="sr-only" />
                        </div>
                        <div>
                            <span className="text-text-primary font-bold text-sm">I have VIP status elsewhere</span>
                            <p className="text-text-muted text-xs mt-0.5">Enable VIP Transfer</p>
                        </div>
                    </label>

                    {isTransfer && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-text-muted font-bold mb-1">Platform Name</label>
                                <input type="text" maxLength={100} value={form.currentPlatform} onChange={e => setForm({ ...form, currentPlatform: e.target.value })}
                                    placeholder="e.g. BC.Game" className="w-full bg-bg-base border border-white/[0.06] rounded-lg p-2.5 text-text-primary text-sm focus:border-brand-gold/50 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs text-text-muted font-bold mb-1">Your Username There</label>
                                <input type="text" maxLength={50} value={form.platformUsername} onChange={e => setForm({ ...form, platformUsername: e.target.value })}
                                    placeholder="@username" className="w-full bg-bg-base border border-white/[0.06] rounded-lg p-2.5 text-text-primary text-sm focus:border-brand-gold/50 outline-none" />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-text-muted font-bold mb-1">Monthly Wagering Volume -- optional</label>
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={form.monthlyVolume ?? ''} onChange={e => setForm({ ...form, monthlyVolume: e.target.value ? parseFloat(e.target.value.replace(/[^0-9.]/g, '')) : undefined })}
                            placeholder="e.g. 500000" className="w-full bg-bg-base border border-white/[0.06] rounded-lg p-2.5 text-text-primary text-sm focus:border-brand-gold/50 outline-none" />
                    </div>

                    <div>
                        <label className="block text-xs text-text-muted font-bold mb-1">Why do you want VIP? -- optional</label>
                        <textarea rows={3} maxLength={1000} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                            placeholder="Tell us about your gaming habits..."
                            className="w-full bg-bg-base border border-white/[0.06] rounded-lg p-2.5 text-text-primary text-sm focus:border-brand-gold/50 outline-none resize-none" />
                        <p className="text-right text-xs text-text-muted mt-0.5">{(form.message || '').length}/1000</p>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 bg-danger-alpha-10 border border-danger/20 rounded-lg p-3">
                            <XCircle size={16} className="text-danger flex-shrink-0 mt-0.5" />
                            <p className="text-danger text-sm">{error}</p>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-white/[0.04] flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl font-bold text-text-muted text-sm transition-colors">Cancel</button>
                    <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-60 text-text-inverse rounded-xl font-black text-sm uppercase tracking-wide transition-all duration-200 hover:scale-[1.02]">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {loading ? 'Submitting...' : 'Submit Application'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────
function VIPContent() {
    const [faqTab, setFaqTab] = useState<'General' | 'Benefits'>('General');
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [application, setApplication] = useState<VipApplicationStatus | null | undefined>(undefined);
    const [vipStatus, setVipStatus] = useState<VipStatus | null>(null);
    const { user, isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            vipApi.getMyApplication().then(app => setApplication(app));
            vipApi.getMyVipStatus().then(status => setVipStatus(status));
        } else {
            setApplication(null);
            setVipStatus(null);
        }
    }, [isAuthenticated]);

    const handleApplySuccess = (data: any) => {
        setShowApplyModal(false);
        setShowTransferModal(false);
        setApplication({ ...data, message: '', createdAt: data.createdAt, updatedAt: data.createdAt });
    };

    const canApply = !application || application.status === 'REJECTED';
    const hasActiveApplication = application && !['REJECTED'].includes(application.status);
    const isVipMember = vipStatus && vipStatus.tier !== 'NONE';

    return (
        <div className="h-screen overflow-hidden bg-bg-base flex flex-col">
            <Header />
            <div className="flex flex-1 overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
                <LeftSidebar />
                <main className="flex-1 min-w-0 bg-bg-base overflow-y-auto overflow-x-hidden flex flex-col">

                    {/* HERO */}
                    <div className="relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(139,92,246,0.18),_transparent_60%)]" />
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(123,92,214,0.12),_transparent_60%)]" />
                        <div className="absolute -right-20 top-10 w-80 h-80 rounded-full bg-brand-gold/5 blur-3xl pointer-events-none" />
                        {/* 3D floating orbs */}
                        <div className="absolute left-1/4 top-1/3 w-3 h-3 rounded-full bg-brand-gold/20 blur-sm animate-pulse pointer-events-none" />
                        <div className="absolute right-1/3 bottom-1/4 w-2 h-2 rounded-full bg-purple-400/20 blur-sm animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />

                        <div className="relative px-4 md:px-8 lg:px-12 pt-10 pb-14 md:pt-16 md:pb-20">
                          <div className="max-w-6xl mx-auto">
                            <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/30 rounded-full px-4 py-1.5 mb-5 backdrop-blur-md"
                                style={{ boxShadow: '0 2px 12px -2px rgba(139,92,246,0.02)' }}>
                                <Crown size={14} className="text-brand-gold" />
                                <span className="text-brand-gold text-xs font-bold uppercase tracking-widest">Zeero VIP Club</span>
                            </div>

                            <div className="max-w-3xl">
                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-text-primary leading-tight mb-3">
                                    Only <span className="text-gradient-gold">Zeero</span> Defines
                                    <br /><span className="text-white">True VIP</span>
                                </h1>
                                <p className="text-text-secondary text-base md:text-lg leading-relaxed max-w-2xl mb-8">
                                    Have VIP status elsewhere? Transfer it and unlock premium perks instantly. Our VIP program is personal, transparent, and built to reward real players.
                                </p>

                                {hasActiveApplication && application && (
                                    <div className="mb-6 p-4 bg-bg-elevated/80 backdrop-blur-md border border-white/[0.06] rounded-2xl inline-flex flex-col gap-2"
                                        style={{ boxShadow: '0 8px 32px -8px rgba(0,0,0,0.3)' }}>
                                        <p className="text-text-muted text-xs font-bold uppercase tracking-wider">Your Application</p>
                                        <StatusBadge status={application.status} />
                                        {application.status === 'APPROVED' && application.assignedTier && (
                                            <p className="text-success-bright text-xs mt-1 flex items-center gap-1.5">
                                                <BadgeCheck size={14} /> Assigned to <strong>{TIER_META[application.assignedTier]?.name || application.assignedTier}</strong> tier
                                            </p>
                                        )}
                                        {application.status === 'UNDER_REVIEW' && (
                                            <p className="text-text-muted text-xs mt-1">Our team is reviewing your application. We'll update you soon.</p>
                                        )}
                                        {application.reviewNotes && application.status === 'REJECTED' && (
                                            <p className="text-text-muted text-xs mt-1 italic">{application.reviewNotes}</p>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-3">
                                    {!isAuthenticated ? (
                                        <button onClick={() => window.location.href = '/auth/login'}
                                            className="flex items-center gap-2 bg-brand-gold hover:bg-brand-gold-hover text-text-inverse font-black px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 text-sm uppercase tracking-wide"
                                            style={{ boxShadow: '0 4px 16px -4px rgba(139,92,246,0.06)' }}>
                                            Login to Apply <ArrowRight size={16} />
                                        </button>
                                    ) : canApply ? (
                                        <button onClick={() => setShowApplyModal(true)}
                                            className="flex items-center gap-2 bg-brand-gold hover:bg-brand-gold-hover text-text-inverse font-black px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 text-sm uppercase tracking-wide"
                                            style={{ boxShadow: '0 4px 16px -4px rgba(139,92,246,0.06)' }}>
                                            {application?.status === 'REJECTED' ? 'Re-Apply for VIP' : 'Apply for VIP'} <ArrowRight size={16} />
                                        </button>
                                    ) : null}
                                    {canApply && (
                                        <button onClick={() => { setShowTransferModal(true); setShowApplyModal(true); }}
                                            className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-brand-gold/30 text-text-primary font-bold px-6 py-3 rounded-xl transition-all duration-200 text-sm uppercase tracking-wide backdrop-blur-md">
                                            Transfer VIP Status
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-12 grid grid-cols-3 gap-4 max-w-lg">
                                {[
                                    { icon: Users, label: 'Active VIPs', value: '10,000+' },
                                    { icon: Zap, label: 'Max Lossback', value: 'Up to 20%' },
                                    { icon: Headphones, label: 'Support', value: '24 / 7' },
                                ].map(s => {
                                    const StatIcon = s.icon;
                                    return (
                                        <div key={s.label} className="text-center">
                                            <StatIcon size={16} className="text-brand-gold mx-auto mb-1.5 opacity-60" />
                                            <div className="text-xl md:text-2xl font-black text-brand-gold">{s.value}</div>
                                            <div className="text-xs text-text-muted mt-0.5">{s.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                          </div>
                        </div>
                    </div>

                    {/* VIP MEMBER DASHBOARD */}
                    {isVipMember && vipStatus && <VipDashboard vipStatus={vipStatus} />}

                    {/* TIER PROGRESSION */}
                    <TierProgression currentTier={isVipMember ? vipStatus?.tier : undefined} />

                    {/* PERKS */}
                    <div className="px-4 md:px-8 lg:px-12 py-12">
                      <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-10">
                            <p className="text-xs font-bold uppercase tracking-widest text-brand-gold mb-2">Exclusive Benefits</p>
                            <h2 className="text-2xl md:text-3xl font-black text-text-primary">Experience Premium VIP Rewards</h2>
                            <p className="text-text-muted text-sm mt-2 max-w-md mx-auto">Every reward is crafted to make your experience richer, faster, and more personal.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {VIP_PERKS.map((perk) => {
                                const Icon = perk.icon;
                                return (
                                    <div key={perk.title} className="group relative bg-bg-elevated border border-white/[0.04] hover:border-brand-gold/20 rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02]"
                                        style={{ boxShadow: '0 4px 24px -8px rgba(0,0,0,0.15)' }}>
                                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${perk.color} border border-white/[0.04] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 relative`}
                                            style={{ boxShadow: '0 4px 12px -2px rgba(0,0,0,0.15)' }}>
                                            <Icon size={22} className={perk.iconColor} />
                                        </div>
                                        <h3 className="font-black text-text-primary text-sm md:text-base mb-1.5 relative">{perk.title}</h3>
                                        <p className="text-text-muted text-xs leading-relaxed relative">{perk.description}</p>
                                    </div>
                                );
                            })}
                            <div className="relative bg-bg-elevated/40 border border-dashed border-brand-gold/20 rounded-2xl p-5 flex flex-col items-center justify-center text-center min-h-[140px]">
                                <div className="w-11 h-11 rounded-xl bg-brand-gold/5 border border-brand-gold/20 flex items-center justify-center mb-3">
                                    <Sparkles size={20} className="text-brand-gold" />
                                </div>
                                <p className="font-black text-brand-gold text-sm">More perks are coming...</p>
                                <p className="text-text-muted text-xs mt-1">Your VIP journey keeps getting better</p>
                            </div>
                        </div>
                      </div>
                    </div>

                    {/* TRANSFER BANNER */}
                    <div className="px-4 md:px-8 lg:px-12 pb-12">
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-gold/20 via-amber-600/10 to-bg-elevated border border-brand-gold/20 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 max-w-6xl mx-auto"
                            style={{ boxShadow: '0 8px 40px -12px rgba(139,92,246,0.025)' }}>
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_rgba(139,92,246,0.025),_transparent_70%)]" />
                            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center relative"
                                style={{ boxShadow: '0 4px 20px -4px rgba(139,92,246,0.04)' }}>
                                <Shield size={28} className="text-brand-gold" />
                            </div>
                            <div className="flex-1 relative">
                                <h3 className="text-lg md:text-xl font-black text-text-primary mb-1">VIP Transfer Available</h3>
                                <p className="text-text-secondary text-sm max-w-xl">Already a VIP somewhere else? Transfer your status to Zeero instantly. Contact our VIP team with proof of your current status and unlock premium perks immediately.</p>
                            </div>
                            {canApply ? (
                                <button onClick={() => { setShowApplyModal(true); setShowTransferModal(true); }}
                                    className="flex-shrink-0 flex items-center gap-2 bg-brand-gold hover:bg-brand-gold-hover text-text-inverse font-bold px-5 py-2.5 rounded-xl text-sm uppercase tracking-wide transition-all duration-200 hover:scale-105 relative"
                                    style={{ boxShadow: '0 4px 16px -4px rgba(139,92,246,0.06)' }}>
                                    Start Transfer <ArrowRight size={14} />
                                </button>
                            ) : (
                                <div className="flex-shrink-0 relative"><StatusBadge status={application?.status || 'PENDING'} /></div>
                            )}
                        </div>
                    </div>

                    {/* QUALIFICATIONS */}
                    <div className="px-4 md:px-8 lg:px-12 py-12 bg-bg-elevated/30">
                      <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-10">
                            <p className="text-xs font-bold uppercase tracking-widest text-brand-gold mb-2">Eligibility</p>
                            <h2 className="text-2xl md:text-3xl font-black text-text-primary">Play and Engage for VIP Access</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { icon: Users, color: 'text-brand-gold', bgColor: '#3B82F6', bg: 'from-blue-500/15 to-blue-600/5', title: 'Activity', description: 'Consistent and responsible gameplay helps you stand out as a valued player. We watch patterns, not just totals.', bullet: 'Regular, responsible play' },
                                { icon: HeartHandshake, color: 'text-brand-gold', bgColor: '#8B5CF6', bg: 'from-amber-500/15 to-amber-600/5', title: 'Loyalty', description: 'Stable and ongoing loyalty to Zeero increases your chance of unlocking VIP service and exclusive personal support.', bullet: 'Long-term engagement' },
                                { icon: Layers, color: 'text-success-bright', bgColor: '#10B981', bg: 'from-success-primary/15 to-success-soft', title: 'No Barriers', description: 'No fixed level or specific game requirements — every player has the opportunity to qualify for VIP regardless of what they play.', bullet: 'Open to all players' },
                            ].map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.title} className="relative bg-bg-elevated border border-white/[0.04] rounded-2xl p-6 text-center hover:border-white/[0.1] transition-all duration-300"
                                        style={{ boxShadow: '0 4px 24px -8px rgba(0,0,0,0.15)' }}>
                                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.bg} border border-white/[0.04] flex items-center justify-center mx-auto mb-4 relative`}
                                            style={{ boxShadow: `0 6px 16px -4px ${item.bgColor}15` }}>
                                            <Icon size={26} className={item.color} />
                                        </div>
                                        <h3 className="font-black text-text-primary text-lg mb-2 relative">{item.title}</h3>
                                        <p className="text-text-muted text-sm leading-relaxed mb-4 relative">{item.description}</p>
                                        <div className="inline-flex items-center gap-1.5 bg-white/[0.04] rounded-full px-3 py-1 relative">
                                            <Check size={12} className={item.color} />
                                            <span className="text-xs text-text-secondary font-medium">{item.bullet}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                      </div>
                    </div>

                    {/* FAQ */}
                    <div className="px-4 md:px-8 lg:px-12 py-12">
                        <div className="max-w-6xl mx-auto">
                            <div className="text-center mb-8">
                                <p className="text-xs font-bold uppercase tracking-widest text-brand-gold mb-2">Got Questions?</p>
                                <h2 className="text-2xl md:text-3xl font-black text-text-primary">Frequently Asked Questions</h2>
                            </div>
                            <div className="flex gap-2 p-1 bg-bg-elevated rounded-xl border border-white/[0.04] mb-6 w-fit mx-auto">
                                {(['General', 'Benefits'] as const).map(tab => (
                                    <button key={tab} onClick={() => setFaqTab(tab)} className={`px-5 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${faqTab === tab ? 'bg-brand-gold text-text-inverse shadow' : 'text-text-muted hover:text-text-secondary'}`}>
                                        {tab}
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-3">
                                {FAQS[faqTab].map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
                            </div>
                            <div className="mt-8 text-center p-6 bg-bg-elevated/40 rounded-2xl border border-white/[0.04]">
                                <p className="text-text-secondary text-sm mb-3">Still have questions about VIP?</p>
                                <button className="flex items-center gap-2 bg-brand-gold/10 hover:bg-brand-gold/20 border border-brand-gold/30 text-brand-gold font-bold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 mx-auto">
                                    <Headphones size={16} /> Contact VIP Support
                                </button>
                            </div>
                        </div>
                    </div>

                    <Footer />
                </main>
            </div>

            {showApplyModal && (
                <ApplyModal
                    onClose={() => { setShowApplyModal(false); setShowTransferModal(false); }}
                    onSuccess={handleApplySuccess}
                />
            )}
        </div>
    );
}

export default function VIPPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-bg-base flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold" /></div>}>
            <VIPContent />
        </Suspense>
    );
}
