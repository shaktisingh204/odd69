'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    DollarSign,
    Loader2,
    RotateCcw,
} from 'lucide-react';
import { betsApi, Bet, CashoutOffer, CashoutResult } from '@/services/bets';
import { useWallet } from '@/context/WalletContext';

type CashoutPhase =
    | 'LOADING'
    | 'UNAVAILABLE'
    | 'SUSPENDED'
    | 'FULL_REFUND'
    | 'IDLE'
    | 'CONFIRMING'
    | 'PRICE_CHANGED'
    | 'EXECUTING'
    | 'SUCCESS';

interface SportsBetCashoutWidgetProps {
    bet: Bet;
    onSuccess: () => void | Promise<void>;
    compact?: boolean;
}

export default function SportsBetCashoutWidget({
    bet,
    onSuccess,
    compact = false,
}: SportsBetCashoutWidgetProps) {
    const { activeSymbol } = useWallet();
    const [offer, setOffer] = useState<CashoutOffer | null>(null);
    const [phase, setPhase] = useState<CashoutPhase>('LOADING');
    const [fraction, setFraction] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [priceChangedValue, setPriceChangedValue] = useState<number | null>(null);
    const [result, setResult] = useState<CashoutResult | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchOffer = useCallback(async (signal?: AbortSignal) => {
        try {
            const data = await betsApi.getCashoutOffer(bet.id);
            if (signal?.aborted) return;

            setOffer(data);
            setPhase((prev) => {
                if (prev === 'CONFIRMING' || prev === 'PRICE_CHANGED' || prev === 'EXECUTING' || prev === 'SUCCESS') {
                    return prev;
                }
                if (data.status === 'UNAVAILABLE') return 'UNAVAILABLE';
                if (data.status === 'SUSPENDED') return 'SUSPENDED';
                if (data.fullRefundEligible) return 'FULL_REFUND';
                return 'IDLE';
            });
        } catch (err: unknown) {
            const maybeAxiosError = err as { response?: { status?: number; data?: { message?: string } } };
            const message = maybeAxiosError.response?.data?.message;

            if (maybeAxiosError.response?.status === 503) {
                setOffer({
                    betId: bet.id,
                    status: 'SUSPENDED',
                    reason: message || 'Sports cash out is temporarily unavailable due to maintenance.',
                });
                setPhase('SUSPENDED');
            }
        }
    }, [bet.id]);

    useEffect(() => {
        const ctrl = new AbortController();
        const initialFetch = setTimeout(() => {
            void fetchOffer(ctrl.signal);
        }, 0);
        timerRef.current = setInterval(() => fetchOffer(ctrl.signal), 8000);

        return () => {
            clearTimeout(initialFetch);
            ctrl.abort();
            if (timerRef.current) clearInterval(timerRef.current);
            if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        };
    }, [fetchOffer]);

    const restartPolling = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => fetchOffer(), 8000);
    }, [fetchOffer]);

    const doExecute = async (opts: { fraction: number; clientExpectedValue?: number; fullRefund?: boolean }) => {
        setPhase('EXECUTING');
        setError(null);
        if (timerRef.current) clearInterval(timerRef.current);

        try {
            const res = await betsApi.executeCashout(bet.id, opts);
            if (res.status === 'PRICE_CHANGED') {
                setPriceChangedValue(res.newCashoutValue ?? null);
                setPhase('PRICE_CHANGED');
                restartPolling();
                return;
            }

            setResult(res);
            setPhase('SUCCESS');
            setTimeout(() => {
                void onSuccess();
            }, 1200);
        } catch (err: unknown) {
            const maybeAxiosError = err as { response?: { data?: { message?: string } }; message?: string };
            const msg = maybeAxiosError.response?.data?.message || maybeAxiosError.message || 'Cash out failed. Please try again.';
            setError(msg);
            setPhase('IDLE');
            void fetchOffer();
            restartPolling();
        }
    };

    const handleFirstTap = () => {
        setPhase('CONFIRMING');
        setError(null);
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = setTimeout(() => setPhase('IDLE'), 8000);
    };

    const handleCancel = () => {
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        setPhase('IDLE');
        setPriceChangedValue(null);
        setError(null);
    };

    const displayValue = offer?.cashoutValue ?? 0;
    const partialValue = parseFloat((displayValue * fraction).toFixed(2));
    const restStake = parseFloat(((offer?.stake ?? bet.stake) * (1 - fraction)).toFixed(2));
    const containerCls = compact
        ? 'rounded-xl bg-bg-modal border border-warning/25 p-2.5 space-y-2.5'
        : 'rounded-xl bg-bg-modal border border-warning/30 p-3 space-y-3';
    const textXsCls = compact ? 'text-[10px]' : 'text-[11px]';

    if (phase === 'LOADING') {
        return (
            <div className="flex items-center gap-1.5 py-1 text-[11px] text-white/20">
                <Loader2 size={10} className="animate-spin" />
                <span>Fetching offer...</span>
            </div>
        );
    }

    if (phase === 'UNAVAILABLE') return null;

    if (phase === 'SUSPENDED') {
        return (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2">
                <div className="flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-white/20" />
                    <span className="text-[11px] font-medium text-white/30">Cash Out Suspended</span>
                </div>
            </div>
        );
    }

    if (phase === 'SUCCESS') {
        const isFull = !result?.remainingStake || result.remainingStake === 0;
        const isPartial = result?.status === 'PARTIAL_CASHED_OUT';

        return (
            <div className="flex items-center gap-2 rounded-xl border border-success-primary/20 bg-success-alpha-10 px-3 py-2.5">
                <CheckCircle2 size={14} className="shrink-0 text-success-bright" />
                <div className="text-xs">
                    <p className="font-bold text-success-bright">
                        {isPartial ? 'Partial Cash Out Successful!' : 'Cashed Out!'}
                    </p>
                    {result?.cashoutValue && (
                        <p className="mt-0.5 text-[10px] text-success-bright/60">
                            {activeSymbol}{result.cashoutValue.toFixed(2)} added to wallet
                            {isFull ? '' : ` · ${activeSymbol}${result.remainingStake?.toFixed(2)} still active`}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (phase === 'FULL_REFUND' || (phase === 'IDLE' && offer?.fullRefundEligible)) {
        if (phase === 'IDLE') {
            return (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <button
                            onClick={handleFirstTap}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-warning/30 bg-warning-alpha-12 px-3 py-2.5 text-[11px] font-bold text-warning-bright transition-all hover:bg-amber-500/25 active:scale-[0.98]"
                        >
                            <DollarSign size={12} />
                            Cash Out {activeSymbol}{displayValue.toFixed(2)}
                        </button>
                        <button
                            onClick={() => doExecute({ fraction: 1, fullRefund: true })}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-success-primary/30 bg-success-alpha-16 px-3 py-2.5 text-[11px] font-bold text-success-bright transition-all hover:bg-success-alpha-20 active:scale-[0.98]"
                        >
                            <RotateCcw size={12} />
                            Cancel Bet {activeSymbol}{offer?.fullRefundValue?.toFixed(2)}
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-white/25">
                        Pre-match · Cancel for full stake back
                    </p>
                </div>
            );
        }
    }

    if (phase === 'PRICE_CHANGED') {
        return (
            <div className="space-y-3 rounded-xl border border-warning/40 bg-amber-500/[0.07] p-3">
                <div className="flex items-center gap-2">
                    <AlertCircle size={13} className="shrink-0 text-warning-bright" />
                    <p className="text-xs font-bold text-warning-bright">Odds Changed</p>
                </div>
                <p className="text-[11px] leading-relaxed text-white/50">
                    The market moved. New offer:{' '}
                    <span className="font-bold text-white">{activeSymbol}{priceChangedValue?.toFixed(2)}</span>
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={handleCancel}
                        className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.06] py-2 text-[11px] font-bold text-white/40 transition-all hover:text-white/60"
                    >
                        Decline
                    </button>
                    <button
                        onClick={() => doExecute({ fraction, clientExpectedValue: priceChangedValue ?? undefined })}
                        className="flex-1 rounded-lg bg-amber-500 py-2 text-[11px] font-bold text-text-inverse transition-all hover:bg-amber-400 active:scale-[0.98]"
                    >
                        Accept {activeSymbol}{priceChangedValue?.toFixed(2)}
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'EXECUTING') {
        return (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-warning-alpha-08 px-3 py-3">
                <Loader2 size={14} className="animate-spin text-warning-bright" />
                <span className="text-xs font-bold text-warning-bright">Processing...</span>
            </div>
        );
    }

    if (phase === 'IDLE') {
        return (
            <div className="space-y-1.5">
                <button
                    onClick={handleFirstTap}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-warning/30 bg-warning-alpha-12 px-3 py-2.5 text-xs font-bold text-warning-bright transition-all hover:border-amber-500/50 hover:bg-amber-500/25 active:scale-[0.98]"
                >
                    <DollarSign size={13} />
                    Cash Out {activeSymbol}{displayValue.toFixed(2)}
                </button>
                <div className="flex justify-between px-1 text-[10px] text-white/20">
                    <span>Live odds: {offer?.currentOdds}</span>
                    <span>Original: {offer?.originalOdds}</span>
                </div>
                {error && (
                    <p className="flex items-center gap-1 text-[11px] text-danger">
                        <AlertCircle size={10} /> {error}
                    </p>
                )}
            </div>
        );
    }

    const isFullCashout = fraction >= 0.99;

    return (
        <div className={containerCls}>
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-white">Confirm Cash Out</p>
                <button
                    onClick={handleCancel}
                    className="text-[10px] text-white/30 transition-all hover:text-white/60"
                >
                    Cancel
                </button>
            </div>

            <div className="space-y-2">
                <div className={`flex items-center justify-between text-white/40 ${textXsCls}`}>
                    <span>Partial</span>
                    <span className="font-bold text-white">{Math.round(fraction * 100)}%</span>
                    <span>Full</span>
                </div>
                <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(fraction * 100)}
                    onChange={(e) => setFraction(parseInt(e.target.value, 10) / 100)}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #8B5CF6 ${Math.round(fraction * 100)}%, rgba(255,255,255,0.1) ${Math.round(fraction * 100)}%)`,
                    }}
                />
                <div className="flex justify-center gap-1.5">
                    {[25, 50, 75, 100].map((pct) => (
                        <button
                            key={pct}
                            onClick={() => setFraction(pct / 100)}
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                                Math.round(fraction * 100) === pct
                                    ? 'bg-amber-500 text-text-inverse'
                                    : 'bg-white/[0.06] text-white/40 hover:text-white/70'
                            }`}
                        >
                            {pct}%
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                    <p className="text-white/30">You receive</p>
                    <p className="mt-0.5 text-xs font-bold text-warning-bright">{activeSymbol}{partialValue.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                    <p className="text-white/30">{isFullCashout ? 'Bet closed' : 'Still active'}</p>
                    <p className={`mt-0.5 text-xs font-bold ${isFullCashout ? 'text-white/30' : 'text-success-bright'}`}>
                        {isFullCashout ? '—' : `${activeSymbol}${restStake.toFixed(2)} stake`}
                    </p>
                </div>
            </div>

            <button
                onClick={() => {
                    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                    doExecute({
                        fraction,
                        clientExpectedValue: partialValue,
                    });
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-text-inverse transition-all hover:bg-amber-400 active:scale-[0.98]"
            >
                <CheckCircle2 size={14} />
                {isFullCashout
                    ? `Cash Out ${activeSymbol}${partialValue.toFixed(2)}`
                    : `Partial Cash Out ${activeSymbol}${partialValue.toFixed(2)}`}
            </button>

            {error && (
                <p className="flex items-center justify-center gap-1 text-center text-[11px] text-danger">
                    <AlertCircle size={10} /> {error}
                </p>
            )}
        </div>
    );
}
