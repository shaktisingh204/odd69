"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import {
    ArrowLeft,
    Check,
    Copy,
    Download,
    Loader2,
    RefreshCw,
    Search,
    Stamp,
} from "lucide-react";
import {
    verifyCasinoTransaction,
    type CasinoTxVerifyResult,
} from "@/actions/casino";

// ─── Distinctive typography ───────────────────────────────────────────────────
// Fraunces gives the page editorial gravity — variable serif with an
// optical-size axis and a SOFT axis that softens terminals at display sizes.
// JetBrains Mono carries the forensic data grids.
const fraunces = Fraunces({
    subsets: ["latin"],
    variable: "--font-fraunces",
    display: "swap",
    style: ["normal", "italic"],
});
const jbMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-jb-mono",
    display: "swap",
});

// ─── Verdict catalogue ────────────────────────────────────────────────────────
type VerdictKey =
    | "VALID"
    | "MISMATCH"
    | "NOT_FOUND_IN_HUIDU"
    | "NOT_FOUND_LOCAL";

interface VerdictMeta {
    stampTitle: string;
    stampSubtitle: string;
    editorialHeadline: string;
    editorialBody: string;
    accent: "teal" | "amber" | "oxide";
}

const VERDICT: Record<VerdictKey, VerdictMeta> = {
    VALID: {
        stampTitle: "MATCH VERIFIED",
        stampSubtitle: "Local row is consistent with remote record",
        editorialHeadline: "Records are in full alignment.",
        editorialBody:
            "Every audited field on the local CasinoTransaction matches the corresponding entry on HUIDU's /game/transaction/list endpoint for the queried UTC day. No action required.",
        accent: "teal",
    },
    MISMATCH: {
        stampTitle: "DATA DIVERGENCE",
        stampSubtitle: "Both records exist but specific fields disagree",
        editorialHeadline: "Records differ on audited fields.",
        editorialBody:
            "Both sources acknowledge the transaction but one or more audited fields disagree. Review the side-by-side below and open a ticket with HUIDU referencing the serial number before acting on either side.",
        accent: "amber",
    },
    NOT_FOUND_IN_HUIDU: {
        stampTitle: "NO REMOTE RECORD",
        stampSubtitle: "Local row exists; HUIDU list endpoint is empty",
        editorialHeadline: "HUIDU has no record for this serial number.",
        editorialBody:
            "The local CasinoTransaction was written — meaning HUIDU's callback reached us at the time — but the serial number is absent from /game/transaction/list for the queried UTC day. Most likely the round was voided or rolled back server-side. Do not debit the user until HUIDU confirms intent via support ticket.",
        accent: "oxide",
    },
    NOT_FOUND_LOCAL: {
        stampTitle: "NO LOCAL RECORD",
        stampSubtitle: "HUIDU has the record; our DB does not",
        editorialHeadline: "Remote record found, local row missing.",
        editorialBody:
            "HUIDU's list endpoint returned a matching serial number but our CasinoTransaction table has no row with that txn_id. This typically means our webhook handler dropped or failed to persist the callback. Check newbackend logs for the timestamp and investigate the HUIDU webhook path.",
        accent: "oxide",
    },
};

// ─── Utility ──────────────────────────────────────────────────────────────────
function todayUtcISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function formatNumber(n: any): string {
    if (n === null || n === undefined || n === "") return "—";
    const num = typeof n === "number" ? n : parseFloat(String(n));
    if (!Number.isFinite(num)) return String(n);
    return num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function useNowUtc() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    return now;
}

// ─── Atmospheric overlays ─────────────────────────────────────────────────────
function GrainOverlay() {
    return (
        <>
            <svg className="hidden" aria-hidden="true">
                <filter id="dossier-grain">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.9"
                        numOctaves="2"
                        stitchTiles="stitch"
                    />
                    <feColorMatrix type="saturate" values="0" />
                </filter>
            </svg>
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[1] opacity-[0.07] mix-blend-overlay"
                style={{ filter: "url(#dossier-grain)" }}
            />
        </>
    );
}

function Scanlines() {
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
                backgroundImage:
                    "repeating-linear-gradient(to bottom, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 2px, rgba(255,176,0,0.018) 2px, rgba(255,176,0,0.018) 3px)",
            }}
        />
    );
}

function GraphPaper() {
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 opacity-[0.22]"
            style={{
                backgroundImage:
                    "linear-gradient(rgba(228,198,146,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(228,198,146,0.06) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
                maskImage:
                    "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0) 100%)",
                WebkitMaskImage:
                    "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0) 100%)",
            }}
        />
    );
}

// ─── Registration crosshair (blueprint corner marks) ─────────────────────────
function RegistrationMark({
    corner,
}: {
    corner: "tl" | "tr" | "bl" | "br";
}) {
    const pos = {
        tl: "top-0 left-0",
        tr: "top-0 right-0 rotate-90",
        bl: "bottom-0 left-0 -rotate-90",
        br: "bottom-0 right-0 rotate-180",
    }[corner];
    return (
        <svg
            className={`absolute ${pos} w-5 h-5 text-[#8a7456] opacity-70`}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
        >
            <path d="M0 1 L10 1" stroke="currentColor" strokeWidth="1" />
            <path d="M1 0 L1 10" stroke="currentColor" strokeWidth="1" />
            <circle cx="1" cy="1" r="2" stroke="currentColor" strokeWidth="0.75" fill="none" />
        </svg>
    );
}

// ─── Case header ──────────────────────────────────────────────────────────────
function CaseHeader({
    caseRef,
    day,
}: {
    caseRef: string;
    day: string;
}) {
    const now = useNowUtc();
    const tzLabel = now.toISOString().replace("T", " ").slice(0, 19) + "Z";
    return (
        <header className="relative z-10">
            <Link
                href="/dashboard/bets/casino"
                className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#8a7456] hover:text-[#ffb000] transition-colors"
            >
                <ArrowLeft size={11} strokeWidth={2.5} />
                <span className="font-[family-name:var(--font-jb-mono)]">
                    RETURN TO INDEX
                </span>
            </Link>

            <div className="mt-6 flex items-start justify-between gap-8 flex-wrap">
                <div>
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-[#8a7456] font-[family-name:var(--font-jb-mono)]">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#ffb000] animate-[pulse_2.2s_ease-in-out_infinite] shadow-[0_0_8px_#ffb000]" />
                        <span>DOSSIER</span>
                        <span className="text-[#5d4a30]">//</span>
                        <span>CASINO · TRANSACTION AUDIT</span>
                    </div>
                    <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-[#f4ece0] font-light italic tracking-tight leading-[0.92]">
                        <span className="block text-[56px] md:text-[78px]">
                            Cross-examine
                        </span>
                        <span className="block text-[56px] md:text-[78px] -mt-2 text-[#ffb000] font-normal not-italic">
                            the ledger.
                        </span>
                    </h1>
                    <p className="mt-5 max-w-xl text-[13px] leading-relaxed text-[#b8a994]">
                        Cross-reference a local{" "}
                        <span className="font-[family-name:var(--font-jb-mono)] text-[#e8d9bf] bg-[#2a1f12] px-1.5 py-0.5 rounded-sm text-[11px]">
                            CasinoTransaction
                        </span>{" "}
                        row against HUIDU's live{" "}
                        <span className="font-[family-name:var(--font-jb-mono)] text-[#e8d9bf] bg-[#2a1f12] px-1.5 py-0.5 rounded-sm text-[11px]">
                            /game/transaction/list
                        </span>{" "}
                        endpoint. Findings are advisory, not authoritative —
                        open a HUIDU support ticket before debiting a user on
                        the basis of a divergence.
                    </p>
                </div>

                {/* Right side: classification strip */}
                <div className="min-w-[240px] text-right font-[family-name:var(--font-jb-mono)] text-[10px] uppercase tracking-[0.22em]">
                    <div className="flex flex-col gap-2 items-end">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#e04a3a]/40 bg-[#1a0908] text-[#ff6b5a]">
                            <span className="w-1.5 h-1.5 bg-[#ff6b5a] rounded-full animate-pulse" />
                            CLASSIFIED · OPS-USE-ONLY
                        </div>
                        <div className="text-[#8a7456] leading-tight">
                            <div>
                                CASE <span className="text-[#e8d9bf]">{caseRef}</span>
                            </div>
                            <div className="mt-1">
                                UTC <span className="text-[#e8d9bf]">{tzLabel}</span>
                            </div>
                            <div className="mt-1">
                                QUERY DAY <span className="text-[#ffb000]">{day}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tick-mark divider */}
            <div className="mt-8 flex items-center gap-0">
                {Array.from({ length: 80 }).map((_, i) => (
                    <span
                        key={i}
                        className={`flex-1 ${
                            i % 5 === 0 ? "h-[6px]" : "h-[2px]"
                        } bg-[#5d4a30]/60 ${i === 0 ? "ml-0" : "ml-[3px]"}`}
                    />
                ))}
            </div>
        </header>
    );
}

// ─── Terminal-style query form ────────────────────────────────────────────────
function TerminalForm({
    txnId,
    day,
    loading,
    onSubmit,
    onTxnChange,
    onDayChange,
}: {
    txnId: string;
    day: string;
    loading: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onTxnChange: (v: string) => void;
    onDayChange: (v: string) => void;
}) {
    return (
        <form onSubmit={onSubmit} className="relative z-10 mt-12">
            <div className="relative bg-[#0c0905] border border-[#2f2518] p-8 overflow-hidden">
                {/* Ribbon label */}
                <div className="absolute top-0 left-0 bg-[#ffb000] text-[#0c0905] font-[family-name:var(--font-jb-mono)] text-[9px] uppercase tracking-[0.28em] px-3 py-1 font-bold">
                    QUERY INTERFACE
                </div>
                <RegistrationMark corner="tl" />
                <RegistrationMark corner="tr" />
                <RegistrationMark corner="bl" />
                <RegistrationMark corner="br" />

                <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
                    <div className="space-y-5">
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-[0.24em] text-[#8a7456] font-[family-name:var(--font-jb-mono)]">
                                <span className="text-[#ffb000]">▸</span>
                                <span>QUERY_SERIAL</span>
                                <span className="text-[#5d4a30]">:: uuid</span>
                            </div>
                            <div className="relative">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[#ffb000] font-[family-name:var(--font-jb-mono)] text-xl select-none pointer-events-none">
                                    &gt;
                                </span>
                                <input
                                    type="text"
                                    placeholder="paste serial_number / round id…"
                                    value={txnId}
                                    onChange={(e) => onTxnChange(e.target.value)}
                                    autoFocus
                                    className="w-full bg-transparent pl-7 py-2 text-[15px] text-[#f4ece0] font-[family-name:var(--font-jb-mono)] placeholder:text-[#5d4a30] outline-none border-b border-dashed border-[#5d4a30] focus:border-[#ffb000] transition-colors caret-[#ffb000]"
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-[0.24em] text-[#8a7456] font-[family-name:var(--font-jb-mono)]">
                                <span className="text-[#ffb000]">▸</span>
                                <span>QUERY_DATE</span>
                                <span className="text-[#5d4a30]">:: UTC day · last 60 days</span>
                            </div>
                            <div className="relative">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[#ffb000] font-[family-name:var(--font-jb-mono)] text-xl select-none pointer-events-none">
                                    &gt;
                                </span>
                                <input
                                    type="date"
                                    value={day}
                                    max={todayUtcISO()}
                                    onChange={(e) => onDayChange(e.target.value)}
                                    className="w-full bg-transparent pl-7 py-2 text-[15px] text-[#f4ece0] font-[family-name:var(--font-jb-mono)] outline-none border-b border-dashed border-[#5d4a30] focus:border-[#ffb000] transition-colors [color-scheme:dark]"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !txnId.trim()}
                        className="group relative inline-flex items-center gap-3 px-7 py-4 bg-[#ffb000] text-[#0c0905] font-[family-name:var(--font-jb-mono)] text-[11px] uppercase tracking-[0.28em] font-bold hover:bg-[#ffc33d] disabled:bg-[#5d4a30] disabled:text-[#8a7456] disabled:cursor-not-allowed transition-colors shadow-[0_0_0_1px_#ffb000,0_0_32px_-8px_#ffb000] disabled:shadow-none"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={13} strokeWidth={3} className="animate-spin" />
                                QUERYING HUIDU
                            </>
                        ) : (
                            <>
                                <Search size={13} strokeWidth={3} />
                                ▶ EXECUTE
                            </>
                        )}
                    </button>
                </div>

                {loading && (
                    <div className="mt-6 text-[11px] font-[family-name:var(--font-jb-mono)] text-[#ffb000]/80 flex items-center gap-2 border-t border-dashed border-[#2f2518] pt-4">
                        <span className="inline-block w-2 h-2 bg-[#ffb000] animate-pulse" />
                        <span className="tracking-wider">
                            POST huidu.bet/game/transaction/list · paging · agency_uid verified ·
                        </span>
                        <span className="inline-block w-2 h-4 bg-[#ffb000] animate-[pulse_0.8s_steps(1)_infinite]" />
                    </div>
                )}
            </div>
        </form>
    );
}

// ─── Rubber-stamp verdict ─────────────────────────────────────────────────────
function VerdictStamp({ verdict }: { verdict: VerdictMeta }) {
    const accentColor =
        verdict.accent === "teal"
            ? "#5eead4"
            : verdict.accent === "amber"
                ? "#ffb000"
                : "#e04a3a";
    const accentShadow =
        verdict.accent === "teal"
            ? "rgba(94,234,212,0.35)"
            : verdict.accent === "amber"
                ? "rgba(255,176,0,0.35)"
                : "rgba(224,74,58,0.40)";

    return (
        <section className="relative z-10 mt-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] gap-10 items-center">
            {/* Editorial headline */}
            <div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#8a7456] font-[family-name:var(--font-jb-mono)]">
                    <span className="text-[#ffb000]">§</span>
                    <span>FINDING</span>
                </div>
                <h2
                    className="mt-4 font-[family-name:var(--font-fraunces)] italic font-light text-[#f4ece0] text-[44px] md:text-[56px] leading-[0.98] tracking-[-0.01em]"
                    style={{ fontFeatureSettings: "'ss01', 'ss02'" }}
                >
                    {verdict.editorialHeadline}
                </h2>
                <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-[#b8a994]">
                    {verdict.editorialBody}
                </p>
            </div>

            {/* Rubber stamp */}
            <div
                className="relative justify-self-start lg:justify-self-end animate-[stampIn_0.65s_cubic-bezier(0.2,0.9,0.3,1.2)_0.2s_backwards]"
                style={{
                    transform: "rotate(-4.5deg)",
                    filter: `drop-shadow(0 6px 24px ${accentShadow})`,
                }}
            >
                <div
                    className="relative px-10 py-6 border-[3px] bg-[#120906]"
                    style={{
                        borderColor: accentColor,
                        boxShadow: `inset 0 0 0 1px ${accentColor}, inset 0 0 42px -12px ${accentShadow}`,
                    }}
                >
                    {/* inner border ring (double-ring stamp) */}
                    <div
                        className="absolute inset-1.5 border pointer-events-none"
                        style={{ borderColor: `${accentColor}99` }}
                    />
                    {/* tiny corner crosses */}
                    {(["tl", "tr", "bl", "br"] as const).map((c) => (
                        <span
                            key={c}
                            className="absolute w-1 h-1"
                            style={{
                                backgroundColor: accentColor,
                                top: c.startsWith("t") ? 4 : "auto",
                                bottom: c.startsWith("b") ? 4 : "auto",
                                left: c.endsWith("l") ? 4 : "auto",
                                right: c.endsWith("r") ? 4 : "auto",
                            }}
                        />
                    ))}
                    <div
                        className="font-[family-name:var(--font-jb-mono)] text-[10px] uppercase tracking-[0.32em] mb-2 text-center"
                        style={{ color: accentColor }}
                    >
                        ★ FORENSIC FINDING ★
                    </div>
                    <div
                        className="font-[family-name:var(--font-fraunces)] text-[34px] md:text-[40px] font-bold uppercase tracking-[0.02em] text-center leading-[0.95]"
                        style={{
                            color: accentColor,
                            textShadow: `0 0 14px ${accentShadow}`,
                        }}
                    >
                        {verdict.stampTitle}
                    </div>
                    <div
                        className="mt-3 font-[family-name:var(--font-jb-mono)] text-[10px] uppercase tracking-[0.2em] text-center"
                        style={{ color: `${accentColor}cc` }}
                    >
                        ─ {verdict.stampSubtitle} ─
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── Copy chip (unchanged behavior, refreshed styling) ────────────────────────
function CopyChip({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    if (!value) return null;
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[#8a7456] hover:text-[#ffb000] ml-2 inline-flex align-middle"
            title="Copy"
            aria-label="Copy value"
        >
            {copied ? (
                <Check size={11} className="text-[#5eead4]" />
            ) : (
                <Copy size={11} />
            )}
        </button>
    );
}

// ─── Single row of a data dossier ────────────────────────────────────────────
function DossierRow({
    label,
    value,
    emphasis,
    mono = false,
}: {
    label: string;
    value: any;
    emphasis?: "primary" | "money" | "default";
    mono?: boolean;
}) {
    const display =
        value === null || value === undefined || value === ""
            ? "—"
            : typeof value === "object"
                ? JSON.stringify(value)
                : String(value);
    const isEmpty = display === "—";
    const valueClass =
        emphasis === "primary"
            ? "text-[#f4ece0] font-semibold"
            : emphasis === "money"
                ? "text-[#ffb000] font-semibold"
                : "text-[#e8d9bf]";

    return (
        <div className="group relative grid grid-cols-[130px_1fr] gap-4 py-2.5 border-b border-dashed border-[#2f2518] last:border-b-0">
            <div className="text-[9px] uppercase tracking-[0.22em] text-[#8a7456] font-[family-name:var(--font-jb-mono)] pt-[3px]">
                {label}
            </div>
            <div
                className={`${mono || emphasis ? "font-[family-name:var(--font-jb-mono)]" : ""} ${
                    isEmpty ? "text-[#5d4a30]" : valueClass
                } text-[12px] leading-relaxed break-all`}
            >
                {display}
                {!isEmpty && mono && <CopyChip value={String(value)} />}
            </div>
        </div>
    );
}

// ─── A dossier panel (local or HUIDU) ─────────────────────────────────────────
function DossierPanel({
    side,
    label,
    sourceTag,
    hasRecord,
    children,
}: {
    side: "left" | "right";
    label: string;
    sourceTag: string;
    hasRecord: boolean;
    children: React.ReactNode;
}) {
    const statusColor = hasRecord ? "#5eead4" : "#e04a3a";
    const statusText = hasRecord ? "RECORD PRESENT" : "NO MATCH ON FILE";
    return (
        <div className="relative bg-[#0c0905] border border-[#2f2518]">
            <RegistrationMark corner="tl" />
            <RegistrationMark corner="tr" />
            <RegistrationMark corner="bl" />
            <RegistrationMark corner="br" />

            {/* folder tab */}
            <div className="absolute -top-[1px] left-6 flex">
                <div
                    className={`px-4 py-1.5 ${
                        side === "left"
                            ? "bg-[#ffb000] text-[#0c0905]"
                            : "bg-[#e8d9bf] text-[#0c0905]"
                    } font-[family-name:var(--font-jb-mono)] text-[9px] uppercase tracking-[0.28em] font-bold`}
                >
                    {label}
                </div>
                <div
                    className={`w-0 h-0 border-l-[14px] border-b-[26px] ${
                        side === "left"
                            ? "border-l-[#ffb000] border-b-transparent"
                            : "border-l-[#e8d9bf] border-b-transparent"
                    }`}
                />
            </div>
            <div className="absolute top-1.5 right-4 text-[9px] uppercase tracking-[0.22em] text-[#8a7456] font-[family-name:var(--font-jb-mono)]">
                SOURCE :: {sourceTag}
            </div>

            <div className="pt-14 pb-6 px-7">{children}</div>

            {/* footer status strip */}
            <div
                className="border-t border-dashed border-[#2f2518] px-7 py-3 flex items-center justify-between text-[9px] uppercase tracking-[0.22em] font-[family-name:var(--font-jb-mono)]"
                style={{ color: statusColor }}
            >
                <div className="flex items-center gap-2">
                    <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: statusColor, boxShadow: `0 0 10px ${statusColor}` }}
                    />
                    {statusText}
                </div>
                <span className="text-[#5d4a30]">::END-OF-FILE::</span>
            </div>
        </div>
    );
}

// ─── Keyframes + global styles injected once ──────────────────────────────────
function DossierStyles() {
    return (
        <style jsx global>{`
            @keyframes stampIn {
                0% {
                    opacity: 0;
                    transform: rotate(8deg) scale(1.25);
                }
                60% {
                    opacity: 1;
                    transform: rotate(-6.5deg) scale(0.96);
                }
                100% {
                    opacity: 1;
                    transform: rotate(-4.5deg) scale(1);
                }
            }
            @keyframes caseSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(14px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .reveal-stagger > * {
                animation: caseSlideIn 0.55s cubic-bezier(0.22, 0.9, 0.3, 1) both;
            }
            .reveal-stagger > *:nth-child(1) {
                animation-delay: 0.05s;
            }
            .reveal-stagger > *:nth-child(2) {
                animation-delay: 0.15s;
            }
            .reveal-stagger > *:nth-child(3) {
                animation-delay: 0.25s;
            }
            .reveal-stagger > *:nth-child(4) {
                animation-delay: 0.35s;
            }
        `}</style>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function VerifyCasinoTxnContent() {
    const searchParams = useSearchParams();
    const initialTxn = searchParams.get("txnId") || "";
    const initialDay = searchParams.get("day") || todayUtcISO();
    const autoRun = searchParams.get("auto") === "1";

    const [txnId, setTxnId] = useState(initialTxn);
    const [day, setDay] = useState<string>(initialDay);
    const [result, setResult] = useState<CasinoTxVerifyResult | null>(null);
    const [loading, setLoading] = useState(false);
    const ranAutoRef = useRef(false);

    const runVerify = async (id: string, dayIso: string) => {
        if (!id.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await verifyCasinoTransaction({
                txnId: id.trim(),
                day: dayIso || undefined,
            });
            setResult(res);
        } finally {
            setLoading(false);
        }
    };

    // Auto-run when navigated with ?txnId=...&auto=1 — guarded so React
    // strict-mode double-mount doesn't fire twice.
    useEffect(() => {
        if (autoRun && initialTxn && !ranAutoRef.current) {
            ranAutoRef.current = true;
            runVerify(initialTxn, initialDay);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        runVerify(txnId, day);
    };

    const verdictMeta =
        result?.verdict && (result.verdict as string) in VERDICT
            ? VERDICT[result.verdict as VerdictKey]
            : null;

    // Build a human-legible case reference
    const caseRef = (txnId || initialTxn || "")
        .slice(0, 8)
        .toUpperCase() || "PENDING";

    return (
        <div
            className={`${fraunces.variable} ${jbMono.variable} relative -mx-4 -my-4 md:-mx-6 md:-my-6 min-h-[calc(100vh-2rem)] overflow-hidden bg-[#0b0807] text-[#f4ece0]`}
            style={{
                backgroundImage:
                    "radial-gradient(1200px 600px at 20% -5%, rgba(255,176,0,0.06), transparent 60%), radial-gradient(900px 480px at 95% 110%, rgba(224,74,58,0.05), transparent 55%)",
            }}
        >
            <DossierStyles />
            <GraphPaper />
            <Scanlines />
            <GrainOverlay />

            <div className="relative z-[3] max-w-[1200px] mx-auto px-6 md:px-10 py-14 md:py-16 reveal-stagger">
                <CaseHeader caseRef={`ZR-${caseRef}`} day={day || todayUtcISO()} />

                <TerminalForm
                    txnId={txnId}
                    day={day}
                    loading={loading}
                    onSubmit={handleVerify}
                    onTxnChange={setTxnId}
                    onDayChange={setDay}
                />

                {/* ─── Error (infrastructure / network) ─── */}
                {result && result.success === false && !result.verdict && (
                    <div className="relative z-10 mt-10 bg-[#1a0908] border border-[#e04a3a]/40 p-6">
                        <div className="flex items-center gap-3 text-[#ff6b5a] font-[family-name:var(--font-jb-mono)] text-[11px] uppercase tracking-[0.22em]">
                            <span className="inline-block w-2 h-2 bg-[#ff6b5a] rounded-full animate-pulse" />
                            QUERY FAILED
                        </div>
                        <div className="mt-3 text-[13px] text-[#f4ece0]">
                            {result.error}
                        </div>
                    </div>
                )}

                {/* ─── Verdict + dossiers ─── */}
                {result && verdictMeta && (
                    <>
                        <VerdictStamp verdict={verdictMeta} />

                        {result.queriedDay && (
                            <div className="relative z-10 mt-10 text-[10px] uppercase tracking-[0.28em] text-[#8a7456] font-[family-name:var(--font-jb-mono)] flex items-center gap-3">
                                <span className="text-[#ffb000]">◆</span>
                                HUIDU QUERIED FOR UTC DAY{" "}
                                <span className="text-[#ffb000]">{result.queriedDay}</span>
                                {result.diffs && result.diffs.length > 0 && (
                                    <>
                                        <span className="text-[#5d4a30]">//</span>
                                        <span className="text-[#ff6b5a]">
                                            {result.diffs.length} DIVERGENCE
                                            {result.diffs.length > 1 ? "S" : ""}
                                        </span>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Diff list (only when MISMATCH) */}
                        {result.diffs && result.diffs.length > 0 && (
                            <div className="relative z-10 mt-4 bg-[#1a0e05] border border-dashed border-[#ffb000]/40 p-5">
                                <div className="text-[9px] uppercase tracking-[0.28em] text-[#ffb000] font-[family-name:var(--font-jb-mono)] mb-3">
                                    FIELD DIVERGENCES
                                </div>
                                <ul className="space-y-1.5 font-[family-name:var(--font-jb-mono)] text-[12px] text-[#f4ece0]">
                                    {result.diffs.map((d, i) => (
                                        <li key={i} className="flex gap-3">
                                            <span className="text-[#ffb000] shrink-0">
                                                {String(i + 1).padStart(2, "0")}
                                            </span>
                                            <span>{d}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Side-by-side dossier panels */}
                        {(result.local || result.huidu) && (
                            <div className="relative z-10 mt-12 grid grid-cols-1 lg:grid-cols-2 gap-7">
                                <DossierPanel
                                    side="left"
                                    label="LOCAL EVIDENCE"
                                    sourceTag="POSTGRES"
                                    hasRecord={!!result.local}
                                >
                                    {result.local ? (
                                        <div>
                                            <DossierRow label="DB ID" value={result.local.id} mono />
                                            <DossierRow
                                                label="User"
                                                value={`${result.local.username || "—"} (#${result.local.user_id})`}
                                                emphasis="primary"
                                            />
                                            <DossierRow
                                                label="Type"
                                                value={result.local.type}
                                                emphasis="primary"
                                            />
                                            <DossierRow
                                                label="Amount"
                                                value={formatNumber(result.local.amount)}
                                                emphasis="money"
                                            />
                                            <DossierRow
                                                label="Wallet"
                                                value={result.local.wallet_type}
                                            />
                                            <DossierRow
                                                label="Provider"
                                                value={result.local.provider}
                                            />
                                            <DossierRow
                                                label="Game"
                                                value={result.local.game_name}
                                            />
                                            <DossierRow
                                                label="Game Code"
                                                value={result.local.game_code}
                                                mono
                                            />
                                            <DossierRow
                                                label="Round ID"
                                                value={result.local.round_id}
                                                mono
                                            />
                                            <DossierRow
                                                label="Serial No."
                                                value={result.local.txn_id}
                                                mono
                                            />
                                            <DossierRow
                                                label="Timestamp"
                                                value={result.local.timestamp}
                                                mono
                                            />
                                        </div>
                                    ) : (
                                        <EmptyDossierBody
                                            title="No local record."
                                            body="This serial number was not found in the CasinoTransaction table. If HUIDU has the record (see the adjacent panel), investigate the webhook handler logs for the timestamp."
                                        />
                                    )}
                                </DossierPanel>

                                <DossierPanel
                                    side="right"
                                    label="REMOTE EVIDENCE"
                                    sourceTag="HUIDU.BET"
                                    hasRecord={!!result.huidu}
                                >
                                    {result.huidu ? (
                                        <div>
                                            <DossierRow
                                                label="Member"
                                                value={result.huidu.member_account}
                                                mono
                                                emphasis="primary"
                                            />
                                            <DossierRow
                                                label="Wallet"
                                                value={(result.huidu as any).wallet_type}
                                            />
                                            <DossierRow
                                                label="Bet"
                                                value={formatNumber(result.huidu.bet_amount)}
                                                emphasis="money"
                                            />
                                            <DossierRow
                                                label="Win"
                                                value={formatNumber(result.huidu.win_amount)}
                                                emphasis="money"
                                            />
                                            <DossierRow
                                                label="Currency"
                                                value={result.huidu.currency_code}
                                            />
                                            <DossierRow
                                                label="Game UID"
                                                value={result.huidu.game_uid}
                                                mono
                                            />
                                            <DossierRow
                                                label="Game Round"
                                                value={result.huidu.game_round}
                                                mono
                                            />
                                            <DossierRow
                                                label="Serial No."
                                                value={result.huidu.serial_number}
                                                mono
                                            />
                                            <DossierRow
                                                label="Timestamp"
                                                value={result.huidu.timestamp}
                                                mono
                                            />
                                            <DossierRow
                                                label="Agency UID"
                                                value={result.huidu.agency_uid}
                                                mono
                                            />
                                        </div>
                                    ) : (
                                        <EmptyDossierBody
                                            title="No remote record."
                                            body="HUIDU's /game/transaction/list endpoint returned no entry matching this serial number for the queried UTC day. Most likely the round was voided or rolled back on HUIDU's side after the original callback was processed."
                                        />
                                    )}
                                </DossierPanel>
                            </div>
                        )}

                        {/* Actions strip */}
                        <div className="relative z-10 mt-12 border-t border-dashed border-[#2f2518] pt-6 flex flex-wrap items-center gap-4 justify-between">
                            <div className="text-[9px] uppercase tracking-[0.28em] text-[#8a7456] font-[family-name:var(--font-jb-mono)]">
                                END OF BRIEF · file closed{" "}
                                <span className="text-[#e8d9bf]">
                                    {new Date().toISOString().slice(11, 19)}Z
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => runVerify(txnId, day)}
                                    className="group inline-flex items-center gap-2 px-4 py-2.5 border border-[#5d4a30] hover:border-[#ffb000] hover:bg-[#1a1108] text-[#e8d9bf] hover:text-[#ffb000] font-[family-name:var(--font-jb-mono)] text-[10px] uppercase tracking-[0.22em] transition-colors"
                                >
                                    <RefreshCw size={12} strokeWidth={2.5} />
                                    RE-RUN QUERY
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const payload = JSON.stringify(result, null, 2);
                                        const blob = new Blob([payload], {
                                            type: "application/json",
                                        });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        a.download = `dossier-${caseRef}.json`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="group inline-flex items-center gap-2 px-4 py-2.5 border border-[#5d4a30] hover:border-[#ffb000] hover:bg-[#1a1108] text-[#e8d9bf] hover:text-[#ffb000] font-[family-name:var(--font-jb-mono)] text-[10px] uppercase tracking-[0.22em] transition-colors"
                                >
                                    <Download size={12} strokeWidth={2.5} />
                                    EXPORT DOSSIER
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (result?.local?.txn_id) {
                                            navigator.clipboard.writeText(
                                                result.local.txn_id,
                                            );
                                        }
                                    }}
                                    className="group inline-flex items-center gap-2 px-4 py-2.5 bg-[#ffb000] text-[#0c0905] hover:bg-[#ffc33d] font-[family-name:var(--font-jb-mono)] text-[10px] uppercase tracking-[0.22em] font-bold transition-colors"
                                >
                                    <Stamp size={12} strokeWidth={3} />
                                    MARK AS REVIEWED
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Bottom signature / watermark */}
                <div className="relative z-10 mt-16 pt-6 border-t border-[#2f2518] text-[9px] uppercase tracking-[0.36em] text-[#5d4a30] font-[family-name:var(--font-jb-mono)] flex items-center justify-between">
                    <span>ZEERO // OPS · CASINO-AUDIT · v2</span>
                    <span>◯ ◯ ◯</span>
                    <span>AUTHORITY :: HUIDU LIVE · POSTGRES MASTER</span>
                </div>
            </div>
        </div>
    );
}

function EmptyDossierBody({ title, body }: { title: string; body: string }) {
    return (
        <div className="py-6">
            <div className="font-[family-name:var(--font-fraunces)] italic text-[22px] text-[#e8d9bf] leading-tight">
                {title}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-[#8a7456] max-w-sm">
                {body}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.24em] text-[#e04a3a] font-[family-name:var(--font-jb-mono)]">
                <span className="inline-block w-2 h-2 bg-[#e04a3a] rounded-full" />
                FILE LEFT BLANK BY SOURCE
            </div>
        </div>
    );
}

export default function VerifyCasinoTxnPage() {
    return (
        <Suspense
            fallback={
                <div className="py-20 flex justify-center">
                    <Loader2 className="animate-spin text-[#ffb000]" size={32} />
                </div>
            }
        >
            <VerifyCasinoTxnContent />
        </Suspense>
    );
}
