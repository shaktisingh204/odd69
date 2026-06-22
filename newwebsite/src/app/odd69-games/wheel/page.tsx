"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";

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

function colorForMultiplier(m: number): string {
  if (m === 0) return "#3a3f4b";
  if (m < 1.3) return "#3b82f6";
  if (m < 2) return "#10b981";
  if (m < 5) return "#a855f7";
  return "#ff9a3d";
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
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [risk, setRisk] = useState<Risk>("low");
  const [segments, setSegments] = useState<SegCount>(20);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WheelResult | null>(null);
  const [preview, setPreview] = useState<WheelPreview | null>(null);
  const [rotation, setRotation] = useState(0);

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

  const wheel = result?.wheelMultipliers || preview?.wheel || [];
  const uniqueMults = useMemo(
    () => Array.from(new Set(wheel)).sort((a, b) => a - b),
    [wheel],
  );

  const play = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Invalid bet");
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<WheelResult>("/originals/wheel/play", {
        betAmount: bet,
        risk,
        segments,
        walletType,
        useBonus,
      });
      const segAngle = 360 / res.data.segments;
      const target =
        360 * 5 + (res.data.segments - res.data.slot) * segAngle - segAngle / 2;
      setRotation(target);
      setResult(res.data);
      if (res.data.status === "WON") {
        toast.success(`+$${res.data.payout.toLocaleString("en-US")}`);
      }
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Spin failed");
    } finally {
      setBusy(false);
    }
  }, [betInput, risk, segments, walletType, useBonus, refreshWallet]);

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
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={busy}
          accent="#38bdf8"
          action={
            <button
              type="button"
              onClick={play}
              disabled={busy}
              className="w-full py-4 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
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
              <span className="text-[11px] font-mono text-sky-300">
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
                    className="absolute left-0 top-0 h-full bg-sky-500 rounded-full transition-all"
                    style={{
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
                  disabled={busy}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-1.5 z-20"
                />
                <div
                  className="absolute top-[-7px] w-5 h-5 bg-white rounded-full border-2 border-sky-500 shadow-lg pointer-events-none transition-all z-10"
                  style={{
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
              {RISKS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => !busy && setRisk(r)}
                  className={`py-1.5 rounded text-[10px] font-bold uppercase ${
                    risk === r
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </OriginalsControls>
      }
    >
      <div
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6 gap-6"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #0a1d31 0%, #081521 40%, #050c14 100%)",
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
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="transition-transform duration-[2500ms] ease-out"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {wheel.map((m, i) => {
              const start = i * segAngle;
              const end = (i + 1) * segAngle;
              return (
                <path
                  key={i}
                  d={arcPath(CX, CY, R_OUT, R_IN, start, end)}
                  fill={colorForMultiplier(m)}
                  stroke="#0b0d11"
                  strokeWidth={1}
                />
              );
            })}
            <circle cx={CX} cy={CY} r={R_IN - 6} fill="#11161f" />
            <circle
              cx={CX}
              cy={CY}
              r={R_IN - 6}
              fill="none"
              stroke="#1e293b"
              strokeWidth={2}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-[10px] uppercase text-[#6b7280] tracking-wider font-bold">
                {risk}
              </div>
              <div className="text-3xl font-black text-white">
                {result ? `× ${result.multiplier.toFixed(2)}` : "·"}
              </div>
            </div>
          </div>
        </div>

        {/* Multiplier pills */}
        {uniqueMults.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
            {uniqueMults.map((m) => {
              const active = result?.multiplier === m;
              return (
                <div
                  key={m}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border-b-4 transition-all ${
                    active ? "scale-110 ring-2 ring-yellow-400/60" : ""
                  }`}
                  style={{
                    borderColor: colorForMultiplier(m),
                    backgroundColor: active
                      ? colorForMultiplier(m)
                      : "rgba(255,255,255,0.04)",
                    color: active ? "#000" : colorForMultiplier(m),
                  }}
                >
                  {m.toFixed(2)}×
                </div>
              );
            })}
          </div>
        )}
      </div>
    </OriginalsShell>
  );
}
