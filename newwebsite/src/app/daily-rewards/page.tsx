"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/context/WalletContext';
import { useModal } from '@/context/ModalContext';
import api from '@/services/api';
import Lottie from 'lottie-react';
import {
    Gift, Zap, Diamond, Flame, Star, Trophy, Crown, Target,
    Sparkles, Clock, TrendingUp, Users, Lock, ChevronRight,
    BarChart3, History, Award, Coins, Rocket, ShieldCheck,
    Timer, Medal, ArrowUpRight, CircleDollarSign, Percent,
} from 'lucide-react';

// ─── Lottie URLs ─────────────────────────────────────────────────────────────
const CONFETTI_URL = "https://assets9.lottiefiles.com/packages/lf20_u4yrau.json";
const FIRE_URL = "https://assets9.lottiefiles.com/packages/lf20_xlkxtmul.json";
const COIN_URL = "https://assets9.lottiefiles.com/packages/lf20_vnikge3g.json";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DayReward { day: number; reward: number; currency: string; claimed: boolean; isCurrent: boolean; }
interface Achievement { id: string; name: string; description: string; icon: string; streakRequired?: number; totalEarnedRequired?: number; reward: number; }
interface SpinSlice { label: string; value: number; color: string; probability: number; }
interface UserStatus {
    streak: number; canClaimToday: boolean; cycleDay: number; rewards: DayReward[];
    totalEarned: number; lastClaimDate: string | null; unlockedAchievements: string[];
    countdownMs: number;
    config: {
        cycleDays: number; currency: string; spinWheelEnabled: boolean; spinWheelSlices: SpinSlice[];
        vipMultiplierEnabled: boolean; luckyJackpotEnabled: boolean;
        weeklyMegaRewardEnabled: boolean; weeklyMegaStreakRequired: number;
        monthlyGrandPrizeEnabled: boolean; monthlyGrandPrizeStreakRequired: number;
        achievementsEnabled: boolean; achievements: Achievement[];
        leaderboardEnabled: boolean; referralBonusEnabled: boolean;
        faqs: { q: string; a: string }[];
    };
}
interface ClaimResult {
    success: boolean; reward: number; baseReward: number; vipMultiplier: number;
    milestoneMultiplier: number; referralBonus: number; jackpotAmount: number;
    weeklyMegaClaimed: boolean; weeklyMegaAmount: number;
    monthlyGrandClaimed: boolean; monthlyGrandAmount: number;
    achievementsUnlocked: string[]; streak: number; cycleDay: number;
    rewardType: string; spinWheelSlice: string | null; currency: string;
}
interface LeaderboardEntry { userId: number; username: string; totalEarned: number; totalClaims: number; maxStreak: number; }

type TabId = 'rewards' | 'spin' | 'achievements' | 'leaderboard' | 'history';

// ─── 3D Icon Component (replaces emojis) ─────────────────────────────────────
const DAY_ICONS: { icon: React.ElementType; gradient: string; shadow: string }[] = [
    { icon: Gift,    gradient: 'from-rose-500 to-pink-600',    shadow: 'rgba(244,63,94,0.4)' },
    { icon: Zap,     gradient: 'from-amber-400 to-orange-500', shadow: 'rgba(255, 154, 61,0.08)' },
    { icon: Diamond, gradient: 'from-cyan-400 to-blue-500',    shadow: 'rgba(34,211,238,0.4)' },
    { icon: Flame,   gradient: 'from-red-500 to-orange-600',   shadow: 'rgba(239,68,68,0.4)' },
    { icon: Star,    gradient: 'from-yellow-400 to-amber-500', shadow: 'rgba(250,204,21,0.4)' },
    { icon: Trophy,  gradient: 'from-amber-500 to-yellow-600', shadow: 'rgba(255, 122, 26,0.4)' },
    { icon: Crown,   gradient: 'from-yellow-400 to-amber-600', shadow: 'rgba(217,179,16,0.4)' },
    { icon: Target,  gradient: 'from-orange-500 to-orange-600', shadow: 'rgba(255, 122, 26,0.4)' },
    { icon: Sparkles, gradient: 'from-pink-500 to-rose-600',   shadow: 'rgba(236,72,153,0.4)' },
    { icon: Rocket,  gradient: 'from-blue-500 to-orange-600',  shadow: 'rgba(59,130,246,0.4)' },
    { icon: Award,   gradient: 'from-emerald-500 to-teal-600', shadow: 'rgba(16,185,129,0.4)' },
    { icon: Coins,   gradient: 'from-yellow-500 to-orange-500', shadow: 'rgba(255, 122, 26,0.4)' },
    { icon: Medal,   gradient: 'from-sky-500 to-blue-600',     shadow: 'rgba(14,165,233,0.4)' },
    { icon: ShieldCheck, gradient: 'from-green-500 to-emerald-600', shadow: 'rgba(34,197,94,0.4)' },
];

function Icon3D({ index, size = 28, pulse = false }: { index: number; size?: number; pulse?: boolean }) {
    const config = DAY_ICONS[index % DAY_ICONS.length];
    const IconComp = config.icon;
    return (
        <motion.div
            animate={pulse ? { scale: [1, 1.12, 1], rotateZ: [-3, 3, -3] } : {}}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className={`relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br ${config.gradient}`}
            style={{
                width: size + 12, height: size + 12,
                boxShadow: `0 6px 20px ${config.shadow}, inset 0 1px 0 rgba(255,255,255,0.3)`,
            }}
        >
            <IconComp size={size} className="text-white" strokeWidth={2.2} />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none" style={{ height: '50%' }} />
        </motion.div>
    );
}

// ─── Achievement icon map ────────────────────────────────────────────────────
const ACHIEVEMENT_ICONS: Record<string, { icon: React.ElementType; gradient: string; shadow: string }> = {
    'first_claim': { icon: Target,     gradient: 'from-blue-500 to-orange-600',    shadow: 'rgba(59,130,246,0.4)' },
    'streak_3':    { icon: Flame,      gradient: 'from-orange-500 to-red-600',     shadow: 'rgba(249,115,22,0.4)' },
    'streak_7':    { icon: Trophy,     gradient: 'from-amber-500 to-yellow-600',   shadow: 'rgba(255, 122, 26,0.4)' },
    'streak_14':   { icon: ShieldCheck, gradient: 'from-sky-500 to-cyan-600',      shadow: 'rgba(14,165,233,0.4)' },
    'streak_30':   { icon: Crown,      gradient: 'from-yellow-400 to-amber-600',   shadow: 'rgba(255, 122, 26,0.4)' },
    'streak_60':   { icon: Diamond,    gradient: 'from-cyan-400 to-blue-500',      shadow: 'rgba(34,211,238,0.4)' },
    'streak_100':  { icon: Award,      gradient: 'from-orange-500 to-orange-700',  shadow: 'rgba(255, 122, 26,0.5)' },
    'total_10k':   { icon: Coins,      gradient: 'from-emerald-500 to-green-600',  shadow: 'rgba(16,185,129,0.4)' },
};

function AchievementIcon3D({ achievementId, size = 32 }: { achievementId: string; size?: number }) {
    const cfg = ACHIEVEMENT_ICONS[achievementId] || ACHIEVEMENT_ICONS['first_claim'];
    const IconComp = cfg.icon;
    return (
        <div className={`relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-br ${cfg.gradient}`}
            style={{ width: size + 16, height: size + 16, boxShadow: `0 8px 25px ${cfg.shadow}, inset 0 1px 0 rgba(255,255,255,0.3)` }}>
            <IconComp size={size} className="text-white" strokeWidth={2} />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none" style={{ height: '50%' }} />
        </div>
    );
}

function formatReward(amount: number, currency: string): string {
    if (currency === 'INR') return `$${amount.toLocaleString()}`;
    if (currency === 'USD') return `$${amount.toLocaleString()}`;
    return `${amount} ${currency}`;
}

// ─── 3D Card Wrapper ─────────────────────────────────────────────────────────
function Card3D({ children, className = '', glowColor = 'rgba(255, 122, 26,0.15)' }: { children: React.ReactNode; className?: string; glowColor?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [rotateX, setRotateX] = useState(0);
    const [rotateY, setRotateY] = useState(0);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        setRotateX(-y * 10);
        setRotateY(x * 10);
    };

    return (
        <motion.div ref={ref} onMouseMove={handleMouseMove} onMouseLeave={() => { setRotateX(0); setRotateY(0); }}
            animate={{ rotateX, rotateY }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`relative ${className}`}
            style={{ perspective: '1000px', transformStyle: 'preserve-3d', boxShadow: `0 20px 60px ${glowColor}` }}>
            {children}
        </motion.div>
    );
}

// ─── Countdown Timer ─────────────────────────────────────────────────────────
function CountdownTimer({ targetMs }: { targetMs: number }) {
    const [time, setTime] = useState(targetMs);
    useEffect(() => { const id = setInterval(() => setTime(p => Math.max(0, p - 1000)), 1000); return () => clearInterval(id); }, []);
    const h = Math.floor(time / 3600000), m = Math.floor((time % 3600000) / 60000), s = Math.floor((time % 60000) / 1000);
    return (
        <div className="flex items-center gap-1.5 md:gap-2">
            {[{ val: h, label: 'HRS' }, { val: m, label: 'MIN' }, { val: s, label: 'SEC' }].map((item, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <span className="text-white/20 text-sm md:text-lg font-bold">:</span>}
                    <div className="flex flex-col items-center">
                        <motion.div key={item.val} initial={{ rotateX: -90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 200 }}
                            className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.1] flex items-center justify-center"
                            style={{ perspective: '200px', boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
                            <span className="text-lg md:text-2xl font-black text-white tabular-nums">{String(item.val).padStart(2, '0')}</span>
                        </motion.div>
                        <span className="text-[8px] md:text-[9px] text-white/30 font-bold mt-1 tracking-widest">{item.label}</span>
                    </div>
                </React.Fragment>
            ))}
        </div>
    );
}

// ─── Circular Progress Ring ──────────────────────────────────────────────────
function ProgressRing({ value, max, size = 120, strokeWidth = 8 }: { value: number; max: number; size?: number; strokeWidth?: number }) {
    const radius = (size - strokeWidth * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / max) * circumference;
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
                <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="url(#progressGrad)" strokeWidth={strokeWidth} strokeLinecap="round"
                    strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.5, ease: 'easeOut' }} />
                <defs><linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#ff7a1a" /><stop offset="50%" stopColor="#EF4444" /><stop offset="100%" stopColor="#EC4899" /></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span key={value} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="text-xl md:text-3xl font-black bg-gradient-to-r from-amber-400 to-red-400 bg-clip-text text-transparent">{value}</motion.span>
                <span className="text-[9px] md:text-[10px] text-white/30 font-bold">of {max}</span>
            </div>
        </div>
    );
}

// ─── 3D Day Card ─────────────────────────────────────────────────────────────
function DayCard3D({ day, reward, currency, claimed, isCurrent, index, onClaim, canClaim }: DayReward & { index: number; onClaim: () => void; canClaim: boolean }) {
    const isLastDay = index === 6;
    return (
        <motion.div initial={{ opacity: 0, y: 30, rotateX: -15 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.06 * index, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ scale: 1.05, rotateY: 5, z: 20 }}
            className="relative" style={{ perspective: '800px', transformStyle: 'preserve-3d' }}>
            <div className={`
                relative rounded-xl md:rounded-2xl p-2 md:p-4 flex flex-col items-center gap-1.5 md:gap-2.5 overflow-hidden cursor-default
                transition-all duration-300 min-h-[100px] md:min-h-[150px]
                ${claimed ? 'bg-gradient-to-b from-emerald-500/20 to-emerald-900/10 border border-emerald-500/40'
                    : isCurrent ? 'bg-gradient-to-b from-amber-500/25 to-orange-900/20 border-2 border-amber-400/70'
                    : isLastDay ? 'bg-gradient-to-b from-yellow-500/15 to-yellow-900/10 border border-yellow-400/30'
                    : 'bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.08]'}
            `} style={{ boxShadow: isCurrent ? '0 0 30px rgba(255, 122, 26,0.3), 0 10px 40px rgba(255, 122, 26,0.15)' : claimed ? '0 0 20px rgba(16,185,129,0.2)' : '0 4px 20px rgba(0,0,0,0.2)' }}>

                {claimed && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg z-10">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </motion.div>
                )}

                {isCurrent && !claimed && (
                    <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 rounded-2xl border-2 border-amber-400/50 pointer-events-none" />
                )}

                <span className={`text-[10px] md:text-[11px] font-black tracking-widest uppercase ${claimed ? 'text-emerald-400' : isCurrent ? 'text-amber-300' : 'text-white/25'}`}>Day {day}</span>

                <Icon3D index={index} size={isCurrent ? 26 : 22} pulse={isCurrent && !claimed} />

                <span className={`text-xs md:text-sm font-black ${claimed ? 'text-emerald-400' : isCurrent ? 'text-amber-200' : 'text-white/30'}`}>
                    {formatReward(reward, currency)}
                </span>

                {isCurrent && canClaim && !claimed && (
                    <motion.button onClick={onClaim} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        className="mt-0.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#1a1208] bg-gradient-to-r from-amber-400 to-orange-500"
                        style={{ boxShadow: '0 4px 15px rgba(255, 122, 26,0.4)' }}>Claim</motion.button>
                )}
            </div>
        </motion.div>
    );
}

// ─── Spin Wheel ──────────────────────────────────────────────────────────────
function SpinWheel({ slices, onSpin, spinning, result }: { slices: SpinSlice[]; onSpin: () => void; spinning: boolean; result: string | null }) {
    const rotation = useMotionValue(0);
    const [currentRotation, setCurrentRotation] = useState(0);
    const [ledPhase, setLedPhase] = useState(0);

    useEffect(() => {
        if (spinning) {
            const t = currentRotation + 1800 + Math.random() * 720;
            animate(rotation, t, { duration: 5.5, ease: [0.15, 0.85, 0.25, 1] });
            setCurrentRotation(t);
        }
    }, [spinning]);

    // LED chase animation
    useEffect(() => {
        const id = setInterval(() => setLedPhase(p => (p + 1) % 24), spinning ? 60 : 250);
        return () => clearInterval(id);
    }, [spinning]);

    const rotateTransform = useTransform(rotation, (v) => `rotate(${v}deg)`);
    const sliceAngle = 360 / slices.length;
    const LED_COUNT = 24;
    const TICK_COUNT = 48;
    const wheelSize = 'w-[320px] h-[320px] md:w-[420px] md:h-[420px]';

    return (
        <div className="flex flex-col items-center gap-10">

            {/* Wheel assembly */}
            <div className="relative">
                {/* Ambient glow layers */}
                <div className="absolute -inset-16 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(255, 122, 26,0.12) 0%, transparent 70%)' }} />
                <motion.div animate={spinning ? { opacity: [0.2, 0.5, 0.2] } : { opacity: 0.15 }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="absolute -inset-10 rounded-full pointer-events-none"
                    style={{ background: 'conic-gradient(from 0deg, #ff7a1a, #EF4444, #EC4899, #ff7a1a, #3B82F6, #10B981, #ff7a1a)', filter: 'blur(30px)' }} />

                <div className={`relative ${wheelSize}`}>

                    {/* ── Outer decorative ring with LEDs ── */}
                    <div className="absolute -inset-5 md:-inset-6">
                        <svg viewBox="0 0 440 440" className="w-full h-full">
                            <defs>
                                <linearGradient id="outerRingGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3D3224" />
                                    <stop offset="30%" stopColor="#5C4A30" />
                                    <stop offset="50%" stopColor="#8B7340" />
                                    <stop offset="70%" stopColor="#5C4A30" />
                                    <stop offset="100%" stopColor="#3D3224" />
                                </linearGradient>
                                <radialGradient id="ledGlow" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="white" stopOpacity="1" />
                                    <stop offset="40%" stopColor="#ff9a3d" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
                                </radialGradient>
                                <filter id="ledBlur"><feGaussianBlur stdDeviation="1.5" /></filter>
                            </defs>

                            {/* Outer metallic ring */}
                            <circle cx="220" cy="220" r="216" fill="none" stroke="url(#outerRingGrad)" strokeWidth="8" />
                            <circle cx="220" cy="220" r="212" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                            <circle cx="220" cy="220" r="220" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />

                            {/* Tick marks */}
                            {Array.from({ length: TICK_COUNT }).map((_, i) => {
                                const angle = (i * 360 / TICK_COUNT - 90) * (Math.PI / 180);
                                const isMajor = i % 2 === 0;
                                const r1 = isMajor ? 200 : 204;
                                const r2 = 210;
                                return (
                                    <line key={`tick-${i}`}
                                        x1={220 + r1 * Math.cos(angle)} y1={220 + r1 * Math.sin(angle)}
                                        x2={220 + r2 * Math.cos(angle)} y2={220 + r2 * Math.sin(angle)}
                                        stroke={isMajor ? 'rgba(255, 122, 26,0.4)' : 'rgba(255,255,255,0.08)'}
                                        strokeWidth={isMajor ? 1.5 : 0.5} />
                                );
                            })}

                            {/* LED bulbs */}
                            {Array.from({ length: LED_COUNT }).map((_, i) => {
                                const angle = (i * 360 / LED_COUNT - 90) * (Math.PI / 180);
                                const cx = 220 + 206 * Math.cos(angle);
                                const cy = 220 + 206 * Math.sin(angle);
                                const isLit = spinning
                                    ? (i + ledPhase) % 3 === 0
                                    : i % 2 === (Math.floor(ledPhase / 3) % 2);
                                return (
                                    <g key={`led-${i}`}>
                                        {isLit && <circle cx={cx} cy={cy} r="6" fill="url(#ledGlow)" filter="url(#ledBlur)" opacity="0.7" />}
                                        <circle cx={cx} cy={cy} r="3"
                                            fill={isLit ? '#ff9a3d' : '#4A3F2F'}
                                            stroke={isLit ? '#C4B5FD' : '#3D3224'}
                                            strokeWidth="0.5" />
                                        {isLit && <circle cx={cx} cy={cy} r="1.5" fill="white" opacity="0.9" />}
                                    </g>
                                );
                            })}

                            {/* Inner metallic ring */}
                            <circle cx="220" cy="220" r="196" fill="none" stroke="#5C4A30" strokeWidth="3" />
                            <circle cx="220" cy="220" r="194" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                        </svg>
                    </div>

                    {/* ── Premium pointer ── */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30" style={{ marginTop: '-6px' }}>
                        <svg width="36" height="48" viewBox="0 0 36 48">
                            <defs>
                                <linearGradient id="pointerGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#C4B5FD" />
                                    <stop offset="50%" stopColor="#ff7a1a" />
                                    <stop offset="100%" stopColor="#e85f00" />
                                </linearGradient>
                                <filter id="pointerShadow"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#ff7a1a" floodOpacity="0.5" /></filter>
                            </defs>
                            <path d="M18 0 L32 40 Q18 48 4 40 Z" fill="url(#pointerGrad)" filter="url(#pointerShadow)" />
                            <path d="M18 4 L28 38 Q18 44 8 38 Z" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                            <circle cx="18" cy="36" r="4" fill="#e85f00" stroke="#C4B5FD" strokeWidth="1" />
                            <circle cx="18" cy="36" r="2" fill="#C4B5FD" />
                        </svg>
                    </div>

                    {/* ── Spinning wheel face ── */}
                    <motion.div style={{ rotate: rotateTransform }}
                        className="absolute inset-0 rounded-full overflow-hidden"
                        >
                        <svg viewBox="0 0 300 300" className="w-full h-full">
                            <defs>
                                <filter id="sliceShadow"><feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="rgba(0,0,0,0.4)" /></filter>
                                <radialGradient id="centerFade" cx="50%" cy="50%" r="50%">
                                    <stop offset="60%" stopColor="transparent" />
                                    <stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
                                </radialGradient>
                            </defs>

                            {slices.map((slice, i) => {
                                const sa = i * sliceAngle, ea = (i + 1) * sliceAngle;
                                const sr = (sa - 90) * (Math.PI / 180), er = (ea - 90) * (Math.PI / 180);
                                const x1 = 150 + 148 * Math.cos(sr), y1 = 150 + 148 * Math.sin(sr);
                                const x2 = 150 + 148 * Math.cos(er), y2 = 150 + 148 * Math.sin(er);
                                const la = sliceAngle > 180 ? 1 : 0;
                                const ma = ((sa + ea) / 2 - 90) * (Math.PI / 180);
                                const tx = 150 + 100 * Math.cos(ma), ty = 150 + 100 * Math.sin(ma);
                                const tr = (sa + ea) / 2;
                                const isJackpot = slice.label === 'JACKPOT';

                                // Darken every other slice slightly
                                const darken = i % 2 === 0 ? '' : 'brightness(0.85)';

                                return (
                                    <g key={i}>
                                        <path d={`M150,150 L${x1},${y1} A148,148 0 ${la},1 ${x2},${y2} Z`}
                                            fill={slice.color} stroke="rgba(0,0,0,0.5)" strokeWidth="0.8"
                                            filter="url(#sliceShadow)" style={{ filter: darken }} />
                                        {/* Shine overlay on each slice */}
                                        <path d={`M150,150 L${x1},${y1} A148,148 0 ${la},1 ${x2},${y2} Z`}
                                            fill="url(#centerFade)" />
                                        {/* Value text */}
                                        <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                                            transform={`rotate(${tr}, ${tx}, ${ty})`}
                                            fill="white" fontSize={isJackpot ? '9' : '12'} fontWeight="900"
                                            letterSpacing={isJackpot ? '1' : '0'}
                                            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7), 0 0 8px rgba(0,0,0,0.3)' }}>
                                            {slice.label}
                                        </text>
                                        {/* Separator line */}
                                        <line x1="150" y1="150" x2={x1} y2={y1} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                                    </g>
                                );
                            })}

                            {/* Center circle decorative rings */}
                            <circle cx="150" cy="150" r="148" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                            <circle cx="150" cy="150" r="38" fill="rgba(0,0,0,0.3)" />
                            <circle cx="150" cy="150" r="36" fill="none" stroke="rgba(255, 122, 26,0.3)" strokeWidth="1" />
                        </svg>
                    </motion.div>

                    {/* ── Premium center button ── */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                        <motion.button onClick={onSpin} disabled={spinning}
                            whileHover={!spinning ? { scale: 1.08 } : {}}
                            whileTap={!spinning ? { scale: 0.92 } : {}}
                            animate={spinning ? { rotate: [0, 360] } : {}}
                            transition={spinning ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
                            className="relative w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-full disabled:cursor-wait"
                            style={{
                                background: 'conic-gradient(from 0deg, #C4B5FD, #ff7a1a, #e85f00, #e85f00, #e85f00, #ff7a1a, #C4B5FD)',
                                boxShadow: '0 0 40px rgba(255, 122, 26,0.5), 0 0 80px rgba(255, 122, 26,0.2), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.3)',
                            }}>
                            {/* Inner face */}
                            <div className="absolute inset-[4px] rounded-full flex items-center justify-center"
                                style={{
                                    background: 'radial-gradient(circle at 40% 35%, #ff7a1a, #e85f00)',
                                    boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.3), inset 0 -3px 6px rgba(0,0,0,0.4)',
                                }}>
                                {spinning ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <Sparkles size={16} className="text-white mb-0.5" />
                                        <span className="text-white font-black text-[11px] md:text-[13px] tracking-wider drop-shadow-lg">SPIN</span>
                                    </div>
                                )}
                            </div>
                            {/* Rim highlight */}
                            <div className="absolute inset-0 rounded-full pointer-events-none"
                                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)' }} />
                        </motion.button>
                    </div>

                    {/* Wheel border ring */}
                    <div className="absolute inset-0 rounded-full pointer-events-none border-[3px] border-white/[0.06]"
                        style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5), 0 0 20px rgba(0,0,0,0.3)' }} />
                </div>
            </div>

            {/* Spin info cards */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
                {[
                    { label: 'Slices', value: `${slices.length}`, icon: Target, gradient: 'from-pink-500/20 to-rose-500/5', border: 'border-pink-500/20', iconColor: 'text-pink-400' },
                    { label: 'Max Prize', value: formatReward(Math.max(...slices.map(s => s.value)), 'INR'), icon: Trophy, gradient: 'from-amber-500/20 to-yellow-500/5', border: 'border-amber-500/20', iconColor: 'text-amber-400' },
                    { label: 'Jackpot Chance', value: `${slices.find(s => s.label === 'JACKPOT')?.probability || 0}%`, icon: Zap, gradient: 'from-orange-500/20 to-orange-500/5', border: 'border-orange-500/20', iconColor: 'text-orange-400' },
                ].map((s, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
                        className={`bg-gradient-to-b ${s.gradient} border ${s.border} rounded-2xl p-4 text-center`}>
                        <div className={`w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center mx-auto mb-2 ${s.iconColor}`}>
                            <s.icon size={18} />
                        </div>
                        <p className="text-white font-bold text-base">{s.value}</p>
                        <p className="text-white/30 text-[11px] mt-0.5">{s.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Result display */}
            <AnimatePresence>
                {result && !spinning && (
                    <motion.div initial={{ opacity: 0, y: 30, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                        className="relative w-full max-w-md">
                        {/* Background glow */}
                        <div className="absolute -inset-4 rounded-3xl opacity-40 blur-xl pointer-events-none"
                            style={{ background: 'linear-gradient(135deg, #ff7a1a, #EF4444)' }} />
                        <div className="relative rounded-2xl overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, rgba(255, 122, 26,0.15) 0%, rgba(239,68,68,0.08) 100%)', border: '1px solid rgba(255, 122, 26,0.3)' }}>
                            {/* Shine sweep */}
                            <motion.div animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                                className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)', width: '50%' }} />
                            <div className="relative px-8 py-6 text-center">
                                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                                    <Icon3D index={5} size={28} />
                                </motion.div>
                                <p className="text-amber-400 text-sm font-bold mt-3 uppercase tracking-widest">Congratulations!</p>
                                <p className="text-white text-4xl font-black mt-1"
                                    style={{ textShadow: '0 0 30px rgba(255, 122, 26,0.3)' }}>{result}</p>
                                <p className="text-white/30 text-sm mt-2">Added to your wallet</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Achievement Badge ───────────────────────────────────────────────────────
function AchievementBadge({ achievement, unlocked, index }: { achievement: Achievement; unlocked: boolean; index: number }) {
    return (
        <motion.div initial={{ opacity: 0, scale: 0.8, rotateY: -30 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ delay: index * 0.08, type: 'spring' }} whileHover={{ scale: 1.05, rotateY: 10, z: 10 }}
            className={`relative rounded-2xl p-5 flex flex-col items-center gap-3 text-center transition-all
                ${unlocked ? 'bg-gradient-to-b from-amber-500/15 to-amber-900/5 border border-amber-400/30' : 'bg-white/[0.03] border border-white/[0.06] opacity-50 grayscale'}`}
            style={{ perspective: '600px', transformStyle: 'preserve-3d', boxShadow: unlocked ? '0 10px 30px rgba(255, 122, 26,0.15)' : 'none' }}>
            {unlocked && (<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shadow-lg"><svg width="12" height="12" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg></motion.div>)}
            <AchievementIcon3D achievementId={achievement.id} size={28} />
            <h4 className="text-sm font-bold text-white">{achievement.name}</h4>
            <p className="text-[11px] text-white/40 leading-relaxed">{achievement.description}</p>
            <span className={`text-xs font-bold ${unlocked ? 'text-amber-400' : 'text-white/20'}`}>+{formatReward(achievement.reward, 'INR')}</span>
            {achievement.streakRequired && <span className="text-[10px] text-white/20">{achievement.streakRequired}-day streak</span>}
        </motion.div>
    );
}

// ─── Leaderboard Row ─────────────────────────────────────────────────────────
function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
    const icons = [Trophy, Medal, Award];
    const colors = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
    return (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: rank * 0.05 }}
            className={`flex items-center gap-4 px-5 py-4 rounded-xl transition-all ${rank < 3 ? 'bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20' : 'bg-white/[0.03] border border-white/[0.05]'}`}>
            {rank < 3 ? (
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${rank === 0 ? 'from-yellow-400 to-amber-600' : rank === 1 ? 'from-slate-300 to-slate-500' : 'from-amber-600 to-amber-800'} flex items-center justify-center`}
                    style={{ boxShadow: `0 4px 15px ${rank === 0 ? 'rgba(250,204,21,0.3)' : 'rgba(0,0,0,0.2)'}` }}>
                    {React.createElement(icons[rank], { size: 18, className: 'text-white' })}
                </div>
            ) : <span className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/30 text-sm font-bold">#{rank + 1}</span>}
            <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{entry.username}</p>
                <p className="text-white/30 text-[11px]">{entry.totalClaims} claims | Max streak: {entry.maxStreak}</p>
            </div>
            <span className="text-amber-400 font-black text-sm">{formatReward(entry.totalEarned, 'INR')}</span>
        </motion.div>
    );
}

// ─── Claim Result Overlay ────────────────────────────────────────────────────
function ClaimResultOverlay({ result, onClose }: { result: ClaimResult; onClose: () => void }) {
    const [confettiData, setConfettiData] = useState<any>(null);
    useEffect(() => { fetch(CONFETTI_URL).then(r => r.json()).then(setConfettiData).catch(() => {}); }, []);
    const resultIcon = result.jackpotAmount > 0 ? Zap : result.weeklyMegaClaimed ? Trophy : result.monthlyGrandClaimed ? Crown : Gift;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center"
            style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7), rgba(0,0,0,0.95))', backdropFilter: 'blur(12px)' }} onClick={onClose}>
            {confettiData && <div className="absolute inset-0 pointer-events-none z-0"><Lottie animationData={confettiData} loop={false} autoplay style={{ width: '100%', height: '100%' }} /></div>}
            <motion.div initial={{ scale: 0.7, rotateY: -20 }} animate={{ scale: 1, rotateY: 0 }} transition={{ type: 'spring', stiffness: 200 }}
                onClick={e => e.stopPropagation()} className="relative z-10 w-full max-w-md mx-4 rounded-3xl overflow-hidden"
                style={{ background: 'linear-gradient(160deg, #2A2230 0%, #1C191F 55%, #19150F 100%)', border: '1px solid rgba(255, 122, 26,0.25)', boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 60px rgba(255, 122, 26,0.1)' }}>
                <div className="p-8 text-center">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: 2 }} className="mb-4 inline-block">
                        <Icon3D index={result.jackpotAmount > 0 ? 1 : result.weeklyMegaClaimed ? 5 : 0} size={40} />
                    </motion.div>
                    <h2 className="text-2xl font-black text-white mb-2">{result.jackpotAmount > 0 ? 'JACKPOT!' : result.weeklyMegaClaimed ? 'WEEKLY MEGA!' : result.monthlyGrandClaimed ? 'MONTHLY GRAND!' : 'Reward Claimed!'}</h2>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        className="text-4xl font-black bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent mb-4">+{formatReward(result.reward, result.currency)}</motion.p>
                    <div className="space-y-2 text-left bg-white/[0.04] rounded-xl p-4 mb-6">
                        <div className="flex justify-between text-sm"><span className="text-white/40">Base Reward</span><span className="text-white">{formatReward(result.baseReward, result.currency)}</span></div>
                        {result.vipMultiplier > 1 && <div className="flex justify-between text-sm"><span className="text-brand-gold">VIP Multiplier</span><span className="text-brand-gold/80">x{result.vipMultiplier}</span></div>}
                        {result.milestoneMultiplier > 1 && <div className="flex justify-between text-sm"><span className="text-orange-400">Milestone Bonus</span><span className="text-orange-300">x{result.milestoneMultiplier}</span></div>}
                        {result.referralBonus > 0 && <div className="flex justify-between text-sm"><span className="text-cyan-400">Referral Bonus</span><span className="text-cyan-300">+{formatReward(result.referralBonus, result.currency)}</span></div>}
                        {result.jackpotAmount > 0 && <div className="flex justify-between text-sm"><span className="text-yellow-400">Lucky Jackpot!</span><span className="text-yellow-300 font-bold">+{formatReward(result.jackpotAmount, result.currency)}</span></div>}
                        {result.weeklyMegaClaimed && <div className="flex justify-between text-sm"><span className="text-orange-400">Weekly Mega</span><span className="text-orange-300 font-bold">+{formatReward(result.weeklyMegaAmount, result.currency)}</span></div>}
                        {result.monthlyGrandClaimed && <div className="flex justify-between text-sm"><span className="text-pink-400">Monthly Grand</span><span className="text-pink-300 font-bold">+{formatReward(result.monthlyGrandAmount, result.currency)}</span></div>}
                        <div className="flex justify-between text-sm border-t border-white/[0.06] pt-2 mt-2"><span className="text-white/60 font-bold">Streak</span><span className="text-amber-400 font-bold">{result.streak} days</span></div>
                    </div>
                    {result.achievementsUnlocked.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                            className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4"><p className="text-amber-400 text-xs font-bold mb-1">Achievements Unlocked!</p><p className="text-white/60 text-sm">{result.achievementsUnlocked.join(', ')}</p></motion.div>
                    )}
                    <motion.button onClick={onClose} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className="w-full py-3.5 rounded-xl font-bold text-[14px] bg-gradient-to-r from-amber-500 to-orange-600 text-[#1a1208]"
                        style={{ boxShadow: '0 8px 25px rgba(255, 122, 26,0.3)' }}>Awesome!</motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Main Content ────────────────────────────────────────────────────────────
function DailyRewardsContent() {
    const { user, isAuthenticated, token } = useAuth();
    const { fiatBalance, depositWageringDone, depositWageringRequired } = useWallet();
    const { openDeposit } = useModal();

    const [status, setStatus] = useState<UserStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [pageHidden, setPageHidden] = useState(false);

    // Check if admin has hidden this page
    useEffect(() => {
        fetch('/api/daily-checkin/config', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => { if (d?.hidden === true) setPageHidden(true); })
            .catch(() => {});
    }, []);
    const [activeTab, setActiveTab] = useState<TabId>('rewards');
    const [claiming, setClaiming] = useState(false);
    const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [spinningWheel, setSpinningWheel] = useState(false);
    const [spinResult, setSpinResult] = useState<string | null>(null);
    const [fireData, setFireData] = useState<any>(null);

    const hasDeposited = fiatBalance > 0 || depositWageringDone > 0 || depositWageringRequired > 0;
    useEffect(() => { fetch(FIRE_URL).then(r => r.json()).then(setFireData).catch(() => {}); }, []);

    const fetchStatus = useCallback(async () => {
        if (!isAuthenticated || !token) { setLoading(false); return; }
        try { const res = await api.get('/daily-checkin/status'); setStatus(res.data); }
        catch { try { await api.get('/daily-checkin/full-config'); } catch {} setStatus(null); }
        finally { setLoading(false); }
    }, [isAuthenticated, token]);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);
    useEffect(() => { if (activeTab === 'leaderboard') api.get('/daily-checkin/leaderboard?limit=20').then(r => setLeaderboard(r.data)).catch(() => {}); }, [activeTab]);
    useEffect(() => { if (activeTab === 'history' && isAuthenticated) api.get(`/daily-checkin/history?page=${historyPage}&limit=20`).then(r => setHistory(r.data.claims || [])).catch(() => {}); }, [activeTab, historyPage, isAuthenticated]);

    const handleClaim = async (useSpinWheel = false) => {
        if (claiming || !status?.canClaimToday) return; setClaiming(true);
        try { const res = await api.post('/daily-checkin/claim', { useSpinWheel }); setClaimResult(res.data); await fetchStatus(); }
        catch (err: any) { alert(err.response?.data?.message || 'Failed to claim reward'); }
        finally { setClaiming(false); }
    };

    const handleSpin = async () => {
        if (spinningWheel || !status?.canClaimToday) return; setSpinningWheel(true); setSpinResult(null);
        try {
            const res = await api.post('/daily-checkin/claim', { useSpinWheel: true });
            setTimeout(() => { setSpinResult(res.data.spinWheelSlice || formatReward(res.data.reward, res.data.currency)); setClaimResult(res.data); setSpinningWheel(false); fetchStatus(); }, 4200);
        } catch (err: any) { setSpinningWheel(false); alert(err.response?.data?.message || 'Failed to spin'); }
    };

    const streak = status?.streak || 0;
    const cycleMax = status?.config?.cycleDays || 7;
    const progressVal = streak % cycleMax === 0 && streak > 0 ? cycleMax : streak % cycleMax;

    const TABS = ([
        { id: 'rewards' as TabId, label: 'Daily Rewards', icon: Gift, show: true },
        { id: 'spin' as TabId, label: 'Spin Wheel', icon: Target, show: !!status?.config?.spinWheelEnabled },
        { id: 'achievements' as TabId, label: 'Achievements', icon: Award, show: !!status?.config?.achievementsEnabled },
        { id: 'leaderboard' as TabId, label: 'Leaderboard', icon: BarChart3, show: !!status?.config?.leaderboardEnabled },
        { id: 'history' as TabId, label: 'History', icon: History, show: isAuthenticated || false },
    ] satisfies { id: TabId; label: string; icon: React.ElementType; show: boolean }[]).filter(t => t.show);

    // Redirect away if admin has hidden this page
    if (pageHidden) {
        return (
            <div className="h-screen overflow-hidden bg-bg-base flex flex-col">
                <Header />
                <div className="flex flex-1 overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
                    <LeftSidebar />
                    <main className="flex-1 min-w-0 bg-bg-base overflow-y-auto flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-white/40 text-lg font-bold mb-2">Daily Rewards</p>
                            <p className="text-white/20 text-sm">This page is currently unavailable.</p>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen overflow-hidden bg-bg-base flex flex-col">
            <Header />
            <div className="flex flex-1 overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
                <LeftSidebar />
                <main className="flex-1 min-w-0 bg-bg-base overflow-y-auto overflow-x-hidden flex flex-col">

                    {/* ═══ HERO ═══════════════════════════════════════════════════ */}
                    <div className="relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255, 122, 26,0.15),_transparent_60%)]" />
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(239,68,68,0.08),_transparent_60%)]" />
                        <div className="absolute -right-20 top-10 w-80 h-80 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />
                        <div className="absolute left-10 bottom-0 w-60 h-60 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />

                        {[...Array(8)].map((_, i) => (
                            <motion.div key={i} animate={{ y: [0, -20, 0], x: [0, 10, 0], opacity: [0.2, 0.7, 0.2] }}
                                transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.4 }}
                                className="absolute rounded-full bg-amber-400/20"
                                style={{ width: 4 + i * 2, height: 4 + i * 2, left: `${10 + i * 11}%`, top: `${15 + (i % 3) * 25}%` }} />
                        ))}

                        <div className="relative px-4 md:px-6 lg:px-8 pt-6 pb-6 md:pt-10 md:pb-12">
                          <div className="max-w-5xl mx-auto">
                            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-5 lg:gap-10">
                                <div className="flex-1 min-w-0">
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1 mb-3">
                                        <Sparkles size={12} className="text-amber-400" />
                                        <span className="text-amber-400 text-[10px] font-bold uppercase tracking-widest">Daily Rewards</span>
                                    </motion.div>

                                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                                        className="text-2xl md:text-3xl lg:text-4xl font-black text-white leading-tight mb-2 md:mb-3">
                                        Claim Your{' '}
                                        <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">Daily Rewards</span>
                                    </motion.h1>

                                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                        className="text-white/40 text-xs md:text-sm max-w-xl leading-relaxed mb-4 hidden md:block">
                                        Log in every day to build your streak, spin the wheel, and unlock achievements. VIP members earn bonus multipliers on every claim.
                                    </motion.p>

                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                                        className="flex flex-wrap gap-1.5 hidden md:flex">
                                        {[
                                            { icon: Target, label: 'Spin' },
                                            { icon: Flame, label: 'Streak' },
                                            { icon: Crown, label: 'VIP Bonus' },
                                            { icon: Zap, label: 'Jackpot' },
                                            { icon: Award, label: 'Badges' },
                                        ].map((f, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/40">
                                                <f.icon size={10} /> {f.label}
                                            </span>
                                        ))}
                                    </motion.div>
                                </div>

                                {/* Right: Streak + Countdown */}
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                                    className="flex flex-col items-center gap-3 w-full lg:w-auto">
                                    <Card3D className="rounded-xl md:rounded-2xl p-3 md:p-5 bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.1] w-full lg:w-auto" glowColor="rgba(255, 122, 26,0.1)">
                                        <div className="flex items-center gap-4 md:gap-6">
                                            <div className="flex flex-col items-center">
                                                <div className="w-10 h-10 md:w-14 md:h-14 flex-shrink-0">{fireData ? <Lottie animationData={fireData} loop autoplay /> : <Flame size={24} className="text-orange-500" />}</div>
                                                <motion.span key={streak} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                                    className="text-2xl md:text-3xl font-black bg-gradient-to-r from-amber-400 to-red-400 bg-clip-text text-transparent">{streak}</motion.span>
                                                <span className="text-[9px] md:text-[10px] text-white/30 font-bold">STREAK</span>
                                            </div>
                                            <ProgressRing value={progressVal} max={cycleMax} size={typeof window !== 'undefined' && window.innerWidth < 768 ? 80 : 100} strokeWidth={6} />
                                        </div>
                                        {status && (
                                            <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-4">
                                                <div className="text-center flex-1"><p className="text-[9px] md:text-[10px] text-white/25 font-bold uppercase tracking-widest">Earned</p><p className="text-sm md:text-lg font-black text-emerald-400">{formatReward(status.totalEarned, status.config.currency)}</p></div>
                                                <div className="w-px h-6 bg-white/[0.06]" />
                                                <div className="text-center flex-1"><p className="text-[9px] md:text-[10px] text-white/25 font-bold uppercase tracking-widest">Day</p><p className="text-sm md:text-lg font-black text-amber-400">{status.cycleDay}/{cycleMax}</p></div>
                                            </div>
                                        )}
                                    </Card3D>
                                    {status && !status.canClaimToday && (
                                        <div className="text-center"><p className="text-[9px] text-white/25 font-bold uppercase tracking-widest mb-1.5">Next Reward In</p><CountdownTimer targetMs={status.countdownMs} /></div>
                                    )}
                                </motion.div>
                            </div>
                          </div>
                        </div>
                    </div>

                    {/* ═══ TABS ════════════════════════════════════════════════════ */}
                    <div className="px-4 md:px-6 lg:px-8 py-3">
                      <div className="max-w-5xl mx-auto">
                        <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] overflow-x-auto scrollbar-none">
                            {TABS.map(tab => {
                                const TabIcon = tab.icon;
                                return (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-300 border border-amber-500/30'
                                            : 'text-white/30 hover:text-white/60'}`}>
                                        <TabIcon size={15} /> {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                      </div>
                    </div>

                    {/* ═══ TAB CONTENT ═════════════════════════════════════════════ */}
                    <div className="px-4 md:px-6 lg:px-8 pb-10">
                      <div className="max-w-5xl mx-auto">

                        {!isAuthenticated && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="text-center py-20 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                                <Lock size={48} className="text-white/20 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">Login Required</h3>
                                <p className="text-white/40 text-sm">Please log in to access your daily rewards.</p>
                            </motion.div>
                        )}

                        {isAuthenticated && loading && (
                            <div className="flex justify-center py-20"><div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>
                        )}

                        {/* ── REWARDS TAB ─────────────────────────────────────────── */}
                        {isAuthenticated && !loading && status && activeTab === 'rewards' && (
                            <div className="space-y-5 md:space-y-6">
                                {/* Deposit gate */}
                                {!hasDeposited && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl md:rounded-2xl p-4 md:p-5 bg-gradient-to-r from-red-500/10 to-red-900/5 border border-red-500/20">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 4px 16px rgba(239,68,68,0.3)' }}><Lock size={18} className="text-white" /></div>
                                            <div className="flex-1 min-w-0"><h3 className="text-white font-bold text-sm md:text-base">Deposit Required</h3><p className="text-white/40 text-xs mt-0.5">Make your first deposit to start claiming daily rewards.</p></div>
                                            <motion.button onClick={() => openDeposit()} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                className="px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm bg-gradient-to-r from-amber-500 to-orange-600 text-[#1a1208] w-full sm:w-auto"
                                                style={{ boxShadow: '0 6px 20px rgba(255, 122, 26,0.3)' }}>Deposit Now</motion.button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Milestone progress */}
                                {status.config.weeklyMegaRewardEnabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                                        <Card3D className="rounded-xl md:rounded-2xl p-3 md:p-4 bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20" glowColor="rgba(249,115,22,0.1)">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-9 h-9 md:w-11 md:h-11 rounded-lg md:rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }}><Trophy size={18} className="text-white" /></div>
                                                <div className="min-w-0"><p className="text-white font-bold text-sm">Weekly Mega Reward</p><p className="text-white/30 text-[11px]">{status.config.weeklyMegaStreakRequired}-day streak required</p></div>
                                            </div>
                                            <div className="h-2 md:h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (streak / status.config.weeklyMegaStreakRequired) * 100)}%` }}
                                                    transition={{ duration: 1, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" />
                                            </div>
                                            <p className="text-[11px] text-white/40 mt-1.5 font-medium">{streak}/{status.config.weeklyMegaStreakRequired} days</p>
                                        </Card3D>

                                        {status.config.monthlyGrandPrizeEnabled && (
                                            <Card3D className="rounded-xl md:rounded-2xl p-3 md:p-4 bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20" glowColor="rgba(255, 122, 26,0.1)">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-9 h-9 md:w-11 md:h-11 rounded-lg md:rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 4px 14px rgba(255, 122, 26,0.3)' }}><Crown size={18} className="text-white" /></div>
                                                    <div className="min-w-0"><p className="text-white font-bold text-sm">Monthly Grand Prize</p><p className="text-white/30 text-[11px]">{status.config.monthlyGrandPrizeStreakRequired}-day streak required</p></div>
                                                </div>
                                                <div className="h-2 md:h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (streak / status.config.monthlyGrandPrizeStreakRequired) * 100)}%` }}
                                                        transition={{ duration: 1, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-orange-500 to-pink-400" />
                                                </div>
                                                <p className="text-[11px] text-white/40 mt-1.5 font-medium">{streak}/{status.config.monthlyGrandPrizeStreakRequired} days</p>
                                            </Card3D>
                                        )}
                                    </div>
                                )}

                                {/* Day cards */}
                                <div>
                                    <div className="flex items-center justify-between mb-3 md:mb-4">
                                        <h3 className="text-white font-bold text-base md:text-lg">Reward Cycle</h3>
                                        <span className="text-white/30 text-xs md:text-sm">Day {status.cycleDay} of {cycleMax}</span>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1.5 md:gap-3">
                                        {status.rewards.map((r, i) => (
                                            <DayCard3D key={r.day} {...r} index={i} onClaim={() => handleClaim(false)} canClaim={hasDeposited && status.canClaimToday && !claiming} />
                                        ))}
                                    </div>
                                    {/* Progress bar below grid */}
                                    <div className="mt-4 flex items-center gap-3">
                                        <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${(progressVal / cycleMax) * 100}%` }}
                                                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }} className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
                                        </div>
                                        <span className="text-[12px] text-white/25 font-bold">{progressVal}/{cycleMax}</span>
                                    </div>
                                </div>

                                {/* Main claim button */}
                                {status.canClaimToday && hasDeposited && (
                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row gap-2 md:gap-3">
                                        <motion.button onClick={() => handleClaim(false)} disabled={claiming} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                            className="flex-1 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black text-sm md:text-base relative overflow-hidden disabled:opacity-60"
                                            style={{ background: 'linear-gradient(135deg, #ff7a1a 0%, #EF4444 60%, #ff7a1a 100%)', backgroundSize: '200% 100%', color: '#1A1208', boxShadow: '0 8px 30px rgba(255, 122, 26,0.35)' }}>
                                            <motion.span animate={{ backgroundPosition: ['200% 0', '-200% 0'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                                                className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)', backgroundSize: '200% 100%' }} />
                                            <span className="relative flex items-center justify-center gap-2">
                                                <Gift size={18} />
                                                {claiming ? 'Claiming...' : <>
                                                    <span className="hidden sm:inline">Claim Day {status.cycleDay} Reward — {formatReward(status.rewards[status.cycleDay - 1]?.reward ?? 10, status.config.currency)}</span>
                                                    <span className="sm:hidden">Claim {formatReward(status.rewards[status.cycleDay - 1]?.reward ?? 10, status.config.currency)}</span>
                                                </>}
                                            </span>
                                        </motion.button>
                                        {status.config.spinWheelEnabled && (
                                            <motion.button onClick={() => setActiveTab('spin')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                className="px-5 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm border-2 border-pink-500/40 text-pink-300 bg-pink-500/10 flex items-center justify-center gap-2"
                                                style={{ boxShadow: '0 6px 20px rgba(236,72,153,0.15)' }}><Target size={16} /> Spin Instead</motion.button>
                                        )}
                                    </motion.div>
                                )}

                                {/* Feature spotlight cards */}
                                <div>
                                    <h3 className="text-white font-bold text-base md:text-lg mb-3 md:mb-4">Reward Features</h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                                        {[
                                            { icon: Target, gradient: 'from-pink-500 to-rose-600', shadow: 'rgba(236,72,153,0.3)', title: 'Spin Wheel', desc: 'Spin the wheel for randomized rewards. Land on the jackpot slice for massive prizes!', enabled: status.config.spinWheelEnabled },
                                            { icon: Crown, gradient: 'from-yellow-400 to-amber-600', shadow: 'rgba(255, 122, 26,0.3)', title: 'VIP Multiplier', desc: 'VIP members earn up to 5x multiplier on every daily reward claim.', enabled: status.config.vipMultiplierEnabled },
                                            { icon: Zap, gradient: 'from-amber-400 to-orange-500', shadow: 'rgba(255, 154, 61,0.3)', title: 'Lucky Jackpot', desc: 'Every claim has a chance to trigger the lucky jackpot for a mega bonus reward!', enabled: status.config.luckyJackpotEnabled },
                                            { icon: Users, gradient: 'from-blue-500 to-orange-600', shadow: 'rgba(59,130,246,0.3)', title: 'Referral Bonus', desc: 'Earn extra rewards when your referred friends also claim their daily rewards.', enabled: status.config.referralBonusEnabled },
                                        ].map((f, i) => (
                                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}
                                                whileHover={{ scale: 1.02, y: -4 }}
                                                className={`rounded-xl md:rounded-2xl p-3 md:p-4 border transition-all ${f.enabled ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-white/[0.02] border-white/[0.04] opacity-40'}`}>
                                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-2 md:mb-3`}
                                                    style={{ boxShadow: `0 4px 14px ${f.shadow}, inset 0 1px 0 rgba(255,255,255,0.3)` }}>
                                                    <f.icon size={16} className="text-white" />
                                                </div>
                                                <p className="text-white font-bold text-xs md:text-sm mb-0.5">{f.title}</p>
                                                <p className="text-white/30 text-[10px] md:text-[12px] leading-relaxed line-clamp-3">{f.desc}</p>
                                                {!f.enabled && <span className="text-[9px] text-white/20 font-bold mt-1 block">Coming Soon</span>}
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* How it works section */}
                                <div>
                                    <h3 className="text-white font-bold text-base md:text-lg mb-3 md:mb-4">How It Works</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
                                        {[
                                            { step: '01', title: 'Log In Daily', desc: 'Visit the Daily Rewards page every day to keep your streak alive. Even one missed day can reset your progress!', icon: Clock },
                                            { step: '02', title: 'Claim or Spin', desc: 'Choose to claim your fixed daily reward or spin the wheel for a chance at something bigger. The choice is yours!', icon: Gift },
                                            { step: '03', title: 'Build Your Streak', desc: 'Consecutive days build your streak multiplier. Hit 7-day and 30-day milestones for massive bonus rewards.', icon: TrendingUp },
                                        ].map((item, i) => (
                                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
                                                className="relative rounded-xl md:rounded-2xl p-4 md:p-5 bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                                                <span className="absolute top-2 right-3 text-4xl md:text-5xl font-black text-white/[0.03]">{item.step}</span>
                                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center mb-2 md:mb-3">
                                                    <item.icon size={16} className="text-amber-400" />
                                                </div>
                                                <h4 className="text-white font-bold text-sm md:text-base mb-1">{item.title}</h4>
                                                <p className="text-white/30 text-[11px] md:text-[13px] leading-relaxed">{item.desc}</p>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* Stats row */}
                                <div>
                                    <h3 className="text-white font-bold text-base md:text-lg mb-3 md:mb-4">Your Stats</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                                        {[
                                            { label: 'Current Streak', value: `${streak} days`, icon: Flame, color: 'text-orange-400' },
                                            { label: 'Total Earned', value: formatReward(status.totalEarned, status.config.currency), icon: CircleDollarSign, color: 'text-emerald-400' },
                                            { label: 'Achievements', value: `${status.unlockedAchievements.length}/${status.config.achievements.length}`, icon: Award, color: 'text-amber-400' },
                                            { label: 'Next Milestone', value: streak < 7 ? '7-day' : streak < 30 ? '30-day' : streak < 100 ? '100-day' : 'MAX', icon: ArrowUpRight, color: 'text-orange-400' },
                                        ].map((s, i) => (
                                            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                                                className="rounded-lg md:rounded-xl p-3 md:p-4 bg-white/[0.03] border border-white/[0.06]">
                                                <s.icon size={14} className={`${s.color} mb-1.5`} /><p className="text-white font-bold text-sm md:text-lg">{s.value}</p><p className="text-white/30 text-[10px] md:text-[11px]">{s.label}</p>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* FAQ */}
                                <div>
                                    {status.config.faqs && status.config.faqs.length > 0 && (
                                        <>
                                            <h3 className="text-white font-bold text-base md:text-lg mb-3 md:mb-4">Frequently Asked Questions</h3>
                                            <div className="space-y-3">
                                                {status.config.faqs.map((faq, i) => (
                                                    <FAQItem key={i} q={faq.q} a={faq.a} />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── SPIN TAB ────────────────────────────────────────────── */}
                        {isAuthenticated && !loading && status && activeTab === 'spin' && (
                            <div className="flex flex-col items-center py-8 space-y-10">
                                {!status.canClaimToday ? (
                                    <div className="text-center py-16">
                                        <Timer size={48} className="text-white/20 mx-auto mb-4" />
                                        <h3 className="text-xl font-bold text-white mb-2">Already Claimed Today</h3>
                                        <p className="text-white/40 mb-6">Come back tomorrow to spin the wheel!</p>
                                        <CountdownTimer targetMs={status.countdownMs} />
                                    </div>
                                ) : !hasDeposited ? (
                                    <div className="text-center py-16">
                                        <Lock size={48} className="text-white/20 mx-auto mb-4" />
                                        <h3 className="text-xl font-bold text-white mb-2">Deposit Required</h3>
                                        <p className="text-white/40 mb-6">Make a deposit to spin the wheel.</p>
                                        <motion.button onClick={() => openDeposit()} whileHover={{ scale: 1.03 }}
                                            className="px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-[#1a1208]">Deposit Now</motion.button>
                                    </div>
                                ) : (
                                    <SpinWheel slices={status.config.spinWheelSlices} onSpin={handleSpin} spinning={spinningWheel} result={spinResult} />
                                )}

                                {/* Spin wheel explanation */}
                                <div className="max-w-2xl w-full">
                                    <h3 className="text-white font-bold text-lg mb-4 text-center">How the Spin Wheel Works</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {[
                                            { icon: Percent, title: 'Weighted Probabilities', desc: 'Each slice has a different chance of landing. Smaller prizes are more common, while the jackpot is rare.' },
                                            { icon: Zap, title: 'Jackpot Slice', desc: 'The golden JACKPOT slice offers the biggest reward. It has the lowest probability but the highest payout!' },
                                            { icon: Crown, title: 'VIP Boost Applies', desc: 'VIP multipliers are applied on top of your spin result, so VIP members get even more from spinning.' },
                                            { icon: Rocket, title: 'One Spin Per Day', desc: 'You can either claim your fixed reward or spin the wheel — choose wisely! The choice resets daily.' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                                <item.icon size={18} className="text-pink-400 flex-shrink-0 mt-0.5" />
                                                <div><p className="text-white font-bold text-sm">{item.title}</p><p className="text-white/30 text-[12px] mt-0.5">{item.desc}</p></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── ACHIEVEMENTS TAB ───────────────────────────────────── */}
                        {isAuthenticated && !loading && status && activeTab === 'achievements' && (
                            <div className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-white font-bold text-xl">Achievement Badges</h3>
                                    <span className="text-amber-400 text-sm font-bold">{status.unlockedAchievements.length}/{status.config.achievements.length} Unlocked</span>
                                </div>
                                {/* Progress overview */}
                                <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/[0.06]">
                                    <div className="flex items-center gap-4">
                                        <ProgressRing value={status.unlockedAchievements.length} max={status.config.achievements.length} size={80} strokeWidth={6} />
                                        <div>
                                            <p className="text-white font-bold text-lg">Achievement Progress</p>
                                            <p className="text-white/40 text-sm">Complete milestones to unlock badges and earn bonus rewards.</p>
                                            <p className="text-amber-400 text-sm font-bold mt-1">
                                                {status.config.achievements.length - status.unlockedAchievements.length} remaining
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {status.config.achievements.map((ach, i) => (
                                        <AchievementBadge key={ach.id} achievement={ach} unlocked={status.unlockedAchievements.includes(ach.id)} index={i} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── LEADERBOARD TAB ────────────────────────────────────── */}
                        {activeTab === 'leaderboard' && (
                            <div className="space-y-6">
                                <h3 className="text-white font-bold text-xl">Top Earners</h3>
                                {leaderboard.length === 0 ? (
                                    <div className="text-center py-16 text-white/30">No data yet. Be the first to claim!</div>
                                ) : (
                                    <div className="space-y-2 max-w-2xl">
                                        {leaderboard.map((entry, i) => (<LeaderboardRow key={entry.userId} entry={entry} rank={i} />))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── HISTORY TAB ─────────────────────────────────────────── */}
                        {isAuthenticated && activeTab === 'history' && (
                            <div className="space-y-4">
                                <h3 className="text-white font-bold text-xl">Your Reward History</h3>
                                {history.length === 0 ? (
                                    <div className="text-center py-16 text-white/30">No claims yet. Start your streak today!</div>
                                ) : (
                                    <div className="space-y-2">
                                        {history.map((claim: any, i: number) => (
                                            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                                                className="flex items-center gap-3 md:gap-4 px-3 md:px-5 py-3 md:py-4 rounded-lg md:rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                                <Icon3D index={(claim.cycleDay - 1) % DAY_ICONS.length} size={18} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-sm font-medium">Day {claim.cycleDay} — Streak {claim.streak}</p>
                                                    <p className="text-white/30 text-[11px]">{claim.claimDate} | {claim.rewardType}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-emerald-400 font-bold text-sm">+{formatReward(claim.totalReward, claim.currency)}</p>
                                                    {claim.jackpotAmount > 0 && <p className="text-yellow-400 text-[10px] font-bold">Jackpot!</p>}
                                                    {claim.weeklyMegaClaimed && <p className="text-orange-400 text-[10px] font-bold">Weekly Mega!</p>}
                                                </div>
                                            </motion.div>
                                        ))}
                                        <div className="flex justify-center gap-3 mt-4">
                                            <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage <= 1}
                                                className="px-4 py-2 rounded-lg bg-white/[0.05] text-white/40 text-sm disabled:opacity-30">Prev</button>
                                            <span className="px-4 py-2 text-white/30 text-sm">Page {historyPage}</span>
                                            <button onClick={() => setHistoryPage(p => p + 1)} disabled={history.length < 20}
                                                className="px-4 py-2 rounded-lg bg-white/[0.05] text-white/40 text-sm disabled:opacity-30">Next</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                      </div>
                    </div>

                    <Footer />
                </main>
            </div>
            <AnimatePresence>{claimResult && <ClaimResultOverlay result={claimResult} onClose={() => setClaimResult(null)} />}</AnimatePresence>
        </div>
    );
}

// ─── FAQ Item ────────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className={`border rounded-xl transition-all duration-200 cursor-pointer ${open ? 'border-amber-500/30 bg-white/[0.04]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]'}`}
            onClick={() => setOpen(!open)}>
            <div className="flex items-center justify-between p-4 gap-3">
                <span className={`font-bold text-sm ${open ? 'text-amber-400' : 'text-white'}`}>{q}</span>
                <ChevronRight size={16} className={`text-white/30 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
            </div>
            {open && <div className="px-4 pb-4 text-white/40 text-sm leading-relaxed border-t border-white/[0.06] pt-3">{a}</div>}
        </div>
    );
}

// ─── Page Export ──────────────────────────────────────────────────────────────
export default function DailyRewardsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-bg-base flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>}>
            <DailyRewardsContent />
        </Suspense>
    );
}
