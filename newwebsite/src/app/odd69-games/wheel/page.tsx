"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { toast } from "react-hot-toast";
import { useReducedMotion } from "framer-motion";
import gsap from "gsap";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import OriginalsAutoBet from "@/components/originals/OriginalsAutoBet";
import { useWallet } from "@/context/WalletContext";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

type Risk = "low" | "medium" | "high";
type SegCount = 10 | 20 | 30 | 40 | 50;

interface WheelResult {
  gameId: string;
  risk: Risk;
  slot: number;
  segments: number;
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
  wheelMultipliers: number[];
}
interface WheelPreview {
  risk: Risk;
  segments: number;
  wheel: number[];
  uniqueMultipliers: number[];
}

const RISKS: Risk[] = ["low", "medium", "high"];
const SEGMENT_OPTIONS: SegCount[] = [10, 20, 30, 40, 50];
const ACCENT = "#ff9a3d";

/** Six-tier wedge palette keyed by multiplier band (ODD69 orange = jackpot). */
function colorForMultiplier(m: number): string {
  if (m === 0) return "#3a3f4b"; // gray — loss
  if (m < 1.3) return "#3b82f6"; // blue
  if (m < 2) return "#10b981"; // green
  if (m < 5) return "#a855f7"; // purple
  if (m < 10) return "#facc15"; // yellow
  return ACCENT; // orange — high / jackpot
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startA: number,
  endA: number,
): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const sx1 = cx + rOuter * Math.cos(toRad(startA));
  const sy1 = cy + rOuter * Math.sin(toRad(startA));
  const ex1 = cx + rOuter * Math.cos(toRad(endA));
  const ey1 = cy + rOuter * Math.sin(toRad(endA));
  const sx2 = cx + rInner * Math.cos(toRad(endA));
  const sy2 = cy + rInner * Math.sin(toRad(endA));
  const ex2 = cx + rInner * Math.cos(toRad(startA));
  const ey2 = cy + rInner * Math.sin(toRad(startA));
  const largeArc = endA - startA > 180 ? 1 : 0;
  return [
    `M ${sx1} ${sy1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${ex1} ${ey1}`,
    `L ${sx2} ${sy2}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${ex2} ${ey2}`,
    "Z",
  ].join(" ");
}

export default function WheelPage() {
  const { refreshWallet } = useWallet();
  const reduceMotion = useReducedMotion();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [risk, setRisk] = useState<Risk>("low");
  const [segments, setSegments] = useState<SegCount>(20);
  const [busy, setBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [instant, setInstant] = useState(false);
  const [result, setResult] = useState<WheelResult | null>(null);
  const [preview, setPreview] = useState<WheelPreview | null>(null);
  const [spinning, setSpinning] = useState(false);

  // GSAP-driven spin: the SVG transform is animated directly so the pointer
  // lands EXACTLY on the server-returned slot. `rotationRef` carries the
  // current accumulated angle between spins so each new spin continues from
  // wherever the wheel currently sits.
  const wheelRef = useRef<SVGSVGElement | null>(null);
  const pointerRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef(0);
  const tlRef = useRef<gsap.core.Tween | null>(null);
  const pointerTweenRef = useRef<gsap.core.Tween | null>(null);

  // Keep latest of these readable inside the async play() loop without stale
  // closures (so autobet always sees the current risk/segments/instant).
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const instantRef = useRef(instant);
  instantRef.current = instant;
  const riskRef = useRef(risk);
  riskRef.current = risk;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const walletTypeRef = useRef(walletType);
  walletTypeRef.current = walletType;
  const useBonusRef = useRef(useBonus);
  useBonusRef.current = useBonus;

  // Clean up any in-flight tweens on unmount.
  useEffect(() => {
    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
      pointerTweenRef.current?.kill();
      pointerTweenRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<WheelPreview>(
        `/originals/wheel/preview?risk=${risk}&segments=${segments}`,
      )
      .then((res) => {
        if (!cancelled) setPreview(res.data);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [risk, segments]);

  const wheel = useMemo(
    () => result?.wheelMultipliers || preview?.wheel || [],
    [result, preview],
  );

  // Distribution: distinct multipliers with their wedge counts + probability,
  // sorted ascending. Drives both the pill row and the proportional bar.
  const distribution = useMemo(() => {
    if (wheel.length === 0) return [];
    const counts = new Map<number, number>();
    for (const m of wheel) counts.set(m, (counts.get(m) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([mult, count]) => ({
        mult,
        count,
        prob: count / wheel.length,
      }))
      .sort((a, b) => a.mult - b.mult);
  }, [wheel]);

  // Best (top) multiplier available for the current risk+segments → drives the
  // "Profit on Win" readout (best-case potential payout).
  const topMultiplier = useMemo(
    () => (wheel.length ? Math.max(...wheel) : 0),
    [wheel],
  );
  const betNum = parseFloat(betInput) || 0;
  const maxProfit = betNum > 0 ? betNum * topMultiplier - betNum : 0;

  /**
   * Flick the red pointer/needle as a wedge boundary passes under it. A short
   * kick that springs back — denser ticks late in the spin feel like a
   * ratcheting flywheel. No-op under reduced motion.
   */
  const flickPointer = useCallback(() => {
    if (reduceMotionRef.current || !pointerRef.current) return;
    pointerTweenRef.current?.kill();
    pointerTweenRef.current = gsap.fromTo(
      pointerRef.current,
      { rotation: -11 },
      {
        rotation: 0,
        duration: 0.26,
        ease: "elastic.out(1, 0.4)",
        transformOrigin: "50% 0%",
      },
    );
  }, []);

  /**
   * Place a single bet and visualise the SERVER result. Returns the round
   * outcome `{ won, payout }` once the wheel has settled (so autobet paces
   * itself to the animation), or `null` on error / abort.
   *
   * Used by BOTH the manual Bet button and the OriginalsAutoBet engine.
   */
  const runBet = useCallback(
    async (bet: number): Promise<{ won: boolean; payout: number } | null> => {
      if (!bet || bet <= 0) {
        toast.error("Invalid bet");
        return null;
      }
      setResult(null);
      setSpinning(true);
      playSound("bet");
      try {
        const res = await api.post<WheelResult>("/originals/wheel/play", {
          betAmount: bet,
          risk: riskRef.current,
          segments: segmentsRef.current,
          walletType: walletTypeRef.current,
          useBonus: useBonusRef.current,
        });
        const data = res.data;

        // ---- Visualise the SERVER result -------------------------------
        // Compute the absolute target angle so the top pointer lands EXACTLY
        // on the slot the server returned, resolved against the wheel's
        // current accumulated rotation so it always spins forward.
        const segAng = 360 / data.segments;
        const landingOffset =
          (data.segments - data.slot) * segAng - segAng / 2;
        const current = rotationRef.current;
        const base = Math.ceil(current / 360) * 360;
        // Randomized 4–7 whole turns + the exact landing offset.
        const turns = 4 + Math.floor(Math.random() * 4);
        const target = base + 360 * turns + landingOffset;

        const isWin = data.status === "WON";
        const high = data.multiplier >= 10;
        const celebrate = () => {
          if (isWin) {
            if (high) fireBigWin();
            else fireWin();
            playSound("win");
            toast.success(`+$${data.payout.toLocaleString("en-US")}`);
          } else {
            playSound("lose");
          }
        };

        tlRef.current?.kill();

        const useInstant = instantRef.current;
        const settle = () => {
          rotationRef.current = target;
          setResult(data);
          setSpinning(false);
          celebrate();
        };

        // Await the spin so autobet pacing matches the visual.
        await new Promise<void>((resolve) => {
          if (reduceMotionRef.current || !wheelRef.current) {
            // Reduced motion / no node: snap straight to the final result.
            rotationRef.current = target;
            if (wheelRef.current) {
              gsap.set(wheelRef.current, {
                rotation: target,
                transformOrigin: "50% 50%",
              });
            }
            settle();
            resolve();
            return;
          }

          if (useInstant) {
            // Instant-bet mode: a quick 380ms snap with just the pop + glow.
            tlRef.current = gsap.to(wheelRef.current, {
              rotation: target,
              duration: 0.38,
              ease: "power3.out",
              transformOrigin: "50% 50%",
              onComplete: () => {
                settle();
                resolve();
              },
            });
            return;
          }

          // Full heavy-flywheel spin: a strong ease-out so ~70% of the
          // rotation happens early, then a long visible deceleration with a
          // ratcheting ticker that gets denser as it slows.
          let nextTick = 0.4; // timeline fraction at which to next tick
          const totalSpan = target - current;
          tlRef.current = gsap.to(wheelRef.current, {
            rotation: target,
            duration: 3.3,
            ease: "power4.out",
            transformOrigin: "50% 50%",
            onUpdate: function () {
              const p = this.progress();
              if (p >= nextTick && p < 0.992) {
                playSound("tick");
                flickPointer();
                // Sparse early, denser late — feels like wedges crawling by.
                nextTick += p < 0.85 ? 0.085 : 0.04;
              }
              rotationRef.current = current + totalSpan * p;
            },
            onComplete: () => {
              settle();
              resolve();
            },
          });
        });

        await refreshWallet();
        return { won: isWin, payout: data.payout };
      } catch (e: unknown) {
        setSpinning(false);
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "Spin failed";
        toast.error(msg);
        return null;
      }
    },
    [refreshWallet, flickPointer],
  );

  // Manual Bet button handler.
  const play = useCallback(async () => {
    if (busy || autoBusy) return;
    setBusy(true);
    try {
      await runBet(parseFloat(betInput));
    } finally {
      setBusy(false);
    }
  }, [busy, autoBusy, betInput, runBet]);

  // Spacebar / Enter hotkey to bet (ignored while typing in inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      e.preventDefault();
      if (!busy && !autoBusy) void play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, autoBusy, play]);

  const locked = busy || autoBusy;

  const SIZE = 320;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R_OUT = 150;
  const R_IN = 110;
  const segAngle = wheel.length > 0 ? 360 / wheel.length : 0;

  return (
    <OriginalsShell
      gameKey="wheel"
      title="Wheel"
      tags={["# Wheel", "# ODD69 Originals", "# Provably Fair"]}
      historyGameKey="wheel"
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
              baseBet={betNum}
              accent={ACCENT}
              disabled={betNum <= 0}
              runBet={runBet}
              onBusyChange={setAutoBusy}
            />
          }
          footer={
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-[#6b7280]">Profit on Win (max)</span>
              <span className="font-black tabular-nums" style={{ color: ACCENT }}>
                ${maxProfit.toFixed(2)}
                <span className="text-[#6b7280] font-bold ml-1">
                  · {topMultiplier.toFixed(2)}×
                </span>
              </span>
            </div>
          }
          action={
            <button
              type="button"
              onClick={play}
              disabled={locked}
              className="w-full py-4 disabled:opacity-40 text-[#0b0d10] font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: ACCENT }}
            >
              {busy ? "Spinning…" : "Bet"}
            </button>
          }
        >
          {/* Segments slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
                Segments
              </label>
              <span className="text-[11px] font-mono" style={{ color: ACCENT }}>
                {segments}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white text-sm font-black w-5 text-right">
                10
              </span>
              <div className="relative flex-1 h-1.5 mt-2 mb-2">
                <div className="absolute inset-0 bg-bg-deep-3 rounded-full border border-white/[0.06] overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all"
                    style={{
                      background: ACCENT,
                      width: `${(SEGMENT_OPTIONS.indexOf(segments) / (SEGMENT_OPTIONS.length - 1)) * 100}%`,
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={SEGMENT_OPTIONS.length - 1}
                  step={1}
                  value={SEGMENT_OPTIONS.indexOf(segments)}
                  onChange={(e) =>
                    setSegments(SEGMENT_OPTIONS[Number(e.target.value)])
                  }
                  disabled={locked}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-1.5 z-20"
                />
                <div
                  className="absolute top-[-7px] w-5 h-5 bg-white rounded-full border-2 shadow-lg pointer-events-none transition-all z-10"
                  style={{
                    borderColor: ACCENT,
                    left: `calc(${(SEGMENT_OPTIONS.indexOf(segments) / (SEGMENT_OPTIONS.length - 1)) * 100}% - 10px)`,
                  }}
                />
              </div>
              <span className="text-white text-sm font-black w-5">50</span>
            </div>
          </div>

          {/* Risk picker */}
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Risk Level
            </label>
            <div className="grid grid-cols-3 gap-1">
              {RISKS.map((r) => {
                const active = risk === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => !locked && setRisk(r)}
                    className="py-1.5 rounded text-[10px] font-bold uppercase transition-all"
                    style={
                      active
                        ? {
                            background: "rgba(255,154,61,0.16)",
                            color: ACCENT,
                            border: "1px solid rgba(255,154,61,0.4)",
                          }
                        : undefined
                    }
                  >
                    <span className={active ? "" : "text-[#9ca3af]"}>{r}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Instant Bet toggle */}
          <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
            <span className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
              Instant Bet
            </span>
            <button
              type="button"
              onClick={() => !locked && setInstant((v) => !v)}
              disabled={locked}
              aria-pressed={instant}
              className={`relative w-10 h-5 rounded-full transition-all border flex-shrink-0 ${
                instant ? "" : "bg-bg-deep-3 border-white/[0.06]"
              } ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              style={
                instant ? { background: ACCENT, borderColor: ACCENT } : undefined
              }
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  instant ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </OriginalsControls>
      }
    >
      <div
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6 gap-6"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #2a1606 0%, #1a0f05 40%, #0a0703 100%)",
          minHeight: 360,
        }}
      >
        {/* Status */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06]">
          {result
            ? result.status === "WON"
              ? `🎉 × ${result.multiplier.toFixed(2)} · +$${result.payout.toLocaleString("en-US")}`
              : `× ${result.multiplier.toFixed(2)} · no payout`
            : "Spin the wheel"}
        </div>

        {/* Wheel */}
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <div
            ref={pointerRef}
            className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            style={{ top: 4 }}
          >
            <div
              className="w-0 h-0"
              style={{
                borderLeft: "12px solid transparent",
                borderRight: "12px solid transparent",
                borderTop: "18px solid #f87171",
                filter: "drop-shadow(0 2px 4px rgba(248,113,113,0.5))",
              }}
            />
          </div>
          <svg
            ref={wheelRef}
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{ willChange: "transform" }}
          >
            {wheel.map((m, i) => {
              const start = i * segAngle;
              const end = (i + 1) * segAngle;
              // Highlight the landed segment once the spin has settled.
              const landed = !spinning && result != null && i === result.slot;
              return (
                <path
                  key={i}
                  d={arcPath(CX, CY, R_OUT, R_IN, start, end)}
                  fill={colorForMultiplier(m)}
                  stroke={landed ? "#fff" : "#0b0d11"}
                  strokeWidth={landed ? 2.5 : 1}
                  style={{
                    filter: landed
                      ? `drop-shadow(0 0 10px ${colorForMultiplier(m)})`
                      : undefined,
                    transition: "filter 200ms ease, stroke 200ms ease",
                  }}
                />
              );
            })}
            <circle cx={CX} cy={CY} r={R_IN - 6} fill="#15100a" />
            <circle
              cx={CX}
              cy={CY}
              r={R_IN - 6}
              fill="none"
              stroke="#3a2a14"
              strokeWidth={2}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-[10px] uppercase text-[#6b7280] tracking-wider font-bold">
                {risk}
              </div>
              <div
                key={result ? `${result.slot}-${result.multiplier}` : "idle"}
                className="text-3xl font-black"
                style={{
                  color:
                    !spinning && result
                      ? colorForMultiplier(result.multiplier)
                      : "#fff",
                  animation:
                    !spinning && result && !reduceMotion
                      ? "wheelPop 320ms ease-out"
                      : undefined,
                  textShadow:
                    !spinning && result && result.status === "WON"
                      ? `0 0 16px ${colorForMultiplier(result.multiplier)}`
                      : undefined,
                }}
              >
                {spinning ? "·" : result ? `× ${result.multiplier.toFixed(2)}` : "·"}
              </div>
            </div>
          </div>
          <style jsx>{`
            @keyframes wheelPop {
              0% {
                transform: scale(0.6);
                opacity: 0;
              }
              60% {
                transform: scale(1.18);
                opacity: 1;
              }
              100% {
                transform: scale(1);
              }
            }
          `}</style>
        </div>

        {/* Multiplier pill row */}
        {distribution.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
            {distribution.map(({ mult }) => {
              const active = !spinning && result?.multiplier === mult;
              return (
                <div
                  key={mult}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border-b-4 transition-all ${
                    active ? "scale-110 ring-2 ring-yellow-400/60" : ""
                  }`}
                  style={{
                    borderColor: colorForMultiplier(mult),
                    backgroundColor: active
                      ? colorForMultiplier(mult)
                      : "rgba(255,255,255,0.04)",
                    color: active ? "#000" : colorForMultiplier(mult),
                  }}
                >
                  {mult.toFixed(2)}×
                </div>
              );
            })}
          </div>
        )}

        {/* Proportional multiplier-distribution bar (value + probability) */}
        {distribution.length > 0 && (
          <div className="w-full max-w-2xl px-2">
            <div className="flex w-full h-7 rounded-md overflow-hidden border border-white/[0.06]">
              {distribution.map(({ mult, prob }) => {
                const active = !spinning && result?.multiplier === mult;
                return (
                  <div
                    key={mult}
                    className="relative flex items-center justify-center transition-all"
                    style={{
                      width: `${prob * 100}%`,
                      background: colorForMultiplier(mult),
                      opacity: active ? 1 : 0.78,
                      boxShadow: active
                        ? `inset 0 0 0 2px #fff, 0 0 10px ${colorForMultiplier(mult)}`
                        : undefined,
                      zIndex: active ? 1 : 0,
                    }}
                    title={`${mult.toFixed(2)}× · ${(prob * 100).toFixed(1)}%`}
                  >
                    {prob >= 0.12 && (
                      <span className="text-[9px] font-mono font-black text-black/80 px-1 truncate">
                        {mult.toFixed(2)}×
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2 text-[10px] text-[#6b7280] font-mono">
              {distribution.map(({ mult, count, prob }) => (
                <span key={mult} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-sm"
                    style={{ background: colorForMultiplier(mult) }}
                  />
                  {mult.toFixed(2)}× · {count} · {(prob * 100).toFixed(1)}%
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </OriginalsShell>
  );
}
