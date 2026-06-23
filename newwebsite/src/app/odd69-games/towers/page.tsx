"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  animate,
} from "framer-motion";
import { toast } from "react-hot-toast";
import { Shuffle } from "lucide-react";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import OriginalsAutoBet from "@/components/originals/OriginalsAutoBet";
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
  pickedTile?: number;
  isTrap?: boolean;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
}

const ACCENT = "#ff9a3d";

/**
 * Difficulty metadata. The tiles/safe counts MUST mirror the backend
 * (newbackend/src/originals/services/towers.service.ts → DIFFICULTIES) so the
 * inline multiplier ladder we render matches the server's authoritative curve.
 * The board is 8 floors server-side (TOTAL_FLOORS = 8).
 */
const DIFF_META: Record<
  Difficulty,
  { label: string; tiles: number; safe: number; tint: string }
> = {
  easy: { label: "Easy", tiles: 4, safe: 3, tint: "#34d399" },
  medium: { label: "Medium", tiles: 3, safe: 2, tint: "#ffb45e" },
  hard: { label: "Hard", tiles: 3, safe: 1, tint: "#fb923c" },
  expert: { label: "Expert", tiles: 2, safe: 1, tint: "#f87171" },
};
const DIFFS = Object.keys(DIFF_META) as Difficulty[];

const HOUSE_RTP = 0.96; // mirrors backend HOUSE_RTP — display math only

/** Server-identical multiplier for a climbed-floor count (display only). */
function multForFloor(floor: number, tiles: number, safe: number): number {
  if (floor <= 0) return 1;
  const probSafe = safe / tiles;
  return parseFloat((Math.pow(1 / probSafe, floor) * HOUSE_RTP).toFixed(4));
}

/** The full per-floor ladder (index 0 = floor 1). */
function ladderFor(diff: Difficulty, totalFloors: number): number[] {
  const { tiles, safe } = DIFF_META[diff];
  return Array.from({ length: totalFloors }, (_, i) =>
    multForFloor(i + 1, tiles, safe),
  );
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Pull a human-readable message off an axios-style error without using `any`. */
function errMsg(e: unknown, fallback: string): string {
  const m = (e as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  return typeof m === "string" && m ? m : fallback;
}

/** Animated count-up readout for the live multiplier (server-driven value). */
function MultiplierCounter({
  value,
  prefersReduced,
}: {
  value: number;
  prefersReduced: boolean;
}) {
  const mv = useMotionValue(value);
  const [display, setDisplay] = useState(value);

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
  const [autoBusy, setAutoBusy] = useState(false);
  const [game, setGame] = useState<TowersState | null>(null);

  // Auto-mode strategy (pick pattern + auto-cashout floor) shared with runBet.
  const [autoPickMode, setAutoPickMode] = useState<"fixed" | "random">("random");
  const [autoCashFloor, setAutoCashFloor] = useState(4);

  const prefersReduced = !!useReducedMotion();

  // ── Animation-only state (never affects data / outcomes) ──────────────────
  const prevFloorRef = useRef(0);
  const [climbedFloor, setClimbedFloor] = useState<number | null>(null);
  const [collapseFloor, setCollapseFloor] = useState<number | null>(null);
  const [revealTerminal, setRevealTerminal] = useState(false);
  // Red screen-edge vignette flash on a trap.
  const [vignette, setVignette] = useState(false);
  const climbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vignetteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (climbTimer.current) {
      clearTimeout(climbTimer.current);
      climbTimer.current = null;
    }
    if (vignetteTimer.current) {
      clearTimeout(vignetteTimer.current);
      vignetteTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Resume an in-flight game on load.
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

  const resetFx = useCallback(() => {
    clearTimers();
    setClimbedFloor(null);
    setCollapseFloor(null);
    setRevealTerminal(false);
    setVignette(false);
  }, [clearTimers]);

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
      resetFx();
      prevFloorRef.current = res.data.currentFloor;
      setGame(res.data);
      playSound("bet");
      await refreshWallet();
    } catch (e: unknown) {
      toast.error(errMsg(e, "Could not start"));
    } finally {
      setBusy(false);
    }
  }, [betInput, difficulty, walletType, useBonus, refreshWallet, resetFx]);

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
          setVignette(true);
          vignetteTimer.current = setTimeout(() => setVignette(false), 650);
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
          const big =
            res.data.multiplier >= 10 ||
            res.data.payout >= res.data.betAmount * 10;
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
      } catch (e: unknown) {
        toast.error(errMsg(e, "Pick failed"));
      } finally {
        setBusy(false);
      }
    },
    [game, refreshWallet, prefersReduced],
  );

  // Pick a random tile in the active floor (manual helper + auto pick mode).
  const pickRandom = useCallback(() => {
    if (!game || game.status !== "ACTIVE" || busy) return;
    const t = Math.floor(Math.random() * game.tilesPerFloor);
    void pick(t);
  }, [game, busy, pick]);

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
      const big =
        res.data.multiplier >= 10 || res.data.payout >= res.data.betAmount * 10;
      if (big) fireBigWin();
      else fireWin();
      toast.success(`Cashed out × ${res.data.multiplier}`);
      await refreshWallet();
    } catch (e: unknown) {
      toast.error(errMsg(e, "Cashout failed"));
    } finally {
      setBusy(false);
    }
  }, [game, refreshWallet]);

  // ── AUTO MODE ─────────────────────────────────────────────────────────────
  // Runs ONE full tower (start → climb to target floor / trap → cashout) and
  // resolves with the round outcome for OriginalsAutoBet's strategy engine.
  // The server is the only authority on each pick; we just drive the sequence.
  const autoPickModeRef = useRef(autoPickMode);
  const autoCashFloorRef = useRef(autoCashFloor);
  const diffRef = useRef(difficulty);
  const walletRef = useRef(walletType);
  const bonusRef = useRef(useBonus);
  useEffect(() => {
    autoPickModeRef.current = autoPickMode;
  }, [autoPickMode]);
  useEffect(() => {
    autoCashFloorRef.current = autoCashFloor;
  }, [autoCashFloor]);
  useEffect(() => {
    diffRef.current = difficulty;
  }, [difficulty]);
  useEffect(() => {
    walletRef.current = walletType;
  }, [walletType]);
  useEffect(() => {
    bonusRef.current = useBonus;
  }, [useBonus]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runAutoBet = useCallback(
    async (bet: number): Promise<{ won: boolean; payout: number } | null> => {
      try {
        // 1) Start the tower.
        const startRes = await api.post<TowersState>("/originals/towers/start", {
          betAmount: bet,
          difficulty: diffRef.current,
          walletType: walletRef.current,
          useBonus: bonusRef.current,
        });
        resetFx();
        let state = startRes.data;
        prevFloorRef.current = state.currentFloor;
        setGame(state);
        playSound("bet");

        const target = Math.min(
          Math.max(1, autoCashFloorRef.current),
          state.totalFloors,
        );

        // 2) Climb until target floor reached or a trap ends it.
        while (state.status === "ACTIVE" && state.currentFloor < target) {
          const tile =
            autoPickModeRef.current === "random"
              ? Math.floor(Math.random() * state.tilesPerFloor)
              : 0; // fixed position = leftmost tile
          const floorAtPick = state.currentFloor;
          const pickRes = await api.post<TowersState>(
            "/originals/towers/pick",
            { gameId: state.gameId, tile },
          );
          state = pickRes.data;
          setGame(state);

          if (state.status === "LOST") {
            setCollapseFloor(floorAtPick);
            playSound("crash");
            setVignette(true);
            vignetteTimer.current = setTimeout(() => setVignette(false), 650);
            setRevealTerminal(true);
            await refreshWallet();
            return { won: false, payout: 0 };
          }
          if (state.status === "CASHEDOUT") {
            // Topped out before the target — full clear.
            setRevealTerminal(true);
            playSound("cashout");
            await refreshWallet();
            return { won: true, payout: state.payout };
          }
          // Safe climb.
          setClimbedFloor(floorAtPick);
          playSound("reveal");
          prevFloorRef.current = state.currentFloor;
          await sleep(160);
        }

        // 3) Reached the target floor while still ACTIVE → cash out.
        if (state.status === "ACTIVE" && state.currentFloor >= 1) {
          const coRes = await api.post<TowersState>(
            "/originals/towers/cashout",
            { gameId: state.gameId },
          );
          state = coRes.data;
          setGame(state);
          setRevealTerminal(true);
          playSound("cashout");
          await refreshWallet();
          return { won: true, payout: state.payout };
        }

        await refreshWallet();
        return { won: state.payout > 0, payout: state.payout };
      } catch (e: unknown) {
        toast.error(errMsg(e, "Auto bet stopped"));
        await refreshWallet().catch(() => undefined);
        return null; // abort the session
      }
    },
    [refreshWallet, resetFx],
  );

  // ── Hotkeys: Space/Enter = Bet or Cashout, R = random tile ────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (autoBusy) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const active = game?.status === "ACTIVE";
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (active) {
          if ((game?.currentFloor ?? 0) >= 1) void cashout();
        } else if (!busy) {
          if (game && game.status !== "ACTIVE") setGame(null);
          void start();
        }
      } else if ((e.key === "r" || e.key === "R") && active && !busy) {
        e.preventDefault();
        pickRandom();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, busy, autoBusy, cashout, start, pickRandom]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isActive = game?.status === "ACTIVE";
  const isFinished = !!game && game.status !== "ACTIVE";
  const tiles = game?.tilesPerFloor ?? DIFF_META[difficulty].tiles;
  const totalFloors = game?.totalFloors ?? 8;
  const revealAll = isFinished && (revealTerminal || prefersReduced);
  const betNum = parseFloat(betInput) || 0;

  // Live ladder for the active/selected difficulty (display only).
  const ladder = useMemo(
    () =>
      ladderFor(
        (game?.difficulty as Difficulty) ?? difficulty,
        totalFloors,
      ),
    [game?.difficulty, difficulty, totalFloors],
  );

  const currentProfit =
    game && game.currentFloor >= 1
      ? game.betAmount * game.multiplier - game.betAmount
      : 0;

  return (
    <OriginalsShell
      gameKey="towers"
      title="Towers"
      tags={["# Towers", "# ODD69 Originals", "# Provably Fair"]}
      historyGameKey="towers"
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={isActive || busy || autoBusy}
          accent={ACCENT}
          autoPanel={
            <div className="space-y-3">
              {/* Auto strategy header: pick pattern + auto-cashout floor */}
              <div>
                <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
                  Pick Pattern
                </label>
                <div className="flex gap-1.5 mt-1.5">
                  {(["random", "fixed"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => !autoBusy && setAutoPickMode(m)}
                      disabled={autoBusy}
                      className="flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all disabled:opacity-40"
                      style={
                        autoPickMode === m
                          ? { background: ACCENT, color: "#0b0d10" }
                          : {
                              background: "var(--bg-deep-3, #16110c)",
                              border: "1px solid rgba(255,255,255,0.06)",
                              color: "#9ca3af",
                            }
                      }
                    >
                      {m === "fixed" ? "Fixed position" : "Random tile"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
                  Auto Cashout at Floor — {autoCashFloor}/{totalFloors}
                </label>
                <input
                  type="range"
                  min={1}
                  max={totalFloors}
                  step={1}
                  value={autoCashFloor}
                  disabled={autoBusy}
                  onChange={(e) => setAutoCashFloor(Number(e.target.value))}
                  className="w-full mt-2 accent-[#ff9a3d] disabled:opacity-40"
                  aria-label="Auto cashout floor"
                />
                <div className="flex justify-between text-[10px] text-[#6b7280] mt-1 tabular-nums">
                  <span>×1</span>
                  <span className="text-[#ffb45e] font-black">
                    × {(ladder[autoCashFloor - 1] ?? 1).toFixed(2)}
                  </span>
                </div>
              </div>

              <OriginalsAutoBet
                baseBet={betNum}
                accent={ACCENT}
                disabled={betNum <= 0}
                runBet={runAutoBet}
                onBusyChange={setAutoBusy}
              />
            </div>
          }
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
                className="w-full py-4 disabled:opacity-40 text-black font-black text-base rounded-xl flex flex-col items-center leading-tight"
                style={{
                  background: "linear-gradient(180deg, #ffb45e 0%, #ff9a3d 100%)",
                }}
              >
                <span>Cashout × {game?.multiplier.toFixed(2)}</span>
                {(game?.currentFloor ?? 0) >= 1 && (
                  <span className="text-[11px] font-bold opacity-80">
                    +${fmtMoney(currentProfit)}
                  </span>
                )}
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
                  <span className="text-white font-black tabular-nums">
                    {game.currentFloor}/{totalFloors}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#6b7280]">Multiplier</span>
                  <span className="text-[#ff9a3d] font-black tabular-nums">
                    <MultiplierCounter
                      value={game.multiplier}
                      prefersReduced={prefersReduced}
                    />
                  </span>
                </div>
                {isActive && game.nextMultiplier !== null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[#6b7280]">Next</span>
                    <span className="text-emerald-400 font-black tabular-nums">
                      × {game.nextMultiplier.toFixed(2)}
                    </span>
                  </div>
                )}
                {/* Cashout display: total return + profit */}
                <div className="flex justify-between text-xs pt-1.5 border-t border-white/[0.06]">
                  <span className="text-[#6b7280]">
                    {isFinished
                      ? game.status === "CASHEDOUT"
                        ? "Won"
                        : "Lost"
                      : "On Cashout"}
                  </span>
                  <span
                    className="font-black tabular-nums"
                    style={{
                      color:
                        isFinished && game.status === "LOST"
                          ? "#ef4444"
                          : "#34d399",
                    }}
                  >
                    $
                    {fmtMoney(
                      isFinished
                        ? game.payout
                        : game.currentFloor >= 1
                          ? game.betAmount * game.multiplier
                          : 0,
                    )}
                  </span>
                </div>
              </div>
            )
          }
        >
          {/* Difficulty — 4-segment control (locked while a round is active) */}
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Difficulty
            </label>
            <div className="grid grid-cols-2 gap-1">
              {DIFFS.map((d) => {
                const meta = DIFF_META[d];
                const selected =
                  (game?.difficulty as Difficulty | undefined) ?? difficulty;
                const isSel = selected === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => !isActive && !autoBusy && setDifficulty(d)}
                    disabled={isActive || autoBusy}
                    title={`${meta.tiles} tiles · ${meta.safe} safe`}
                    className={`py-1.5 rounded text-[10px] font-bold uppercase transition-colors flex flex-col items-center leading-tight ${
                      isSel
                        ? "bg-[#ff9a3d]/20 text-[#ffb45e] border border-[#ff9a3d]/40"
                        : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                    } ${isActive || autoBusy ? "opacity-40" : ""}`}
                  >
                    <span>{meta.label}</span>
                    <span className="text-[8px] opacity-60 normal-case">
                      {meta.safe}/{meta.tiles} safe
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Random-tile helper (manual, active round only) */}
          {isActive && (
            <button
              type="button"
              onClick={pickRandom}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af] hover:text-white hover:border-white/[0.12] text-xs font-bold transition-all disabled:opacity-40"
            >
              <Shuffle size={14} /> Pick random tile
            </button>
          )}
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

        {/* Red screen-edge vignette flash on a trap */}
        <AnimatePresence>
          {vignette && !prefersReduced && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                background:
                  "radial-gradient(ellipse at 50% 50%, rgba(239,68,68,0) 55%, rgba(239,68,68,0.35) 100%)",
              }}
            />
          )}
        </AnimatePresence>

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
                  ? `🎉 +$${fmtMoney(game.payout)}`
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
              // Per-floor ladder multiplier (the inline paytable).
              const floorMult = ladder[floor] ?? 1;
              const floorProfit = betNum > 0 ? betNum * floorMult - betNum : 0;

              return (
                <motion.div
                  key={floor}
                  className="group flex items-center gap-2"
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
                    className="w-8 text-[10px] font-bold text-right tabular-nums"
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
                          disabled={!isCurrent || busy || autoBusy}
                          onClick={() => pick(t)}
                          className="relative h-10 rounded-md text-xs font-bold flex items-center justify-center overflow-hidden"
                          animate={{ backgroundColor: bg, color: text }}
                          style={{ border }}
                          transition={{ duration: 0.25 }}
                          whileHover={
                            isCurrent && !prefersReduced
                              ? {
                                  scale: 1.06,
                                  backgroundColor: "rgba(255,154,61,0.22)",
                                }
                              : undefined
                          }
                          whileTap={
                            isCurrent && !prefersReduced
                              ? { scale: 0.94 }
                              : undefined
                          }
                        >
                          {/* Green gem pop on a freshly-picked safe tile */}
                          {pickedSafe && justClimbed && !prefersReduced && (
                            <motion.span
                              aria-hidden
                              className="absolute inset-0 rounded-md"
                              initial={{
                                boxShadow: "0 0 0 0 rgba(52,211,153,0.0)",
                              }}
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

                  {/* Inline multiplier ladder (per-floor paytable) */}
                  <div className="w-14 flex-shrink-0 text-right">
                    <div
                      className={`text-[10px] font-black tabular-nums leading-none transition-colors ${
                        isCurrent
                          ? "text-[#ffb45e]"
                          : isClimbed
                            ? "text-[#34d399]"
                            : "text-[#6b7280]"
                      }`}
                    >
                      ×{floorMult.toFixed(2)}
                    </div>
                    {/* Profit-on-win on hover */}
                    {betNum > 0 && (
                      <div className="text-[8px] text-[#6b7280] leading-none mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                        +${fmtMoney(floorProfit)}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            },
          )}
        </motion.div>

        {/* Fairness strip under the board (hash · client seed · nonce) */}
        {game?.serverSeedHash && (
          <div className="relative z-10 mt-3 w-full max-w-md flex items-center justify-center gap-3 text-[9px] text-[#6b7280] font-mono px-2">
            <span className="truncate" title={`Server seed (hashed): ${game.serverSeedHash}`}>
              hash: {game.serverSeedHash.slice(0, 10)}…
            </span>
            {game.clientSeed && (
              <span className="truncate" title={`Client seed: ${game.clientSeed}`}>
                client: {game.clientSeed.slice(0, 10)}
              </span>
            )}
            {typeof game.nonce === "number" && <span>nonce: {game.nonce}</span>}
          </div>
        )}
      </div>
    </OriginalsShell>
  );
}
