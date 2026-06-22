"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  motion,
  useAnimationControls,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { gsap } from "gsap";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

interface CoinResult {
  gameId: string;
  pick: "heads" | "tails";
  result: "heads" | "tails";
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
}

// A "big win" threshold for the bigger celebration / sound emphasis.
const BIG_WIN_MULTIPLIER = 5;

// The coin's front (visible at 0deg / multiples of 360) is HEADS; the back
// (visible at 180deg) is TAILS. We always spin several full turns then ease to
// the half-turn that exposes the server-decided face.
function targetRotation(face: "heads" | "tails", spins: number) {
  const fullTurns = spins * 360;
  const faceOffset = face === "heads" ? 0 : 180;
  return fullTurns + faceOffset;
}

export default function CoinflipPage() {
  const { refreshWallet } = useWallet();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [pick, setPick] = useState<"heads" | "tails">("heads");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CoinResult | null>(null);

  // Visual-only state: which face is currently shown to the player. This drives
  // the resting glow + label and is set from the SERVER result, never the
  // animation. While flipping we keep the previous face until the spin resolves.
  const [flipping, setFlipping] = useState(false);

  const prefersReduced = useReducedMotion();
  const coinControls = useAnimationControls();
  const rotationRef = useRef(0); // accumulated rotateY so spins always go forward
  const glowTlRef = useRef<gsap.core.Timeline | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);

  // Clean up any running gsap timeline on unmount.
  useEffect(() => {
    return () => {
      glowTlRef.current?.kill();
      glowTlRef.current = null;
    };
  }, []);

  const play = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Invalid bet");
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<CoinResult>("/originals/coinflip/play", {
        betAmount: bet,
        pick,
        walletType,
        useBonus,
      });
      setResult(res.data);
      if (res.data.status === "WON") {
        toast.success(`+$${res.data.payout.toLocaleString("en-US")}`);
      }
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Flip failed");
    } finally {
      setBusy(false);
    }
  }, [betInput, pick, walletType, useBonus, refreshWallet]);

  // --- VISUAL: react to a new server result and animate the coin to THAT face.
  useEffect(() => {
    if (!result) return;

    let cancelled = false;
    const won = result.status === "WON";
    const big = won && result.multiplier >= BIG_WIN_MULTIPLIER;

    // Kill any leftover glow timeline before starting the spin.
    glowTlRef.current?.kill();
    glowTlRef.current = null;

    const finalRotation = (() => {
      // Choose a forward spin count then add the face offset, ensuring the
      // final value is strictly greater than the current accumulated rotation.
      const spins = prefersReduced ? 0 : 5;
      let target = targetRotation(result.result, spins);
      // Normalise so the coin keeps spinning forward from wherever it rests.
      const current = rotationRef.current;
      const base = Math.floor(current / 360) * 360;
      target += base;
      while (target <= current + (prefersReduced ? 0 : 360)) target += 360;
      return target;
    })();

    const runGlow = () => {
      if (cancelled || !haloRef.current) return;
      const color = won
        ? "rgba(16,185,129,0.65)" // emerald
        : "rgba(239,68,68,0.55)"; // red
      glowTlRef.current = gsap.timeline();
      glowTlRef.current
        .fromTo(
          haloRef.current,
          { opacity: 0, scale: 0.6 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.25,
            ease: "power2.out",
            "--glow-color": color,
          } as gsap.TweenVars,
        )
        .to(haloRef.current, {
          opacity: won ? 0.85 : 0.55,
          scale: 1.06,
          duration: 1.1,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
    };

    const onSettled = () => {
      if (cancelled) return;
      setFlipping(false);
      runGlow();
      if (won) {
        playSound("win");
        if (big) {
          fireBigWin();
        } else {
          // Fire near the coin's centre for a localised burst.
          const rect = haloRef.current?.getBoundingClientRect();
          if (rect) fireWin(rect.left + rect.width / 2, rect.top + rect.height / 2);
          else fireWin();
        }
      } else {
        playSound("lose");
      }
    };

    // Reduced motion: snap instantly to the final face, then resolve.
    if (prefersReduced) {
      setFlipping(false);
      rotationRef.current = finalRotation;
      coinControls.set({ rotateY: finalRotation });
      onSettled();
      return () => {
        cancelled = true;
      };
    }

    // Full motion: spin many turns and ease to the server face.
    setFlipping(true);
    playSound("bet");
    rotationRef.current = finalRotation;
    void coinControls
      .start({
        rotateY: finalRotation,
        transition: {
          duration: 2.1,
          ease: [0.16, 0.62, 0.2, 1], // fast launch, long settle
        },
      })
      .then(() => {
        onSettled();
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Idle wobble before any result — gentle continuous rotateY for "alive" feel.
  useEffect(() => {
    if (result || flipping || prefersReduced) return;
    const ctrl = coinControls;
    void ctrl.start({
      rotateY: [rotationRef.current, rotationRef.current + 14, rotationRef.current],
      transition: { duration: 3.2, ease: "easeInOut", repeat: Infinity },
    });
    return () => {
      ctrl.stop();
    };
  }, [result, flipping, prefersReduced, coinControls]);

  const showFace: "heads" | "tails" | null = flipping ? null : result?.result ?? null;
  const won = result?.status === "WON";
  const lost = result?.status === "LOST";

  return (
    <OriginalsShell
      gameKey="coinflip"
      title="Coinflip"
      tags={["# Coinflip", "# ODD69 Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={busy}
          accent="#ff9a3d"
          action={
            <button
              type="button"
              onClick={play}
              disabled={busy}
              className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? "Flipping…" : "Flip × 1.96"}
            </button>
          }
        >
          {/* Pick */}
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Your Call
            </label>
            <div className="grid grid-cols-2 gap-1">
              {(["heads", "tails"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => !busy && setPick(p)}
                  className={`py-2 rounded text-xs font-bold uppercase transition-colors ${
                    pick === p
                      ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400/40"
                      : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                  }`}
                >
                  {p}
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
            "radial-gradient(ellipse at 50% 30%, #241804 0%, #181004 40%, #0f0902 100%)",
          minHeight: 360,
          perspective: "1200px",
        }}
      >
        {/* Status */}
        <AnimatePresence mode="wait">
          <motion.div
            key={
              flipping
                ? "flipping"
                : result
                  ? `${result.status}-${result.result}`
                  : `idle-${pick}`
            }
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            className={`absolute top-4 left-1/2 -translate-x-1/2 text-xs font-semibold px-4 py-1.5 backdrop-blur-md rounded-full border whitespace-nowrap ${
              won
                ? "text-emerald-200 bg-emerald-500/10 border-emerald-400/30"
                : lost
                  ? "text-red-200 bg-red-500/10 border-red-400/30"
                  : "text-[#9ca3af] bg-black/40 border-white/[0.06]"
            }`}
          >
            {flipping
              ? "Flipping…"
              : result
                ? result.status === "WON"
                  ? `🎉 ${result.result.toUpperCase()} · +$${result.payout.toLocaleString("en-US")}`
                  : `${result.result.toUpperCase()} · no payout`
                : `You picked ${pick.toUpperCase()}`}
          </motion.div>
        </AnimatePresence>

        {/* Coin stage */}
        <div className="mt-12 relative flex items-center justify-center">
          {/* Result halo (animated by gsap on settle) */}
          <div
            ref={haloRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 -m-6 rounded-full opacity-0"
            style={
              {
                background:
                  "radial-gradient(circle, var(--glow-color, rgba(250,204,21,0.0)) 0%, transparent 70%)",
                ["--glow-color" as string]: "rgba(250,204,21,0)",
              } as React.CSSProperties
            }
          />

          {/* The 3D coin */}
          <motion.div
            className="relative w-48 h-48"
            style={{ transformStyle: "preserve-3d" }}
            animate={coinControls}
            initial={{ rotateY: 0 }}
          >
            {/* HEADS — front face (0deg) */}
            <CoinFace
              side="heads"
              label="H"
              state={
                !flipping && showFace === "heads"
                  ? won
                    ? "win"
                    : lost
                      ? "lose"
                      : "idle"
                  : "idle"
              }
            />
            {/* TAILS — back face (rotated 180deg) */}
            <div
              className="absolute inset-0"
              style={{
                transform: "rotateY(180deg)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <CoinFace
                side="tails"
                label="T"
                state={
                  !flipping && showFace === "tails"
                    ? won
                      ? "win"
                      : lost
                        ? "lose"
                        : "idle"
                    : "idle"
                }
              />
            </div>
          </motion.div>

          {/* Ground shadow that reacts subtly to flipping */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 h-4 w-40 rounded-[100%]"
            style={{
              background:
                "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)",
              filter: "blur(4px)",
            }}
            animate={
              prefersReduced
                ? { opacity: 0.5 }
                : flipping
                  ? { scaleX: [1, 0.7, 1], opacity: [0.5, 0.3, 0.5] }
                  : { scaleX: 1, opacity: 0.5 }
            }
            transition={
              flipping
                ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.4 }
            }
          />
        </div>

        {/* Sub caption */}
        <div className="mt-16 text-[10px] uppercase tracking-[0.2em] text-[#6b7280] font-bold">
          {flipping
            ? "in the air"
            : result
              ? result.result
              : "place a bet"}
        </div>
      </div>
    </OriginalsShell>
  );
}

// ---------------------------------------------------------------------------
// CoinFace — a single side of the coin with idle/win/lose visual states.
// ---------------------------------------------------------------------------
function CoinFace({
  side,
  label,
  state,
}: {
  side: "heads" | "tails";
  label: string;
  state: "idle" | "win" | "lose";
}) {
  const borderClass =
    state === "win"
      ? "border-emerald-400 shadow-[0_0_60px_rgba(16,185,129,0.55)]"
      : state === "lose"
        ? "border-red-400 shadow-[0_0_60px_rgba(239,68,68,0.45)]"
        : "border-yellow-400/60 shadow-[0_0_40px_rgba(250,204,21,0.3)]";

  return (
    <div
      className={`absolute inset-0 rounded-full border-[10px] flex flex-col items-center justify-center bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-700 transition-[box-shadow,border-color] duration-500 ${borderClass}`}
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      {/* engraved ring */}
      <div className="absolute inset-3 rounded-full border-2 border-yellow-900/25" />
      {/* radial sheen */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 28%, rgba(255,255,255,0.55) 0%, transparent 45%)",
        }}
      />
      <div className="relative text-yellow-900 text-7xl font-black drop-shadow-sm">
        {label}
      </div>
      <div className="relative text-[10px] text-yellow-900/80 uppercase tracking-wider font-bold">
        {side}
      </div>
    </div>
  );
}
