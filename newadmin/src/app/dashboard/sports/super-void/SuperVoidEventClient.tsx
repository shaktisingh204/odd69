"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { superVoidEvent } from "@/actions/settlement";

interface VoidSummary {
    total?: number;
    voided?: number;
    alreadyVoided?: number;
    reversedAmount?: number;
    refundedAmount?: number;
    errors?: string[];
}

function formatAmount(amount: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount || 0);
}

export default function SuperVoidEventClient() {
    const searchParams = useSearchParams();
    const [eventId, setEventId] = useState("");
    const [eventName, setEventName] = useState("");
    const [reason, setReason] = useState("");
    const [voiding, setVoiding] = useState(false);
    const [summary, setSummary] = useState<VoidSummary | null>(null);
    const [error, setError] = useState("");

    const prefilledEventId = useMemo(() => searchParams.get("eventId") || "", [searchParams]);
    const prefilledEventName = useMemo(() => searchParams.get("eventName") || "", [searchParams]);

    useEffect(() => {
        setEventId(prefilledEventId);
        setEventName(prefilledEventName);
    }, [prefilledEventId, prefilledEventName]);

    const handleSubmit = async () => {
        const normalizedEventId = eventId.trim();
        const normalizedReason = reason.trim();

        if (!normalizedEventId) {
            setError("Enter the event ID you want to super void.");
            setSummary(null);
            return;
        }

        if (!normalizedReason) {
            setError("Enter a reason so users can see exactly why the event was voided.");
            setSummary(null);
            return;
        }

        const label = eventName ? `${eventName} (${normalizedEventId})` : normalizedEventId;
        const shouldContinue = window.confirm(
            `Super void all bets for ${label}?\n\nThis can reverse already settled wins/cashouts and refund the original stake.`,
        );

        if (!shouldContinue) return;

        setVoiding(true);
        setError("");
        setSummary(null);

        try {
            const result = await superVoidEvent(normalizedEventId, normalizedReason);

            if (!result.success) {
                setError(result.message || "Failed to super void the event.");
                return;
            }

            setSummary(result.data || {});
        } catch (err) {
            console.error("Super void failed", err);
            setError("Failed to super void the event.");
        } finally {
            setVoiding(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Super Void Event</h1>
                    <p className="mt-1 text-slate-400">
                        Void every bet for an event, including already settled bets, with a proper user-facing reason and audit trail.
                    </p>
                </div>
                <Link
                    href="/dashboard/settlement"
                    className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                    <ArrowLeft size={16} />
                    Back to Settlement
                </Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                <section className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/30 p-6 shadow-2xl shadow-red-950/20">
                    <div className="flex items-start gap-3 rounded-xl border border-red-500/15 bg-red-500/10 p-4">
                        <AlertTriangle className="mt-0.5 text-red-300" size={18} />
                        <div>
                            <h2 className="font-semibold text-white">High impact action</h2>
                            <p className="mt-1 text-sm leading-6 text-slate-300">
                                Use this only when the whole event result must be cancelled. The system will reverse previous win or cashout credits, refund the original stake, and store the reason in bet history.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-5">
                        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Event ID
                                </label>
                                <input
                                    type="text"
                                    value={eventId}
                                    onChange={(e) => setEventId(e.target.value)}
                                    placeholder="e.g. 12345678"
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-400"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Event Name
                                </label>
                                <input
                                    type="text"
                                    value={eventName}
                                    onChange={(e) => setEventName(e.target.value)}
                                    placeholder="Optional label for confirmation clarity"
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-400"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Reason Shown To Users
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={5}
                                placeholder="Official result correction, feed issue, market grading error, match cancellation, etc."
                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-400"
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                This reason is saved into bet history so support and users can both see why the event was voided.
                            </p>
                        </div>

                        {error ? (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                {error}
                            </div>
                        ) : null}

                        <div className="flex flex-col gap-3 border-t border-slate-800 pt-5 md:flex-row md:items-center md:justify-between">
                            <p className="max-w-2xl text-sm leading-6 text-slate-400">
                                Before running this, confirm the event ID carefully. This action will also affect already settled users by deducting previous credits and then refunding the original stake.
                            </p>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={voiding}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {voiding ? <Loader2 className="animate-spin" size={16} /> : <AlertTriangle size={16} />}
                                Super Void Event
                            </button>
                        </div>
                    </div>
                </section>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                        <h2 className="text-lg font-semibold text-white">What happens</h2>
                        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                            <p>Pending bets are voided and any open exposure is released.</p>
                            <p>Won or cashed-out bets are reversed from the user wallet before the original stake is returned.</p>
                            <p>Bet history keeps the super-void reason so support has a clear explanation.</p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                        <h2 className="text-lg font-semibold text-white">Best workflow</h2>
                        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                            <p>Pick the event ID from the settlement list or recent bet history.</p>
                            <p>Write the exact business reason that should appear for users.</p>
                            <p>Run the void once and review the summary below.</p>
                        </div>
                    </div>

                    {summary ? (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="mt-0.5 text-emerald-300" size={18} />
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Super void complete</h2>
                                    <p className="mt-1 text-sm text-slate-300">
                                        The event has been processed and the audit summary is ready below.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3">
                                <div className="rounded-xl border border-white/5 bg-slate-950/70 px-4 py-3">
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Voided Bets</p>
                                    <p className="mt-1 text-2xl font-semibold text-white">{summary.voided ?? 0}</p>
                                </div>
                                <div className="rounded-xl border border-white/5 bg-slate-950/70 px-4 py-3">
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Already Void</p>
                                    <p className="mt-1 text-2xl font-semibold text-white">{summary.alreadyVoided ?? 0}</p>
                                </div>
                                <div className="rounded-xl border border-white/5 bg-slate-950/70 px-4 py-3">
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Reversed Credits</p>
                                    <p className="mt-1 text-lg font-semibold text-white">{formatAmount(summary.reversedAmount ?? 0)}</p>
                                </div>
                                <div className="rounded-xl border border-white/5 bg-slate-950/70 px-4 py-3">
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Refunded Stakes</p>
                                    <p className="mt-1 text-lg font-semibold text-white">{formatAmount(summary.refundedAmount ?? 0)}</p>
                                </div>
                                {summary.errors?.length ? (
                                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
                                        {summary.errors.join(", ")}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </aside>
            </div>
        </div>
    );
}
