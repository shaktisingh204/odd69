"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";
import { ChevronUp, ChevronDown, ChevronsRight } from "lucide-react";

interface HiloState {
  gameId: string;
  betAmount: number;
  currentCard: number;
  currentRank: number;
  multiplier: number;
  step: number;
  status: "ACTIVE" | "CASHEDOUT" | "LOST";
  payout: number;
  history: number[];
  nextHigherChance: number;
  nextLowerChance: number;
  nextHigherMultiplier: number;
  nextLowerMultiplier: number;
}

const SUITS = ["♣", "♦", "♥", "♠"];
const RANK_LABELS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function cardLabel(card: number) {
  const rank = card % 13;
  const suit = Math.floor(card / 13);
  return {
    rank: RANK_LABELS[rank],
    suit: SUITS[suit],
    red: suit === 1 || suit === 2,
  };
}

const ORANGE = "#ff9a3d";

// Animated multiplier counter that tweens to the server's multiplier value.
function MultiplierCounter({
  value,
  reduced,
  className,
  style,
}: {
  value: number;
  reduced: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => `× ${v.toFixed(2)}`);

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [value, reduced, mv]);

  return (
    <motion.span className={className} style={style}>
      {text}
    </motion.span>
  );
}

export default function HiloPage() {
  const { refreshWallet } = useWallet();
  const reduced = !!useReducedMotion();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [game, setGame] = useState<HiloState | null>(null);

  // ----- Animation-only state (never feeds the bet/data flow) -----
  // The card key forces a fresh flip whenever the server returns a new card.
  const [cardKey, setCardKey] = useState(0);
  // Visual outcome flash on the card after an action: 'win' | 'bust' | null.
  const [flash, setFlash] = useState<"win" | "bust" | null>(null);
  // The action the player chose, so we can highlight the right side.
  const [lastAction, setLastAction] = useState<
    "higher" | "lower" | "skip" | null
  >(null);

  // Track previous values to decide animations without altering outcomes.
  const prevCardRef = useRef<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlashTimer = () => {
    if (flashTimer.current) {
      clearTimeout(flashTimer.current);
      flashTimer.current = null;
    }
  };

  useEffect(() => () => clearFlashTimer(), []);

  // Restore in-flight game on mount
  useEffect(() => {
    let cancelled = false;
    api
      .get<HiloState | null>("/originals/hilo/active")
      .then((res) => {
        if (!cancelled && res.data) {
          setGame(res.data);
          prevCardRef.current = res.data.currentCard;
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Enter a valid bet");
    setBusy(true);
    try {
      const res = await api.post<HiloState>("/originals/hilo/start", {
        betAmount: bet,
        walletType,
        useBonus,
      });
      // Visuals: deal the first card with a fresh flip.
      clearFlashTimer();
      setFlash(null);
      setLastAction(null);
      prevCardRef.current = res.data.currentCard;
      playSound("reveal");
      setGame(res.data);
      setCardKey((k) => k + 1);
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not start game");
    } finally {
      setBusy(false);
    }
  }, [betInput, walletType, useBonus, refreshWallet]);

  const action = useCallback(
    async (act: "higher" | "lower" | "skip") => {
      if (!game) return;
      setBusy(true);
      setLastAction(act);
      try {
        const res = await api.post<HiloState>("/originals/hilo/action", {
          gameId: game.gameId,
          action: act,
        });

        const newCard = res.data.currentCard;
        const cardChanged = newCard !== prevCardRef.current;

        // Drive the flip from the server-returned card.
        clearFlashTimer();
        setFlash(null);
        if (cardChanged) {
          playSound("reveal");
          setCardKey((k) => k + 1);
        }
        prevCardRef.current = newCard;
        setGame(res.data);

        if (res.data.status === "LOST") {
          // Wrong guess — red shake then game over (visuals follow server).
          setFlash("bust");
          playSound("lose");
          toast.error("Wrong guess — game over");
          await refreshWallet();
        } else if (act !== "skip" && cardChanged) {
          // Correct guess — green pop. Counter tweens via MultiplierCounter.
          setFlash("win");
          playSound("tick");
        }

        // Clear the transient flash after the pop/shake plays.
        flashTimer.current = setTimeout(
          () => setFlash(null),
          reduced ? 0 : 650,
        );
      } catch (e: any) {
        toast.error(e?.response?.data?.message || "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [game, refreshWallet, reduced],
  );

  const cashout = useCallback(async () => {
    if (!game) return;
    setBusy(true);
    try {
      const res = await api.post<HiloState>("/originals/hilo/cashout", {
        gameId: game.gameId,
      });
      setGame(res.data);
      // Celebrate the server-confirmed cashout.
      clearFlashTimer();
      setFlash(null);
      playSound("win");
      if (res.data.multiplier >= 10) {
        fireBigWin();
      } else {
        fireWin();
      }
      toast.success(`Cashed out $${res.data.payout.toLocaleString("en-US")}`);
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Cashout failed");
    } finally {
      setBusy(false);
    }
  }, [game, refreshWallet]);

  const isActive = game?.status === "ACTIVE";
  const card = game ? cardLabel(game.currentCard) : null;

  // Card flip transition tuned for reduced motion.
  const flipTransition = reduced
    ? { duration: 0 }
    : { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const };

  // Outcome-driven wrapper animation (green pop / red shake).
  const stageAnim =
    flash === "win" && !reduced
      ? { scale: [1, 1.08, 1] }
      : flash === "bust" && !reduced
        ? { x: [0, -14, 13, -10, 8, -4, 0] }
        : { scale: 1, x: 0 };

  return (
    <OriginalsShell
      gameKey="hilo"
      title="Hi-Lo"
      tags={["# Hi-Lo", "# ODD69 Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={isActive || busy}
          accent="#22d3ee"
          action={
            isActive ? (
              <button
                type="button"
                onClick={cashout}
                disabled={busy || (game?.step ?? 0) === 0}
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Cashout × {game?.multiplier.toFixed(2)}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (game && game.status !== "ACTIVE") setGame(null);
                  start();
                }}
                disabled={busy}
                className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {busy ? "Dealing…" : "Bet"}
              </button>
            )
          }
          footer={
            game && (
              <div className="bg-bg-deep-3 border border-white/[0.06] rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#6b7280]">Step</span>
                  <span className="text-white font-black">{game.step}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#6b7280]">Multiplier</span>
                  <MultiplierCounter
                    value={game.multiplier}
                    reduced={reduced}
                    className="text-yellow-400 font-black"
                  />
                </div>
              </div>
            )
          }
        />
      }
    >
      <div
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #082028 0%, #07161d 40%, #040d12 100%)",
          minHeight: 360,
        }}
      >
        {/* Outcome bloom behind the card (win = green, bust = red) */}
        <AnimatePresence>
          {flash && !reduced && (
            <motion.div
              key={`bloom-${flash}-${cardKey}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 0.5, 0], scale: [0.6, 1.25, 1.5] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="pointer-events-none absolute"
              style={{
                width: 320,
                height: 320,
                borderRadius: "9999px",
                filter: "blur(40px)",
                background:
                  flash === "win"
                    ? "radial-gradient(circle, rgba(34,197,94,0.55), transparent 70%)"
                    : "radial-gradient(circle, rgba(239,68,68,0.55), transparent 70%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Status */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06] z-10">
          {!game
            ? "Place a bet to deal a card"
            : game.status === "ACTIVE"
              ? `Step ${game.step + 1} · × ${game.multiplier.toFixed(2)}`
              : game.status === "CASHEDOUT"
                ? `🎉 Cashed out × ${game.multiplier.toFixed(2)}`
                : "💥 Bust"}
        </div>

        {/* Card stage */}
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 items-center w-full max-w-3xl mt-12 z-[1]">
          {/* Higher */}
          <button
            type="button"
            onClick={() => action("higher")}
            disabled={!isActive || busy}
            className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              lastAction === "higher" && flash
                ? flash === "win"
                  ? "border-green-400/70 bg-green-400/15"
                  : "border-red-500/70 bg-red-500/15"
                : "border-amber-400/40 bg-amber-400/5 hover:bg-amber-400/10"
            }`}
          >
            <div className="w-14 h-14 rounded-full border-2 border-amber-300/40 flex items-center justify-center">
              <ChevronUp size={32} className="text-amber-300" />
            </div>
            <div className="text-sm font-black text-amber-200">Higher or Same</div>
            <div className="text-[11px] text-amber-200/70">
              × {game?.nextHigherMultiplier?.toFixed(2) ?? "—"} ·{" "}
              {game?.nextHigherChance?.toFixed(1) ?? "—"}%
            </div>
          </button>

          {/* Card */}
          <div className="flex flex-col items-center gap-3">
            <motion.div
              className="relative"
              style={{ perspective: 1000, width: 144, height: 208 }}
              animate={stageAnim}
              transition={
                flash === "bust"
                  ? { duration: 0.5, ease: "easeInOut" }
                  : { duration: 0.4, ease: "easeOut" }
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={cardKey}
                  className="absolute inset-0"
                  style={{ transformStyle: "preserve-3d" }}
                  initial={
                    reduced
                      ? { rotateY: 0, opacity: 1 }
                      : { rotateY: -180, opacity: 0 }
                  }
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={
                    reduced
                      ? { opacity: 0 }
                      : { rotateY: 180, opacity: 0 }
                  }
                  transition={flipTransition}
                >
                  <div
                    className={`w-36 h-52 rounded-2xl border-4 ${
                      card?.red ? "border-red-500" : "border-slate-300"
                    } bg-white shadow-2xl flex flex-col items-center justify-center select-none`}
                    style={{
                      backfaceVisibility: "hidden",
                      boxShadow:
                        flash === "win"
                          ? "0 0 40px rgba(34,197,94,0.6)"
                          : flash === "bust"
                            ? "0 0 40px rgba(239,68,68,0.6)"
                            : "0 12px 40px rgba(0,0,0,0.6)",
                    }}
                  >
                    {card ? (
                      <>
                        <div
                          className={`text-6xl font-black ${
                            card.red ? "text-red-500" : "text-slate-900"
                          }`}
                        >
                          {card.rank}
                        </div>
                        <div
                          className={`text-4xl ${
                            card.red ? "text-red-500" : "text-slate-900"
                          }`}
                        >
                          {card.suit}
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-500 text-xs font-bold">
                        Place a bet
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Placeholder card when no game (no flip needed) */}
              {!game && (
                <div
                  className="w-36 h-52 rounded-2xl border-4 border-slate-300 bg-white shadow-2xl flex flex-col items-center justify-center select-none"
                  style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}
                >
                  <div className="text-slate-500 text-xs font-bold">
                    Place a bet
                  </div>
                </div>
              )}
            </motion.div>

            <button
              type="button"
              onClick={() => action("skip")}
              disabled={!isActive || busy}
              className="flex items-center gap-1 text-[11px] font-bold text-[#9ca3af] hover:text-white disabled:opacity-30"
            >
              Skip <ChevronsRight size={12} />
            </button>
          </div>

          {/* Lower */}
          <button
            type="button"
            onClick={() => action("lower")}
            disabled={!isActive || busy}
            className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              lastAction === "lower" && flash
                ? flash === "win"
                  ? "border-green-400/70 bg-green-400/15"
                  : "border-red-500/70 bg-red-500/15"
                : "border-cyan-400/40 bg-cyan-400/5 hover:bg-cyan-400/10"
            }`}
          >
            <div className="w-14 h-14 rounded-full border-2 border-cyan-300/40 flex items-center justify-center">
              <ChevronDown size={32} className="text-cyan-300" />
            </div>
            <div className="text-sm font-black text-cyan-200">Lower or Same</div>
            <div className="text-[11px] text-cyan-200/70">
              × {game?.nextLowerMultiplier?.toFixed(2) ?? "—"} ·{" "}
              {game?.nextLowerChance?.toFixed(1) ?? "—"}%
            </div>
          </button>
        </div>

        {/* Live running multiplier badge while active */}
        <AnimatePresence>
          {isActive && (game?.step ?? 0) > 0 && (
            <motion.div
              key="run-mult"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-5 px-4 py-1.5 rounded-full bg-black/40 border border-white/[0.08] backdrop-blur-md z-[1]"
            >
              <MultiplierCounter
                value={game!.multiplier}
                reduced={reduced}
                className="text-lg font-black"
                style={{ color: ORANGE }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* History strip */}
        {game && game.history.length > 1 && (
          <div className="mt-6 flex gap-1.5 flex-wrap justify-center max-w-3xl z-[1]">
            {game.history.map((c, i) => {
              const cl = cardLabel(c);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.7, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={
                    reduced ? { duration: 0 } : { duration: 0.25, delay: i * 0.01 }
                  }
                  className={`w-9 h-12 rounded border ${
                    cl.red
                      ? "border-red-500/40 bg-red-500/5"
                      : "border-white/20 bg-white/[0.04]"
                  } flex flex-col items-center justify-center`}
                >
                  <div
                    className={`text-[12px] font-black ${
                      cl.red ? "text-red-300" : "text-white"
                    }`}
                  >
                    {cl.rank}
                  </div>
                  <div
                    className={`text-[10px] ${
                      cl.red ? "text-red-300" : "text-white/70"
                    }`}
                  >
                    {cl.suit}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </OriginalsShell>
  );
}
