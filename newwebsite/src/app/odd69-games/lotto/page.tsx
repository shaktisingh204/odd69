"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";
import { Sparkles, RotateCcw } from "lucide-react";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

interface LottoResult {
  gameId: string;
  selected: number[];
  drawn: number[];
  hits: number;
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
}

const POOL = Array.from({ length: 49 }, (_, i) => i + 1);
const PAYTABLE = [
  { hits: 2, mult: 1 },
  { hits: 3, mult: 2 },
  { hits: 4, mult: 10 },
  { hits: 5, mult: 100 },
  { hits: 6, mult: 1000 },
];

export default function LottoPage() {
  const { refreshWallet } = useWallet();
  const reduceMotion = useReducedMotion();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LottoResult | null>(null);

  // ── Draw-reveal orchestration (visual only; driven by the server result) ──
  // `revealCount` is how many of result.drawn have tumbled into the chamber so
  // far. It gates both the chamber balls and the board highlight so the board
  // lights up in lock-step with the draw. Never affects bet data / payout.
  const [revealCount, setRevealCount] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const celebratedRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  // When a new server result arrives, sequence the balls one-by-one.
  useEffect(() => {
    clearTimers();
    celebratedRef.current = false;
    if (!result) {
      setRevealCount(0);
      return;
    }

    const drawn = result.drawn || [];
    const total = drawn.length;

    const celebrate = () => {
      if (celebratedRef.current) return;
      celebratedRef.current = true;
      if (result.status === "WON") {
        playSound("win");
        if (result.hits >= 5) {
          fireBigWin();
        } else {
          fireWin();
        }
      } else {
        playSound("lose");
      }
    };

    if (reduceMotion) {
      // Snap straight to the final, correct state.
      setRevealCount(total);
      celebrate();
      return;
    }

    setRevealCount(0);
    const PER_BALL = 520; // ms between balls — slow enough to feel "drawn"
    const START = 360;

    for (let i = 0; i < total; i++) {
      const t = setTimeout(() => {
        setRevealCount(i + 1);
        playSound("reveal");
      }, START + i * PER_BALL);
      timersRef.current.push(t);
    }

    // Celebrate once the final ball has landed.
    const celebrateAt = START + total * PER_BALL + 220;
    timersRef.current.push(setTimeout(celebrate, celebrateAt));

    return clearTimers;
  }, [result, reduceMotion, clearTimers]);

  // Cleanup any pending timers on unmount.
  useEffect(() => clearTimers, [clearTimers]);

  const togglePick = (n: number) => {
    if (busy) return;
    setResult(null);
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(n)) {
        next.delete(n);
      } else {
        if (next.size >= 6) {
          toast.error("Pick exactly 6");
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
    const next = new Set<number>();
    while (next.size < 6) next.add(1 + Math.floor(Math.random() * 49));
    setPicks(next);
  };

  const play = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Invalid bet");
    if (picks.size !== 6) return toast.error("Pick exactly 6 numbers");
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<LottoResult>("/originals/lotto/play", {
        betAmount: bet,
        selected: Array.from(picks),
        walletType,
        useBonus,
      });
      setResult(res.data);
      if (res.data.status === "WON") {
        toast.success(
          `+$${res.data.payout.toLocaleString("en-US")} (${res.data.hits}/6)`,
        );
      }
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Play failed");
    } finally {
      setBusy(false);
    }
  }, [betInput, picks, walletType, useBonus, refreshWallet]);

  // Only reveal balls that have already "landed" so the board lights up in
  // lock-step with the draw animation. Data is untouched — these are purely
  // the visible-so-far slices of the server-provided result.drawn.
  const revealedDrawn = result ? result.drawn.slice(0, revealCount) : [];
  const drawnSet = new Set(revealedDrawn);
  const hitSet = new Set(revealedDrawn.filter((n) => picks.has(n)));
  const allRevealed = !!result && revealCount >= (result.drawn?.length || 0);

  return (
    <OriginalsShell
      gameKey="lotto"
      title="Lotto"
      tags={["# Lotto", "# ODD69 Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={busy}
          accent="#2dd4bf"
          action={
            <button
              type="button"
              onClick={play}
              disabled={busy || picks.size !== 6}
              className="w-full py-4 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? "Drawing…" : "Buy Ticket"}
            </button>
          }
          footer={
            <div className="text-[10px] text-[#6b7280] text-center">
              {picks.size}/6 numbers selected
            </div>
          }
        >
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Quick Pick
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={autoPick}
                disabled={busy}
                className="flex items-center justify-center gap-1 py-1.5 bg-bg-deep-3 border border-white/[0.06] rounded text-[11px] text-[#9ca3af] hover:text-white hover:border-white/[0.12]"
              >
                <Sparkles size={11} /> Auto
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
      <div
        className="relative w-full h-full flex flex-col items-center p-4 md:p-6 gap-3"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #08201c 0%, #071713 40%, #04100d 100%)",
          minHeight: 360,
        }}
      >
        <motion.div
          layout
          className="text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06]"
          animate={{
            color:
              result && allRevealed
                ? result.status === "WON"
                  ? "#ffd24a"
                  : "#9ca3af"
                : "#9ca3af",
            borderColor:
              result && allRevealed && result.status === "WON"
                ? "rgba(255,210,74,0.4)"
                : "rgba(255,255,255,0.06)",
          }}
        >
          {result
            ? allRevealed
              ? `${result.hits}/6 hits · ${
                  result.status === "WON"
                    ? `+$${result.payout.toLocaleString("en-US")} (×${result.multiplier})`
                    : "no payout"
                }`
              : "Drawing the lucky numbers…"
            : `${picks.size}/6 numbers selected`}
        </motion.div>

        {/* ── Ball-draw chamber: balls tumble in one-by-one (server result) ── */}
        <div className="relative z-10 w-full max-w-2xl flex items-center justify-center gap-2 sm:gap-3 min-h-[68px] sm:min-h-[80px]">
          {result ? (
            <>
              {result.drawn.map((n, i) => {
                const landed = i < revealCount;
                const isHit = picks.has(n);
                return (
                  <div
                    key={`ball-${i}`}
                    className="relative w-11 h-11 sm:w-14 sm:h-14"
                  >
                    {/* Empty slot placeholder so the row never reflows */}
                    <div className="absolute inset-0 rounded-full border border-white/[0.06] bg-black/30" />
                    <AnimatePresence>
                      {landed && (
                        <motion.div
                          key={`ballface-${i}`}
                          initial={
                            reduceMotion
                              ? { opacity: 1, scale: 1, y: 0, rotate: 0 }
                              : {
                                  opacity: 0,
                                  scale: 0.2,
                                  y: -64,
                                  rotate: -160,
                                }
                          }
                          animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : {
                                  type: "spring",
                                  stiffness: 520,
                                  damping: 16,
                                  mass: 0.7,
                                }
                          }
                          className="absolute inset-0 rounded-full flex items-center justify-center font-black text-sm sm:text-base select-none"
                          style={
                            isHit
                              ? {
                                  background:
                                    "radial-gradient(circle at 35% 28%, #fff4cf 0%, #ffd24a 38%, #ff9a3d 100%)",
                                  color: "#3a2400",
                                  boxShadow:
                                    "0 0 18px rgba(255,154,61,0.75), inset 0 2px 4px rgba(255,255,255,0.6), inset 0 -4px 8px rgba(180,90,0,0.5)",
                                  border: "1px solid #ffe08a",
                                }
                              : {
                                  background:
                                    "radial-gradient(circle at 35% 28%, #ffffff 0%, #d7dbe2 45%, #9aa1ad 100%)",
                                  color: "#1a1d24",
                                  boxShadow:
                                    "inset 0 2px 4px rgba(255,255,255,0.85), inset 0 -4px 8px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.4)",
                                  border: "1px solid rgba(255,255,255,0.5)",
                                }
                          }
                        >
                          {/* Pop / settle pulse for matched gold balls */}
                          {isHit && !reduceMotion && (
                            <motion.span
                              className="absolute inset-0 rounded-full"
                              initial={{ opacity: 0.9, scale: 1 }}
                              animate={{ opacity: 0, scale: 1.9 }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              style={{
                                boxShadow: "0 0 0 2px rgba(255,210,74,0.7)",
                              }}
                            />
                          )}
                          {n}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="text-[11px] text-[#6b7280] font-medium">
              Pick 6 numbers, then buy your ticket to draw.
            </div>
          )}
        </div>

        {/* Number board */}
        <div className="relative z-10 w-full max-w-2xl mt-4">
          <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
            {POOL.map((n) => {
              const isPicked = picks.has(n);
              const isDrawn = drawnSet.has(n);
              const isHit = hitSet.has(n);
              return (
                <motion.button
                  key={n}
                  type="button"
                  onClick={() => togglePick(n)}
                  animate={
                    isHit
                      ? {
                          scale: reduceMotion ? 1.05 : [1, 1.28, 1.08],
                        }
                      : { scale: 1 }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.45, ease: "easeOut" }
                  }
                  className={`relative aspect-square rounded-lg text-[11px] sm:text-sm font-black transition-colors ${
                    isHit
                      ? "border text-[#3a2400]"
                      : isDrawn && !isPicked
                        ? "bg-white/[0.1] border border-white/30 text-white/60"
                        : isPicked
                          ? "bg-teal-500/30 border border-teal-400 text-white"
                          : "bg-bg-elevated border border-[#3a3d45] text-[#9ca3af] hover:bg-bg-hover hover:border-[#4a4d55]"
                  }`}
                  style={
                    isHit
                      ? {
                          background:
                            "radial-gradient(circle at 35% 28%, #fff4cf 0%, #ffd24a 40%, #ff9a3d 100%)",
                          borderColor: "#ffe08a",
                          boxShadow:
                            "0 0 14px rgba(255,154,61,0.7), inset 0 1px 3px rgba(255,255,255,0.6)",
                          zIndex: 1,
                        }
                      : undefined
                  }
                >
                  {n}
                </motion.button>
              );
            })}
          </div>

          {/* Pay table */}
          <div className="mt-4 grid grid-cols-5 gap-2 text-[11px] text-[#9ca3af]">
            {PAYTABLE.map((p) => {
              const active = allRevealed && result?.hits === p.hits;
              return (
                <motion.div
                  key={p.hits}
                  animate={
                    active && !reduceMotion
                      ? { scale: [1, 1.08, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className={`rounded-lg p-2 text-center font-bold border ${
                    active
                      ? "bg-[#ff9a3d]/20 text-[#ffd24a] border-[#ff9a3d]/50 shadow-[0_0_14px_rgba(255,154,61,0.35)]"
                      : "bg-bg-deep-3 border-white/[0.06]"
                  }`}
                >
                  {p.hits} hits
                  <div className="text-teal-300 font-black">×{p.mult}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </OriginalsShell>
  );
}
