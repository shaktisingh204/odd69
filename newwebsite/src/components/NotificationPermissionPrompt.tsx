"use client";
/**
 * NotificationPermissionPrompt
 *
 * Dialog (desktop) / bottom-sheet (mobile) that asks for browser push permission.
 * The OneSignal SDK is already initialised globally via layout.tsx.
 *
 * Rules:
 *  - Never shows if permission is "granted"
 *  - Denied state: re-prompts after 7 days with step-by-step instructions
 *  - Default state: re-prompts every 30 minutes
 *  - 4 s delay after page load so it doesn't interrupt initial paint
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMPT_COOLDOWN_MS  = 30 * 60 * 1000;         // 30 min  (not yet asked)
const DENIED_COOLDOWN_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days  (browser blocked)
const LS_KEY              = 'notif_prompt_last_shown';
const LS_DENIED_KEY       = 'notif_prompt_denied_at';
const SHOW_DELAY_MS       = 4000;
const ONESIGNAL_APP_ID    = 'e15ae046-8207-4d8b-9588-5a37c6128dc3';

// ─── Benefit cards ────────────────────────────────────────────────────────────

const BENEFITS = [
    {
        emoji: '💸',
        title: 'Deposit & Withdrawal Alerts',
        desc: 'Know the instant your money arrives or your payout is processed.',
        color: 'from-success-primary/20 to-success-primary/5',
        border: 'border-success-primary/20',
        dot: 'bg-success-vivid',
    },
    {
        emoji: '🏆',
        title: 'Bet Settlement Updates',
        desc: 'Get notified the moment your bets are settled — win or lose.',
        color: 'from-amber-500/20 to-amber-500/5',
        border: 'border-amber-500/20',
        dot: 'bg-amber-400',
    },
    {
        emoji: '⚽',
        title: 'Match Starting Soon',
        desc: "We'll remind you 5 minutes before your favourite games go live.",
        color: 'from-blue-500/20 to-blue-500/5',
        border: 'border-brand-gold/20',
        dot: 'bg-blue-400',
    },
    {
        emoji: '🎁',
        title: 'Exclusive Offers & Bonuses',
        desc: 'Be first to grab limited-time promos, reloads and tournament entries.',
        color: 'from-purple-500/20 to-purple-500/5',
        border: 'border-accent-purple/20',
        dot: 'bg-purple-400',
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

declare global {
    interface Window {
        OneSignal?: any;
        OneSignalDeferred?: any[];
    }
}

/** Wait for window.OneSignal to be ready (SDK already loaded by layout.tsx) */
function waitForOneSignal(timeoutMs = 6000): Promise<any> {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const check = () => {
            if (window.OneSignal) return resolve(window.OneSignal);
            if (Date.now() > deadline) return reject(new Error('OneSignal not ready'));
            setTimeout(check, 200);
        };
        check();
    });
}

/**
 * Core permission flow:
 * 1. Ask native browser permission (immediate dialog)
 * 2. If granted, register subscription ID with our backend (background)
 */
async function requestPermission(token: string): Promise<NotificationPermission> {
    if (typeof Notification === 'undefined') return 'denied';

    // Use OneSignal's method if SDK is ready, otherwise fall back to native
    try {
        const OneSignal = await waitForOneSignal(3000);
        await OneSignal.Notifications.requestPermission();
    } catch {
        // SDK not ready yet — use native API directly
        await Notification.requestPermission();
    }

    const result = Notification.permission;

    // Kick off background subscription registration (non-blocking)
    if (result === 'granted') {
        registerSubscription(token).catch(() => undefined);
    }

    return result;
}

/** Background: save OneSignal subscription ID to backend */
async function registerSubscription(token: string): Promise<void> {
    try {
        const OneSignal = await waitForOneSignal(5000);

        // v16 API: User.PushSubscription.id
        let subId: string | null =
            OneSignal.User?.PushSubscription?.id ?? null;

        // Fallback for older SDK shape
        if (!subId) {
            subId = await new Promise<string | null>((res) => {
                OneSignal.getUserId?.((id: string | null) => res(id));
                setTimeout(() => res(null), 3000);
            });
        }

        if (subId) {
            await api.post(
                '/push-notifications/register-device',
                { playerId: subId },
                { headers: { Authorization: `Bearer ${token}` } },
            );
        }
    } catch {
        // Non-fatal
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationPermissionPrompt() {
    const { user, token, isAuthenticated } = useAuth();

    const [visible,  setVisible]  = useState(false);
    const [animIn,   setAnimIn]   = useState(false);
    const [loading,  setLoading]  = useState(false);
    const [step,     setStep]     = useState<'idle' | 'success' | 'denied'>('idle');

    // ── Show logic ─────────────────────────────────────────────────────────

    useEffect(() => {
        if (typeof window === 'undefined' || !isAuthenticated) return;

        // Mobile-only — skip on tablets/desktops (screen width ≥ 768 px)
        if (!window.matchMedia('(max-width: 767px)').matches) return;

        const perm = typeof Notification !== 'undefined'
            ? Notification.permission
            : 'default';

        // Already granted — never ask again
        if (perm === 'granted') return;

        if (perm === 'denied') {
            // 7-day cooldown for hard-denied state
            const deniedAt = Number(localStorage.getItem(LS_DENIED_KEY) || '0');
            if (Date.now() - deniedAt < DENIED_COOLDOWN_MS) return;
        } else {
            // 30-minute cooldown for default state
            const lastShown = Number(localStorage.getItem(LS_KEY) || '0');
            if (Date.now() - lastShown < PROMPT_COOLDOWN_MS) return;
        }

        // Delayed reveal
        const t = setTimeout(() => {
            setVisible(true);
            requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
            // Record we showed the prompt
            if (perm === 'denied') {
                localStorage.setItem(LS_DENIED_KEY, String(Date.now()));
            } else {
                localStorage.setItem(LS_KEY, String(Date.now()));
            }
        }, SHOW_DELAY_MS);

        return () => clearTimeout(t);
    }, [isAuthenticated]);

    // ── Dismiss ─────────────────────────────────────────────────────────────

    const dismiss = useCallback(() => {
        setAnimIn(false);
        setTimeout(() => {
            setVisible(false);
            setStep('idle');
            setLoading(false);
        }, 380);
    }, []);

    // ── Later (snooze) ──────────────────────────────────────────────────────

    const handleLater = useCallback(() => {
        const perm = typeof Notification !== 'undefined'
            ? Notification.permission : 'default';
        if (perm === 'denied') {
            localStorage.setItem(LS_DENIED_KEY, String(Date.now()));
        } else {
            localStorage.setItem(LS_KEY, String(Date.now()));
        }
        dismiss();
    }, [dismiss]);

    // ── Enable ──────────────────────────────────────────────────────────────

    const handleEnable = useCallback(async () => {
        if (!token) return;
        setLoading(true);

        let result: NotificationPermission = 'default';
        try {
            result = await requestPermission(token);
        } catch {
            result = typeof Notification !== 'undefined'
                ? Notification.permission : 'default';
        }

        setLoading(false);

        if (result === 'granted') {
            setStep('success');
            localStorage.setItem(LS_KEY, '9999999999999'); // suppress forever
            setTimeout(dismiss, 2500);
        } else {
            setStep('denied');
            if (result === 'denied') {
                localStorage.setItem(LS_DENIED_KEY, String(Date.now()));
            }
        }
    }, [token, dismiss]);

    // ── Render guard ────────────────────────────────────────────────────────

    if (!visible) return null;

    // ── Panel variant (denied state = show from start if browser is denied) ─
    const browserAlreadyDenied =
        typeof Notification !== 'undefined' && Notification.permission === 'denied';

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={handleLater}
                style={{
                    opacity: animIn ? 1 : 0,
                    transition: 'opacity 0.35s ease',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                }}
                className="fixed inset-0 bg-black/55 z-[800]"
            />

            {/* Panel */}
            <div
                className={`
                    fixed z-[801]
                    bottom-0 left-0 right-0
                    md:bottom-auto md:left-1/2 md:top-1/2
                    md:-translate-x-1/2 md:-translate-y-1/2
                    md:w-[500px]
                    rounded-t-3xl md:rounded-3xl
                    overflow-hidden
                    bg-bg-card
                    border border-white/[0.08]
                    shadow-[0_-24px_64px_rgba(0,0,0,0.65)]
                    md:shadow-[0_24px_64px_rgba(0,0,0,0.75)]
                    transition-all duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]
                    ${animIn
                        ? 'translate-y-0 opacity-100 md:scale-100'
                        : 'translate-y-full opacity-0 md:translate-y-0 md:scale-95'
                    }
                `}
            >
                {/* Accent bar */}
                <div className="h-[3px] w-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600" />

                {/* Drag handle (mobile only) */}
                <div className="flex justify-center pt-3 md:hidden">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                <div className="px-6 pb-6 pt-4 md:p-8">

                    {/* ── SUCCESS ── */}
                    {step === 'success' && (
                        <div className="flex flex-col items-center text-center py-6 gap-3">
                            <div className="w-16 h-16 rounded-full bg-success-alpha-16 flex items-center justify-center">
                                <span className="text-4xl">✅</span>
                            </div>
                            <h2 className="text-xl font-black text-white">Notifications enabled!</h2>
                            <p className="text-sm text-white/45 max-w-xs leading-relaxed">
                                You'll get instant alerts for deposits, bets, matches and offers.
                            </p>
                        </div>
                    )}

                    {/* ── DENIED (after clicking Enable and browser blocked) ── */}
                    {step === 'denied' && (
                        <div className="flex flex-col items-center text-center py-4 gap-3">
                            <div className="w-16 h-16 rounded-full bg-warning-alpha-12 flex items-center justify-center">
                                <span className="text-4xl">🔔</span>
                            </div>
                            <h2 className="text-xl font-black text-white">Notifications are blocked</h2>
                            <p className="text-sm text-white/45 max-w-[280px] leading-relaxed">
                                Your browser blocked the request. Enable it manually in 3 quick steps:
                            </p>

                            <div className="w-full space-y-2 mt-1">
                                {[
                                    'Click the 🔒 lock icon in your browser\'s address bar',
                                    'Set "Notifications" to Allow',
                                    'Refresh the page — done!',
                                ].map((text, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-left"
                                    >
                                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-warning-bright text-[10px] font-black flex items-center justify-center mt-0.5">
                                            {i + 1}
                                        </span>
                                        <p className="text-[11px] text-white/55 leading-relaxed">{text}</p>
                                    </div>
                                ))}
                            </div>

                            <p className="text-[10px] text-white/25 mt-1">
                                We'll remind you again in 7 days 🗓️
                            </p>

                            <button
                                onClick={() => {
                                    localStorage.setItem(LS_DENIED_KEY, String(Date.now()));
                                    dismiss();
                                }}
                                className="mt-1 px-6 py-2.5 rounded-xl bg-white/[0.08] text-white/70 text-sm font-bold hover:bg-white/[0.12] transition-colors"
                            >
                                Got it, thanks
                            </button>
                        </div>
                    )}

                    {/* ── IDLE — ask for permission ── */}
                    {step === 'idle' && (
                        <>
                            {/* Header */}
                            <div className="flex items-start justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500/25 to-amber-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-2xl">🔔</span>
                                    </div>
                                    <div>
                                        <h2 className="text-[15px] font-black text-white leading-tight">
                                            Stay in the loop
                                        </h2>
                                        <p className="text-[11px] text-white/40 mt-0.5">
                                            {browserAlreadyDenied
                                                ? 'Re-enable notifications in your browser'
                                                : 'Enable notifications — takes 2 seconds'}
                                        </p>
                                    </div>
                                </div>

                                {/* Close X */}
                                <button
                                    onClick={handleLater}
                                    aria-label="Close"
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-white/70 hover:bg-white/[0.08] transition-colors mt-0.5 flex-shrink-0"
                                >
                                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                        <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                    </svg>
                                </button>
                            </div>

                            {/* Benefits */}
                            <div className="space-y-2 mb-5">
                                {BENEFITS.map((b, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r ${b.color} border ${b.border}`}
                                    >
                                        <span className="text-[18px] leading-none mt-0.5 flex-shrink-0">{b.emoji}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12px] font-bold text-white leading-tight">{b.title}</p>
                                            <p className="text-[10px] text-white/45 mt-0.5 leading-relaxed">{b.desc}</p>
                                        </div>
                                        <div className={`flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${b.dot}`} />
                                    </div>
                                ))}
                            </div>

                            {/* Privacy line */}
                            <p className="text-[10px] text-white/22 text-center mb-4 px-2 leading-relaxed">
                                🔒 No spam — only important alerts. Turn off anytime from browser settings.
                            </p>

                            {/* Buttons */}
                            <div className="flex flex-col sm:flex-row gap-2.5">
                                <button
                                    onClick={handleEnable}
                                    disabled={loading}
                                    className="flex-1 relative overflow-hidden flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl font-black text-[13px] uppercase tracking-wide
                                        bg-gradient-to-r from-orange-500 to-amber-500 text-white
                                        hover:from-orange-400 hover:to-amber-400
                                        active:scale-[0.97] transition-all
                                        shadow-[0_4px_20px_rgba(251,146,60,0.35)]
                                        disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
                                >
                                    {loading ? (
                                        <>
                                            <Spinner />
                                            <span>Enabling…</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>🔔</span>
                                            <span>Enable Notifications</span>
                                        </>
                                    )}

                                    {/* Shimmer sweep on idle */}
                                    {!loading && (
                                        <span
                                            aria-hidden
                                            style={{ animation: 'btnShimmer 2.8s ease-in-out infinite' }}
                                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -skew-x-12 pointer-events-none"
                                        />
                                    )}
                                </button>

                                <button
                                    onClick={handleLater}
                                    className="px-5 py-3.5 rounded-2xl text-[12px] font-bold text-white/35 hover:text-white/60 hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all"
                                >
                                    Maybe later
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <style>{`
                    @keyframes btnShimmer {
                        0%   { transform: translateX(-160%) skewX(-12deg); }
                        50%  { transform: translateX(260%) skewX(-12deg); }
                        100% { transform: translateX(260%) skewX(-12deg); }
                    }
                `}</style>
            </div>
        </>
    );
}

function Spinner() {
    return (
        <svg className="animate-spin h-4 w-4 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
    );
}
