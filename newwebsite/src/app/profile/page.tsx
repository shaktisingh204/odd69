'use client';
import Link from 'next/link';
import { CreditCard, History, FileText, ChevronRight, Users, TrendingUp, Edit2, CheckCircle, XCircle, Loader2, Settings, Gift, Trophy } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import WalletOverview from '@/components/profile/WalletOverview';
import BonusActivationModal from '@/components/profile/BonusActivationModal';
import { useState, useEffect } from 'react';
import api from '@/services/api';
import toast from 'react-hot-toast';

const baseMenuItems = [
    {
        href: '/profile/bet-history',
        icon: TrendingUp,
        label: 'Sports Bet History',
        desc: 'View all exchange bets & results',
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
    },
    {
        href: '/profile/casino-transactions',
        icon: History,
        label: 'Casino Transactions',
        desc: 'View betting history and game logs',
        color: 'text-accent-purple',
        bg: 'bg-purple-500/10',
    },
    {
        href: '/fantasy/history',
        icon: Trophy,
        label: 'Fantasy History',
        desc: 'Contests, ranks & winnings',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
    },
    {
        href: '/profile/transactions',
        icon: CreditCard,
        label: 'Deposit / Withdraw',
        desc: 'Manage funds & view history',
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
    },
    {
        href: '/profile/referral',
        icon: Users,
        label: 'Refer & Earn',
        desc: 'Invite friends and earn rewards',
        color: 'text-warning-bright',
        bg: 'bg-warning-alpha-08',
    },
    {
        href: '/settings',
        icon: Settings,
        label: 'Settings',
        desc: 'Change password, username & preferences',
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
    },
    {
        href: '/profile/rules',
        icon: FileText,
        label: 'Rules & Regulations',
        desc: 'Platform rules and guidelines',
        color: 'text-white/20',
        bg: 'bg-white/[0.04]',
    },
];

// ─── Username Change Widget ────────────────────────────────────────────────────

function UsernameEditor({ currentUsername, onUpdate }: { currentUsername: string; onUpdate: (u: string) => void }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(currentUsername);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        const trimmed = value.trim();
        if (!trimmed || trimmed === currentUsername) { setEditing(false); return; }

        // Client-side validation
        if (trimmed.length < 3 || trimmed.length > 20) { setError('Must be 3–20 characters.'); return; }
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setError('Letters, numbers, underscores only.'); return; }

        setLoading(true);
        setError('');
        try {
            const res = await api.patch('/user/username', { username: trimmed });
            if (res.data.success) {
                onUpdate(res.data.username);
                setEditing(false);
                toast.success(`Username changed to ${res.data.username}`);
            } else {
                setError(res.data.error || 'Failed to update.');
            }
        } catch (e: any) {
            setError(e.response?.data?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    if (!editing) {
        return (
            <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{currentUsername || 'User'}</h1>
                <button
                    onClick={() => { setValue(currentUsername); setError(''); setEditing(true); }}
                    className="p-1 rounded-lg hover:bg-white/[0.08] transition-colors"
                    title="Change username"
                >
                    <Edit2 size={13} className="text-white/30 hover:text-brand-gold transition-colors" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <input
                    autoFocus
                    type="text"
                    value={value}
                    onChange={e => {
                        // Strip any character that isn't a-z, A-Z, 0-9, or _  (no hyphens, spaces, etc.)
                        const clean = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                        setValue(clean);
                        setError('');
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                    maxLength={20}
                    placeholder="new_username"
                    className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-brand-gold/60 w-40 font-mono"
                />
                {loading ? (
                    <Loader2 size={16} className="animate-spin text-brand-gold" />
                ) : (
                    <>
                        <button onClick={handleSave} className="p-1.5 rounded-lg bg-brand-gold/10 hover:bg-brand-gold/20 transition-colors">
                            <CheckCircle size={14} className="text-brand-gold" />
                        </button>
                        <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors">
                            <XCircle size={14} className="text-white/30" />
                        </button>
                    </>
                )}
            </div>
            {error && <p className="text-danger text-[11px] px-1">{error}</p>}
            <p className="text-[10px] text-white/20 px-1">3–20 chars · letters, numbers, _ only</p>
        </div>
    );
}

// ─── Bonus Card ───────────────────────────────────────────────────────────────

function BonusCard() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="group flex items-center gap-3 bg-bg-modal hover:bg-bg-input-2 border border-amber-500/20 hover:border-amber-500/40 rounded-xl p-4 transition-all text-left w-full"
            >
                <div className="w-10 h-10 rounded-lg bg-warning-alpha-08 flex items-center justify-center flex-shrink-0">
                    <Gift size={18} className="text-warning-bright" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white group-hover:text-warning-bright transition-colors">My Bonuses</h3>
                    <p className="text-[11px] text-white/30 truncate">View & manage your active bonuses</p>
                </div>
                <ChevronRight size={16} className="text-white/10 group-hover:text-warning-bright/50 transition-colors flex-shrink-0" />
            </button>
            <BonusActivationModal isOpen={open} onClose={() => setOpen(false)} />
        </>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
    const { user, login } = useAuth();
    const [displayUsername, setDisplayUsername] = useState(user?.username || '');

    // Keep in sync when AuthContext finishes hydrating
    useEffect(() => {
        if (user?.username) setDisplayUsername(user.username);
    }, [user?.username]);

    const handleUsernameUpdate = async (newUsername: string) => {
        setDisplayUsername(newUsername);
        // Re-fetch the profile so AuthContext gets the fresh username
        try {
            const res = await api.get('/auth/profile');
            const token = localStorage.getItem('token') || '';
            if (token) login(token, res.data);
        } catch { /* non-critical — display username is already updated locally */ }
    };

    return (
        <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-bg-surface border border-white/[0.06] flex items-center justify-center text-brand-gold font-black text-xl">
                        {displayUsername?.substring(0, 2).toUpperCase() || 'U'}
                    </div>
                    <div>
                        <UsernameEditor currentUsername={displayUsername || user?.username || 'User'} onUpdate={handleUsernameUpdate} />
                        <p className="text-xs text-white/30">Welcome back to your profile</p>
                    </div>
                </div>
                <Link
                    href="/settings"
                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl transition-colors text-sm font-bold text-white/80 hover:text-white"
                >
                    <Settings size={14} className="text-brand-gold" />
                    Edit Profile
                </Link>
            </div>

            {/* Wallet */}
            <WalletOverview />

            {/* Menu Grid */}
            <div className="space-y-2">
                <h2 className="text-xs font-bold text-white/20 uppercase tracking-wider px-1">Account</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* My Bonuses — opens modal inline */}
                    <BonusCard />

                    {baseMenuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="group flex items-center gap-3 bg-bg-modal hover:bg-bg-input-2 border border-white/[0.06] hover:border-white/[0.06] rounded-xl p-4 transition-all"
                        >
                            <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                                <item.icon size={18} className={item.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-white group-hover:text-brand-gold transition-colors">{item.label}</h3>
                                <p className="text-[11px] text-white/30 truncate">{item.desc}</p>
                            </div>
                            <ChevronRight size={16} className="text-white/10 group-hover:text-white/30 transition-colors flex-shrink-0" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
