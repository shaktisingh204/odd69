"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import OriginalsAutoBet from "@/components/originals/OriginalsAutoBet";
import { useWallet } from "@/context/WalletContext";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

interface JackpotResult {
  gameId: string;
  tier: "BUST" | "MINI" | "SMALL" | "BIG" | "MEGA" | "GRAND";
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
}

type TierName = JackpotResult["tier"];

interface TierDef {
  tier: TierName;
  mult: number;
  /** hit probability (matches backend resolveTier cumulative table) */
  prob: number;
  /** strip cell colours */
  from: string;
  to: string;
  text: string;
  glow: string;
}

// Probabilities mirror the backend resolveTier() cumulative table (RTP 97.5%).
const TIERS: TierDef[] = [
  { tier: "BUST", mult: 0, prob: 0.6375, from: "#1f2733", to: "#0e131b", text: "#94a3b8", glow: "rgba(148,163,184,0.5)" },
  { tier: "MINI", mult: 1.4, prob: 0.238, from: "#0f3d2e", to: "#0a241c", text: "#6ee7b7", glow: "rgba(16,185,129,0.55)" },
  { tier: "SMALL", mult: 2.8, prob: 0.1, from: "#0c3a44", to: "#082329", text: "#67e8f9", glow: "rgba(34,211,238,0.55)" },
  { tier: "BIG", mult: 8, prob: 0.02, from: "#5a2a06", to: "#321704", text: "#ffb066", glow: "rgba(255,154,61,0.7)" },
  { tier: "MEGA", mult: 28, prob: 0.004, from: "#5a0f3a", to: "#320824", text: "#f9a8d4", glow: "rgba(236,72,153,0.7)" },
  { tier: "GRAND", mult: 180, prob: 0.0005, from: "#5a4406", to: "#322603", text: "#fde047", glow: "rgba(250,204,21,0.85)" },
];

const RTP = 97.5;

const TIER_INDEX: Record<TierName, number> = TIERS.reduce(
  (acc, t, i) => ((acc[t.tier] = i), acc),
  {} as Record<TierName, number>,
);

const BIG_TIERS: ReadonlySet<TierName> = new Set<TierName>(["BIG", "MEGA", "GRAND"]);
const HUGE_TIERS: ReadonlySet<TierName> = new Set<TierName>(["MEGA", "GRAND"]);

// Reel geometry — one cell tall window, cells stacked vertically.
const CELL_H = 96; // px, must match the rendered cell height below
// The reel is built by repeating the 6 tiers many times so a long spin always
// has runway; we land on a target copy near the end.
const REPEATS = 16;
const TARGET_LOOP = 12; // which repeat we decelerate into (leaves loops for runway)

const MAX_HISTORY = 15;

interface HistoryChip {
  id: number;
  tier: TierName;
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function fmtChance(p: number): string {
  if (p >= 0.01) return (p * 100).toFixed(p >= 0.1 ? 1 : 2) + "%";
  return (p * 100).toFixed(p < 0.001 ? 3 : 2) + "%";
}

function TierCell({ def, dim }: { def: TierDef; dim?: boolean }) {
  return (
    <div
      className="relative flex items-center justify-between px-5"
      style={{
        height: CELL_H,
        background: `linear-gradient(135deg, ${def.from}, ${def.to})`,
        opacity: dim ? 0.55 : 1,
      }}
    >
      {/* left rail accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: def.glow }}
      />
      <div className="flex flex-col">
        <span
          className="text-[11px] font-black uppercase tracking-[0.18em]"
          style={{ color: def.text, opacity: 0.85 }}
        >
          {def.tier}
        </span>
        <span className="text-2xl font-black text-white tabular-nums">
          ×{def.mult}
        </span>
      </div>
      <span
        className="text-3xl font-black tabular-nums"
        style={{ color: def.text, textShadow: `0 0 18px ${def.glow}` }}
      >
        {def.mult === 0 ? "—" : `×${def.mult}`}
      </span>
    </div>
  );
}

export default function JackpotPage() {
  const { refreshWallet } = useWallet();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [busy, setBusy] = useState(false); // single manual spin
  const [autoBusy, setAutoBusy] = useState(false); // auto session running
  const [result, setResult] = useState<JackpotResult | null>(null);

  // Visual-only state: which tier the reel has visually settled on, and whether
  // we are mid-spin. These never influence the bet/payout — they only mirror the
  // server result once the animation completes.
  const [landedTier, setLandedTier] = useState<TierName | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [flash, setFlash] = useState(false); // gold screen-wide burst overlay
  const [history, setHistory] = useState<HistoryChip[]>([]);
  const [displayPayout, setDisplayPayout] = useState(0); // count-up value

  const prefersReduced = useReducedMotion();

  const reelRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const settleTweenRef = useRef<gsap.core.Tween | null>(null);
  const shakeTweenRef = useRef<gsap.core.Tween | null>(null);
  const countTweenRef = useRef<gsap.core.Tween | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickStateRef = useRef<number>(-1);
  const historyId = useRef(0);

  const bet = parseFloat(betInput) || 0;

  // Clean up any running gsap tweens / timers on unmount.
  useEffect(() => {
    const strip = stripRef.current;
    const stage = stageRef.current;
    return () => {
      tlRef.current?.kill();
      settleTweenRef.current?.kill();
      shakeTweenRef.current?.kill();
      countTweenRef.current?.kill();
      if (strip) gsap.killTweensOf(strip);
      if (stage) gsap.killTweensOf(stage);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Park the idle strip on the last landed tier (or BUST baseline) when not spinning.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || spinning) return;
    const tier = landedTier ?? "BUST";
    const idx = TARGET_LOOP * TIERS.length + TIER_INDEX[tier];
    gsap.set(strip, { y: -(idx * CELL_H) });
  }, [spinning, landedTier]);

  /**
   * Multi-phase mechanical reel spin → lands on the SERVER tier. Pure
   * visualisation; resolves once the strip is locked on `tier`.
   *
   * Phases: wind-up kick → ease-in accel → cruise → power4.out decel →
   * (anticipation slow-crawl one cell before BIG/MEGA/GRAND) → elastic settle.
   */
  const animateToTier = useCallback(
    (tier: TierName) =>
      new Promise<void>((resolve) => {
        const strip = stripRef.current;
        const targetIdx = TARGET_LOOP * TIERS.length + TIER_INDEX[tier];
        const finalY = -(targetIdx * CELL_H);

        // Reduced motion: snap straight to the result, no spin.
        if (prefersReduced || !strip) {
          if (strip) gsap.set(strip, { y: finalY });
          resolve();
          return;
        }

        tlRef.current?.kill();
        settleTweenRef.current?.kill();
        gsap.killTweensOf(strip);
        tickStateRef.current = -1;

        const big = BIG_TIERS.has(tier);
        // One cell before the target (the "almost slides past" anticipation cell).
        const anticipateY = finalY + CELL_H;
        // Long runway start, several loops above the target.
        const startIdx = (TARGET_LOOP - 7) * TIERS.length + TIER_INDEX[tier];
        const startY = -(startIdx * CELL_H);
        // A point partway down to mark the cruise → decel boundary.
        const cruiseIdx = (TARGET_LOOP - 2) * TIERS.length + TIER_INDEX[tier];
        const cruiseY = -(cruiseIdx * CELL_H);

        const onTick = () => {
          const yNow = (gsap.getProperty(strip, "y") as number) || 0;
          const passing = Math.round(-yNow / CELL_H);
          if (passing !== tickStateRef.current) {
            tickStateRef.current = passing;
            playSound("tick");
          }
        };

        const tl = gsap.timeline({
          onUpdate: onTick,
          onComplete: () => {
            // SETTLE — small overshoot + elastic recovery (the mechanical "lock").
            settleTweenRef.current = gsap.fromTo(
              strip,
              { y: finalY + 10 },
              {
                y: finalY,
                duration: 0.32,
                ease: "elastic.out(1, 0.55)",
                onComplete: () => resolve(),
              },
            );
          },
        });
        tlRef.current = tl;

        // 1) WIND-UP — tiny reverse kick opposite the spin direction.
        tl.set(strip, { y: startY });
        tl.to(strip, { y: startY + 10, duration: 0.1, ease: "power2.out" });
        // 2) ACCELERATION — ease-in ramp to top speed.
        tl.to(strip, {
          y: startY - CELL_H * 2,
          duration: 0.36,
          ease: "power2.in",
        });
        // 3) TOP-SPEED HOLD — near-constant velocity cruise window.
        tl.to(strip, {
          y: cruiseY,
          duration: 0.95,
          ease: "none",
        });

        if (big) {
          // 4) DECELERATION down to one cell before the target.
          tl.to(strip, {
            y: anticipateY,
            duration: 1.0,
            ease: "power4.out",
          });
          // 5) ANTICIPATION HOLD — slow crawl so the top tier "almost" slides past.
          tl.to(strip, {
            y: finalY,
            duration: 0.5,
            ease: "power2.inOut",
          });
        } else {
          // 4) DECELERATION straight onto the target (no anticipation for low tiers).
          tl.to(strip, {
            y: finalY,
            duration: 1.15,
            ease: "power4.out",
          });
        }
      }),
    [prefersReduced],
  );

  /** Brief screen-shake on the play stage (MEGA / GRAND only). */
  const shakeStage = useCallback(
    (intensity: number) => {
      const stage = stageRef.current;
      if (!stage || prefersReduced) return;
      shakeTweenRef.current?.kill();
      shakeTweenRef.current = gsap.fromTo(
        stage,
        { x: -intensity },
        {
          x: 0,
          duration: 0.45,
          ease: "elastic.out(1.4, 0.25)",
          onComplete: () => gsap.set(stage, { x: 0 }),
        },
      );
    },
    [prefersReduced],
  );

  /** Count the payout number up from 0 → payout (BIG+ tiers). */
  const countUp = useCallback(
    (to: number) => {
      countTweenRef.current?.kill();
      if (prefersReduced) {
        setDisplayPayout(to);
        return;
      }
      const obj = { v: 0 };
      countTweenRef.current = gsap.to(obj, {
        v: to,
        duration: 0.7,
        ease: "power2.out",
        onUpdate: () => setDisplayPayout(obj.v),
        onComplete: () => setDisplayPayout(to),
      });
    },
    [prefersReduced],
  );

  /** Escalating celebration scaled by tier. */
  const celebrate = useCallback(
    (data: JackpotResult) => {
      const tier = data.tier;
      if (data.status !== "WON") {
        playSound("lose");
        return;
      }
      playSound("win");
      const big = BIG_TIERS.has(tier);
      const huge = HUGE_TIERS.has(tier);

      if (big) {
        countUp(data.payout);
      } else {
        setDisplayPayout(data.payout);
      }

      if (!big) {
        // MINI / SMALL — light confetti + chime (sound already played).
        fireWin();
        return;
      }

      // BIG / MEGA / GRAND.
      fireWin();
      if (huge) fireBigWin();
      if (tier === "MEGA") shakeStage(3);
      if (tier === "GRAND") shakeStage(5);

      if (huge) {
        setFlash(true);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(
          () => setFlash(false),
          tier === "GRAND" ? 1200 : 900,
        );
      }
    },
    [countUp, shakeStage],
  );

  /**
   * Place ONE bet (server-authoritative) and play the reel → returns the
   * outcome for the auto-bet engine. Shared by manual + auto.
   */
  const placeBet = useCallback(
    async (
      amount: number,
    ): Promise<{ won: boolean; payout: number } | null> => {
      if (!amount || amount <= 0) {
        toast.error("Invalid bet");
        return null;
      }
      setResult(null);
      setLandedTier(null);
      setFlash(false);
      setDisplayPayout(0);
      setSpinning(true);
      tickStateRef.current = -1;
      playSound("bet");

      try {
        const res = await api.post<JackpotResult>("/originals/jackpot/play", {
          betAmount: amount,
          walletType,
          useBonus,
        });
        const data = res.data;
        setResult(data);

        // Visualise the SERVER tier: spin the reel and land on data.tier.
        await animateToTier(data.tier);

        setSpinning(false);
        setLandedTier(data.tier);

        // Push into the multiplier-history strip (newest first).
        historyId.current += 1;
        setHistory((h) =>
          [{ id: historyId.current, tier: data.tier }, ...h].slice(
            0,
            MAX_HISTORY,
          ),
        );

        celebrate(data);

        if (data.status === "WON") {
          toast.success(
            `${data.tier} ×${data.multiplier} · +$${fmtUsd(data.payout)}`,
          );
        }

        await refreshWallet();
        return { won: data.status === "WON", payout: data.payout };
      } catch (e: any) {
        setSpinning(false);
        toast.error(e?.response?.data?.message || "Spin failed");
        return null;
      }
    },
    [walletType, useBonus, animateToTier, celebrate, refreshWallet],
  );

  // Manual single spin.
  const play = useCallback(async () => {
    if (busy || autoBusy) return;
    setBusy(true);
    try {
      await placeBet(bet);
    } finally {
      setBusy(false);
    }
  }, [busy, autoBusy, bet, placeBet]);

  // Keyboard: Space / Enter = spin (manual, when idle).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.code === "Space" || e.code === "Enter") && !busy && !autoBusy) {
        e.preventDefault();
        void play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play, busy, autoBusy]);

  const won = result?.status === "WON" && !!landedTier;
  const landedDef = landedTier ? TIERS[TIER_INDEX[landedTier]] : null;
  const isBigWin = won && landedTier ? BIG_TIERS.has(landedTier) : false;
  const locked = busy || autoBusy;

  // Live projections off the current bet.
  const grandTier = TIERS[TIERS.length - 1];
  const potentialGrand = bet * grandTier.mult;

  // The repeated strip cells.
  const stripCells: TierDef[] = [];
  for (let r = 0; r < REPEATS; r++) {
    for (let i = 0; i < TIERS.length; i++) stripCells.push(TIERS[i]);
  }

  return (
    <OriginalsShell
      gameKey="jackpot"
      title="Jackpot"
      tags={["# Jackpot", "# ODD69 Originals", "# Provably Fair"]}
      historyGameKey="jackpot"
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={locked}
          accent="#ff7a1a"
          footer={
            <div className="rounded-lg bg-bg-deep-3 border border-white/[0.06] p-3 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[#6b7280]">Win on GRAND ×180</span>
                <span className="font-black tabular-nums text-[#fde047]">
                  ${fmtUsd(potentialGrand)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b7280]">Theoretical RTP</span>
                <span className="font-black tabular-nums text-[#9ca3af]">
                  {RTP}%
                </span>
              </div>
            </div>
          }
          autoPanel={
            <OriginalsAutoBet
              baseBet={bet}
              accent="#ff7a1a"
              disabled={bet <= 0}
              onBusyChange={setAutoBusy}
              runBet={(b) => placeBet(b)}
            />
          }
          action={
            <button
              type="button"
              onClick={play}
              disabled={locked}
              className="w-full py-4 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? "Rolling…" : "Spin Jackpot"}
            </button>
          }
        />
      }
    >
      <div
        ref={stageRef}
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #2a1404 0%, #1b0d03 40%, #100702 100%)",
          minHeight: 360,
        }}
      >
        {/* status pill */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06]">
          {spinning
            ? "Spinning the reel…"
            : result
              ? result.status === "WON"
                ? `🎉 ${result.tier} × ${result.multiplier} · +$${fmtUsd(result.payout)}`
                : `${result.tier} · Bust`
              : "Spin for the jackpot"}
        </div>

        {/* multiplier-history strip (top-left), newest slides in from the right */}
        {history.length > 0 && (
          <div className="absolute top-4 left-4 z-20 hidden sm:flex items-center gap-1 max-w-[55%] overflow-hidden">
            <AnimatePresence initial={false}>
              {history.map((chip) => {
                const def = TIERS[TIER_INDEX[chip.tier]];
                return (
                  <motion.span
                    key={chip.id}
                    layout
                    initial={
                      prefersReduced
                        ? { opacity: 0 }
                        : { opacity: 0, x: 24, scale: 0.6 }
                    }
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-black tabular-nums"
                    style={{
                      background: `linear-gradient(135deg, ${def.from}, ${def.to})`,
                      color: def.text,
                      boxShadow: `inset 0 0 0 1px ${def.glow}`,
                    }}
                  >
                    {def.mult === 0 ? "—" : `×${def.mult}`}
                  </motion.span>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* screen-wide gold burst on huge wins */}
        <AnimatePresence>
          {flash && !prefersReduced && (
            <motion.div
              key="goldflash"
              className="pointer-events-none absolute inset-0 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.85, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              style={{
                background:
                  "radial-gradient(ellipse at 50% 45%, rgba(253,224,71,0.55) 0%, rgba(255,154,61,0.28) 35%, rgba(255,154,61,0) 70%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* ── THE REEL ───────────────────────────────────────── */}
        <div className="relative mt-10 flex flex-col items-center">
          {/* GRAND label above */}
          <div className="mb-3 text-[11px] font-black uppercase tracking-[0.32em] text-[#fde047]/70">
            ◆ Jackpot Reel ◆
          </div>

          <motion.div
            ref={reelRef}
            className="relative rounded-2xl border overflow-hidden"
            style={{
              width: 320,
              height: CELL_H, // single-cell viewing window
              borderColor: won
                ? landedDef?.glow ?? "rgba(255,210,74,0.8)"
                : "rgba(255,255,255,0.10)",
              boxShadow: won
                ? `0 0 0 2px ${landedDef?.glow ?? "rgba(255,210,74,0.6)"}, 0 0 48px ${landedDef?.glow ?? "rgba(255,210,74,0.45)"}`
                : "0 14px 40px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)",
            }}
            animate={
              won && !prefersReduced
                ? { scale: [1, isBigWin ? 1.14 : 1.07, 1] }
                : { scale: 1 }
            }
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* moving strip */}
            <div ref={stripRef} className="will-change-transform">
              {stripCells.map((def, i) => (
                <TierCell key={i} def={def} />
              ))}
            </div>

            {/* top / bottom fade so the window reads as a slot */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-6 z-10"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(8,4,1,0.9), rgba(8,4,1,0))",
              }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-6 z-10"
              style={{
                background:
                  "linear-gradient(to top, rgba(8,4,1,0.9), rgba(8,4,1,0))",
              }}
            />

            {/* center selection guides */}
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-[2px]"
              style={{ background: "rgba(255,154,61,0.5)" }}
            />
            <div
              className="pointer-events-none absolute left-0 right-0 bottom-0 z-10 h-[2px]"
              style={{ background: "rgba(255,154,61,0.5)" }}
            />
          </motion.div>

          {/* pointer carets flanking the window */}
          <div
            className="pointer-events-none absolute z-10"
            style={{ left: -10, top: 30 + CELL_H / 2, transform: "translateY(-50%)" }}
          >
            <span style={{ color: "#ff9a3d", fontSize: 18 }}>▶</span>
          </div>
          <div
            className="pointer-events-none absolute z-10"
            style={{ right: -10, top: 30 + CELL_H / 2, transform: "translateY(-50%)" }}
          >
            <span style={{ color: "#ff9a3d", fontSize: 18 }}>◀</span>
          </div>
        </div>

        {/* ── TIER LADDER / PAYTABLE (multiplier + win-chance %) ── */}
        <div className="mt-8 grid grid-cols-3 sm:grid-cols-6 gap-2 max-w-2xl w-full px-2">
          {TIERS.map((t) => {
            const active = landedTier === t.tier && !spinning;
            return (
              <motion.div
                key={t.tier}
                className="rounded-xl px-2 py-2.5 text-center"
                style={{
                  background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                  boxShadow: active
                    ? `0 0 0 2px ${t.glow}, 0 0 26px ${t.glow}`
                    : "inset 0 0 0 1px rgba(255,255,255,0.04)",
                }}
                animate={
                  active && !prefersReduced
                    ? t.tier === "GRAND"
                      ? { scale: [1, 1.16, 1.08, 1.12, 1.08], y: [0, -3, 0, -2, 0] }
                      : { scale: [1, 1.12, 1.06], y: [0, -2, 0] }
                    : { scale: 1, y: 0 }
                }
                transition={{
                  duration: active && t.tier === "GRAND" ? 0.9 : 0.45,
                  ease: "easeOut",
                  repeat: active && t.tier === "GRAND" && !prefersReduced ? Infinity : 0,
                  repeatType: "reverse",
                }}
              >
                <div
                  className="text-[9px] font-black uppercase tracking-wider"
                  style={{ color: t.text, opacity: active ? 1 : 0.7 }}
                >
                  {t.tier}
                </div>
                <div className="text-base font-black text-white tabular-nums leading-tight">
                  ×{t.mult}
                </div>
                <div
                  className="text-[9px] font-bold tabular-nums mt-0.5"
                  style={{ color: t.text, opacity: 0.65 }}
                >
                  {fmtChance(t.prob)}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* paytable footnote: RTP + max-win cap legibility */}
        <div className="mt-2 text-[10px] text-[#6b7280] font-medium">
          RTP {RTP}% · payout = bet × tier multiplier (capped at max win)
        </div>

        {/* payout banner with count-up */}
        <AnimatePresence>
          {won && landedDef && (
            <motion.div
              key="payout"
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mt-4 px-6 py-2.5 rounded-full font-black text-lg tabular-nums"
              style={{
                color: "#0b0602",
                background: `linear-gradient(135deg, ${landedDef.text}, #ff9a3d)`,
                boxShadow: `0 0 30px ${landedDef.glow}`,
              }}
            >
              +${fmtUsd(displayPayout)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </OriginalsShell>
  );
}
