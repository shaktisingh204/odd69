"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

interface JackpotResult {
  gameId: string;
  tier: "BUST" | "MINI" | "SMALL" | "BIG" | "MEGA" | "GRAND";
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
}

type TierName = JackpotResult["tier"];

interface TierDef {
  tier: TierName;
  mult: number;
  /** strip cell colours */
  from: string;
  to: string;
  text: string;
  glow: string;
}

const TIERS: TierDef[] = [
  { tier: "BUST", mult: 0, from: "#1f2733", to: "#0e131b", text: "#94a3b8", glow: "rgba(148,163,184,0.5)" },
  { tier: "MINI", mult: 1.4, from: "#0f3d2e", to: "#0a241c", text: "#6ee7b7", glow: "rgba(16,185,129,0.55)" },
  { tier: "SMALL", mult: 2.8, from: "#0c3a44", to: "#082329", text: "#67e8f9", glow: "rgba(34,211,238,0.55)" },
  { tier: "BIG", mult: 8, from: "#5a2a06", to: "#321704", text: "#ffb066", glow: "rgba(255,154,61,0.7)" },
  { tier: "MEGA", mult: 28, from: "#5a0f3a", to: "#320824", text: "#f9a8d4", glow: "rgba(236,72,153,0.7)" },
  { tier: "GRAND", mult: 180, from: "#5a4406", to: "#322603", text: "#fde047", glow: "rgba(250,204,21,0.85)" },
];

const TIER_INDEX: Record<TierName, number> = TIERS.reduce(
  (acc, t, i) => ((acc[t.tier] = i), acc),
  {} as Record<TierName, number>,
);

const BIG_TIERS: ReadonlySet<TierName> = new Set<TierName>(["BIG", "MEGA", "GRAND"]);

// Reel geometry — one cell tall window, cells stacked vertically.
const CELL_H = 96; // px, must match the rendered cell height below
// The reel is built by repeating the 6 tiers many times so a long spin always
// has runway; we land on a target copy near the end.
const REPEATS = 14;
const TARGET_LOOP = 11; // which repeat we decelerate into (leaves loops for runway)

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
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<JackpotResult | null>(null);

  // Visual-only state: which tier the reel has visually settled on, and whether
  // we are mid-spin. These never influence the bet/payout — they only mirror the
  // server result once the animation completes.
  const [landedTier, setLandedTier] = useState<TierName | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [flash, setFlash] = useState(false); // gold screen-wide burst overlay

  const prefersReduced = useReducedMotion();

  const reelRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const idleTweenRef = useRef<gsap.core.Tween | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickStateRef = useRef<number>(-1);

  // Clean up any running gsap tweens / timers on unmount.
  useEffect(() => {
    const strip = stripRef.current;
    const idleTween = idleTweenRef;
    const tween = tweenRef;
    const flashTimer = flashTimerRef;
    return () => {
      tween.current?.kill();
      idleTween.current?.kill();
      if (strip) gsap.killTweensOf(strip);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  // Gentle idle drift when no spin is happening, so the reel feels "alive".
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || spinning || prefersReduced) return;
    // Park the idle strip on the last landed tier (or BUST baseline) and add a
    // subtle floating sheen via a looping y micro-oscillation on the window.
    const tier = landedTier ?? "BUST";
    const idx = TARGET_LOOP * TIERS.length + TIER_INDEX[tier];
    const y = -(idx * CELL_H);
    gsap.set(strip, { y });
    return undefined;
  }, [spinning, landedTier, prefersReduced]);

  /** Drive the reel to a server-returned tier. Pure visualisation. */
  const animateToTier = useCallback(
    (tier: TierName, onDone: () => void) => {
      const strip = stripRef.current;
      const targetIdx = TARGET_LOOP * TIERS.length + TIER_INDEX[tier];
      const finalY = -(targetIdx * CELL_H);

      // Reduced motion: snap straight to the result, no spin.
      if (prefersReduced || !strip) {
        if (strip) gsap.set(strip, { y: finalY });
        onDone();
        return;
      }

      tweenRef.current?.kill();
      gsap.killTweensOf(strip);

      // Start a couple of loops above the target for a long runway.
      const startIdx = (TARGET_LOOP - 6) * TIERS.length + TIER_INDEX[tier];
      gsap.set(strip, { y: -(startIdx * CELL_H) });

      tweenRef.current = gsap.to(strip, {
        y: finalY,
        duration: 3.0,
        ease: "power4.out",
        onUpdate: () => {
          // Mechanical "tick" as cells pass the window, throttled.
          const yNow = (gsap.getProperty(strip, "y") as number) || 0;
          const passing = Math.round(-yNow / CELL_H);
          const last = tickStateRef.current;
          if (passing !== last) {
            tickStateRef.current = passing;
            // Only audible early/mid; near the end gsap slows so ticks naturally space out.
            playSound("tick");
          }
        },
        onComplete: () => {
          // Settle bounce — a tiny overshoot recovery for tactility.
          gsap.fromTo(
            strip,
            { y: finalY + 10 },
            { y: finalY, duration: 0.32, ease: "elastic.out(1, 0.55)" },
          );
          onDone();
        },
      });
    },
    [prefersReduced],
  );

  const play = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Invalid bet");
    setBusy(true);
    setResult(null);
    setLandedTier(null);
    setFlash(false);
    setSpinning(true);
    tickStateRef.current = -1;
    playSound("bet");
    try {
      const res = await api.post<JackpotResult>("/originals/jackpot/play", {
        betAmount: bet,
        walletType,
        useBonus,
      });
      setResult(res.data);

      const data = res.data;

      // Visualise the SERVER tier: spin the reel and land on data.tier.
      animateToTier(data.tier, () => {
        setSpinning(false);
        setLandedTier(data.tier);

        if (data.status === "WON") {
          const isBig = BIG_TIERS.has(data.tier);
          playSound("win");
          fireWin();
          if (isBig) {
            fireBigWin();
            setFlash(true);
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setFlash(false), 900);
          }
          toast.success(
            `${data.tier} ×${data.multiplier} · +$${data.payout.toLocaleString("en-US")}`,
          );
        } else {
          // BUST / lost.
          playSound("lose");
        }
      });

      await refreshWallet();
    } catch (e: any) {
      setSpinning(false);
      toast.error(e?.response?.data?.message || "Spin failed");
    } finally {
      setBusy(false);
    }
  }, [betInput, walletType, useBonus, refreshWallet, animateToTier]);

  const won = result?.status === "WON" && !!landedTier;
  const landedDef = landedTier ? TIERS[TIER_INDEX[landedTier]] : null;
  const isBigWin = won && landedTier ? BIG_TIERS.has(landedTier) : false;

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
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={busy}
          accent="#ff7a1a"
          action={
            <button
              type="button"
              onClick={play}
              disabled={busy}
              className="w-full py-4 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? "Rolling…" : "Spin Jackpot"}
            </button>
          }
        />
      }
    >
      <div
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
                ? `🎉 ${result.tier} × ${result.multiplier} · +$${result.payout.toLocaleString("en-US")}`
                : `${result.tier} · Bust`
              : "Spin for the jackpot"}
        </div>

        {/* screen-wide gold burst on big wins */}
        <AnimatePresence>
          {flash && !prefersReduced && (
            <motion.div
              key="goldflash"
              className="pointer-events-none absolute inset-0 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.85, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
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

        {/* ── TIER LADDER (all tiers, highlights the landed one) ── */}
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
                    ? { scale: [1, 1.12, 1.06], y: [0, -2, 0] }
                    : { scale: 1, y: 0 }
                }
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                <div
                  className="text-[9px] font-black uppercase tracking-wider"
                  style={{ color: t.text, opacity: active ? 1 : 0.7 }}
                >
                  {t.tier}
                </div>
                <div className="text-base font-black text-white tabular-nums">
                  ×{t.mult}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* payout banner */}
        <AnimatePresence>
          {won && landedDef && (
            <motion.div
              key="payout"
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mt-5 px-6 py-2.5 rounded-full font-black text-lg tabular-nums"
              style={{
                color: "#0b0602",
                background: `linear-gradient(135deg, ${landedDef.text}, #ff9a3d)`,
                boxShadow: `0 0 30px ${landedDef.glow}`,
              }}
            >
              +${result?.payout.toLocaleString("en-US")}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </OriginalsShell>
  );
}
