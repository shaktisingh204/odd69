"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  animate,
} from "framer-motion";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

type Difficulty = "easy" | "medium" | "hard" | "expert";

interface TowersState {
  gameId: string;
  betAmount: number;
  difficulty: Difficulty;
  tilesPerFloor: number;
  safePerFloor: number;
  totalFloors: number;
  currentFloor: number;
  multiplier: number;
  picks: number[];
  status: "ACTIVE" | "CASHEDOUT" | "LOST";
  payout: number;
  nextMultiplier: number | null;
  floorTraps?: number[][];
}

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert"];

const ACCENT = "#ff9a3d";

/** Animated count-up readout for the live multiplier (server-driven value). */
function MultiplierCounter({ value, prefersReduced }: { value: number; prefersReduced: boolean }) {
  const mv = useMotionValue(value);
  const [display, setDisplay] = useState(value);

  // Mirror the motion value into React state via subscription (no synchronous
  // setState inside the effect body).
  useEffect(() => mv.on("change", (v) => setDisplay(v)), [mv]);

  useEffect(() => {
    if (prefersReduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.5, ease: "easeOut" });
    return () => controls.stop();
  }, [value, prefersReduced, mv]);

  return <>× {display.toFixed(2)}</>;
}

export default function TowersPage() {
  const { refreshWallet } = useWallet();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [busy, setBusy] = useState(false);
  const [game, setGame] = useState<TowersState | null>(null);

  const prefersReduced = !!useReducedMotion();

  // ── Animation-only state (never affects data / outcomes) ──────────────────
  // Track previous floor so we can detect a fresh successful climb.
  const prevFloorRef = useRef(0);
  // Floor that just climbed (drives the green gem pop + climb transition).
  const [climbedFloor, setClimbedFloor] = useState<number | null>(null);
  // The floor the trap was on when the tower collapsed (drives red shake).
  const [collapseFloor, setCollapseFloor] = useState<number | null>(null);
  const [revealTerminal, setRevealTerminal] = useState(false);
  const climbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (climbTimer.current) {
      clearTimeout(climbTimer.current);
      climbTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<TowersState | null>("/originals/towers/active")
      .then((res) => {
        if (!cancelled && res.data) {
          setGame(res.data);
          prevFloorRef.current = res.data.currentFloor;
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Invalid bet");
    setBusy(true);
    try {
      const res = await api.post<TowersState>("/originals/towers/start", {
        betAmount: bet,
        difficulty,
        walletType,
        useBonus,
      });
      // Reset animation state for the fresh tower.
      clearTimers();
      setClimbedFloor(null);
      setCollapseFloor(null);
      setRevealTerminal(false);
      prevFloorRef.current = res.data.currentFloor;
      setGame(res.data);
      playSound("bet");
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not start");
    } finally {
      setBusy(false);
    }
  }, [betInput, difficulty, walletType, useBonus, refreshWallet, clearTimers]);

  const pick = useCallback(
    async (tile: number) => {
      if (!game || game.status !== "ACTIVE") return;
      setBusy(true);
      playSound("tick"); // the pick gesture itself
      const floorAtPick = game.currentFloor;
      try {
        const res = await api.post<TowersState>("/originals/towers/pick", {
          gameId: game.gameId,
          tile,
        });
        setGame(res.data);

        if (res.data.status === "LOST") {
          // Trap! Red shake on the floor we just attempted, then reveal traps.
          setCollapseFloor(floorAtPick);
          playSound("crash");
          if (prefersReduced) {
            setRevealTerminal(true);
          } else {
            climbTimer.current = setTimeout(() => setRevealTerminal(true), 240);
          }
          toast.error("Trap! Game over");
          await refreshWallet();
        } else if (res.data.status === "CASHEDOUT") {
          // Reached the top — auto cashout (full tower clear).
          setClimbedFloor(floorAtPick);
          setRevealTerminal(true);
          playSound("cashout");
          const big = res.data.multiplier >= 10 || res.data.payout >= res.data.betAmount * 10;
          if (big) fireBigWin();
          else fireWin();
          toast.success(`Tower complete × ${res.data.multiplier}`);
          await refreshWallet();
        } else {
          // Safe pick — green gem pop + climb up a floor.
          setClimbedFloor(floorAtPick);
          playSound("reveal");
          prevFloorRef.current = res.data.currentFloor;
        }
      } catch (e: any) {
        toast.error(e?.response?.data?.message || "Pick failed");
      } finally {
        setBusy(false);
      }
    },
    [game, refreshWallet, prefersReduced],
  );

  const cashout = useCallback(async () => {
    if (!game) return;
    setBusy(true);
    try {
      const res = await api.post<TowersState>("/originals/towers/cashout", {
        gameId: game.gameId,
      });
      setGame(res.data);
      setRevealTerminal(true);
      playSound("cashout");
      const big = res.data.multiplier >= 10 || res.data.payout >= res.data.betAmount * 10;
      if (big) fireBigWin();
      else fireWin();
      toast.success(`Cashed out × ${res.data.multiplier}`);
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Cashout failed");
    } finally {
      setBusy(false);
    }
  }, [game, refreshWallet]);

  const isActive = game?.status === "ACTIVE";
  const isFinished = !!game && game.status !== "ACTIVE";
  const tiles = game?.tilesPerFloor ?? 3;
  const totalFloors = game?.totalFloors ?? 8;
  const revealAll = isFinished && (revealTerminal || prefersReduced);

  return (
    <OriginalsShell
      gameKey="towers"
      title="Towers"
      tags={["# Towers", "# ODD69 Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={isActive || busy}
          accent={ACCENT}
          action={
            isActive ? (
              <motion.button
                type="button"
                onClick={cashout}
                disabled={busy || (game?.currentFloor ?? 0) === 0}
                whileHover={prefersReduced ? undefined : { scale: 1.02 }}
                whileTap={prefersReduced ? undefined : { scale: 0.98 }}
                animate={
                  prefersReduced || (game?.currentFloor ?? 0) === 0
                    ? undefined
                    : {
                        boxShadow: [
                          "0 0 0 0 rgba(255,154,61,0.0)",
                          "0 0 22px 2px rgba(255,154,61,0.45)",
                          "0 0 0 0 rgba(255,154,61,0.0)",
                        ],
                      }
                }
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="w-full py-4 disabled:opacity-40 text-black font-black text-base rounded-xl"
                style={{ background: "linear-gradient(180deg, #ffb45e 0%, #ff9a3d 100%)" }}
              >
                Cashout × {game?.multiplier.toFixed(2)}
              </motion.button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (isFinished) setGame(null);
                  start();
                }}
                disabled={busy}
                className="w-full py-4 bg-stone-300 hover:bg-stone-200 disabled:opacity-40 text-black font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {busy ? "Building…" : "Bet"}
              </button>
            )
          }
          footer={
            game && (
              <div className="bg-bg-deep-3 border border-white/[0.06] rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#6b7280]">Floor</span>
                  <span className="text-white font-black">
                    {game.currentFloor}/{totalFloors}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#6b7280]">Multiplier</span>
                  <span className="text-[#ff9a3d] font-black tabular-nums">
                    <MultiplierCounter value={game.multiplier} prefersReduced={prefersReduced} />
                  </span>
                </div>
                {isActive && game.nextMultiplier !== null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[#6b7280]">Next</span>
                    <span className="text-emerald-400 font-black">
                      × {game.nextMultiplier.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )
          }
        >
          {/* Difficulty */}
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Difficulty
            </label>
            <div className="grid grid-cols-2 gap-1">
              {DIFFS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => !isActive && setDifficulty(d)}
                  disabled={isActive}
                  className={`py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${
                    difficulty === d
                      ? "bg-[#ff9a3d]/20 text-[#ffb45e] border border-[#ff9a3d]/40"
                      : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                  } ${isActive ? "opacity-40" : ""}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </OriginalsControls>
      }
    >
      <div
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #201912 0%, #17120d 40%, #0c0906 100%)",
          minHeight: 360,
        }}
      >
        {/* Ambient drifting glow behind the tower */}
        {!prefersReduced && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 75%, rgba(255,154,61,0.10) 0%, rgba(255,154,61,0) 55%)",
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={
              !game
                ? "idle"
                : isActive
                  ? `active-${game.currentFloor}`
                  : game.status
            }
            initial={prefersReduced ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06] whitespace-nowrap"
          >
            {!game
              ? "Pick a difficulty and bet"
              : isActive
                ? `Floor ${game.currentFloor + 1}/${totalFloors} · pick a tile`
                : game.status === "CASHEDOUT"
                  ? `🎉 +$${game.payout.toLocaleString("en-US")}`
                  : "💥 Tower collapsed"}
          </motion.div>
        </AnimatePresence>

        {/* Tower board */}
        <motion.div
          className="relative z-10 w-full max-w-md mt-12 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 space-y-2"
          animate={
            collapseFloor !== null && !prefersReduced
              ? { x: [0, -10, 9, -7, 5, -3, 0], rotate: [0, -0.6, 0.6, -0.4, 0] }
              : { x: 0, rotate: 0 }
          }
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{
            boxShadow:
              collapseFloor !== null
                ? "0 0 28px 0 rgba(239,68,68,0.25)"
                : isActive
                  ? "0 0 24px 0 rgba(255,154,61,0.12)"
                  : "none",
          }}
        >
          {Array.from({ length: totalFloors }, (_, i) => totalFloors - 1 - i).map(
            (floor) => {
              const isCurrent = game?.currentFloor === floor && isActive;
              const isClimbed = (game?.currentFloor ?? 0) > floor;
              const playerPick = game?.picks[floor];
              const traps = game?.floorTraps?.[floor] || [];
              const justClimbed = climbedFloor === floor;

              return (
                <motion.div
                  key={floor}
                  className="flex items-center gap-2"
                  animate={
                    isCurrent && !prefersReduced
                      ? { scale: [1, 1.012, 1] }
                      : { scale: 1 }
                  }
                  transition={
                    isCurrent
                      ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.2 }
                  }
                >
                  <motion.div
                    className="w-8 text-[10px] font-bold text-right"
                    animate={{
                      color: isCurrent
                        ? "#ffb45e"
                        : isClimbed
                          ? "#34d399"
                          : "#6b7280",
                    }}
                  >
                    {floor + 1}
                  </motion.div>
                  <div
                    className="flex-1 grid gap-1.5"
                    style={{
                      gridTemplateColumns: `repeat(${tiles}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: tiles }, (_, t) => {
                      const isPicked = playerPick === t;
                      const isTrap = traps.includes(t);
                      const reveal = revealAll;
                      const pickedTrap = isPicked && isTrap && reveal;
                      const pickedSafe = isPicked && !isTrap;
                      const revealedTrap = !isPicked && reveal && isTrap;

                      // Staggered reveal delay across the whole board.
                      const revealDelay = prefersReduced
                        ? 0
                        : (totalFloors - 1 - floor) * 0.05 + t * 0.04;

                      let bg: string;
                      let border: string;
                      let text: string;
                      if (pickedTrap) {
                        bg = "rgba(239,68,68,0.40)";
                        border = "1px solid rgb(248,113,113)";
                        text = "#ffffff";
                      } else if (pickedSafe) {
                        bg = "rgba(16,185,129,0.40)";
                        border = "1px solid rgb(52,211,153)";
                        text = "#ffffff";
                      } else if (isClimbed) {
                        bg = "rgba(16,185,129,0.10)";
                        border = "1px solid rgba(16,185,129,0.30)";
                        text = "rgba(110,231,183,0.4)";
                      } else if (revealedTrap) {
                        bg = "rgba(239,68,68,0.10)";
                        border = "1px solid rgba(239,68,68,0.30)";
                        text = "rgba(252,165,165,0.6)";
                      } else if (isCurrent) {
                        bg = "rgba(255,154,61,0.10)";
                        border = "1px solid rgba(255,154,61,0.40)";
                        text = "#ffd9b0";
                      } else {
                        bg = "rgba(255,255,255,0.02)";
                        border = "1px solid rgba(255,255,255,0.06)";
                        text = "#3a3d45";
                      }

                      const showFace = isPicked || (reveal && isTrap);

                      return (
                        <motion.button
                          key={t}
                          type="button"
                          disabled={!isCurrent || busy}
                          onClick={() => pick(t)}
                          className="relative h-10 rounded-md text-xs font-bold flex items-center justify-center overflow-hidden"
                          animate={{ backgroundColor: bg, color: text }}
                          style={{ border }}
                          transition={{ duration: 0.25 }}
                          whileHover={
                            isCurrent && !prefersReduced
                              ? { scale: 1.06, backgroundColor: "rgba(255,154,61,0.22)" }
                              : undefined
                          }
                          whileTap={isCurrent && !prefersReduced ? { scale: 0.94 } : undefined}
                        >
                          {/* Green gem pop on a freshly-picked safe tile */}
                          {pickedSafe && justClimbed && !prefersReduced && (
                            <motion.span
                              aria-hidden
                              className="absolute inset-0 rounded-md"
                              initial={{ boxShadow: "0 0 0 0 rgba(52,211,153,0.0)" }}
                              animate={{
                                boxShadow: [
                                  "0 0 0 0 rgba(52,211,153,0.7)",
                                  "0 0 0 10px rgba(52,211,153,0.0)",
                                ],
                              }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                            />
                          )}

                          <AnimatePresence>
                            {showFace && (
                              <motion.span
                                key={isTrap ? "trap" : "safe"}
                                initial={
                                  prefersReduced
                                    ? false
                                    : isPicked
                                      ? { scale: 0, rotate: -40 }
                                      : { rotateY: 90, opacity: 0 }
                                }
                                animate={
                                  prefersReduced
                                    ? { scale: 1, opacity: 1 }
                                    : isPicked
                                      ? {
                                          scale: isTrap ? [0, 1.4, 1] : [0, 1.35, 1],
                                          rotate: 0,
                                        }
                                      : { rotateY: 0, opacity: 1 }
                                }
                                transition={
                                  isPicked
                                    ? { duration: 0.42, ease: "backOut" }
                                    : {
                                        duration: 0.4,
                                        ease: "easeOut",
                                        delay: revealDelay,
                                      }
                                }
                                className="text-base leading-none"
                              >
                                {isTrap ? "💀" : "💎"}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            },
          )}
        </motion.div>
      </div>
    </OriginalsShell>
  );
}
