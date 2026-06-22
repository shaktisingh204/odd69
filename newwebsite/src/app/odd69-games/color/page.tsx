"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

type Pick = "red" | "green" | "violet" | "number";

interface ColorResult {
  gameId: string;
  pick: Pick;
  pickNumber?: number;
  result: number;
  resultColors: string[];
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
}

const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function colorsForNumber(n: number) {
  if (n === 0) return ["red", "violet"];
  if (n === 5) return ["green", "violet"];
  if (n % 2 === 1) return ["green"];
  return ["red"];
}

function bg(colors: string[]) {
  if (colors.includes("violet") && colors.length > 1) {
    return colors[0] === "red"
      ? "bg-gradient-to-br from-red-500 to-orange-500"
      : "bg-gradient-to-br from-emerald-500 to-orange-500";
  }
  if (colors[0] === "red") return "bg-red-500";
  if (colors[0] === "green") return "bg-emerald-500";
  return "bg-orange-500";
}

// Solid colour values used for the SVG reel segments.
function fill(colors: string[]) {
  if (colors.includes("violet") && colors.length > 1) {
    return colors[0] === "red" ? "url(#segRedViolet)" : "url(#segGreenViolet)";
  }
  if (colors[0] === "red") return "#ef4444";
  if (colors[0] === "green") return "#10b981";
  return "#ff9a3d";
}

const ACCENT = "#ff9a3d";
const SEG = 36; // 360 / 10 segments
const RING = 150; // svg viewport radius reference

export default function ColorPage() {
  const { refreshWallet } = useWallet();
  const reduceMotion = useReducedMotion();

  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [pick, setPick] = useState<Pick>("red");
  const [pickNumber, setPickNumber] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ColorResult | null>(null);

  // Visual-only state: drives the reveal sequence after the server answers.
  const [spinning, setSpinning] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Animation refs (cleaned up on unmount).
  const ringRef = useRef<SVGGElement | null>(null);
  const rotProxy = useRef({ rot: 0 });
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupAnims = useCallback(() => {
    tweenRef.current?.kill();
    tweenRef.current = null;
    if (tickTimer.current) {
      clearTimeout(tickTimer.current);
      tickTimer.current = null;
    }
  }, []);

  useEffect(() => cleanupAnims, [cleanupAnims]);

  // Apply rotation to the SVG group via gsap proxy.
  const applyRot = useCallback(() => {
    if (ringRef.current) {
      ringRef.current.setAttribute(
        "transform",
        `rotate(${rotProxy.current.rot} ${RING} ${RING})`,
      );
    }
  }, []);

  /**
   * Spin the reel so the pointer (top, 12 o'clock) lands on the server's
   * `result` number. The animation is purely cosmetic — `setResult` already
   * holds the authoritative outcome; this just visualises THAT number.
   */
  const spinTo = useCallback(
    (target: number, onDone: () => void) => {
      cleanupAnims();
      // Segment center angle (segment i is centered at i*SEG). Pointer is at
      // the top, so we rotate the ring backwards to bring `target` under it.
      const base = rotProxy.current.rot % 360;
      const targetAngle = 360 - target * SEG; // bring target to top
      const fullSpins = 6 * 360;
      const to = base + fullSpins + ((targetAngle - base) % 360 + 360) % 360;

      // Soft ticking that thins out as the reel slows (set-interval driven so
      // it tracks wall-clock pacing rather than every animation frame).
      let gap = 55;
      const scheduleTick = () => {
        playSound("tick");
        gap = Math.min(220, gap * 1.13);
        tickTimer.current = setTimeout(scheduleTick, gap);
      };
      tickTimer.current = setTimeout(scheduleTick, gap);

      tweenRef.current = gsap.to(rotProxy.current, {
        rot: to,
        duration: 4,
        ease: "power3.out",
        onUpdate: applyRot,
        onComplete: () => {
          if (tickTimer.current) {
            clearTimeout(tickTimer.current);
            tickTimer.current = null;
          }
          rotProxy.current.rot = to % 360;
          applyRot();
          onDone();
        },
      });
    },
    [applyRot, cleanupAnims],
  );

  const play = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Invalid bet");
    setBusy(true);
    setResult(null);
    setRevealed(false);
    playSound("bet");
    try {
      const res = await api.post<ColorResult>("/originals/color/play", {
        betAmount: bet,
        pick,
        pickNumber: pick === "number" ? pickNumber : undefined,
        walletType,
        useBonus,
      });
      setResult(res.data);

      const finish = (data: ColorResult) => {
        setRevealed(true);
        playSound("reveal");
        if (data.status === "WON") {
          toast.success(`+$${data.payout.toLocaleString("en-US")}`);
          if (data.multiplier >= 4) {
            fireBigWin();
          } else {
            fireWin();
          }
          playSound("win");
        } else {
          playSound("lose");
        }
        setBusy(false);
      };

      if (reduceMotion) {
        // Snap straight to the final result — no long animation.
        rotProxy.current.rot = (360 - res.data.result * SEG) % 360;
        applyRot();
        finish(res.data);
      } else {
        setSpinning(true);
        spinTo(res.data.result, () => {
          setSpinning(false);
          finish(res.data);
        });
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Bet failed";
      toast.error(msg);
      setBusy(false);
    } finally {
      // refreshWallet must always run; outcome handled above.
      await refreshWallet();
    }
  }, [
    betInput,
    pick,
    pickNumber,
    walletType,
    useBonus,
    refreshWallet,
    reduceMotion,
    spinTo,
    applyRot,
  ]);

  // The number the pointer is locked on once revealed (server result).
  const landed = revealed && result ? result.result : null;

  return (
    <OriginalsShell
      gameKey="color"
      title="Color"
      tags={["# Color", "# ODD69 Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={busy}
          accent="#f472b6"
          action={
            <button
              type="button"
              onClick={play}
              disabled={busy}
              className="w-full py-4 bg-pink-500 hover:bg-pink-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? "Spinning…" : "Bet"}
            </button>
          }
        >
          {/* Color picker */}
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Pick
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { c: "red", mult: "×1.92" },
                  { c: "green", mult: "×1.92" },
                  { c: "violet", mult: "×4.8" },
                ] as const
              ).map(({ c, mult }) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => !busy && setPick(c)}
                  className={`py-2 rounded text-[10px] font-bold uppercase flex flex-col items-center gap-0.5 ${
                    pick === c
                      ? c === "red"
                        ? "bg-red-500/30 text-red-200 border border-red-400/50"
                        : c === "green"
                          ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/50"
                          : "bg-orange-500/30 text-orange-200 border border-orange-400/50"
                      : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                  }`}
                >
                  <span>{c}</span>
                  <span className="text-[8px] opacity-70">{mult}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => !busy && setPick("number")}
              className={`mt-2 w-full py-2 rounded text-[10px] font-bold uppercase ${
                pick === "number"
                  ? "bg-pink-500/30 text-pink-200 border border-pink-400/50"
                  : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
              }`}
            >
              Number ×9.6
            </button>
            {pick === "number" && (
              <div className="grid grid-cols-5 gap-1 mt-2">
                {NUMBERS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPickNumber(n)}
                    className={`py-1.5 rounded text-xs font-bold ${
                      pickNumber === n
                        ? "bg-pink-500/30 text-pink-200 border border-pink-400/50"
                        : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </OriginalsControls>
      }
    >
      <div
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #2a0917 0%, #1a0810 40%, #10040a 100%)",
          minHeight: 360,
        }}
      >
        {/* Status banner */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06]">
          {spinning
            ? "Spinning…"
            : landed != null && result
              ? result.status === "WON"
                ? `🎉 ${result.result} (${result.resultColors.join(" + ")}) · +$${result.payout.toLocaleString("en-US")}`
                : `${result.result} (${result.resultColors.join(" + ")}) · no payout`
              : "Pick a color or number"}
        </div>

        {/* ── Spinning reel ring ─────────────────────────────────────── */}
        <div className="relative mt-6" style={{ width: 300, height: 300 }}>
          {/* Glow halo on win */}
          <AnimatePresence>
            {landed != null && result?.status === "WON" && (
              <motion.div
                key="halo"
                className="absolute inset-[-14px] rounded-full pointer-events-none"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,154,61,0.35) 0%, rgba(255,154,61,0) 70%)",
                }}
              />
            )}
          </AnimatePresence>

          {/* Pointer at 12 o'clock */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10">
            <motion.div
              animate={
                spinning && !reduceMotion
                  ? { y: [0, -2, 0] }
                  : { y: 0 }
              }
              transition={{
                repeat: spinning ? Infinity : 0,
                duration: 0.18,
              }}
              style={{
                width: 0,
                height: 0,
                borderLeft: "12px solid transparent",
                borderRight: "12px solid transparent",
                borderTop: `20px solid ${ACCENT}`,
                filter: "drop-shadow(0 2px 6px rgba(255,154,61,0.6))",
              }}
            />
          </div>

          <svg viewBox="0 0 300 300" className="w-full h-full">
            <defs>
              <linearGradient id="segRedViolet" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#ff9a3d" />
              </linearGradient>
              <linearGradient id="segGreenViolet" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#ff9a3d" />
              </linearGradient>
              <radialGradient id="hubGrad" cx="50%" cy="40%" r="70%">
                <stop offset="0%" stopColor="#2a0917" />
                <stop offset="100%" stopColor="#10040a" />
              </radialGradient>
            </defs>

            {/* Outer rim */}
            <circle
              cx={RING}
              cy={RING}
              r={142}
              fill="none"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={4}
            />

            {/* Rotating segment group */}
            <g ref={ringRef} transform={`rotate(0 ${RING} ${RING})`}>
              {NUMBERS.map((n) => {
                const colors = colorsForNumber(n);
                // Segment i spans [i*SEG - SEG/2, i*SEG + SEG/2], centered at
                // the top (-90deg in svg space) so the pointer reads it.
                const start = (n * SEG - SEG / 2 - 90) * (Math.PI / 180);
                const end = (n * SEG + SEG / 2 - 90) * (Math.PI / 180);
                const rOuter = 138;
                const rInner = 58;
                const x1 = RING + rOuter * Math.cos(start);
                const y1 = RING + rOuter * Math.sin(start);
                const x2 = RING + rOuter * Math.cos(end);
                const y2 = RING + rOuter * Math.sin(end);
                const xi2 = RING + rInner * Math.cos(end);
                const yi2 = RING + rInner * Math.sin(end);
                const xi1 = RING + rInner * Math.cos(start);
                const yi1 = RING + rInner * Math.sin(start);
                const d = `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${xi2} ${yi2} A ${rInner} ${rInner} 0 0 0 ${xi1} ${yi1} Z`;

                // Label position (mid radius, mid angle).
                const midAng = (n * SEG - 90) * (Math.PI / 180);
                const rLabel = 100;
                const lx = RING + rLabel * Math.cos(midAng);
                const ly = RING + rLabel * Math.sin(midAng);

                const isWinner = landed === n;

                return (
                  <g key={n}>
                    <path
                      d={d}
                      fill={fill(colors)}
                      stroke="rgba(0,0,0,0.35)"
                      strokeWidth={2}
                      style={{
                        opacity: landed != null && !isWinner ? 0.4 : 1,
                        transition: "opacity 0.35s ease",
                      }}
                    />
                    <text
                      x={lx}
                      y={ly}
                      fill="#fff"
                      fontSize={isWinner ? 26 : 20}
                      fontWeight={900}
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${n * SEG} ${lx} ${ly})`}
                      style={{
                        transition: "font-size 0.25s ease",
                        filter: isWinner
                          ? "drop-shadow(0 0 6px rgba(255,255,255,0.9))"
                          : "none",
                      }}
                    >
                      {n}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Hub */}
            <circle cx={RING} cy={RING} r={54} fill="url(#hubGrad)" />
            <circle
              cx={RING}
              cy={RING}
              r={54}
              fill="none"
              stroke={ACCENT}
              strokeWidth={2}
              opacity={0.6}
            />
          </svg>

          {/* Hub content overlay (server result number) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <AnimatePresence mode="wait">
              {landed != null && result ? (
                <motion.div
                  key={`hub-${result.gameId}`}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 320, damping: 16 }
                  }
                  className="flex flex-col items-center"
                >
                  <span
                    className="text-4xl font-black leading-none"
                    style={{
                      color:
                        result.status === "WON" ? ACCENT : "#e5e7eb",
                      textShadow:
                        result.status === "WON"
                          ? "0 0 18px rgba(255,154,61,0.8)"
                          : "none",
                    }}
                  >
                    {result.result}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest text-[#9ca3af] mt-0.5">
                    {result.resultColors.join("+")}
                  </span>
                </motion.div>
              ) : (
                <motion.span
                  key="hub-idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: spinning ? 0.25 : 0.5 }}
                  exit={{ opacity: 0 }}
                  className="text-2xl font-black text-[#6b7280]"
                >
                  {spinning ? "•" : "?"}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Pick / result chips ─────────────────────────────────────── */}
        <div className="mt-5 flex items-center gap-2 flex-wrap justify-center max-w-md">
          {(["red", "green", "violet"] as const).map((c) => {
            const isWinColor =
              landed != null && result?.resultColors.includes(c);
            const isPicked =
              pick === c || (pick === "number" && false);
            return (
              <motion.div
                key={c}
                animate={
                  isWinColor && result?.status === "WON" && !reduceMotion
                    ? { scale: [1, 1.18, 1] }
                    : { scale: 1 }
                }
                transition={{
                  repeat: isWinColor && result?.status === "WON" ? Infinity : 0,
                  duration: 0.9,
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border ${bg([
                  c,
                ])} ${
                  isWinColor
                    ? "ring-2 ring-[#ff9a3d] border-[#ff9a3d]"
                    : isPicked
                      ? "border-white/40"
                      : "border-transparent opacity-60"
                }`}
                style={{ color: "#fff" }}
              >
                {c}
              </motion.div>
            );
          })}
          {pick === "number" && (
            <motion.div
              animate={
                landed === pickNumber &&
                result?.status === "WON" &&
                !reduceMotion
                  ? { scale: [1, 1.18, 1] }
                  : { scale: 1 }
              }
              transition={{
                repeat:
                  landed === pickNumber && result?.status === "WON"
                    ? Infinity
                    : 0,
                duration: 0.9,
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border bg-pink-500 ${
                landed === pickNumber
                  ? "ring-2 ring-[#ff9a3d] border-[#ff9a3d]"
                  : "border-white/40"
              }`}
              style={{ color: "#fff" }}
            >
              #{pickNumber}
            </motion.div>
          )}
        </div>

        {/* Win multiplier flash */}
        <AnimatePresence>
          {landed != null && result?.status === "WON" && (
            <motion.div
              key={`mult-${result.gameId}`}
              initial={{ opacity: 0, y: 14, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 300, damping: 14 }
              }
              className="mt-3 text-2xl font-black"
              style={{
                color: ACCENT,
                textShadow: "0 0 20px rgba(255,154,61,0.7)",
              }}
            >
              ×{result.multiplier}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </OriginalsShell>
  );
}
