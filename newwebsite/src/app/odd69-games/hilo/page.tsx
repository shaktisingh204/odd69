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
  actions: ("higher" | "lower" | "skip")[];
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

/** rank in 1..13 (Ace low) from a card id 0..51 */
function cardRank(card: number) {
  return (card % 13) + 1;
}

const ORANGE = "#ff9a3d";
const GREEN = "#22c55e";

/** Pull a user-facing message out of an axios-style error without using `any`. */
function errMsg(e: unknown, fallback: string): string {
  const m = (e as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  return m || fallback;
}

// Animated number that tweens to the server value with a slight count-roll feel.
function TweenNumber({
  value,
  reduced,
  format,
  className,
  style,
  duration = 0.55,
}: {
  value: number;
  reduced: boolean;
  format: (v: number) => string;
  className?: string;
  style?: React.CSSProperties;
  duration?: number;
}) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [value, reduced, mv, duration]);

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
  // Visual outcome flash on the card after an action: 'win' | 'bust' | 'skip' | null.
  const [flash, setFlash] = useState<"win" | "bust" | "skip" | null>(null);
  // The action the player chose, so we can highlight the right side.
  const [lastAction, setLastAction] = useState<
    "higher" | "lower" | "skip" | null
  >(null);

  // Track previous values to decide animations without altering outcomes.
  const prevCardRef = useRef<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest game ref so the keyboard handler always sees current state.
  const gameRef = useRef<HiloState | null>(null);
  const busyRef = useRef(false);

  const clearFlashTimer = () => {
    if (flashTimer.current) {
      clearTimeout(flashTimer.current);
      flashTimer.current = null;
    }
  };

  useEffect(() => () => clearFlashTimer(), []);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // Restore in-flight game on mount
  useEffect(() => {
    let cancelled = false;
    api
      .get<HiloState | null>("/originals/hilo/active")
      .then((res) => {
        if (!cancelled && res.data && res.data.gameId) {
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
    } catch (e: unknown) {
      toast.error(errMsg(e, "Could not start game"));
    } finally {
      setBusy(false);
    }
  }, [betInput, walletType, useBonus, refreshWallet]);

  const action = useCallback(
    async (act: "higher" | "lower" | "skip") => {
      const g = gameRef.current;
      if (!g || g.status !== "ACTIVE" || busyRef.current) return;
      setBusy(true);
      setLastAction(act);
      try {
        const res = await api.post<HiloState>("/originals/hilo/action", {
          gameId: g.gameId,
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
        } else if (act === "skip") {
          // Neutral skip — light whoosh, no glow, multiplier untouched.
          setFlash("skip");
          playSound("tick");
        } else if (cardChanged) {
          // Correct guess — green pop. Counter tweens via TweenNumber.
          setFlash("win");
          playSound("tick");
        }

        // Clear the transient flash after the pop/shake plays.
        flashTimer.current = setTimeout(
          () => setFlash(null),
          reduced ? 0 : 650,
        );
      } catch (e: unknown) {
        toast.error(errMsg(e, "Action failed"));
      } finally {
        setBusy(false);
      }
    },
    [refreshWallet, reduced],
  );

  // Payout count-up target (visual-only) — animates 0 → won amount on cashout.
  const [payoutShown, setPayoutShown] = useState(0);

  const cashout = useCallback(async () => {
    const g = gameRef.current;
    if (!g || g.status !== "ACTIVE" || (g.step ?? 0) === 0 || busyRef.current)
      return;
    setBusy(true);
    try {
      const res = await api.post<HiloState>("/originals/hilo/cashout", {
        gameId: g.gameId,
      });
      setGame(res.data);
      // Celebrate the server-confirmed cashout.
      clearFlashTimer();
      setFlash(null);
      setPayoutShown(res.data.payout);
      playSound("cashout");
      if (res.data.multiplier >= 10) {
        fireBigWin();
      } else {
        fireWin();
      }
      toast.success(`Cashed out $${res.data.payout.toLocaleString("en-US")}`);
      await refreshWallet();
    } catch (e: unknown) {
      toast.error(errMsg(e, "Cashout failed"));
    } finally {
      setBusy(false);
    }
  }, [refreshWallet]);

  // Hotkeys: ↑ higher · ↓ lower · Space skip · Enter cashout/bet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      const g = gameRef.current;
      const active = g?.status === "ACTIVE";
      if (e.key === "ArrowUp") {
        if (active) {
          e.preventDefault();
          action("higher");
        }
      } else if (e.key === "ArrowDown") {
        if (active) {
          e.preventDefault();
          action("lower");
        }
      } else if (e.code === "Space") {
        if (active) {
          e.preventDefault();
          action("skip");
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (active && (g?.step ?? 0) > 0) cashout();
        else if (!active && !busyRef.current) {
          if (g && g.status !== "ACTIVE") setGame(null);
          start();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [action, cashout, start]);

  const isActive = game?.status === "ACTIVE";
  const card = game ? cardLabel(game.currentCard) : null;
  const curRank = game ? cardRank(game.currentCard) : 0;
  // Ace (1) can only go higher-or-same; King (13) only lower-or-same.
  const lowerDisabled = curRank === 1;
  const higherDisabled = curRank === 13;

  // Card flip transition — expo-out with a slight settle (animationSpec).
  const flipTransition = reduced
    ? { duration: 0 }
    : { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const };

  // Outcome-driven wrapper animation (green pop / red shake / neutral skip).
  const stageAnim =
    flash === "win" && !reduced
      ? { scale: [1, 1.06, 1] }
      : flash === "bust" && !reduced
        ? { x: [0, -14, 13, -10, 8, -4, 0] }
        : { scale: 1, x: 0 };

  // Profit-on-win figures (visual readout; outcome still server-driven).
  const profitHigher = game
    ? Math.max(0, game.betAmount * game.nextHigherMultiplier - game.betAmount)
    : 0;
  const profitLower = game
    ? Math.max(0, game.betAmount * game.nextLowerMultiplier - game.betAmount)
    : 0;
  const totalProfit = game ? game.betAmount * (game.multiplier - 1) : 0;

  return (
    <OriginalsShell
      gameKey="hilo"
      historyGameKey="hilo"
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
          accent={ORANGE}
          action={
            isActive ? (
              <button
                type="button"
                onClick={cashout}
                disabled={busy || (game?.step ?? 0) === 0}
                className="w-full py-4 disabled:opacity-40 text-black font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center leading-tight"
                style={{ background: ORANGE }}
              >
                <span>Cashout × {game?.multiplier.toFixed(2)}</span>
                <span className="text-[11px] font-bold opacity-80">
                  $
                  {(
                    (game?.betAmount ?? 0) * (game?.multiplier ?? 1)
                  ).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </span>
              </button>
            ) : (
              <motion.button
                type="button"
                onClick={() => {
                  if (game && game.status !== "ACTIVE") setGame(null);
                  start();
                }}
                disabled={busy}
                animate={
                  reduced || busy ? {} : { scale: [1, 1.015, 1] }
                }
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="w-full py-4 disabled:opacity-40 text-black font-black text-base rounded-xl transition-colors hover:brightness-110 active:scale-[0.98]"
                style={{ background: ORANGE }}
              >
                {busy ? "Dealing…" : "Bet"}
              </motion.button>
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
                  <TweenNumber
                    value={game.multiplier}
                    reduced={reduced}
                    format={(v) => `× ${v.toFixed(2)}`}
                    className="font-black"
                    style={{ color: ORANGE }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#6b7280]">Total Profit</span>
                  <TweenNumber
                    value={totalProfit}
                    reduced={reduced}
                    format={(v) =>
                      `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                    }
                    className={`font-black ${totalProfit > 0 ? "text-green-400" : "text-white"}`}
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
            "radial-gradient(ellipse at 50% 28%, #1b1206 0%, #120c06 42%, #08060a 100%)",
          minHeight: 360,
        }}
      >
        {/* Orange-accent vignette shimmer (ambient) */}
        {!reduced && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 30%, rgba(255,154,61,0.10), transparent 60%)",
            }}
            animate={{ opacity: [0.6, 0.95, 0.6] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Outcome bloom behind the card (win = green, bust = red) */}
        <AnimatePresence>
          {(flash === "win" || flash === "bust") && !reduced && (
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

        {/* Draw-pile / shoe — the visual source of dealt cards (top-right) */}
        <div className="absolute top-12 right-4 sm:right-8 z-[1] hidden sm:flex flex-col items-center gap-1.5">
          <motion.div
            className="relative"
            style={{ width: 56, height: 80 }}
            animate={reduced ? {} : { y: [0, -2, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute rounded-lg border border-amber-200/20"
                style={{
                  inset: 0,
                  transform: `translate(${i * 2}px, ${-i * 2}px)`,
                  background:
                    "linear-gradient(135deg, #2a1c0c 0%, #18120a 100%)",
                  boxShadow:
                    i === 2
                      ? "0 0 16px rgba(255,154,61,0.25), inset 0 0 0 1px rgba(255,154,61,0.18)"
                      : "0 4px 12px rgba(0,0,0,0.5)",
                }}
              >
                {i === 2 && (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-amber-300/40 text-xl font-black"
                    style={{ textShadow: "0 0 8px rgba(255,154,61,0.4)" }}
                  >
                    ?
                  </div>
                )}
              </div>
            ))}
          </motion.div>
          <span className="text-[9px] uppercase tracking-widest text-amber-200/40 font-bold">
            Shoe
          </span>
        </div>

        {/* Status */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06] z-10">
          {!game
            ? "Place a bet to deal a card"
            : game.status === "ACTIVE"
              ? `Step ${game.step + 1} · × ${game.multiplier.toFixed(2)}`
              : game.status === "CASHEDOUT"
                ? `Cashed out × ${game.multiplier.toFixed(2)}`
                : "Bust"}
        </div>

        {/* Card stage */}
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 items-center w-full max-w-3xl mt-12 z-[1]">
          {/* Higher or Same */}
          <button
            type="button"
            onClick={() => action("higher")}
            disabled={!isActive || busy || higherDisabled}
            className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-colors disabled:cursor-not-allowed ${
              higherDisabled
                ? "opacity-30 border-white/10 bg-white/[0.02]"
                : !isActive || busy
                  ? "opacity-40"
                  : ""
            } ${
              lastAction === "higher" && flash && flash !== "skip"
                ? flash === "win"
                  ? "border-green-400/70 bg-green-400/15"
                  : "border-red-500/70 bg-red-500/15"
                : "border-amber-400/40 bg-amber-400/5 hover:bg-amber-400/10"
            }`}
          >
            <div
              className="w-14 h-14 rounded-full border-2 flex items-center justify-center"
              style={{ borderColor: "rgba(255,154,61,0.4)" }}
            >
              <ChevronUp size={32} style={{ color: ORANGE }} />
            </div>
            <div className="text-sm font-black" style={{ color: "#ffd2a3" }}>
              Higher or Same
            </div>
            {higherDisabled ? (
              <div className="text-[11px] text-white/40">— King is highest —</div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <TweenNumber
                    value={game?.nextHigherMultiplier ?? 0}
                    reduced={reduced}
                    format={(v) => `× ${v.toFixed(2)}`}
                    duration={0.25}
                    className="font-black"
                    style={{ color: ORANGE }}
                  />
                  <span className="text-white/30">·</span>
                  <TweenNumber
                    value={game?.nextHigherChance ?? 0}
                    reduced={reduced}
                    format={(v) => `${v.toFixed(1)}%`}
                    duration={0.25}
                    className="text-amber-200/70"
                  />
                </div>
                {game && (
                  <div className="text-[10px] text-green-300/70 font-bold">
                    +$
                    {profitHigher.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                )}
              </>
            )}
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
                      ? { rotateY: 0, opacity: 1, x: 0, y: 0, scale: 1 }
                      : { rotateY: -180, opacity: 0, x: 70, y: -54, scale: 0.9 }
                  }
                  animate={{ rotateY: 0, opacity: 1, x: 0, y: 0, scale: 1 }}
                  exit={
                    reduced
                      ? { opacity: 0 }
                      : { rotateY: 24, opacity: 0, y: -24, scale: 0.92 }
                  }
                  transition={flipTransition}
                >
                  <div
                    className={`relative w-36 h-52 rounded-2xl border-4 ${
                      card?.red ? "border-red-500" : "border-slate-300"
                    } bg-white shadow-2xl flex flex-col items-center justify-center select-none overflow-hidden`}
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
                    {/* corner pips */}
                    {card && (
                      <>
                        <div
                          className={`absolute top-1.5 left-2 text-sm font-black leading-none flex flex-col items-center ${
                            card.red ? "text-red-500" : "text-slate-900"
                          }`}
                        >
                          <span>{card.rank}</span>
                          <span className="text-[11px]">{card.suit}</span>
                        </div>
                        <div
                          className={`absolute bottom-1.5 right-2 text-sm font-black leading-none flex flex-col items-center rotate-180 ${
                            card.red ? "text-red-500" : "text-slate-900"
                          }`}
                        >
                          <span>{card.rank}</span>
                          <span className="text-[11px]">{card.suit}</span>
                        </div>
                      </>
                    )}
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

                    {/* Specular highlight sweeping across the face as it lands */}
                    {!reduced && (
                      <motion.div
                        key={`spec-${cardKey}`}
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        initial={{ x: "-130%" }}
                        animate={{ x: "130%" }}
                        transition={{
                          duration: 0.7,
                          ease: "easeOut",
                          delay: 0.18,
                        }}
                        style={{
                          background:
                            "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)",
                        }}
                      />
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

          {/* Lower or Same */}
          <button
            type="button"
            onClick={() => action("lower")}
            disabled={!isActive || busy || lowerDisabled}
            className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-colors disabled:cursor-not-allowed ${
              lowerDisabled
                ? "opacity-30 border-white/10 bg-white/[0.02]"
                : !isActive || busy
                  ? "opacity-40"
                  : ""
            } ${
              lastAction === "lower" && flash && flash !== "skip"
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
            {lowerDisabled ? (
              <div className="text-[11px] text-white/40">— Ace is lowest —</div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <TweenNumber
                    value={game?.nextLowerMultiplier ?? 0}
                    reduced={reduced}
                    format={(v) => `× ${v.toFixed(2)}`}
                    duration={0.25}
                    className="font-black text-cyan-200"
                  />
                  <span className="text-white/30">·</span>
                  <TweenNumber
                    value={game?.nextLowerChance ?? 0}
                    reduced={reduced}
                    format={(v) => `${v.toFixed(1)}%`}
                    duration={0.25}
                    className="text-cyan-200/70"
                  />
                </div>
                {game && (
                  <div className="text-[10px] text-green-300/70 font-bold">
                    +$
                    {profitLower.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                )}
              </>
            )}
          </button>
        </div>

        {/* Running multiplier pill (orange, glowing) under the card */}
        <AnimatePresence>
          {isActive && (game?.step ?? 0) > 0 && (
            <motion.div
              key="run-mult"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-5 px-5 py-1.5 rounded-full bg-black/40 border backdrop-blur-md z-[1]"
              style={{
                borderColor: "rgba(255,154,61,0.35)",
                boxShadow: "0 0 24px rgba(255,154,61,0.18)",
              }}
            >
              <TweenNumber
                value={game!.multiplier}
                reduced={reduced}
                format={(v) => `× ${v.toFixed(2)}`}
                className="text-lg font-black"
                style={{ color: ORANGE }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cashout payout count-up float */}
        <AnimatePresence>
          {game?.status === "CASHEDOUT" && (
            <motion.div
              key="cashout-float"
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-5 px-5 py-2 rounded-full z-[1] font-black text-lg"
              style={{
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.4)",
                color: GREEN,
              }}
            >
              <TweenNumber
                value={payoutShown}
                reduced={reduced}
                duration={0.7}
                format={(v) =>
                  `+$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* History strip — color-coded suits + skipped-card indicator */}
        {game && game.history.length > 1 && (
          <div className="mt-6 flex gap-1.5 flex-wrap justify-center max-w-3xl z-[1]">
            {game.history.map((c, i) => {
              const cl = cardLabel(c);
              // actions[i-1] is the move that produced history[i] (history[0] is the deal).
              const wasSkip = i > 0 && game.actions?.[i - 1] === "skip";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.7, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={
                    reduced ? { duration: 0 } : { duration: 0.25, delay: i * 0.01 }
                  }
                  title={wasSkip ? "Skipped" : undefined}
                  className={`relative w-9 h-12 rounded border flex flex-col items-center justify-center ${
                    wasSkip ? "border-dashed opacity-50" : ""
                  } ${
                    cl.red
                      ? "border-red-500/40 bg-red-500/5"
                      : "border-white/20 bg-white/[0.04]"
                  }`}
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
                  {wasSkip && (
                    <span className="absolute -top-1.5 -right-1.5 text-[7px] uppercase tracking-wide px-1 rounded bg-black/70 border border-white/20 text-white/60 font-bold">
                      S
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Hotkey hint */}
        {isActive && (
          <div className="mt-4 text-[10px] text-white/30 font-medium z-[1] hidden sm:block">
            ↑ Higher · ↓ Lower · Space Skip · Enter Cashout
          </div>
        )}
      </div>
    </OriginalsShell>
  );
}
