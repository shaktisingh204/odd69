'use client';
import { TrendingUp, Lock, CheckCircle2, Zap, Gamepad2, Trophy, Clock, RotateCcw } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function WageringCard() {
    const {
        depositWageringRequired,
        depositWageringDone,
        casinoBonusWageringRequired,
        casinoBonusWageringDone,
        sportsBonusWageringRequired,
        sportsBonusWageringDone,
        fiatBonus,
        cryptoBonus,
        activeCasinoBonus,
        activeSportsBonus,
        activeSymbol,
        refreshWallet,
    } = useWallet();
    const { token } = useAuth();
    const [revoking, setRevoking] = useState<string | null>(null);

    const fmt = (n: number) =>
        new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

    const hasDepositLock = depositWageringRequired > 0;
    const depositDone = depositWageringDone;
    const depositPct = hasDepositLock
        ? Math.min(100, Math.round((depositDone / depositWageringRequired) * 100))
        : 100;
    const depositRemaining = Math.max(0, depositWageringRequired - depositDone);
    const depositComplete = depositDone >= depositWageringRequired;

    const hasCasinoBonus = casinoBonusWageringRequired > 0;
    const casinoPct = hasCasinoBonus
        ? Math.min(100, Math.round((casinoBonusWageringDone / casinoBonusWageringRequired) * 100))
        : 0;
    const casinoRemaining = Math.max(0, casinoBonusWageringRequired - casinoBonusWageringDone);
    const casinoComplete = hasCasinoBonus && casinoBonusWageringDone >= casinoBonusWageringRequired;

    const hasSportsBonus = sportsBonusWageringRequired > 0;
    const sportsPct = hasSportsBonus
        ? Math.min(100, Math.round((sportsBonusWageringDone / sportsBonusWageringRequired) * 100))
        : 0;
    const sportsRemaining = Math.max(0, sportsBonusWageringRequired - sportsBonusWageringDone);
    const sportsComplete = hasSportsBonus && sportsBonusWageringDone >= sportsBonusWageringRequired;

    if (!hasDepositLock && !hasCasinoBonus && !hasSportsBonus) return null;

    const handleRevoke = async (type: 'CASINO' | 'SPORTS') => {
        const label = type === 'CASINO' ? 'Casino' : 'Sports';
        if (!confirm(`Revoke your active ${label} bonus? This cannot be undone — your bonus balance will be cleared.`)) return;
        setRevoking(type);
        try {
            await api.post('/bonus/revoke', { type }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(`${label} bonus revoked`);
            await refreshWallet();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Failed to revoke bonus');
        } finally {
            setRevoking(null);
        }
    };

    return (
        <div className="space-y-3">

            {/* ── 1. Deposit Wagering Lock ── */}
            {hasDepositLock && (
                depositComplete ? (
                    <div className="bg-success-alpha-10 border border-success-primary/25 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-success-alpha-20 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={18} className="text-success-bright" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-success-bright">Deposit Wagering Complete!</p>
                            <p className="text-[11px] text-success-bright/60">Withdrawals are now unlocked.</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-bg-modal border border-amber-500/20 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-warning-alpha-12 flex items-center justify-center">
                                    <Lock size={13} className="text-warning-bright" />
                                </div>
                                <span className="text-xs font-bold text-warning-bright uppercase tracking-wider">
                                    Withdrawal Locked
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-warning-bright bg-warning-alpha-08 px-2 py-0.5 rounded-full border border-amber-500/20">
                                {depositPct}%
                            </span>
                        </div>

                        <div className="space-y-1.5">
                            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${depositPct}%`,
                                        background: 'linear-gradient(90deg, #8B5CF6, #f97316)',
                                        boxShadow: '0 0 4px rgba(139,92,246,0.08)',
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-white/30">
                                <span>{activeSymbol}{fmt(depositDone)} wagered</span>
                                <span>{activeSymbol}{fmt(depositWageringRequired)} required (1×)</span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                            <Zap size={13} className="text-warning-bright shrink-0 mt-0.5" />
                            <p className="text-[11px] text-warning-bright/80 leading-relaxed">
                                Bet{' '}
                                <span className="font-bold text-warning-bright">{activeSymbol}{fmt(depositRemaining)}</span>{' '}
                                more on Sports or Casino to unlock withdrawals.
                            </p>
                        </div>
                    </div>
                )
            )}

            {/* ── 2. Casino Bonus Wagering ── */}
            {hasCasinoBonus && (
                casinoComplete ? (
                    <div className="bg-success-alpha-10 border border-success-primary/25 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-success-alpha-20 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={18} className="text-success-bright" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-success-bright">🎰 Casino Bonus Wagering Complete!</p>
                            <p className="text-[11px] text-success-bright/60">Bonus has been added to your wallet 🎉</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-bg-modal border border-accent-purple/20 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-accent-purple-alpha flex items-center justify-center">
                                    <Gamepad2 size={13} className="text-accent-purple" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-accent-purple uppercase tracking-wider">
                                        Casino Bonus
                                    </span>
                                    {activeCasinoBonus && (
                                        <div className="text-[10px] text-accent-purple/60 mt-0.5 truncate max-w-[140px]">
                                            {activeCasinoBonus.bonusTitle}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {activeCasinoBonus?.daysLeft !== null && activeCasinoBonus?.daysLeft !== undefined && (
                                    <div className="flex items-center gap-1 text-[10px] text-accent-purple/50">
                                        <Clock size={9} />
                                        <span>{activeCasinoBonus.daysLeft}d left</span>
                                    </div>
                                )}
                                <span className="text-[10px] font-bold text-accent-purple bg-accent-purple-alpha px-2 py-0.5 rounded-full border border-accent-purple/20">
                                    {casinoPct}%
                                </span>
                                <button
                                    onClick={() => handleRevoke('CASINO')}
                                    disabled={revoking === 'CASINO'}
                                    className="p-1 rounded-lg hover:bg-danger-alpha-10 transition-colors"
                                    title="Revoke casino bonus"
                                >
                                    <RotateCcw size={11} className={`text-danger/50 hover:text-danger ${revoking === 'CASINO' ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${casinoPct}%`,
                                        background: 'linear-gradient(90deg, #a855f7, #6366f1)',
                                        boxShadow: '0 0 4px rgba(168,85,247,0.08)',
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-white/30">
                                <span>{activeSymbol}{fmt(casinoBonusWageringDone)} wagered</span>
                                <span>{activeSymbol}{fmt(casinoBonusWageringRequired)} required</span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 p-2.5 bg-accent-purple-soft/20 border border-accent-purple/10 rounded-lg">
                            <TrendingUp size={13} className="text-accent-purple shrink-0 mt-0.5" />
                            <p className="text-[11px] text-accent-purple/80 leading-relaxed">
                                Play casino games to wager{' '}
                                <span className="font-bold text-accent-purple">{activeSymbol}{fmt(casinoRemaining)}</span>{' '}
                                more to unlock your bonus automatically.
                            </p>
                        </div>
                    </div>
                )
            )}

            {/* ── 3. Sports Bonus Wagering ── */}
            {hasSportsBonus && (
                sportsComplete ? (
                    <div className="bg-success-alpha-10 border border-success-primary/25 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-success-alpha-20 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={18} className="text-success-bright" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-success-bright">⚽ Sports Bonus Wagering Complete!</p>
                            <p className="text-[11px] text-success-bright/60">Bonus has been added to your wallet 🎉</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-bg-modal border border-success-primary/20 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-success-alpha-16 flex items-center justify-center">
                                    <Trophy size={13} className="text-success-bright" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-success-bright uppercase tracking-wider">
                                        Sports Bonus
                                    </span>
                                    {activeSportsBonus && (
                                        <div className="text-[10px] text-success-bright/60 mt-0.5 truncate max-w-[140px]">
                                            {activeSportsBonus.bonusTitle}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {activeSportsBonus?.daysLeft !== null && activeSportsBonus?.daysLeft !== undefined && (
                                    <div className="flex items-center gap-1 text-[10px] text-success-bright/50">
                                        <Clock size={9} />
                                        <span>{activeSportsBonus.daysLeft}d left</span>
                                    </div>
                                )}
                                <span className="text-[10px] font-bold text-success-bright bg-success-alpha-10 px-2 py-0.5 rounded-full border border-success-primary/20">
                                    {sportsPct}%
                                </span>
                                <button
                                    onClick={() => handleRevoke('SPORTS')}
                                    disabled={revoking === 'SPORTS'}
                                    className="p-1 rounded-lg hover:bg-danger-alpha-10 transition-colors"
                                    title="Revoke sports bonus"
                                >
                                    <RotateCcw size={11} className={`text-danger/50 hover:text-danger ${revoking === 'SPORTS' ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${sportsPct}%`,
                                        background: 'linear-gradient(90deg, #10b981, #34d399)',
                                        boxShadow: '0 0 4px rgba(16,185,129,0.08)',
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-white/30">
                                <span>{activeSymbol}{fmt(sportsBonusWageringDone)} wagered</span>
                                <span>{activeSymbol}{fmt(sportsBonusWageringRequired)} required</span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 p-2.5 bg-success-soft/20 border border-success-primary/10 rounded-lg">
                            <TrendingUp size={13} className="text-success-bright shrink-0 mt-0.5" />
                            <p className="text-[11px] text-success-bright/80 leading-relaxed">
                                Place sports bets to wager{' '}
                                <span className="font-bold text-success-bright">{activeSymbol}{fmt(sportsRemaining)}</span>{' '}
                                more to unlock your bonus automatically.
                            </p>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
