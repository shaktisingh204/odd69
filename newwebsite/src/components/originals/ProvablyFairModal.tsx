"use client";

import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  X,
  Copy,
  Check,
  RefreshCw,
  Dice5,
  ShieldCheck,
  Loader2,
  Lock,
  Unlock,
} from "lucide-react";
import api from "@/services/api";
import { playSound } from "@/utils/originalsFx";

const ACCENT = "#ff9a3d";

interface ProvablyFairModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional — which game opened the panel (the seed pair is per-user, shared across all Originals). */
  gameKey?: string;
}

/** Public fairness state returned by GET /originals/fair/state. */
interface FairState {
  serverSeedHash: string;
  nextServerSeedHash: string;
  clientSeed: string;
  nonce: number;
  previousServerSeed?: string;
  previousServerSeedHash?: string;
  previousClientSeed?: string;
  previousNonce?: number;
}

/** Result returned by POST /originals/fair/rotate. */
interface RotateResult {
  revealedServerSeed: string;
  revealedServerSeedHash: string;
  previousClientSeed: string;
  previousNonce: number;
  serverSeedHash: string;
  nextServerSeedHash: string;
  clientSeed: string;
  nonce: number;
}

/** Generate a fresh 32-char hex client seed using the Web Crypto API. */
function randomClientSeed(): string {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback (non-crypto) — only ever hit in environments without Web Crypto.
  return Math.random().toString(36).slice(2).padEnd(16, "0").slice(0, 16);
}

/**
 * Per-user provably-fair panel for ODD69 Originals.
 *
 * The seed pair is per-user and shared across every Originals game (dice,
 * mines, plinko, …): one active committed server-seed hash, one queued "next"
 * hash, an editable client seed, and a running nonce. The raw server seed is
 * only disclosed when the player rotates the pair, at which point it can be
 * used to verify every bet placed against it.
 *
 *   GET  /originals/fair/state        → current FairState
 *   POST /originals/fair/client-seed  { clientSeed }  → updated FairState
 *   POST /originals/fair/rotate       { clientSeed? } → RotateResult (reveals prev server seed)
 */
export default function ProvablyFairModal({
  open,
  onClose,
  gameKey,
}: ProvablyFairModalProps) {
  const prefersReducedMotion = useReducedMotion();

  const [mounted, setMounted] = React.useState(false);
  const [state, setState] = React.useState<FairState | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Client-seed editor (local, until Saved / Rotated).
  const [clientSeedInput, setClientSeedInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [rotating, setRotating] = React.useState(false);

  // Freshly-revealed previous server seed from the most recent rotate this session.
  const [justRevealed, setJustRevealed] = React.useState<RotateResult | null>(
    null,
  );

  // Which value was last copied (drives the transient ✓ swap).
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const seedDirty =
    !!state && clientSeedInput.trim() !== state.clientSeed.trim();
  const seedValid =
    clientSeedInput.trim().length >= 1 && clientSeedInput.trim().length <= 256;

  // Portal target only exists on the client.
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const loadState = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<FairState>("/originals/fair/state");
      setState(res.data);
      setClientSeedInput(res.data.clientSeed ?? "");
    } catch (err: unknown) {
      setError(
        getApiMessage(err) || "Could not load fairness data. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch fresh state every time the modal opens; reset transient UI.
  React.useEffect(() => {
    if (!open) return;
    setJustRevealed(null);
    setCopiedKey(null);
    void loadState();
  }, [open, loadState]);

  // Close on Escape while open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  React.useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const copy = React.useCallback((key: string, value?: string) => {
    if (!value) return;
    const finish = () => {
      setCopiedKey(key);
      playSound("tick");
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedKey(null), 1400);
    };
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(finish).catch(finish);
    } else {
      finish();
    }
  }, []);

  const handleRandomize = () => {
    setClientSeedInput(randomClientSeed());
    setError(null);
  };

  const handleSaveSeed = async () => {
    if (!seedValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<FairState>("/originals/fair/client-seed", {
        clientSeed: clientSeedInput.trim(),
      });
      setState(res.data);
      setClientSeedInput(res.data.clientSeed ?? "");
      playSound("reveal");
    } catch (err: unknown) {
      setError(getApiMessage(err) || "Could not save your client seed.");
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    if (rotating) return;
    setRotating(true);
    setError(null);
    try {
      // Carry the edited client seed into the rotation if the player changed it.
      const body =
        seedDirty && seedValid ? { clientSeed: clientSeedInput.trim() } : {};
      const res = await api.post<RotateResult>("/originals/fair/rotate", body);
      const r = res.data;
      setJustRevealed(r);
      // Promote the new active pair into local state.
      setState({
        serverSeedHash: r.serverSeedHash,
        nextServerSeedHash: r.nextServerSeedHash,
        clientSeed: r.clientSeed,
        nonce: r.nonce,
        previousServerSeed: r.revealedServerSeed,
        previousServerSeedHash: r.revealedServerSeedHash,
        previousClientSeed: r.previousClientSeed,
        previousNonce: r.previousNonce,
      });
      setClientSeedInput(r.clientSeed ?? "");
      playSound("cashout");
    } catch (err: unknown) {
      setError(getApiMessage(err) || "Could not rotate your seed pair.");
    } finally {
      setRotating(false);
    }
  };

  if (!mounted) return null;

  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={prefersReducedMotion ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pf-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col bg-bg-modal-2 border border-white/[0.08] rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
            initial={
              prefersReducedMotion ? undefined : { opacity: 0, scale: 0.94, y: 8 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96, y: 8 }
            }
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${ACCENT}1f`,
                  border: `1px solid ${ACCENT}40`,
                }}
              >
                <ShieldCheck size={18} style={{ color: ACCENT }} />
              </div>
              <div className="min-w-0">
                <h2
                  id="pf-title"
                  className="text-white font-black text-base leading-tight"
                >
                  Provably Fair
                </h2>
                <p className="text-[11px] text-[#6b7280] leading-tight">
                  {gameKey
                    ? `Seed pair · shared across all Originals (${gameKey})`
                    : "Seed pair · shared across all Originals"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af] hover:text-white hover:border-white/[0.14] transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {loading ? (
                <div className="py-16 flex items-center justify-center text-[#6b7280]">
                  <Loader2 size={22} className="animate-spin" />
                </div>
              ) : !state ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-sm text-danger">
                    {error || "Fairness data unavailable."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadState()}
                    className="px-4 py-2 rounded-lg bg-bg-deep-3 border border-white/[0.08] text-sm font-bold text-white hover:border-white/[0.16] transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs font-medium">
                      {error}
                    </div>
                  )}

                  {/* Active (committed) server seed hash */}
                  <SeedField
                    label="Active Server Seed (hashed)"
                    badge={
                      <Lock size={11} className="text-[#9ca3af]" aria-hidden />
                    }
                    badgeLabel="Committed"
                    value={state.serverSeedHash}
                    copied={copiedKey === "active"}
                    onCopy={() => copy("active", state.serverSeedHash)}
                    hint="Committed before any bet — only revealed when you rotate."
                  />

                  {/* Next server seed hash */}
                  <SeedField
                    label="Next Server Seed (hashed)"
                    value={state.nextServerSeedHash}
                    copied={copiedKey === "next"}
                    onCopy={() => copy("next", state.nextServerSeedHash)}
                    hint="Becomes active the moment you rotate."
                  />

                  {/* Client seed editor */}
                  <div>
                    <label
                      htmlFor="pf-client-seed"
                      className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider"
                    >
                      Client Seed
                    </label>
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        id="pf-client-seed"
                        type="text"
                        value={clientSeedInput}
                        maxLength={256}
                        spellCheck={false}
                        autoComplete="off"
                        onChange={(e) => {
                          setClientSeedInput(e.target.value);
                          setError(null);
                        }}
                        className="flex-1 min-w-0 bg-bg-deep-3 border border-white/[0.06] rounded-lg px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-[#ff9a3d]/50 transition-colors"
                        style={{ caretColor: ACCENT }}
                      />
                      <button
                        type="button"
                        onClick={handleRandomize}
                        title="Randomize client seed"
                        aria-label="Randomize client seed"
                        className="px-3 py-2.5 bg-bg-deep-3 border border-white/[0.06] rounded-lg text-[#9ca3af] hover:text-white hover:border-white/[0.14] transition-colors flex-shrink-0"
                      >
                        <Dice5 size={16} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-[#6b7280]">
                        {seedValid
                          ? "1–256 characters. You control this value."
                          : "Client seed must be 1–256 characters."}
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveSeed}
                        disabled={!seedDirty || !seedValid || saving}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
                        style={{ background: ACCENT }}
                      >
                        {saving ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Saving
                          </>
                        ) : (
                          "Save"
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Nonce */}
                  <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-bg-deep-3 border border-white/[0.06]">
                    <span className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
                      Current Nonce
                    </span>
                    <span className="text-white font-black tabular-nums text-sm">
                      {state.nonce}
                    </span>
                  </div>

                  {/* Rotate */}
                  <button
                    type="button"
                    onClick={handleRotate}
                    disabled={rotating}
                    className="w-full py-3 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-white/[0.10] bg-bg-deep-3 hover:border-[#ff9a3d]/50 hover:bg-[#ff9a3d]/[0.06]"
                  >
                    {rotating ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={15} style={{ color: ACCENT }} />
                    )}
                    Rotate Seed Pair
                  </button>
                  <p className="text-[11px] text-[#6b7280] -mt-2 text-center">
                    Rotating reveals the current server seed so you can verify
                    past bets, then commits a new pair and resets the nonce to 0.
                  </p>

                  {/* Revealed previous seed (this session) or last-known previous */}
                  {(justRevealed ||
                    state.previousServerSeed ||
                    state.previousServerSeedHash) && (
                    <div className="rounded-xl border border-success-bright/25 bg-success-bright/[0.05] p-3 space-y-3">
                      <div className="flex items-center gap-1.5 text-success-bright text-[11px] font-bold uppercase tracking-wider">
                        <Unlock size={12} />
                        {justRevealed
                          ? "Revealed — Verify Your Past Bets"
                          : "Previous Seed Pair (verifiable)"}
                      </div>

                      {(justRevealed?.revealedServerSeed ||
                        state.previousServerSeed) && (
                        <SeedField
                          dense
                          label="Previous Server Seed (revealed)"
                          value={
                            justRevealed?.revealedServerSeed ??
                            state.previousServerSeed
                          }
                          copied={copiedKey === "prevServer"}
                          onCopy={() =>
                            copy(
                              "prevServer",
                              justRevealed?.revealedServerSeed ??
                                state.previousServerSeed,
                            )
                          }
                          hint={
                            state.previousServerSeedHash
                              ? `SHA-256 must equal ${truncate(
                                  state.previousServerSeedHash,
                                )}`
                              : undefined
                          }
                        />
                      )}

                      {(justRevealed?.previousClientSeed ??
                        state.previousClientSeed) && (
                        <SeedField
                          dense
                          label="Previous Client Seed"
                          value={
                            justRevealed?.previousClientSeed ??
                            state.previousClientSeed
                          }
                          copied={copiedKey === "prevClient"}
                          onCopy={() =>
                            copy(
                              "prevClient",
                              justRevealed?.previousClientSeed ??
                                state.previousClientSeed,
                            )
                          }
                        />
                      )}

                      <div className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-black/20">
                        <span className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
                          Previous Nonce (bets placed)
                        </span>
                        <span className="text-white font-black tabular-nums text-sm">
                          {justRevealed?.previousNonce ??
                            state.previousNonce ??
                            0}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Explainer */}
                  <div className="rounded-xl bg-bg-deep-3 border border-white/[0.06] p-3.5 space-y-2">
                    <h3 className="text-[11px] text-white font-bold uppercase tracking-wider">
                      How verification works
                    </h3>
                    <p className="text-[12px] leading-relaxed text-[#9ca3af]">
                      Every result is derived from{" "}
                      <code className="px-1 py-0.5 rounded bg-black/30 text-[#ffd24a] font-mono text-[11px]">
                        HMAC-SHA256(serverSeed, clientSeed:nonce)
                      </code>
                      . Before any bet, we commit to the server seed by showing
                      you its SHA-256 hash — so it can&apos;t change afterwards.
                      You pick the client seed, and the nonce counts up by one
                      per bet.
                    </p>
                    <p className="text-[12px] leading-relaxed text-[#9ca3af]">
                      The raw server seed is only revealed when you rotate the
                      pair. Once revealed, hash it yourself: the SHA-256 must
                      match the committed hash you saw earlier, proving no result
                      was tampered with. Replay any bet with the revealed server
                      seed, your client seed, and its nonce to confirm the
                      outcome.
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}

/* ------------------------------------------------------------------ helpers */

function truncate(s: string, head = 10, tail = 6): string {
  if (!s || s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function getApiMessage(err: unknown): string | undefined {
  const e = err as { response?: { data?: { message?: unknown } } };
  const msg = e?.response?.data?.message;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg) && typeof msg[0] === "string") return msg[0];
  return undefined;
}

interface SeedFieldProps {
  label: string;
  value?: string;
  copied: boolean;
  onCopy: () => void;
  hint?: string;
  /** Small inline icon next to the label (e.g. lock). */
  badge?: React.ReactNode;
  /** Pill text shown after the label. */
  badgeLabel?: string;
  /** Tighter padding for nested (revealed) blocks. */
  dense?: boolean;
}

/** Read-only seed/hash row with a copy button + monospace value. */
function SeedField({
  label,
  value,
  copied,
  onCopy,
  hint,
  badge,
  badgeLabel,
  dense,
}: SeedFieldProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {badge}
        <span className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
          {label}
        </span>
        {badgeLabel && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[#9ca3af]">
            {badgeLabel}
          </span>
        )}
      </div>
      <div
        className={`flex items-center gap-2 bg-bg-deep-3 border border-white/[0.06] rounded-lg ${
          dense ? "px-2.5 py-2" : "px-3 py-2.5"
        }`}
      >
        <code className="flex-1 min-w-0 text-[12px] font-mono text-[#e5e7eb] break-all leading-snug">
          {value || "—"}
        </code>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          aria-label={`Copy ${label}`}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-white/[0.04] border border-white/[0.06] text-[#9ca3af] hover:text-white hover:border-white/[0.14] transition-colors disabled:opacity-30"
        >
          {copied ? (
            <Check size={13} className="text-success-bright" />
          ) : (
            <Copy size={13} />
          )}
        </button>
      </div>
      {hint && <p className="mt-1 text-[10.5px] text-[#6b7280]">{hint}</p>}
    </div>
  );
}
