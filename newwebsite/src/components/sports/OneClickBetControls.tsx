'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Ticket, Zap } from 'lucide-react';
import { useBets } from '@/context/BetContext';
import { useWallet } from '@/context/WalletContext';

interface OneClickBetControlsProps {
    className?: string;
}

const STAKE_PRESETS = [100, 500, 1_000, 5_000, 10_000, 25_000];

export default function OneClickBetControls({ className = '' }: OneClickBetControlsProps) {
    const {
        oneClickEnabled,
        oneClickStake,
        setOneClickEnabled,
        setOneClickStake,
    } = useBets();
    const { activeSymbol, selectedWallet } = useWallet();

    // Whether the inline amount panel is open
    const [amountOpen, setAmountOpen] = useState(false);
    const [customStake, setCustomStake] = useState(String(oneClickStake));
    const [pendingStake, setPendingStake] = useState<number>(oneClickStake);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync if external changes happen
    useEffect(() => {
        setCustomStake(String(oneClickStake));
        setPendingStake(oneClickStake);
    }, [oneClickStake]);

    // When enabled turns ON → open the amount panel right away
    const handleToggle = () => {
        const next = !oneClickEnabled;
        setOneClickEnabled(next);
        if (next) {
            setAmountOpen(true);
            setPendingStake(oneClickStake);
            setCustomStake(String(oneClickStake));
        } else {
            setAmountOpen(false);
        }
    };

    const selectPreset = (amount: number) => {
        setPendingStake(amount);
        setCustomStake(String(amount));
    };

    const applyStake = () => {
        const cleaned = customStake.replace(/[^0-9]/g, '');
        const val = Number(cleaned);
        if (!val) return;
        setOneClickStake(val);
        setPendingStake(val);
        setAmountOpen(false);
    };

    const handleCustomChange = (raw: string) => {
        const cleaned = raw.replace(/[^0-9]/g, '');
        setCustomStake(cleaned);
        const n = Number(cleaned);
        if (n > 0) setPendingStake(n);
    };

    // Focus input when panel opens
    useEffect(() => {
        if (amountOpen) {
            setTimeout(() => inputRef.current?.focus(), 120);
        }
    }, [amountOpen]);

    return (
        <section className={`overflow-hidden rounded-2xl border border-white/[0.06] bg-bg-modal ${className}`}>

            {/* ── Top row: icon · label · wallet badge · toggle ── */}
            <div className="flex items-center gap-2 p-3">
                {/* Mode icon */}
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    oneClickEnabled
                        ? 'border-success-primary/30 bg-success-alpha-10 text-success-bright'
                        : 'border-white/[0.08] bg-white/[0.04] text-white/40'
                }`}>
                    {oneClickEnabled ? <Zap size={15} /> : <Ticket size={15} />}
                </div>

                {/* Label + sub-text */}
                <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-white leading-none">Quick Bet</p>
                    <p className="mt-0.5 text-[10px] text-white/35 leading-none">
                        {oneClickEnabled
                            ? `${activeSymbol}${oneClickStake.toLocaleString()} per click`
                            : 'Tap an odd to add to slip'}
                    </p>
                </div>

                {/* Wallet badge */}
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] ${
                    selectedWallet === 'crypto'
                        ? 'bg-accent-purple-alpha text-purple-300'
                        : 'bg-brand-gold/10 text-brand-gold'
                }`}>
                    {selectedWallet}
                </span>

                {/* Stake chip — visible only when enabled; opens/closes amount panel */}
                {oneClickEnabled && (
                    <button
                        type="button"
                        onClick={() => setAmountOpen((v) => !v)}
                        className={`flex-shrink-0 flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[10px] font-black transition-all ${
                            amountOpen
                                ? 'border-success-primary/35 bg-success-alpha-12 text-success-bright'
                                : 'border-white/[0.08] bg-bg-deep-4 text-white/60 hover:border-white/[0.1] hover:text-white'
                        }`}
                    >
                        {activeSymbol}{oneClickStake.toLocaleString()}
                        {amountOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                )}

                {/* Enable / Disable toggle */}
                <button
                    type="button"
                    onClick={handleToggle}
                    className={`flex-shrink-0 relative h-8 rounded-xl border px-3 transition-all ${
                        oneClickEnabled
                            ? 'border-success-primary/30 bg-success-alpha-12 text-success-bright'
                            : 'border-white/[0.08] bg-white/[0.04] text-white/50'
                    }`}
                >
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                        <span>{oneClickEnabled ? 'ON' : 'OFF'}</span>
                        <span className={`h-2 w-2 rounded-full transition-all ${
                            oneClickEnabled
                                ? 'bg-success-vivid shadow-glow-success'
                                : 'bg-white/20'
                        }`} />
                    </span>
                </button>
            </div>

            {/* ── Inline amount panel — slides in when amountOpen ── */}
            <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    amountOpen ? 'max-h-[260px] opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="border-t border-white/[0.05] px-3 pb-3 pt-2.5">
                    {/* Section label */}
                    <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">
                        Set one-click amount
                    </p>

                    {/* Preset grid */}
                    <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                        {STAKE_PRESETS.map((amount) => {
                            const active = pendingStake === amount;
                            return (
                                <button
                                    key={amount}
                                    type="button"
                                    onClick={() => selectPreset(amount)}
                                    className={`rounded-xl border py-2 text-[11px] font-black transition-all ${
                                        active
                                            ? 'border-success-primary/40 bg-success-alpha-16 text-success-bright'
                                            : 'border-white/[0.06] bg-bg-deep-3 text-white/55 hover:border-white/[0.1] hover:text-white'
                                    }`}
                                >
                                    {activeSymbol}{amount >= 1000 ? `${amount / 1000}K` : amount}
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom input + apply */}
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 flex-1 items-center rounded-xl border border-white/[0.08] bg-bg-zeero px-3 focus-within:border-success-primary/30 transition-colors">
                            <span className="text-[12px] font-black text-white/35 flex-shrink-0">{activeSymbol}</span>
                            <input
                                ref={inputRef}
                                type="text"
                                inputMode="numeric"
                                value={customStake}
                                onChange={(e) => handleCustomChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); applyStake(); }
                                }}
                                placeholder="Custom amount"
                                className="ml-1.5 w-full bg-transparent text-[13px] font-bold text-white outline-none placeholder:text-white/20"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={applyStake}
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-gold text-white transition-all hover:bg-brand-gold-hover active:scale-95"
                        >
                            <Check size={16} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
