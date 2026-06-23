"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import OriginalsAutoBet from "@/components/originals/OriginalsAutoBet";
import { useWallet } from "@/context/WalletContext";
import { Sparkles, RotateCcw, Hash, Zap } from "lucide-react";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";
import KenoLadder from "./KenoLadder";
import { kenoMaxMultiplier, KENO_RISKS, type KenoRisk } from "./paytable";

interface KenoResult {
  gameId: string;
  selected: number[];
  drawn: number[];
  hits: number;
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
  risk?: KenoRisk;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
}

const ACCENT = "#ff9a3d";
// Authentic Stake layout: 40 numbers as 8 columns × 5 rows.
const POOL = Array.from({ length: 40 }, (_, i) => i + 1);
const MAX_PICK = 10;

// Per-ball reveal cadence (ms). Tightened from 230ms to match Stake's rhythmic
// ~150ms feel. Reduced motion / Instant Bet bypass the stagger entirely.
const REVEAL_STEP_MS = 150;
// Big-win confetti threshold (multiplier ≥ this fires the barrage).
const BIG_WIN_MULT = 20;

export default function KenoPage() {
  const { refreshWallet } = useWallet();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [risk, setRisk] = useState<KenoRisk>("classic");
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [instant, setInstant] = useState(false);
  const [result, setResult] = useState<KenoResult | null>(null);

  // How many of result.drawn[] have been revealed so far. Drives the
  // staggered one-by-one reveal of the SERVER-supplied draw.
  const [revealCount, setRevealCount] = useState(0);
  const [revealing, setRevealing] = useState(false);

  const reducedMotion = useReducedMotion();
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSoundRef = useRef(0);
  // Resolves once the current draw's reveal+celebration has fully finished, so
  // the autobet loop can wait for the animation before placing the next bet.
  const revealResolveRef = useRef<(() => void) | null>(null);
  // Latest picks set, read inside the async autobet loop without stale closures.
  const picksRef = useRef(picks);
  useEffect(() => {
    picksRef.current = picks;
  }, [picks]);

  const clearRevealTimer = () => {
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
  };

  // Cleanup any pending timers / resolve any waiter on unmount.
  useEffect(
    () => () => {
      clearRevealTimer();
      revealResolveRef.current?.();
      revealResolveRef.current = null;
    },
    [],
  );

  // Throttled reveal blip so rapid balls don't stack into noise.
  const playRevealThrottled = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundRef.current < 90) return;
    lastSoundRef.current = now;
    playSound("reveal");
  }, []);

  // Fire celebrations once the full server draw has been revealed.
  const finishReveal = useCallback((r: KenoResult) => {
    setRevealing(false);
    if (r.status === "WON") {
      playSound("win");
      if (r.multiplier >= BIG_WIN_MULT) fireBigWin();
      else fireWin();
    } else {
      playSound("lose");
    }
    // Release the autobet loop (if any) now that the round is fully resolved.
    revealResolveRef.current?.();
    revealResolveRef.current = null;
  }, []);

  // When a new server result arrives, animate its `drawn` array in.
  useEffect(() => {
    clearRevealTimer();
    if (!result) {
      setRevealCount(0);
      setRevealing(false);
      return;
    }

    const total = result.drawn.length;

    // Reduced motion OR Instant Bet: snap straight to the final, correct state.
    if (reducedMotion || instant) {
      setRevealCount(total);
      setRevealing(false);
      if (result.status === "WON") {
        playSound("win");
        if (result.multiplier >= BIG_WIN_MULT) fireBigWin();
        else fireWin();
      } else {
        playSound("lose");
      }
      revealResolveRef.current?.();
      revealResolveRef.current = null;
      return;
    }

    setRevealCount(0);
    setRevealing(true);

    let i = 0;
    const tick = () => {
      i += 1;
      setRevealCount(i);
      playRevealThrottled();
      if (i < total) {
        revealTimer.current = setTimeout(tick, REVEAL_STEP_MS);
      } else {
        // Brief beat after the last ball lands before celebrating.
        revealTimer.current = setTimeout(() => finishReveal(result), 220);
      }
    };
    revealTimer.current = setTimeout(tick, REVEAL_STEP_MS);

    return clearRevealTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, reducedMotion, instant]);

  const locked = busy || autoBusy;

  const togglePick = (n: number) => {
    if (locked) return;
    setResult(null);
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(n)) {
        next.delete(n);
      } else {
        if (next.size >= MAX_PICK) {
          toast.error("Max 10 numbers");
          return prev;
        }
        next.add(n);
      }
      return next;
    });
  };
  const clear = () => {
    if (locked) return;
    setPicks(new Set());
    setResult(null);
  };
  const autoPick = () => {
    if (locked) return;
    setResult(null);
    // Stake fills to the current spot count (default 5 when none selected).
    const target = picks.size > 0 ? picks.size : 5;
    const next = new Set<number>();
    while (next.size < target) next.add(1 + Math.floor(Math.random() * 40));
    setPicks(next);
  };

  /**
   * Place a single keno bet against the SERVER and (unless Instant/reduced
   * motion) wait for the reveal animation to finish. Returns the result, or
   * null on error so the autobet loop can stop cleanly. UNCHANGED contract:
   * POST /originals/keno/play → { drawn, hits, multiplier, payout, status, … }.
   */
  const placeBet = useCallback(
    async (bet: number): Promise<KenoResult | null> => {
      const selected = Array.from(picksRef.current);
      if (selected.length === 0) {
        toast.error("Pick 1–10 numbers");
        return null;
      }
      setResult(null);
      try {
        const res = await api.post<KenoResult>("/originals/keno/play", {
          betAmount: bet,
          selected,
          risk,
          walletType,
          useBonus,
        });
        const data = res.data;

        // Arm a waiter the reveal effect will resolve once fully animated.
        const animationDone =
          reducedMotion || instant
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                revealResolveRef.current = resolve;
              });

        setResult(data);
        if (data.status === "WON")
          toast.success(`+$${data.payout.toLocaleString("en-US")}`);
        await refreshWallet();
        await animationDone;
        return data;
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "Play failed";
        toast.error(msg);
        return null;
      }
    },
    [risk, walletType, useBonus, refreshWallet, reducedMotion, instant],
  );

  // Manual single bet.
  const play = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Enter a valid bet");
    if (picks.size === 0) return toast.error("Pick 1–10 numbers");
    setBusy(true);
    playSound("bet");
    await placeBet(bet);
    setBusy(false);
  }, [betInput, picks.size, placeBet]);

  // Auto-bet adapter: one server bet → {won,payout} (null aborts the session).
  const runAutoBet = useCallback(
    async (bet: number) => {
      const data = await placeBet(bet);
      if (!data) return null;
      return { won: data.status === "WON", payout: data.payout };
    },
    [placeBet],
  );

  const baseBet = parseFloat(betInput) || 0;
  const maxMult = kenoMaxMultiplier(risk, picks.size);
  const potentialWin = baseBet > 0 && maxMult > 0 ? baseBet * maxMult : 0;

  // Only the numbers revealed so far (a prefix of the SERVER draw) are "drawn".
  const revealedDrawn = result ? result.drawn.slice(0, revealCount) : [];
  const drawnSet = new Set(revealedDrawn);
  const hitSet = new Set(revealedDrawn.filter((n) => picks.has(n)));
  const revealDone = !!result && !revealing;
  const liveHits = hitSet.size;

  return (
    <OriginalsShell
      gameKey="keno"
      title="Keno"
      historyGameKey="keno"
      tags={["# Keno", "# ODD69 Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={locked}
          accent={ACCENT}
          autoPanel={
            <OriginalsAutoBet
              baseBet={baseBet}
              accent={ACCENT}
              disabled={picks.size === 0 || baseBet <= 0}
              runBet={runAutoBet}
              onBusyChange={setAutoBusy}
            />
          }
          action={
            <button
              type="button"
              onClick={play}
              disabled={busy || picks.size === 0}
              className="w-full py-4 disabled:opacity-40 text-black font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: ACCENT }}
            >
              {busy ? "Drawing…" : "Bet"}
            </button>
          }
          footer={
            <div className="space-y-2">
              {/* Profit-on-win readout (best case for the current pick count). */}
              <div className="flex items-center justify-between rounded-lg bg-bg-deep-3 border border-white/[0.06] px-3 py-2">
                <span className="text-[10px] text-[#6b7280] font-bold uppercase tracking-wider">
                  Max Win {maxMult > 0 ? `(${maxMult}×)` : ""}
                </span>
                <span
                  className="text-xs font-black tabular-nums"
                  style={{ color: potentialWin > 0 ? ACCENT : "#6b7280" }}
                >
                  ${potentialWin.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="text-[10px] text-[#6b7280] text-center">
                {picks.size === 0
                  ? "Select 1–10 numbers to play"
                  : `${picks.size} selected`}
              </div>
            </div>
          }
        >
          {/* Risk picker */}
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Risk
            </label>
            <div className="grid grid-cols-4 gap-1">
              {KENO_RISKS.map((r) => {
                const active = risk === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => !locked && setRisk(r)}
                    disabled={locked}
                    className="py-1.5 rounded text-[10px] font-bold uppercase border transition-colors disabled:opacity-50"
                    style={
                      active
                        ? {
                            background: "rgba(255,154,61,0.18)",
                            borderColor: "rgba(255,154,61,0.45)",
                            color: ACCENT,
                          }
                        : {
                            background: "var(--bg-deep-3, #14161b)",
                            borderColor: "rgba(255,255,255,0.06)",
                            color: "#9ca3af",
                          }
                    }
                  >
                    {r}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-1 mt-2">
              <button
                type="button"
                onClick={autoPick}
                disabled={locked}
                className="flex items-center justify-center gap-1 py-1.5 bg-bg-deep-3 border border-white/[0.06] rounded text-[11px] text-[#9ca3af] hover:text-white hover:border-white/[0.12] disabled:opacity-50"
              >
                <Sparkles size={11} /> Auto Pick
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={locked}
                className="flex items-center justify-center gap-1 py-1.5 bg-bg-deep-3 border border-white/[0.06] rounded text-[11px] text-[#9ca3af] hover:text-white hover:border-white/[0.12] disabled:opacity-50"
              >
                <RotateCcw size={11} /> Clear
              </button>
            </div>
          </div>

          {/* Instant Bet toggle — collapses the reveal stagger for fast play. */}
          <div className="flex items-center justify-between py-2">
            <span className="flex items-center gap-1.5 text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
              <Zap size={12} /> Instant Bet
            </span>
            <button
              type="button"
              onClick={() => !busy && setInstant((v) => !v)}
              disabled={busy}
              aria-pressed={instant}
              className="relative w-10 h-5 rounded-full transition-all border flex-shrink-0 disabled:opacity-40"
              style={{
                background: instant ? ACCENT : "var(--bg-deep-3, #14161b)",
                borderColor: instant ? ACCENT : "rgba(255,255,255,0.06)",
              }}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  instant ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </OriginalsControls>
      }
    >
      {/* GAME AREA */}
      <div
        className="relative w-full h-full flex flex-col items-center justify-start p-4 md:p-6 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 25%, #2a1a08 0%, #160d04 42%, #0a0703 100%)",
          minHeight: 360,
        }}
      >
        {/* Status bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06] flex items-center gap-2 z-20">
          <Hash size={11} style={{ color: ACCENT }} />
          {result ? (
            revealing ? (
              <span className="flex items-center gap-2">
                <motion.span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: ACCENT }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                />
                Drawing… {revealCount}/{result.drawn.length}
                {picks.size > 0 && (
                  <span className="text-emerald-300 font-bold">
                    · {liveHits} hit{liveHits === 1 ? "" : "s"}
                  </span>
                )}
              </span>
            ) : result.status === "WON" ? (
              `🎯 ${result.hits}/${picks.size} hits · ×${result.multiplier} · +$${result.payout.toLocaleString("en-US")}`
            ) : (
              `${result.hits}/${picks.size} hits · no payout`
            )
          ) : picks.size === 0 ? (
            "Pick 1–10 numbers to play"
          ) : (
            `${picks.size} number${picks.size === 1 ? "" : "s"} selected`
          )}
        </div>

        {/* WIN / LOSE banner once the server draw is fully revealed */}
        <AnimatePresence>
          {revealDone && (
            <motion.div
              key={result!.status}
              initial={{ opacity: 0, y: -8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="absolute top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            >
              {result!.status === "WON" ? (
                <div className="px-5 py-1.5 rounded-full font-black text-sm bg-gradient-to-r from-emerald-500 to-emerald-400 text-black shadow-[0_0_24px_rgba(16,185,129,0.55)]">
                  WIN ×{result!.multiplier}
                </div>
              ) : (
                <div className="px-5 py-1.5 rounded-full font-black text-sm bg-white/[0.08] border border-white/10 text-white/60">
                  NO WIN
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Number board — authentic 8 columns × 5 rows */}
        <div className="relative z-10 w-full max-w-xl mt-16">
          <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
            {POOL.map((n) => {
              const isPicked = picks.has(n);
              const isDrawn = drawnSet.has(n);
              const isHit = hitSet.has(n);
              // Index of this number within the server draw — used to know
              // whether it's the ball that *just* landed (for the pop accent).
              const drawOrder = result ? result.drawn.indexOf(n) : -1;
              const justLanded =
                revealing && drawOrder === revealCount - 1 && drawOrder >= 0;

              return (
                <motion.button
                  key={n}
                  type="button"
                  onClick={() => togglePick(n)}
                  layout
                  animate={
                    isHit
                      ? {
                          scale: justLanded ? [1, 1.25, 1.08] : 1.08,
                          boxShadow: justLanded
                            ? [
                                "0 0 0px rgba(16,185,129,0)",
                                "0 0 26px rgba(16,185,129,0.9)",
                                "0 0 12px rgba(16,185,129,0.5)",
                              ]
                            : "0 0 12px rgba(16,185,129,0.5)",
                        }
                      : isDrawn && !isPicked
                        ? { scale: justLanded ? [1, 1.18, 1] : 1, opacity: 0.6 }
                        : { scale: 1, opacity: 1 }
                  }
                  transition={
                    justLanded
                      ? { duration: 0.25, ease: "easeOut" }
                      : { type: "spring", stiffness: 300, damping: 24 }
                  }
                  className={`relative aspect-square rounded-lg text-[11px] sm:text-sm font-black transition-colors overflow-hidden ${
                    isHit
                      ? "bg-emerald-500 border border-emerald-300 text-white"
                      : isDrawn && !isPicked
                        ? "bg-white/[0.1] border border-white/30 text-white/60"
                        : isPicked
                          ? "text-white"
                          : "bg-bg-elevated border border-[#3a3d45] text-[#9ca3af] hover:bg-bg-hover hover:border-[#4a4d55]"
                  }`}
                  style={
                    isPicked && !isHit
                      ? {
                          background: "rgba(255,154,61,0.22)",
                          borderColor: "rgba(255,154,61,0.7)",
                          borderWidth: 1,
                          borderStyle: "solid",
                        }
                      : undefined
                  }
                >
                  {/* Signature green gem behind a matched (hit) tile. */}
                  {isHit && (
                    <motion.span
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 0.35, scale: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      aria-hidden
                    >
                      <svg
                        width="60%"
                        height="60%"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M6 3h12l4 6-10 12L2 9l4-6z"
                          fill="rgba(255,255,255,0.55)"
                        />
                      </svg>
                    </motion.span>
                  )}
                  <span className="relative z-10">{n}</span>
                  {/* Pop-in ring for the ball that just landed */}
                  <AnimatePresence>
                    {justLanded && (
                      <motion.span
                        key="ring"
                        className={`absolute inset-0 rounded-lg border-2 ${
                          isHit ? "border-emerald-200" : "border-white/60"
                        }`}
                        initial={{ opacity: 0.9, scale: 0.7 }}
                        animate={{ opacity: 0, scale: 1.9 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                      />
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px] text-[#6b7280] justify-center mt-4">
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded border"
                style={{
                  background: "rgba(255,154,61,0.22)",
                  borderColor: "rgba(255,154,61,0.7)",
                }}
              />
              Pick
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-emerald-500 border border-emerald-300" />
              Hit
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-white/[0.1] border border-white/30" />
              Drawn (miss)
            </span>
          </div>

          {/* Live payout / odds ladder — one cell per possible hit count. */}
          <div className="mt-5">
            <div className="text-[10px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 text-center">
              {picks.size > 0
                ? `Payout ladder · ${risk} · ${picks.size} pick${picks.size === 1 ? "" : "s"}`
                : "Payout ladder"}
            </div>
            <KenoLadder
              risk={risk}
              picks={picks.size}
              activeHits={revealDone ? result!.hits : null}
              revealedHits={liveHits}
            />
          </div>
        </div>
      </div>
    </OriginalsShell>
  );
}
