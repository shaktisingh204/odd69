"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  animate,
  type AnimationPlaybackControls,
} from "framer-motion";
import { toast } from "react-hot-toast";
import { Zap } from "lucide-react";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import OriginalsAutoBet from "@/components/originals/OriginalsAutoBet";
import { useWallet } from "@/context/WalletContext";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

const ACCENT = "#ff9a3d"; // ODD69 orange
const WIN_GREEN = "#00e701";
const LOSE_RED = "#ed4163";

const MIN_TARGET = 1.01;
const MAX_TARGET = 1_000_000;
const HOUSE_EDGE = 99; // 99% RTP → win chance = 99 / target

/** Server response from POST /originals/limbo/play. */
interface LimboResult {
  gameId: string;
  target: number;
  result: number; // the "crash point" — the verdict number
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
  winChance: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

interface RecentResult {
  id: string;
  result: number;
  won: boolean;
}

/** Clamp + sanitise the typed target multiplier. */
function clampTarget(n: number): number {
  if (!isFinite(n)) return MIN_TARGET;
  return Math.min(MAX_TARGET, Math.max(MIN_TARGET, n));
}

/** A recent-results pill. Green if it would have beaten a 2× reference. */
function ResultPill({ r }: { r: RecentResult }) {
  const isWin = r.won;
  return (
    <span
      className="tabular-nums"
      style={{
        fontSize: 11,
        fontWeight: 800,
        padding: "3px 9px",
        borderRadius: 100,
        background: isWin ? "rgba(0,231,1,0.10)" : "rgba(237,65,99,0.10)",
        color: isWin ? WIN_GREEN : LOSE_RED,
        border: `1px solid ${isWin ? "rgba(0,231,1,0.30)" : "rgba(237,65,99,0.30)"}`,
        whiteSpace: "nowrap",
      }}
    >
      {r.result.toFixed(2)}×
    </span>
  );
}

export default function LimboPage() {
  const { refreshWallet } = useWallet();
  const prefersReducedMotion = useReducedMotion();

  // ── Controls state ─────────────────────────────────────────────────────
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [targetInput, setTargetInput] = useState("2.00");
  const [instantBet, setInstantBet] = useState(false);

  // ── Round state ────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [lastResult, setLastResult] = useState<LimboResult | null>(null);
  const [recent, setRecent] = useState<RecentResult[]>([]);

  // The big central number shown on the stage. Animated up then snapped to the
  // SERVER result by `runCountUp`. `verdict` is only set once the number lands.
  const [displayValue, setDisplayValue] = useState(1.0);
  const [verdict, setVerdict] = useState<"win" | "lose" | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const countCtrlRef = useRef<AnimationPlaybackControls | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup any in-flight count-up / timers on unmount.
  useEffect(() => {
    return () => {
      countCtrlRef.current?.stop();
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  // ── Derived live readouts ────────────────────────────────────────────────
  const target = useMemo(() => clampTarget(parseFloat(targetInput) || 0), [
    targetInput,
  ]);
  const betAmount = useMemo(() => parseFloat(betInput) || 0, [betInput]);
  const winChance = useMemo(() => HOUSE_EDGE / target, [target]);
  const profitOnWin = useMemo(
    () => betAmount * (target - 1),
    [betAmount, target],
  );

  const adjustTarget = useCallback(
    (delta: number) => {
      setTargetInput((cur) => {
        const next = clampTarget((parseFloat(cur) || MIN_TARGET) + delta);
        return next.toFixed(2);
      });
    },
    [],
  );

  // ── Count-up-and-snap animation, driven by the SERVER result ─────────────
  // Resolves once the number has fully settled on its final value so the
  // auto-bet loop can pace itself off the visible outcome.
  const animateToResult = useCallback(
    (res: LimboResult): Promise<void> => {
      const won = res.status === "WON";

      // Stop any prior animation / pending settle.
      countCtrlRef.current?.stop();
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      setVerdict(null);

      const applyVerdict = () => {
        setDisplayValue(res.result);
        setVerdict(won ? "win" : "lose");
        if (won) {
          playSound("win");
          if (res.result >= 50 || res.target >= 50) fireBigWin();
          else if (res.result >= 10 || res.target >= 10) fireBigWin();
          else fireWin();
        } else {
          playSound("lose");
          setShakeKey((k) => k + 1);
        }
      };

      // Instant Bet or reduced motion: snap straight to the verdict.
      if (instantBet || prefersReducedMotion) {
        applyVerdict();
        return Promise.resolve();
      }

      // Higher results take slightly longer so a big multiplier feels earned.
      const duration = Math.min(
        0.7,
        0.28 + Math.log10(Math.max(1, res.result)) * 0.16,
      );

      return new Promise<void>((resolve) => {
        countCtrlRef.current = animate(1, res.result, {
          duration,
          ease: [0.16, 1, 0.3, 1], // easeOutExpo-ish: fast then decelerate
          onUpdate: (v) => setDisplayValue(v),
          onComplete: () => {
            // Tiny settle beat, then lock the colour verdict.
            settleTimerRef.current = setTimeout(() => {
              applyVerdict();
              resolve();
            }, 40);
          },
        });
      });
    },
    [instantBet, prefersReducedMotion],
  );

  // ── Place ONE bet (shared by manual + auto) ──────────────────────────────
  // Returns the auto-bet outcome shape, or null to abort the auto session.
  const placeBet = useCallback(
    async (
      stake: number,
    ): Promise<{ won: boolean; payout: number } | null> => {
      if (!stake || stake <= 0) {
        toast.error("Enter a valid bet");
        return null;
      }
      if (target < MIN_TARGET || target > MAX_TARGET) {
        toast.error(`Target must be ${MIN_TARGET}–${MAX_TARGET}`);
        return null;
      }

      playSound("bet");
      try {
        const res = await api.post<LimboResult>("/originals/limbo/play", {
          betAmount: stake,
          target,
          walletType,
          useBonus,
        });
        const data = res.data;

        setLastResult(data);
        setRecent((prev) => [
          { id: data.gameId, result: data.result, won: data.status === "WON" },
          ...prev.slice(0, 24),
        ]);

        await animateToResult(data);

        if (data.status === "WON") {
          toast.success(`+$${data.payout.toLocaleString("en-US")}`);
        }
        await refreshWallet();

        return {
          won: data.status === "WON",
          payout: data.payout,
        };
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "Bet failed";
        toast.error(msg);
        return null;
      }
    },
    [target, walletType, useBonus, animateToResult, refreshWallet],
  );

  // Manual bet handler.
  const handleManualBet = useCallback(async () => {
    if (busy || autoBusy) return;
    setBusy(true);
    try {
      await placeBet(betAmount);
    } finally {
      setBusy(false);
    }
  }, [busy, autoBusy, placeBet, betAmount]);

  // Spacebar = bet (manual). Ignores typing in inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (!busy && !autoBusy) void handleManualBet();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, autoBusy, handleManualBet]);

  const locked = busy || autoBusy;
  const verdictColor =
    verdict === "win" ? WIN_GREEN : verdict === "lose" ? LOSE_RED : "#e8eaed";
  const targetValid = target >= MIN_TARGET && target <= MAX_TARGET;

  // Horizontal shake on a loss (damped). Keyed so identical losses re-fire.
  const shakeAnim =
    prefersReducedMotion || verdict !== "lose"
      ? {}
      : { x: [0, -9, 8, -6, 4, -2, 0] };

  return (
    <OriginalsShell
      gameKey="limbo"
      title="Limbo"
      historyGameKey="limbo"
      tags={["# Limbo", "# ODD69 Originals", "# Provably Fair"]}
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
              baseBet={betAmount}
              accent={ACCENT}
              disabled={busy || !targetValid || betAmount <= 0}
              onBusyChange={setAutoBusy}
              runBet={placeBet}
            />
          }
          action={
            <button
              type="button"
              onClick={handleManualBet}
              disabled={locked || betAmount <= 0 || !targetValid}
              className="w-full py-4 font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
              style={{ background: ACCENT, color: "#0b0d10" }}
            >
              {busy ? "Rolling…" : "Bet"}
            </button>
          }
        >
          {/* Target Multiplier (the core manual control) */}
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-1.5 block">
              Target Multiplier
            </label>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg overflow-hidden focus-within:border-white/20">
                <input
                  type="number"
                  inputMode="decimal"
                  min={MIN_TARGET}
                  max={MAX_TARGET}
                  step="0.01"
                  value={targetInput}
                  disabled={locked}
                  onChange={(e) => setTargetInput(e.target.value)}
                  onBlur={() =>
                    setTargetInput(
                      clampTarget(parseFloat(targetInput) || MIN_TARGET).toFixed(
                        2,
                      ),
                    )
                  }
                  className="flex-1 bg-transparent py-2.5 px-3 text-white text-sm font-bold outline-none min-w-0"
                  aria-label="Target multiplier"
                />
                <span className="pr-2 text-sm font-bold text-[#9ca3af]">×</span>
                <div className="flex flex-col border-l border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => !locked && adjustTarget(0.1)}
                    disabled={locked}
                    className="px-2 py-1 hover:bg-white/[0.05] text-[#6b7280] hover:text-white transition-colors disabled:opacity-40 text-xs leading-none"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => !locked && adjustTarget(-0.1)}
                    disabled={locked}
                    className="px-2 py-1 hover:bg-white/[0.05] text-[#6b7280] hover:text-white transition-colors disabled:opacity-40 border-t border-white/[0.06] text-xs leading-none"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1 mt-2">
              {[1.5, 2, 5, 10, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => !locked && setTargetInput(v.toFixed(2))}
                  disabled={locked}
                  className="py-1.5 rounded text-[11px] font-bold border transition-all disabled:opacity-40"
                  style={
                    parseFloat(targetInput) === v
                      ? {
                          background: "rgba(255,154,61,0.16)",
                          borderColor: "rgba(255,154,61,0.45)",
                          color: ACCENT,
                        }
                      : {
                          background: "var(--bg-deep-3, #14161c)",
                          borderColor: "rgba(255,255,255,0.06)",
                          color: "#9ca3af",
                        }
                  }
                >
                  {v}×
                </button>
              ))}
            </div>
          </div>

          {/* Win Chance + Profit on Win readouts (animated tween of numbers) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
                Win Chance
              </label>
              <div className="mt-1.5 flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg px-3 py-2.5">
                <TweenNumber
                  value={winChance}
                  suffix="%"
                  decimals={winChance < 1 ? 4 : 2}
                  className="text-white text-sm font-black tabular-nums"
                  reduced={!!prefersReducedMotion}
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
                Profit on Win
              </label>
              <div className="mt-1.5 flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg px-3 py-2.5">
                <span className="text-[#9ca3af] text-sm font-bold mr-1">$</span>
                <TweenNumber
                  value={profitOnWin}
                  decimals={2}
                  className="text-white text-sm font-black tabular-nums truncate"
                  reduced={!!prefersReducedMotion}
                />
              </div>
            </div>
          </div>

          {/* Instant Bet toggle */}
          <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
            <span className="flex items-center gap-1.5 text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
              <Zap size={12} className="text-[#ff9a3d]" />
              Instant Bet
            </span>
            <button
              type="button"
              onClick={() => setInstantBet((v) => !v)}
              aria-pressed={instantBet}
              className="relative w-10 h-5 rounded-full transition-all border flex-shrink-0 cursor-pointer"
              style={
                instantBet
                  ? { background: ACCENT, borderColor: ACCENT }
                  : { background: "var(--bg-deep-3, #14161c)", borderColor: "rgba(255,255,255,0.06)" }
              }
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: instantBet ? 22 : 2 }}
              />
            </button>
          </div>
        </OriginalsControls>
      }
    >
      {/* ── GAME STAGE ──────────────────────────────────────────────────── */}
      <div
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, #1a1207 0%, #12100c 38%, #0a0a0c 100%)",
          minHeight: 360,
        }}
      >
        {/* Faint LIMBO watermark */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{
            color: "rgba(255,255,255,0.02)",
            fontSize: "clamp(80px, 22vw, 240px)",
            fontWeight: 900,
            letterSpacing: "0.08em",
          }}
        >
          LIMBO
        </div>

        {/* Recent results strip */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
          <div className="relative overflow-hidden">
            <div className="flex gap-1.5 items-center overflow-x-auto no-scrollbar py-1">
              {recent.length === 0 ? (
                <span className="text-[#4b5563] text-xs">
                  Your recent rolls appear here
                </span>
              ) : (
                <AnimatePresence initial={false}>
                  {recent.map((r) => (
                    <motion.div
                      key={r.id}
                      layout
                      initial={
                        prefersReducedMotion
                          ? false
                          : { opacity: 0, x: -16, scale: 0.85 }
                      }
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                      <ResultPill r={r} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
            <div
              className="absolute right-0 top-0 h-full w-10 pointer-events-none"
              style={{
                background: "linear-gradient(to left, #0a0a0c, transparent)",
              }}
            />
          </div>
        </div>

        {/* The giant central multiplier — the hero of the game */}
        <motion.div
          key={shakeKey}
          className="relative z-10 text-center"
          animate={shakeAnim}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <motion.div
            key={verdict ?? "rolling"}
            className="font-black tabular-nums"
            initial={false}
            animate={
              verdict && !prefersReducedMotion
                ? { scale: [1, 1.06, 1], y: verdict === "win" ? [0, -4, 0] : 0 }
                : { scale: 1, y: 0 }
            }
            transition={{ duration: 0.32, ease: "easeOut" }}
            style={{
              color: verdictColor,
              fontSize: "clamp(48px, 13vw, 120px)",
              lineHeight: 1,
              textShadow:
                verdict === "win"
                  ? "0 0 40px rgba(0,231,1,0.45)"
                  : verdict === "lose"
                    ? "0 0 30px rgba(237,65,99,0.30)"
                    : "0 0 26px rgba(255,255,255,0.12)",
              transition: "color 0.18s ease, text-shadow 0.18s ease",
            }}
          >
            {displayValue.toFixed(2)}
            <span style={{ fontSize: "0.55em", opacity: 0.85 }}>×</span>
          </motion.div>

          {/* Verdict underline / target reminder */}
          <div className="mt-3 flex items-center justify-center gap-3 text-xs">
            <AnimatePresence mode="wait">
              {verdict ? (
                <motion.div
                  key={`v-${verdict}-${shakeKey}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="font-black uppercase tracking-[0.2em]"
                  style={{ color: verdictColor }}
                >
                  {verdict === "win"
                    ? `WIN · ${lastResult ? lastResult.target.toFixed(2) : ""}×`
                    : "BUST"}
                </motion.div>
              ) : (
                <motion.div
                  key="target-hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[#6b7280] font-bold uppercase tracking-[0.2em]"
                >
                  Target {target.toFixed(2)}× · {winChance < 1 ? winChance.toFixed(4) : winChance.toFixed(2)}%
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Thin verdict frame underline along the bottom of the stage */}
        <AnimatePresence>
          {verdict && (
            <motion.div
              key={`frame-${shakeKey}`}
              initial={{ opacity: 0, scaleX: 0.4 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute bottom-0 left-0 right-0 h-1 origin-center"
              style={{
                background: verdictColor,
                boxShadow: `0 0 16px ${verdictColor}`,
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </OriginalsShell>
  );
}

// ---------------------------------------------------------------------------
// TweenNumber — softly tweens a number toward `value` so the reciprocal
// Win Chance / Profit relationship feels alive as the target changes.
// ---------------------------------------------------------------------------
function TweenNumber({
  value,
  decimals = 2,
  suffix = "",
  className,
  reduced,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  reduced: boolean;
}) {
  const [shown, setShown] = useState(value);
  const ctrlRef = useRef<AnimationPlaybackControls | null>(null);
  const fromRef = useRef(value);

  useEffect(() => {
    ctrlRef.current?.stop();
    if (reduced) {
      // Snap without a synchronous setState in the effect body: schedule the
      // update on a microtask so it doesn't trigger a cascading render.
      fromRef.current = value;
      const id = setTimeout(() => setShown(value), 0);
      return () => clearTimeout(id);
    }
    const from = fromRef.current;
    ctrlRef.current = animate(from, value, {
      duration: 0.12,
      ease: "easeOut",
      onUpdate: (v) => setShown(v),
      onComplete: () => {
        fromRef.current = value;
      },
    });
    return () => ctrlRef.current?.stop();
  }, [value, reduced]);

  const safe = isFinite(shown) ? shown : 0;
  return (
    <span className={className}>
      {safe.toFixed(decimals)}
      {suffix}
    </span>
  );
}
