"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, RotateCw, History, AlertTriangle } from "lucide-react";
import api from "@/services/api";

interface BetHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The originals game slug, e.g. "coinflip", "keno", "hilo". */
  gameKey: string;
}

/**
 * A single history row. Fields vary slightly per game, so everything beyond the
 * common set is optional. The backend always returns betAmount / multiplier /
 * payout / status / createdAt (plus a gameId we use as a stable key).
 */
interface HistoryRow {
  gameId?: string;
  _id?: string;
  betAmount?: number;
  multiplier?: number;
  payout?: number;
  status?: string;
  createdAt?: string | number | Date;
  [k: string]: unknown;
}

const ACCENT = "#ff9a3d";

// ── helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/** "$1,234.50" — matches the controls' fixed-2 money formatting. */
function fmtMoney(v: unknown): string {
  return (
    "$" +
    toNum(v).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Compact, relative timestamp: "12s", "5m", "3h", "2d", else a date. */
function fmtRelative(value: HistoryRow["createdAt"]): string {
  if (!value) return "—";
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 0) return "now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type Outcome = "won" | "lost" | "cashedout" | "push";

/** Normalize the per-game status strings into one of four buckets. */
function classify(row: HistoryRow): Outcome {
  const raw = String(row.status ?? "").toUpperCase().replace(/[\s_-]/g, "");
  if (raw.includes("CASH")) return "cashedout";
  if (raw === "WON" || raw === "WIN") return "won";
  if (raw === "LOST" || raw === "LOSE" || raw === "LOSS") return "lost";
  if (raw === "PUSH" || raw === "DRAW" || raw === "TIE") return "push";
  // Fall back to payout vs. bet when status is ambiguous/empty.
  const payout = toNum(row.payout);
  const bet = toNum(row.betAmount);
  if (payout > bet) return "won";
  if (payout > 0 && payout === bet) return "push";
  return "lost";
}

const PILL: Record<Outcome, { label: string; cls: string }> = {
  won: {
    label: "WON",
    cls: "bg-green-500/15 text-green-400 border-green-500/25",
  },
  cashedout: {
    label: "CASHED OUT",
    cls: "bg-green-500/15 text-green-400 border-green-500/25",
  },
  lost: {
    label: "LOST",
    cls: "bg-red-500/15 text-red-400 border-red-500/25",
  },
  push: {
    label: "PUSH",
    cls: "bg-white/[0.06] text-[#9ca3af] border-white/[0.10]",
  },
};

function StatusPill({ outcome }: { outcome: Outcome }) {
  const { label, cls } = PILL[outcome];
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-[3px] rounded-md text-[10px] font-black tracking-wide border whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export default function BetHistoryDrawer({
  open,
  onClose,
  gameKey,
}: BetHistoryDrawerProps) {
  const reduceMotion = useReducedMotion();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Guards against setting state after an unmount / out-of-order responses.
  const reqIdRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const fetchHistory = useCallback(async () => {
    if (!gameKey) return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        `/originals/${encodeURIComponent(gameKey)}/history`,
        { params: { limit: 30 } },
      );
      if (reqId !== reqIdRef.current) return; // a newer request superseded this one
      const data = res?.data;
      setRows(Array.isArray(data) ? (data as HistoryRow[]) : []);
    } catch {
      if (reqId !== reqIdRef.current) return;
      setError("Couldn't load your bet history. Please try again.");
      setRows([]);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [gameKey]);

  // Fetch whenever the drawer opens (or the game changes while open).
  useEffect(() => {
    if (open) void fetchHistory();
  }, [open, fetchHistory]);

  // Close on Escape + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const ease = [0.22, 1, 0.36, 1] as const;

  const drawer = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[600]" aria-hidden={!open}>
          {/* Scrim */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="My bet history"
            className="absolute top-0 right-0 h-full w-full max-w-[420px] bg-[#0f1115] border-l border-white/[0.06] shadow-2xl flex flex-col"
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.32, ease }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${ACCENT}1a`, color: ACCENT }}
                >
                  <History size={15} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-white leading-tight">
                    My Bets
                  </h2>
                  <p className="text-[11px] text-[#6b7280] capitalize truncate">
                    {gameKey || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void fetchHistory()}
                  disabled={loading}
                  aria-label="Refresh history"
                  title="Refresh"
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#9ca3af] hover:text-white hover:border-white/[0.12] transition-all disabled:opacity-40"
                >
                  <RotateCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  title="Close"
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#9ca3af] hover:text-white hover:border-white/[0.12] transition-all"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[52px_1fr_1fr_1fr_auto] gap-2 px-4 py-2 border-b border-white/[0.04] flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">
              <span>Time</span>
              <span className="text-right">Bet</span>
              <span className="text-right">Mult</span>
              <span className="text-right">Payout</span>
              <span className="text-right">Status</span>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {loading && rows.length === 0 ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-10 rounded-lg bg-white/[0.03] animate-pulse"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-3">
                  <div className="w-11 h-11 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle size={20} className="text-red-400" />
                  </div>
                  <p className="text-[13px] text-[#9ca3af] max-w-[260px]">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => void fetchHistory()}
                    className="mt-1 px-4 py-2 rounded-lg text-xs font-bold text-black transition-all hover:brightness-110"
                    style={{ background: ACCENT }}
                  >
                    Retry
                  </button>
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-3">
                  <div className="w-11 h-11 rounded-full bg-white/[0.04] flex items-center justify-center">
                    <History size={20} className="text-[#6b7280]" />
                  </div>
                  <p className="text-[13px] font-bold text-white">No bets yet</p>
                  <p className="text-[12px] text-[#6b7280] max-w-[240px]">
                    Your recent rounds for this game will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.04]">
                  {rows.map((row, i) => {
                    const outcome = classify(row);
                    const mult = toNum(row.multiplier);
                    return (
                      <li
                        key={row.gameId ?? row._id ?? i}
                        className="grid grid-cols-[52px_1fr_1fr_1fr_auto] gap-2 items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                      >
                        <span className="text-[11px] text-[#6b7280] font-medium tabular-nums">
                          {fmtRelative(row.createdAt)}
                        </span>
                        <span className="text-[12px] text-[#9ca3af] font-bold text-right tabular-nums">
                          {fmtMoney(row.betAmount)}
                        </span>
                        <span className="text-[12px] text-white font-bold text-right tabular-nums">
                          {mult > 0 ? `${mult.toFixed(2)}×` : "—"}
                        </span>
                        <span
                          className={`text-[12px] font-black text-right tabular-nums ${
                            outcome === "lost"
                              ? "text-[#6b7280]"
                              : "text-green-400"
                          }`}
                        >
                          {fmtMoney(row.payout)}
                        </span>
                        <span className="text-right">
                          <StatusPill outcome={outcome} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-white/[0.06] flex-shrink-0 text-[10px] text-[#6b7280] text-center">
              Showing your last {rows.length || 0} bet
              {rows.length === 1 ? "" : "s"}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(drawer, document.body);
}
