"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";
import { Sparkles, RotateCcw, Hash } from "lucide-react";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

type Risk = "low" | "classic" | "medium" | "high";

interface KenoResult {
  gameId: string;
  selected: number[];
  drawn: number[];
  hits: number;
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
}

const RISKS: Risk[] = ["low", "classic", "medium", "high"];
const POOL = Array.from({ length: 40 }, (_, i) => i + 1);
const MAX_PICK = 10;

// Per-ball reveal cadence (ms). Reduced motion bypasses this entirely.
const REVEAL_STEP_MS = 230;

export default function KenoPage() {
  const { refreshWallet } = useWallet();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [risk, setRisk] = useState<Risk>("classic");
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<KenoResult | null>(null);

  // How many of result.drawn[] have been revealed so far. Drives the
  // staggered one-by-one reveal of the SERVER-supplied draw.
  const [revealCount, setRevealCount] = useState(0);
  const [revealing, setRevealing] = useState(false);

  const reducedMotion = useReducedMotion();
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSoundRef = useRef(0);

  const clearRevealTimer = () => {
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
  };

  // Cleanup any pending timers on unmount.
  useEffect(() => () => clearRevealTimer(), []);

  // Throttled reveal blip so rapid balls don't stack into noise.
  const playRevealThrottled = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundRef.current < 90) return;
    lastSoundRef.current = now;
    playSound("reveal");
  }, []);

  // Fire celebrations once the full server draw has been revealed.
  const finishReveal = useCallback(
    (r: KenoResult) => {
      setRevealing(false);
      if (r.status === "WON") {
        playSound("win");
        if (r.multiplier >= 20) fireBigWin();
        else fireWin();
      } else {
        playSound("lose");
      }
    },
    [],
  );

  // When a new server result arrives, animate its `drawn` array in.
  useEffect(() => {
    clearRevealTimer();
    if (!result) {
      setRevealCount(0);
      setRevealing(false);
      return;
    }

    const total = result.drawn.length;

    // Reduced motion: snap straight to the final, correct state.
    if (reducedMotion) {
      setRevealCount(total);
      setRevealing(false);
      if (result.status === "WON") {
        playSound("win");
        if (result.multiplier >= 20) fireBigWin();
        else fireWin();
      } else {
        playSound("lose");
      }
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
        revealTimer.current = setTimeout(() => finishReveal(result), 260);
      }
    };
    revealTimer.current = setTimeout(tick, REVEAL_STEP_MS);

    return clearRevealTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, reducedMotion]);

  const togglePick = (n: number) => {
    if (busy) return;
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
    if (busy) return;
    setPicks(new Set());
    setResult(null);
  };
  const autoPick = () => {
    if (busy) return;
    setResult(null);
    const target = picks.size > 0 ? picks.size : 5;
    const next = new Set<number>();
    while (next.size < target) next.add(1 + Math.floor(Math.random() * 40));
    setPicks(next);
  };

  const play = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Enter a valid bet");
    if (picks.size === 0) return toast.error("Pick 1–10 numbers");
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<KenoResult>("/originals/keno/play", {
        betAmount: bet,
        selected: Array.from(picks),
        risk,
        walletType,
        useBonus,
      });
      setResult(res.data);
      if (res.data.status === "WON")
        toast.success(`+$${res.data.payout.toLocaleString("en-US")}`);
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Play failed");
    } finally {
      setBusy(false);
    }
  }, [betInput, picks, risk, walletType, useBonus, refreshWallet]);

  // Only the numbers revealed so far (a prefix of the SERVER draw) are "drawn".
  const revealedDrawn = result ? result.drawn.slice(0, revealCount) : [];
  const drawnSet = new Set(revealedDrawn);
  const hitSet = new Set(revealedDrawn.filter((n) => picks.has(n)));
  const revealDone = !!result && !revealing;

  // Hits accumulate as balls land, for a live ticking counter.
  const liveHits = hitSet.size;

  return (
    <OriginalsShell
      gameKey="keno"
      title="Keno"
      tags={["# Keno", "# ODD69 Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={busy}
          accent="#fb7185"
          action={
            <button
              type="button"
              onClick={play}
              disabled={busy || picks.size === 0}
              className="w-full py-4 bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? "Drawing…" : "Bet"}
            </button>
          }
          footer={
            <div className="text-[10px] text-[#6b7280] text-center">
              {picks.size === 0
                ? "Select 1–10 numbers to play"
                : `${picks.size} selected`}
            </div>
          }
        >
          {/* Risk picker */}
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Risk
            </label>
            <div className="grid grid-cols-4 gap-1">
              {RISKS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => !busy && setRisk(r)}
                  className={`py-1.5 rounded text-[10px] font-bold uppercase ${
                    risk === r
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1 mt-2">
              <button
                type="button"
                onClick={autoPick}
                disabled={busy}
                className="flex items-center justify-center gap-1 py-1.5 bg-bg-deep-3 border border-white/[0.06] rounded text-[11px] text-[#9ca3af] hover:text-white hover:border-white/[0.12]"
              >
                <Sparkles size={11} /> Auto Pick
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={busy}
                className="flex items-center justify-center gap-1 py-1.5 bg-bg-deep-3 border border-white/[0.06] rounded text-[11px] text-[#9ca3af] hover:text-white hover:border-white/[0.12]"
              >
                <RotateCcw size={11} /> Clear
              </button>
            </div>
          </div>
        </OriginalsControls>
      }
    >
      {/* GAME AREA */}
      <div
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #2a0d16 0%, #14070b 40%, #0a0407 100%)",
          minHeight: 360,
        }}
      >
        {/* Status bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06] flex items-center gap-2 z-20">
          <Hash size={11} className="text-rose-400" />
          {result ? (
            revealing ? (
              <span className="flex items-center gap-2">
                <motion.span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400"
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

        {/* Number board */}
        <div className="relative z-10 w-full max-w-2xl mt-12">
          <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
            {POOL.map((n) => {
              const isPicked = picks.has(n);
              const isDrawn = drawnSet.has(n);
              const isHit = hitSet.has(n);
              // The index of this number within the server draw — used to know
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
                          scale: justLanded
                            ? [1, 1.35, 1.08]
                            : 1.08,
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
                      ? { duration: 0.45, ease: "easeOut" }
                      : { type: "spring", stiffness: 300, damping: 24 }
                  }
                  className={`relative aspect-square rounded-lg text-[11px] sm:text-sm font-black transition-colors ${
                    isHit
                      ? "bg-emerald-500 border border-emerald-300 text-white"
                      : isDrawn && !isPicked
                        ? "bg-white/[0.1] border border-white/30 text-white/60"
                        : isPicked
                          ? "bg-rose-500/30 border border-rose-400 text-white"
                          : "bg-bg-elevated border border-[#3a3d45] text-[#9ca3af] hover:bg-bg-hover hover:border-[#4a4d55]"
                  }`}
                >
                  {n}
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
                        transition={{ duration: 0.55, ease: "easeOut" }}
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
              <span className="inline-block w-3 h-3 rounded bg-rose-500/30 border border-rose-400" />
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
        </div>
      </div>
    </OriginalsShell>
  );
}
