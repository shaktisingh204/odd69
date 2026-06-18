"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
    getDailyCheckinConfig,
    saveDailyCheckinConfig,
    resetDailyCheckinConfig,
    toggleDailyCheckin,
    getDailyCheckinClaims,
    getDailyCheckinStats,
    getDailyCheckinLeaderboard,
} from '@/actions/daily-checkin';
import {
    Gift, Save, RotateCcw, Power, Calendar, Shuffle, Clock,
    ChevronDown, AlertTriangle, Info, Zap, Trophy, Coins,
    Target, Star, Users, BarChart3, History, Crown, Flame,
    Sparkles, Award, TrendingUp, DollarSign, Search,
    ChevronLeft, ChevronRight, HelpCircle, ArrowUp, ArrowDown, Plus, Trash2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ScheduleType = 'daily' | 'weekly' | 'monthly' | 'custom';
type RewardMode = 'fixed' | 'random';
type TabId = 'config' | 'features' | 'claims' | 'stats';

interface Config {
    _id?: string;
    enabled: boolean;
    hidden: boolean;
    scheduleType: ScheduleType;
    customIntervalDays: number;
    rewardMode: RewardMode;
    fixedRewards: number[];
    randomMin: number[];
    randomMax: number[];
    currency: 'INR' | 'USD';
    walletTarget: 'MAIN' | 'BONUS';
    requiresDeposit: boolean;
    minDepositAmount: number;
    streakResetOnMiss: boolean;
    cycleDays: number;
    milestoneMultipliers: Record<string, number>;
    maxDailyClaimsPerUser: number;
    maxTotalRewardPerUser: number;
    activeFrom: string | null;
    activeTo: string | null;
    updatedBy: string;
    note: string;
    // New features
    spinWheelEnabled: boolean;
    spinWheelSlices: { label: string; value: number; color: string; probability: number }[];
    vipMultiplierEnabled: boolean;
    vipTierMultipliers: Record<string, number>;
    luckyJackpotEnabled: boolean;
    luckyJackpotChancePercent: number;
    luckyJackpotAmount: number;
    weeklyMegaRewardEnabled: boolean;
    weeklyMegaRewardAmount: number;
    weeklyMegaStreakRequired: number;
    monthlyGrandPrizeEnabled: boolean;
    monthlyGrandPrizeAmount: number;
    monthlyGrandPrizeStreakRequired: number;
    achievementsEnabled: boolean;
    achievements: { id: string; name: string; description: string; icon: string; streakRequired?: number; totalEarnedRequired?: number; reward: number }[];
    referralBonusEnabled: boolean;
    referralBonusPercent: number;
    referralBonusMaxPerDay: number;
    leaderboardEnabled: boolean;
    leaderboardTopN: number;
    faqs: { q: string; a: string }[];
}

const DEFAULTS: Config = {
    enabled: true, hidden: false, scheduleType: 'daily', customIntervalDays: 1, rewardMode: 'fixed',
    fixedRewards: [10, 20, 30, 50, 75, 100, 200], randomMin: [5, 10, 15, 25, 35, 50, 100],
    randomMax: [20, 40, 60, 100, 150, 200, 500], currency: 'INR', walletTarget: 'MAIN',
    requiresDeposit: true, minDepositAmount: 0, streakResetOnMiss: false, cycleDays: 7,
    milestoneMultipliers: { '7': 2, '30': 5 }, maxDailyClaimsPerUser: 1, maxTotalRewardPerUser: 0,
    activeFrom: null, activeTo: null, updatedBy: 'admin', note: '',
    spinWheelEnabled: true, spinWheelSlices: [
        { label: '₹5', value: 5, color: '#FF6B6B', probability: 25 },
        { label: '₹10', value: 10, color: '#4ECDC4', probability: 20 },
        { label: '₹25', value: 25, color: '#45B7D1', probability: 15 },
        { label: '₹50', value: 50, color: '#96CEB4', probability: 12 },
        { label: '₹100', value: 100, color: '#FFEAA7', probability: 10 },
        { label: '₹200', value: 200, color: '#DDA0DD', probability: 8 },
        { label: '₹500', value: 500, color: '#FF9FF3', probability: 5 },
        { label: 'JACKPOT', value: 2000, color: '#FFD700', probability: 2 },
        { label: '₹15', value: 15, color: '#A8E6CF', probability: 3 },
    ],
    vipMultiplierEnabled: true, vipTierMultipliers: { BRONZE: 1, SILVER: 1.5, GOLD: 2, PLATINUM: 3, DIAMOND: 5 },
    luckyJackpotEnabled: true, luckyJackpotChancePercent: 2, luckyJackpotAmount: 5000,
    weeklyMegaRewardEnabled: true, weeklyMegaRewardAmount: 1000, weeklyMegaStreakRequired: 7,
    monthlyGrandPrizeEnabled: true, monthlyGrandPrizeAmount: 10000, monthlyGrandPrizeStreakRequired: 30,
    achievementsEnabled: true, achievements: [
        { id: 'first_claim', name: 'First Steps', description: 'Claim your first daily reward', icon: '🎯', streakRequired: 1, reward: 50 },
        { id: 'streak_3', name: 'Getting Warmed Up', description: 'Maintain a 3-day streak', icon: '🔥', streakRequired: 3, reward: 100 },
        { id: 'streak_7', name: 'Week Warrior', description: 'Complete a full 7-day streak', icon: '⚔️', streakRequired: 7, reward: 500 },
        { id: 'streak_14', name: 'Fortnight Fighter', description: '14-day streak achieved', icon: '🛡️', streakRequired: 14, reward: 1000 },
        { id: 'streak_30', name: 'Monthly Master', description: '30-day streak legend', icon: '👑', streakRequired: 30, reward: 5000 },
        { id: 'streak_60', name: 'Diamond Hands', description: '60-day streak champion', icon: '💎', streakRequired: 60, reward: 10000 },
        { id: 'streak_100', name: 'Century Club', description: '100-day streak immortal', icon: '🏆', streakRequired: 100, reward: 25000 },
        { id: 'total_10k', name: 'Big Earner', description: 'Earn total from daily rewards', icon: '💰', totalEarnedRequired: 10000, reward: 2000 },
    ],
    referralBonusEnabled: true, referralBonusPercent: 20, referralBonusMaxPerDay: 500,
    leaderboardEnabled: true, leaderboardTopN: 10,
    faqs: [
        { q: 'What happens if I miss a day?', a: 'Depending on the settings, your streak may reset to 0 or continue from where you left off.' },
        { q: 'How does the spin wheel work?', a: 'Instead of claiming a fixed reward, you can spin the wheel for a random prize.' },
        { q: 'What are VIP multipliers?', a: 'VIP members get automatic reward multipliers on every daily claim.' },
        { q: 'How do milestone rewards work?', a: 'Hit streak milestones for bonus multipliers and mega rewards.' },
        { q: 'Do I need to deposit to claim rewards?', a: 'Yes, at least one deposit is required to be eligible.' },
    ],
};

// ─── Shared Components ───────────────────────────────────────────────────────
const DAY_EMOJI = ['🎁', '⚡', '💎', '🔥', '⭐', '🏆', '👑', '🎯', '💫', '🌟', '🎊', '🎉', '🏅', '🥇'];
const CURRENCY_SYMBOL: Record<string, string> = { INR: '₹', USD: '$' };

function Toggle({ checked, onChange, color = 'green' }: { checked: boolean; onChange: (v: boolean) => void; color?: string }) {
    const colors: Record<string, string> = { green: 'peer-checked:bg-emerald-500', amber: 'peer-checked:bg-amber-500', red: 'peer-checked:bg-red-500', violet: 'peer-checked:bg-violet-500', blue: 'peer-checked:bg-blue-500', pink: 'peer-checked:bg-pink-500' };
    return (
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
            <div className={`w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${colors[color] || colors.green}`} />
        </label>
    );
}

function Card({ title, icon: Icon, iconColor = 'text-violet-400', children, badge }: {
    title: string; icon: any; iconColor?: string; children: React.ReactNode; badge?: React.ReactNode;
}) {
    return (
        <div className="bg-slate-800 rounded-2xl border border-slate-700/80 p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl bg-slate-700/60 flex items-center justify-center ${iconColor}`}>
                    <Icon size={15} />
                </div>
                <h2 className="text-[15px] font-bold text-white flex-1">{title}</h2>
                {badge}
            </div>
            {children}
        </div>
    );
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
    return (
        <label className="block text-[13px] font-medium text-slate-400 mb-1.5">
            {children}
            {hint && <span className="ml-1.5 text-slate-600 text-[11px] font-normal">{hint}</span>}
        </label>
    );
}

function Input({ value, onChange, type = 'text', placeholder, min, max, step, className = '' }: any) {
    return (
        <input type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder}
            min={min} max={max} step={step}
            className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-[13px] text-white focus:border-violet-500 outline-none placeholder-slate-600 transition-colors ${className}`}
        />
    );
}

function Select({ value, onChange, options, className = '' }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
    return (
        <div className="relative">
            <select value={value} onChange={e => onChange(e.target.value)}
                className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-[13px] text-white focus:border-violet-500 outline-none appearance-none pr-8 transition-colors ${className}`}>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
    );
}

function StatusPill({ on, labels }: { on: boolean; labels: [string, string] }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${on ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            {on ? labels[0] : labels[1]}
        </span>
    );
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700/80 p-4">
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon size={13} />
                </div>
                <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DailyRewardsSettingsPage() {
    const [cfg, setCfg] = useState<Config>(DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [milestoneJson, setMilestoneJson] = useState('');
    const [milestoneError, setMilestoneError] = useState('');
    const [activeTab, setActiveTab] = useState<TabId>('config');

    // Claims state
    const [claims, setClaims] = useState<any[]>([]);
    const [claimsPage, setClaimsPage] = useState(1);
    const [claimsTotalPages, setClaimsTotalPages] = useState(1);
    const [claimsSearch, setClaimsSearch] = useState('');
    const [claimsLoading, setClaimsLoading] = useState(false);

    // Stats state
    const [stats, setStats] = useState<any>(null);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [statsLoading, setStatsLoading] = useState(false);

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    // ── Load Config ──────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        const res = await getDailyCheckinConfig();
        if (res.success && res.data) {
            const d = res.data;
            setCfg({
                ...DEFAULTS, ...d,
                fixedRewards: Array.isArray(d.fixedRewards) ? d.fixedRewards : DEFAULTS.fixedRewards,
                randomMin: Array.isArray(d.randomMin) ? d.randomMin : DEFAULTS.randomMin,
                randomMax: Array.isArray(d.randomMax) ? d.randomMax : DEFAULTS.randomMax,
                spinWheelSlices: Array.isArray(d.spinWheelSlices) && d.spinWheelSlices.length > 0 ? d.spinWheelSlices : DEFAULTS.spinWheelSlices,
                achievements: Array.isArray(d.achievements) && d.achievements.length > 0 ? d.achievements : DEFAULTS.achievements,
                faqs: Array.isArray(d.faqs) && d.faqs.length > 0 ? d.faqs : DEFAULTS.faqs,
                vipTierMultipliers: d.vipTierMultipliers && typeof d.vipTierMultipliers === 'object' ? d.vipTierMultipliers : DEFAULTS.vipTierMultipliers,
                activeFrom: d.activeFrom ? new Date(d.activeFrom).toISOString().split('T')[0] : null,
                activeTo: d.activeTo ? new Date(d.activeTo).toISOString().split('T')[0] : null,
            });
            setMilestoneJson(JSON.stringify(d.milestoneMultipliers ?? {}, null, 2));
        }
        setLoading(false);
    }, []);

    // ── Load Claims ──────────────────────────────────────────────────────
    const loadClaims = useCallback(async () => {
        setClaimsLoading(true);
        const res = await getDailyCheckinClaims(claimsPage, 50, claimsSearch);
        if (res.success) {
            setClaims(res.data || []);
            setClaimsTotalPages(res.totalPages || 1);
        }
        setClaimsLoading(false);
    }, [claimsPage, claimsSearch]);

    // ── Load Stats ───────────────────────────────────────────────────────
    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        const [statsRes, lbRes] = await Promise.all([
            getDailyCheckinStats(),
            getDailyCheckinLeaderboard(10),
        ]);
        if (statsRes.success) setStats(statsRes.data);
        if (lbRes.success) setLeaderboard(lbRes.data || []);
        setStatsLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (activeTab === 'claims') loadClaims(); }, [activeTab, loadClaims]);
    useEffect(() => { if (activeTab === 'stats') loadStats(); }, [activeTab, loadStats]);

    // ── Config helpers ───────────────────────────────────────────────────
    const set = (key: keyof Config, value: any) => setCfg(prev => ({ ...prev, [key]: value }));

    const setArrayField = (field: 'fixedRewards' | 'randomMin' | 'randomMax', index: number, value: string) => {
        setCfg(prev => {
            const arr = [...(prev[field] as number[])];
            arr[index] = Number(value) || 0;
            return { ...prev, [field]: arr };
        });
    };

    const resizeCycle = (newLen: number) => {
        setCfg(prev => {
            const resize = (arr: number[], fill: number) => {
                const a = [...arr];
                while (a.length < newLen) a.push(fill);
                return a.slice(0, newLen);
            };
            return { ...prev, cycleDays: newLen, fixedRewards: resize(prev.fixedRewards, 10), randomMin: resize(prev.randomMin, 5), randomMax: resize(prev.randomMax, 20) };
        });
    };

    const parseMilestones = (raw: string) => {
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed !== 'object') throw new Error();
            setMilestoneError('');
            set('milestoneMultipliers', parsed);
        } catch { setMilestoneError('Invalid JSON'); }
    };

    const updateSpinSlice = (index: number, field: string, value: any) => {
        setCfg(prev => {
            const slices = [...prev.spinWheelSlices];
            slices[index] = { ...slices[index], [field]: field === 'label' || field === 'color' ? value : Number(value) || 0 };
            return { ...prev, spinWheelSlices: slices };
        });
    };

    const addSpinSlice = () => {
        setCfg(prev => ({
            ...prev,
            spinWheelSlices: [...prev.spinWheelSlices, { label: '₹10', value: 10, color: '#FF6B6B', probability: 10 }],
        }));
    };

    const removeSpinSlice = (index: number) => {
        setCfg(prev => ({ ...prev, spinWheelSlices: prev.spinWheelSlices.filter((_, i) => i !== index) }));
    };

    const updateVipTier = (tier: string, value: string) => {
        setCfg(prev => ({ ...prev, vipTierMultipliers: { ...prev.vipTierMultipliers, [tier]: Number(value) || 1 } }));
    };

    const updateAchievement = (index: number, field: string, value: any) => {
        setCfg(prev => {
            const achs = [...prev.achievements];
            achs[index] = { ...achs[index], [field]: field === 'reward' || field === 'streakRequired' || field === 'totalEarnedRequired' ? Number(value) || 0 : value };
            return { ...prev, achievements: achs };
        });
    };

    // FAQ helpers
    const updateFaq = (index: number, field: 'q' | 'a', value: string) => {
        setCfg(prev => {
            const faqs = [...prev.faqs];
            faqs[index] = { ...faqs[index], [field]: value };
            return { ...prev, faqs };
        });
    };

    const addFaq = () => {
        setCfg(prev => ({ ...prev, faqs: [...prev.faqs, { q: '', a: '' }] }));
    };

    const removeFaq = (index: number) => {
        setCfg(prev => ({ ...prev, faqs: prev.faqs.filter((_, i) => i !== index) }));
    };

    const moveFaq = (index: number, direction: -1 | 1) => {
        setCfg(prev => {
            const faqs = [...prev.faqs];
            const target = index + direction;
            if (target < 0 || target >= faqs.length) return prev;
            [faqs[index], faqs[target]] = [faqs[target], faqs[index]];
            return { ...prev, faqs };
        });
    };

    // ── Actions ──────────────────────────────────────────────────────────
    const handleToggle = async (val: boolean) => {
        set('enabled', val);
        const res = await toggleDailyCheckin(val);
        if (!res.success) { set('enabled', !val); showToast('error', 'Toggle failed'); }
        else showToast('success', val ? 'Daily check-in enabled' : 'Daily check-in disabled');
    };

    const handleSave = async () => {
        if (milestoneError) { showToast('error', 'Fix milestone JSON before saving'); return; }
        setSaving(true);
        const res = await saveDailyCheckinConfig({ ...cfg, milestoneMultipliers: cfg.milestoneMultipliers });
        setSaving(false);
        if (res.success) showToast('success', 'Saved successfully!');
        else showToast('error', res.error || 'Save failed');
    };

    const handleReset = async () => {
        if (!confirm('Reset all settings to defaults?')) return;
        const res = await resetDailyCheckinConfig();
        if (res.success) { await load(); showToast('success', 'Reset to defaults'); }
        else showToast('error', 'Reset failed');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                    <p className="text-slate-500 text-sm">Loading configuration...</p>
                </div>
            </div>
        );
    }

    const sym = CURRENCY_SYMBOL[cfg.currency] || '₹';

    const TABS: { id: TabId; label: string; icon: any }[] = [
        { id: 'config', label: 'Configuration', icon: Gift },
        { id: 'features', label: 'New Features', icon: Sparkles },
        { id: 'claims', label: 'Claim History', icon: History },
        { id: 'stats', label: 'Stats & Leaderboard', icon: BarChart3 },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-5 right-5 z-[999] px-5 py-3 rounded-xl border text-sm font-semibold shadow-xl ${toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-red-500/15 border-red-500/40 text-red-300'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-900/30">
                            <Gift size={16} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Daily Rewards</h1>
                        <StatusPill on={cfg.enabled} labels={['LIVE', 'PAUSED']} />
                    </div>
                    <p className="text-[13px] text-slate-500 ml-12">Full control over daily rewards, spin wheel, achievements, and more.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all">
                        <RotateCcw size={13} /> Reset
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-50 shadow shadow-violet-900/30">
                        <Save size={13} /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl border border-slate-700/50">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-all ${activeTab === tab.id ? 'bg-violet-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════ CONFIG TAB ═══════════════ */}
            {activeTab === 'config' && (
                <div className="space-y-6">
                    {/* Master Toggle */}
                    <Card title="Master Control" icon={Power} iconColor="text-emerald-400">
                        <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-900/60 border border-slate-700 p-4">
                            <div>
                                <p className="text-[14px] font-semibold text-white">Daily Check-In System</p>
                                <p className="text-[12px] text-slate-500 mt-0.5">{cfg.enabled ? 'Users can collect their daily rewards.' : 'System is paused — users can see the page but cannot claim.'}</p>
                            </div>
                            <Toggle checked={cfg.enabled} onChange={handleToggle} color="green" />
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-900/60 border border-red-900/40 p-4">
                            <div>
                                <p className="text-[14px] font-semibold text-white">Hide Daily Rewards</p>
                                <p className="text-[12px] text-slate-500 mt-0.5">
                                    {cfg.hidden
                                        ? 'The Daily Rewards page, navigation links, header button, and auto-prompt are completely hidden from all users.'
                                        : 'The Daily Rewards section is visible to users in navigation and on the site.'}
                                </p>
                            </div>
                            <Toggle checked={cfg.hidden} onChange={async (val) => {
                                set('hidden', val);
                                const res = await saveDailyCheckinConfig({ ...cfg, hidden: val });
                                if (!res.success) { set('hidden', !val); showToast('error', 'Failed to update visibility'); }
                                else showToast('success', val ? 'Daily Rewards is now hidden from all users' : 'Daily Rewards is now visible');
                            }} color="red" />
                        </div>
                    </Card>

                    {/* Schedule */}
                    <Card title="Reward Schedule" icon={Calendar} iconColor="text-blue-400">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <Label hint="How often users can check in">Schedule Type</Label>
                                <Select value={cfg.scheduleType} onChange={v => set('scheduleType', v as ScheduleType)}
                                    options={[
                                        { value: 'daily', label: 'Daily (once per day)' },
                                        { value: 'weekly', label: 'Weekly' },
                                        { value: 'monthly', label: 'Monthly' },
                                        { value: 'custom', label: 'Custom interval' },
                                    ]} />
                                {cfg.scheduleType === 'custom' && (
                                    <div className="mt-3"><Label>Interval (days)</Label><Input type="number" min={1} max={365} value={cfg.customIntervalDays} onChange={(e: any) => set('customIntervalDays', Number(e.target.value))} /></div>
                                )}
                            </div>
                            <div>
                                <Label>Cycle Length (days)</Label>
                                <Select value={String(cfg.cycleDays)} onChange={v => resizeCycle(Number(v))}
                                    options={[3, 5, 7, 10, 14].map(n => ({ value: String(n), label: `${n} days` }))} />
                            </div>
                            <div><Label>Campaign Start</Label><Input type="date" value={cfg.activeFrom || ''} onChange={(e: any) => set('activeFrom', e.target.value || null)} /></div>
                            <div><Label>Campaign End</Label><Input type="date" value={cfg.activeTo || ''} onChange={(e: any) => set('activeTo', e.target.value || null)} /></div>
                        </div>
                    </Card>

                    {/* Reward Mode */}
                    <Card title="Reward Amounts" icon={Coins} iconColor="text-amber-400">
                        <div className="flex gap-3">
                            {(['fixed', 'random'] as RewardMode[]).map(mode => (
                                <button key={mode} onClick={() => set('rewardMode', mode)}
                                    className={`flex-1 py-3 rounded-xl text-[13px] font-semibold border transition-all flex items-center justify-center gap-2 ${cfg.rewardMode === mode ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-white'}`}>
                                    {mode === 'fixed' ? <><Gift size={14} /> Fixed</> : <><Shuffle size={14} /> Random</>}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Currency</Label><Select value={cfg.currency} onChange={v => set('currency', v)} options={[{ value: 'INR', label: '₹ INR' }, { value: 'USD', label: '$ USD' }]} /></div>
                            <div><Label>Credit To</Label><Select value={cfg.walletTarget} onChange={v => set('walletTarget', v)} options={[{ value: 'MAIN', label: 'Main Wallet' }, { value: 'BONUS', label: 'Bonus Wallet' }]} /></div>
                        </div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: cfg.rewardMode === 'fixed' ? 'repeat(auto-fill, minmax(80px, 1fr))' : '1fr' }}>
                            {cfg.rewardMode === 'fixed' ? (
                                Array.from({ length: cfg.cycleDays }, (_, i) => (
                                    <div key={i} className="flex flex-col items-center gap-1.5 bg-slate-900 rounded-xl p-2.5 border border-slate-700/60">
                                        <span className="text-[16px]">{DAY_EMOJI[i] || '🎁'}</span>
                                        <span className="text-[10px] text-slate-500 font-semibold">Day {i + 1}</span>
                                        <input type="number" min={0} value={cfg.fixedRewards[i] ?? 0} onChange={e => setArrayField('fixedRewards', i, e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[12px] text-white outline-none text-center focus:border-amber-500 transition-colors" />
                                    </div>
                                ))
                            ) : (
                                Array.from({ length: cfg.cycleDays }, (_, i) => (
                                    <div key={i} className="grid grid-cols-[60px_1fr_1fr] items-center gap-3 bg-slate-900 rounded-xl px-4 py-3 border border-slate-700/60">
                                        <div className="flex items-center gap-2"><span>{DAY_EMOJI[i]}</span><span className="text-[11px] text-slate-500 font-bold">D{i + 1}</span></div>
                                        <div><Label hint="min">Min {sym}</Label><input type="number" min={0} value={cfg.randomMin[i] ?? 0} onChange={e => setArrayField('randomMin', i, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-amber-500" /></div>
                                        <div><Label hint="max">Max {sym}</Label><input type="number" min={0} value={cfg.randomMax[i] ?? 0} onChange={e => setArrayField('randomMax', i, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-amber-500" /></div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* Deposit Gate */}
                    <Card title="Deposit Requirement" icon={AlertTriangle} iconColor="text-orange-400">
                        <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-900/60 border border-slate-700 p-4">
                            <div><p className="text-[14px] font-semibold text-white">Require Deposit</p><p className="text-[12px] text-slate-500 mt-0.5">Users must have deposited to claim.</p></div>
                            <Toggle checked={cfg.requiresDeposit} onChange={v => set('requiresDeposit', v)} color="amber" />
                        </div>
                        {cfg.requiresDeposit && (
                            <div><Label>Min Deposit Amount ({sym})</Label><Input type="number" min={0} value={cfg.minDepositAmount} onChange={(e: any) => set('minDepositAmount', Number(e.target.value))} /></div>
                        )}
                    </Card>

                    {/* Streak */}
                    <Card title="Streak & Milestones" icon={Trophy} iconColor="text-yellow-400">
                        <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-900/60 border border-slate-700 p-4">
                            <div><p className="text-[14px] font-semibold text-white">Reset Streak on Miss</p></div>
                            <Toggle checked={cfg.streakResetOnMiss} onChange={v => set('streakResetOnMiss', v)} color="red" />
                        </div>
                        <div>
                            <Label>Milestone Multipliers (JSON)</Label>
                            <textarea rows={3} value={milestoneJson} onChange={e => { setMilestoneJson(e.target.value); parseMilestones(e.target.value); }}
                                className={`w-full bg-slate-900 border rounded-lg px-3 py-2.5 text-[13px] text-white font-mono focus:outline-none resize-y placeholder-slate-600 ${milestoneError ? 'border-red-500' : 'border-slate-700 focus:border-violet-500'}`} />
                            {milestoneError && <p className="text-[11px] text-red-400 mt-1">{milestoneError}</p>}
                        </div>
                    </Card>

                    {/* Limits */}
                    <Card title="Claim Limits" icon={Clock} iconColor="text-cyan-400">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div><Label>Max Claims per Day</Label><Input type="number" min={1} max={10} value={cfg.maxDailyClaimsPerUser} onChange={(e: any) => set('maxDailyClaimsPerUser', Number(e.target.value))} /></div>
                            <div><Label>Max Total Reward ({sym})</Label><Input type="number" min={0} value={cfg.maxTotalRewardPerUser} onChange={(e: any) => set('maxTotalRewardPerUser', Number(e.target.value))} placeholder="0 (unlimited)" /></div>
                        </div>
                    </Card>

                    {/* Notes */}
                    <Card title="Admin Notes" icon={Info} iconColor="text-slate-400">
                        <textarea rows={3} value={cfg.note} onChange={e => set('note', e.target.value)} placeholder="Internal notes..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-[13px] text-white focus:border-violet-500 outline-none resize-y placeholder-slate-600" />
                    </Card>
                </div>
            )}

            {/* ═══════════════ FEATURES TAB ═══════════════ */}
            {activeTab === 'features' && (
                <div className="space-y-6">
                    {/* 1. Spin Wheel */}
                    <Card title="Spin Wheel" icon={Target} iconColor="text-pink-400"
                        badge={<Toggle checked={cfg.spinWheelEnabled} onChange={v => set('spinWheelEnabled', v)} color="pink" />}>
                        {cfg.spinWheelEnabled && (
                            <div className="space-y-3">
                                <p className="text-[12px] text-slate-500">Configure wheel slices. Total probability should sum to 100.</p>
                                <div className="space-y-2">
                                    {cfg.spinWheelSlices.map((slice, i) => (
                                        <div key={i} className="grid grid-cols-[40px_1fr_80px_80px_80px_32px] gap-2 items-center bg-slate-900 rounded-lg px-3 py-2 border border-slate-700/60">
                                            <div className="w-6 h-6 rounded-full border-2" style={{ backgroundColor: slice.color, borderColor: slice.color }} />
                                            <input value={slice.label} onChange={e => updateSpinSlice(i, 'label', e.target.value)}
                                                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[12px] text-white outline-none" placeholder="Label" />
                                            <input type="number" value={slice.value} onChange={e => updateSpinSlice(i, 'value', e.target.value)}
                                                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[12px] text-white outline-none text-center" placeholder="Value" />
                                            <input value={slice.color} onChange={e => updateSpinSlice(i, 'color', e.target.value)}
                                                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[12px] text-white outline-none" placeholder="#color" />
                                            <input type="number" value={slice.probability} onChange={e => updateSpinSlice(i, 'probability', e.target.value)}
                                                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[12px] text-white outline-none text-center" placeholder="%" />
                                            <button onClick={() => removeSpinSlice(i)} className="text-red-400 hover:text-red-300 text-[16px]">x</button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between">
                                    <button onClick={addSpinSlice} className="text-[12px] text-violet-400 hover:text-violet-300 font-medium">+ Add Slice</button>
                                    <span className="text-[11px] text-slate-500">Total: {cfg.spinWheelSlices.reduce((s, sl) => s + sl.probability, 0)}%</span>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* 2. VIP Multipliers */}
                    <Card title="VIP Tier Multipliers" icon={Crown} iconColor="text-yellow-400"
                        badge={<Toggle checked={cfg.vipMultiplierEnabled} onChange={v => set('vipMultiplierEnabled', v)} color="amber" />}>
                        {cfg.vipMultiplierEnabled && (
                            <div className="grid grid-cols-5 gap-3">
                                {Object.entries(cfg.vipTierMultipliers).map(([tier, mult]) => (
                                    <div key={tier} className="bg-slate-900 rounded-xl p-3 border border-slate-700/60 text-center">
                                        <p className="text-[11px] text-slate-500 font-bold mb-1">{tier}</p>
                                        <input type="number" step={0.5} min={1} value={mult}
                                            onChange={e => updateVipTier(tier, e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[13px] text-white outline-none text-center focus:border-yellow-500" />
                                        <p className="text-[10px] text-yellow-400/60 mt-1">x{mult}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* 3. Lucky Jackpot */}
                    <Card title="Lucky Jackpot" icon={Zap} iconColor="text-amber-400"
                        badge={<Toggle checked={cfg.luckyJackpotEnabled} onChange={v => set('luckyJackpotEnabled', v)} color="amber" />}>
                        {cfg.luckyJackpotEnabled && (
                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Chance (%)</Label><Input type="number" min={0} max={100} step={0.5} value={cfg.luckyJackpotChancePercent} onChange={(e: any) => set('luckyJackpotChancePercent', Number(e.target.value))} /></div>
                                <div><Label>Jackpot Amount ({sym})</Label><Input type="number" min={0} value={cfg.luckyJackpotAmount} onChange={(e: any) => set('luckyJackpotAmount', Number(e.target.value))} /></div>
                            </div>
                        )}
                    </Card>

                    {/* 4. Weekly Mega Reward */}
                    <Card title="Weekly Mega Reward" icon={Flame} iconColor="text-orange-400"
                        badge={<Toggle checked={cfg.weeklyMegaRewardEnabled} onChange={v => set('weeklyMegaRewardEnabled', v)} color="amber" />}>
                        {cfg.weeklyMegaRewardEnabled && (
                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Streak Required</Label><Input type="number" min={1} value={cfg.weeklyMegaStreakRequired} onChange={(e: any) => set('weeklyMegaStreakRequired', Number(e.target.value))} /></div>
                                <div><Label>Reward Amount ({sym})</Label><Input type="number" min={0} value={cfg.weeklyMegaRewardAmount} onChange={(e: any) => set('weeklyMegaRewardAmount', Number(e.target.value))} /></div>
                            </div>
                        )}
                    </Card>

                    {/* 5. Monthly Grand Prize */}
                    <Card title="Monthly Grand Prize" icon={Award} iconColor="text-purple-400"
                        badge={<Toggle checked={cfg.monthlyGrandPrizeEnabled} onChange={v => set('monthlyGrandPrizeEnabled', v)} color="violet" />}>
                        {cfg.monthlyGrandPrizeEnabled && (
                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Streak Required</Label><Input type="number" min={1} value={cfg.monthlyGrandPrizeStreakRequired} onChange={(e: any) => set('monthlyGrandPrizeStreakRequired', Number(e.target.value))} /></div>
                                <div><Label>Prize Amount ({sym})</Label><Input type="number" min={0} value={cfg.monthlyGrandPrizeAmount} onChange={(e: any) => set('monthlyGrandPrizeAmount', Number(e.target.value))} /></div>
                            </div>
                        )}
                    </Card>

                    {/* 6. Achievement Badges */}
                    <Card title="Achievement Badges" icon={Star} iconColor="text-emerald-400"
                        badge={<Toggle checked={cfg.achievementsEnabled} onChange={v => set('achievementsEnabled', v)} color="green" />}>
                        {cfg.achievementsEnabled && (
                            <div className="space-y-2">
                                {cfg.achievements.map((ach, i) => (
                                    <div key={i} className="grid grid-cols-[40px_1fr_1fr_100px_80px] gap-2 items-center bg-slate-900 rounded-lg px-3 py-2 border border-slate-700/60">
                                        <span className="text-xl text-center">{ach.icon}</span>
                                        <div>
                                            <input value={ach.name} onChange={e => updateAchievement(i, 'name', e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[12px] text-white outline-none mb-1" />
                                            <input value={ach.description} onChange={e => updateAchievement(i, 'description', e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-400 outline-none" />
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            {ach.streakRequired ? `Streak: ${ach.streakRequired}d` : `Total: ${sym}${ach.totalEarnedRequired}`}
                                        </div>
                                        <input type="number" value={ach.reward} onChange={e => updateAchievement(i, 'reward', e.target.value)}
                                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[12px] text-amber-300 outline-none text-center" />
                                        <span className="text-[10px] text-slate-500">bonus {sym}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* 7. Referral Daily Bonus */}
                    <Card title="Referral Daily Bonus" icon={Users} iconColor="text-blue-400"
                        badge={<Toggle checked={cfg.referralBonusEnabled} onChange={v => set('referralBonusEnabled', v)} color="blue" />}>
                        {cfg.referralBonusEnabled && (
                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Bonus Percent (%)</Label><Input type="number" min={0} max={100} value={cfg.referralBonusPercent} onChange={(e: any) => set('referralBonusPercent', Number(e.target.value))} /></div>
                                <div><Label>Max Per Day ({sym})</Label><Input type="number" min={0} value={cfg.referralBonusMaxPerDay} onChange={(e: any) => set('referralBonusMaxPerDay', Number(e.target.value))} /></div>
                            </div>
                        )}
                    </Card>

                    {/* 8. Leaderboard */}
                    <Card title="Leaderboard" icon={TrendingUp} iconColor="text-cyan-400"
                        badge={<Toggle checked={cfg.leaderboardEnabled} onChange={v => set('leaderboardEnabled', v)} color="green" />}>
                        {cfg.leaderboardEnabled && (
                            <div><Label>Top N Players</Label><Input type="number" min={3} max={100} value={cfg.leaderboardTopN} onChange={(e: any) => set('leaderboardTopN', Number(e.target.value))} /></div>
                        )}
                    </Card>

                    {/* 9. FAQs */}
                    <Card title="FAQs (Shown on Website)" icon={HelpCircle} iconColor="text-sky-400">
                        <p className="text-[12px] text-slate-500 -mt-2 mb-3">Manage the frequently asked questions displayed on the Daily Rewards page. Drag to reorder.</p>
                        <div className="space-y-3">
                            {cfg.faqs.map((faq, i) => (
                                <div key={i} className="bg-slate-900 rounded-xl border border-slate-700/60 p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-500 font-bold w-6 text-center">{i + 1}</span>
                                        <div className="flex-1" />
                                        <button onClick={() => moveFaq(i, -1)} disabled={i === 0}
                                            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-white disabled:opacity-20 transition-colors" title="Move up">
                                            <ArrowUp size={13} />
                                        </button>
                                        <button onClick={() => moveFaq(i, 1)} disabled={i === cfg.faqs.length - 1}
                                            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-white disabled:opacity-20 transition-colors" title="Move down">
                                            <ArrowDown size={13} />
                                        </button>
                                        <button onClick={() => removeFaq(i)}
                                            className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors" title="Remove">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                    <div>
                                        <Label hint="shown as heading">Question</Label>
                                        <Input value={faq.q} onChange={(e: any) => updateFaq(i, 'q', e.target.value)} placeholder="e.g. What happens if I miss a day?" />
                                    </div>
                                    <div>
                                        <Label hint="shown when expanded">Answer</Label>
                                        <textarea rows={3} value={faq.a} onChange={e => updateFaq(i, 'a', e.target.value)}
                                            placeholder="Write the answer here..."
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-[13px] text-white focus:border-sky-500 outline-none resize-y placeholder-slate-600 transition-colors" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={addFaq}
                            className="mt-3 flex items-center gap-2 text-[13px] text-sky-400 hover:text-sky-300 font-medium transition-colors">
                            <Plus size={14} /> Add FAQ
                        </button>
                        {cfg.faqs.length === 0 && (
                            <p className="text-[12px] text-slate-600 mt-2 text-center py-4">No FAQs added. Click &quot;Add FAQ&quot; to create one.</p>
                        )}
                    </Card>
                </div>
            )}

            {/* ═══════════════ CLAIMS TAB ═══════════════ */}
            {activeTab === 'claims' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input value={claimsSearch} onChange={e => { setClaimsSearch(e.target.value); setClaimsPage(1); }}
                                placeholder="Search by username or user ID..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-[13px] text-white outline-none focus:border-violet-500 placeholder-slate-600" />
                        </div>
                        <button onClick={loadClaims} className="px-4 py-2.5 rounded-lg bg-slate-700 text-[13px] text-white hover:bg-slate-600 transition-colors">
                            Refresh
                        </button>
                    </div>

                    {claimsLoading ? (
                        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /></div>
                    ) : claims.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">No claims found</div>
                    ) : (
                        <div className="bg-slate-800 rounded-xl border border-slate-700/80 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-[12px]">
                                    <thead>
                                        <tr className="border-b border-slate-700 text-slate-500">
                                            <th className="text-left px-4 py-3 font-semibold">User</th>
                                            <th className="text-center px-3 py-3 font-semibold">Day</th>
                                            <th className="text-center px-3 py-3 font-semibold">Streak</th>
                                            <th className="text-right px-3 py-3 font-semibold">Base</th>
                                            <th className="text-center px-3 py-3 font-semibold">VIP x</th>
                                            <th className="text-right px-3 py-3 font-semibold">Jackpot</th>
                                            <th className="text-right px-3 py-3 font-semibold">Total</th>
                                            <th className="text-center px-3 py-3 font-semibold">Type</th>
                                            <th className="text-left px-4 py-3 font-semibold">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {claims.map((c, i) => (
                                            <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                                                <td className="px-4 py-2.5 text-white font-medium">{c.username} <span className="text-slate-600">#{c.userId}</span></td>
                                                <td className="text-center px-3 py-2.5 text-slate-400">{c.cycleDay}</td>
                                                <td className="text-center px-3 py-2.5"><span className="text-amber-400 font-bold">{c.streak}</span></td>
                                                <td className="text-right px-3 py-2.5 text-slate-400">{sym}{c.baseReward}</td>
                                                <td className="text-center px-3 py-2.5 text-blue-400">{c.vipMultiplier > 1 ? `x${c.vipMultiplier}` : '-'}</td>
                                                <td className="text-right px-3 py-2.5">{c.jackpotAmount > 0 ? <span className="text-yellow-400 font-bold">{sym}{c.jackpotAmount}</span> : <span className="text-slate-600">-</span>}</td>
                                                <td className="text-right px-3 py-2.5 text-emerald-400 font-bold">{sym}{c.totalReward}</td>
                                                <td className="text-center px-3 py-2.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.rewardType === 'spin_wheel' ? 'bg-pink-500/15 text-pink-400' : c.rewardType === 'random' ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
                                                        {c.rewardType}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-500">{c.claimDate}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* Pagination */}
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
                                <span className="text-[12px] text-slate-500">Page {claimsPage} of {claimsTotalPages}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setClaimsPage(p => Math.max(1, p - 1))} disabled={claimsPage <= 1}
                                        className="p-1.5 rounded bg-slate-700 text-white disabled:opacity-30"><ChevronLeft size={14} /></button>
                                    <button onClick={() => setClaimsPage(p => Math.min(claimsTotalPages, p + 1))} disabled={claimsPage >= claimsTotalPages}
                                        className="p-1.5 rounded bg-slate-700 text-white disabled:opacity-30"><ChevronRight size={14} /></button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════ STATS TAB ═══════════════ */}
            {activeTab === 'stats' && (
                <div className="space-y-6">
                    {statsLoading ? (
                        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /></div>
                    ) : stats ? (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <StatBox label="Total Claims" value={stats.totalClaims.toLocaleString()} icon={Gift} color="bg-violet-500/20 text-violet-400" />
                                <StatBox label="Today's Claims" value={stats.todayClaims} icon={Calendar} color="bg-blue-500/20 text-blue-400" />
                                <StatBox label="Total Rewarded" value={`${sym}${stats.totalRewarded.toLocaleString()}`} icon={DollarSign} color="bg-emerald-500/20 text-emerald-400" />
                                <StatBox label="Today's Rewards" value={`${sym}${stats.todayRewarded.toLocaleString()}`} icon={TrendingUp} color="bg-amber-500/20 text-amber-400" />
                                <StatBox label="Unique Users" value={stats.uniqueUsers} icon={Users} color="bg-cyan-500/20 text-cyan-400" />
                                <StatBox label="Jackpot Hits" value={stats.jackpotHits} icon={Zap} color="bg-yellow-500/20 text-yellow-400" />
                                <StatBox label="Weekly Mega" value={stats.weeklyMegaHits} icon={Flame} color="bg-orange-500/20 text-orange-400" />
                                <StatBox label="Monthly Grand" value={stats.monthlyGrandHits} icon={Award} color="bg-purple-500/20 text-purple-400" />
                            </div>

                            {stats.topStreaker && (
                                <Card title="Top Streaker" icon={Crown} iconColor="text-yellow-400">
                                    <div className="flex items-center gap-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/5 rounded-xl p-4 border border-yellow-500/20">
                                        <span className="text-3xl">🏆</span>
                                        <div>
                                            <p className="text-white font-bold text-lg">{stats.topStreaker.username}</p>
                                            <p className="text-yellow-400 text-sm">{stats.topStreaker.streak}-day streak</p>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {leaderboard.length > 0 && (
                                <Card title="Leaderboard (Top Earners)" icon={TrendingUp} iconColor="text-cyan-400">
                                    <div className="space-y-2">
                                        {leaderboard.map((entry: any, i: number) => (
                                            <div key={i} className="flex items-center gap-3 bg-slate-900 rounded-lg px-4 py-3 border border-slate-700/60">
                                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' : i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-slate-700 text-slate-500'}`}>
                                                    {i + 1}
                                                </span>
                                                <div className="flex-1">
                                                    <p className="text-white text-[13px] font-medium">{entry.username}</p>
                                                    <p className="text-[11px] text-slate-500">{entry.totalClaims} claims | Max streak: {entry.maxStreak}</p>
                                                </div>
                                                <p className="text-emerald-400 font-bold text-[14px]">{sym}{entry.totalEarned.toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-12 text-slate-500">No stats available yet</div>
                    )}
                </div>
            )}

            {/* Save bar */}
            {(activeTab === 'config' || activeTab === 'features') && (
                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={handleReset} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-medium border border-slate-700 text-slate-400 hover:text-white transition-all">
                        <RotateCcw size={13} /> Reset
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-50 shadow-lg shadow-violet-900/20">
                        <Save size={14} /> {saving ? 'Saving...' : 'Save All Changes'}
                    </button>
                </div>
            )}
        </div>
    );
}
