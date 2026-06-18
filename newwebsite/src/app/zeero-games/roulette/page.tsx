"use client";

import React, { useState, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import { useWallet } from "@/context/WalletContext";
import { Undo2, RotateCcw } from "lucide-react";

const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

type BetKind =
  | "number"
  | "red"
  | "black"
  | "odd"
  | "even"
  | "high"
  | "low"
  | "dozen1"
  | "dozen2"
  | "dozen3"
  | "col1"
  | "col2"
  | "col3";

interface ChipBet {
  kind: BetKind;
  value?: number;
  amount: number;
}

interface RouletteResult {
  gameId: string;
  result: number;
  resultColor: "red" | "black" | "green";
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
}

const CHIP_VALUES = [1, 5, 10, 50, 100, 500, 1000];
const CHIP_COLORS: Record<number, string> = {
  1: "from-emerald-400 to-emerald-600",
  5: "from-cyan-400 to-cyan-600",
  10: "from-violet-400 to-violet-600",
  50: "from-blue-400 to-blue-600",
  100: "from-pink-400 to-pink-600",
  500: "from-amber-400 to-amber-600",
  1000: "from-red-400 to-red-600",
};

const TABLE_ROWS: number[][] = [
  Array.from({ length: 12 }, (_, i) => 3 + i * 3),
  Array.from({ length: 12 }, (_, i) => 2 + i * 3),
  Array.from({ length: 12 }, (_, i) => 1 + i * 3),
];

export default function RoulettePage() {
  const { fiatBalance, cryptoBalance, refreshWallet } = useWallet();
  const [chipValue, setChipValue] = useState<number>(10);
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("fiat");
  const [useBonus, setUseBonus] = useState(false);
  const [bets, setBets] = useState<ChipBet[]>([]);
  const [history, setHistory] = useState<ChipBet[][]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [recentResults, setRecentResults] = useState<RouletteResult[]>([]);
  const [wheelRotation, setWheelRotation] = useState(0);

  const totalStake = useMemo(
    () => bets.reduce((s, b) => s + b.amount, 0),
    [bets],
  );
  const sym = walletType === "crypto" ? "$" : "$";
  const balance = walletType === "crypto" ? cryptoBalance : fiatBalance;

  const placeBet = (kind: BetKind, value?: number) => {
    if (busy) return;
    setResult(null);
    setHistory((h) => [...h, bets]);
    setBets((prev) => {
      const idx = prev.findIndex((b) => b.kind === kind && b.value === value);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], amount: next[idx].amount + chipValue };
        return next;
      }
      return [...prev, { kind, value, amount: chipValue }];
    });
  };
  const undo = () => {
    if (busy || history.length === 0) return;
    setBets(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };
  const clearBets = () => {
    if (busy) return;
    setHistory((h) => (bets.length ? [...h, bets] : h));
    setBets([]);
  };
  const halfBets = () => {
    if (busy) return;
    setHistory((h) => [...h, bets]);
    setBets((prev) =>
      prev
        .map((b) => ({ ...b, amount: Math.max(0, Math.floor(b.amount / 2)) }))
        .filter((b) => b.amount > 0),
    );
  };
  const doubleBets = () => {
    if (busy) return;
    setHistory((h) => [...h, bets]);
    setBets((prev) => prev.map((b) => ({ ...b, amount: b.amount * 2 })));
  };

  const getBetTotal = (kind: BetKind, value?: number) =>
    bets.find((b) => b.kind === kind && b.value === value)?.amount || 0;

  const play = useCallback(async () => {
    if (bets.length === 0) return toast.error("Place at least one chip");
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<RouletteResult>("/originals/roulette/play", {
        bets,
        walletType,
        useBonus,
      });
      setWheelRotation(360 * 6 + (37 - res.data.result) * (360 / 37));
      setResult(res.data);
      setRecentResults((prev) => [res.data, ...prev].slice(0, 12));
      if (res.data.status === "WON") {
        toast.success(`+${sym}${res.data.payout.toLocaleString("en-US")}`);
      } else {
        toast.error(`Landed on ${res.data.result}`);
      }
      setHistory([]);
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Spin failed");
    } finally {
      setBusy(false);
    }
  }, [bets, walletType, useBonus, refreshWallet, sym]);

  const numColor = (n: number) =>
    n === 0 ? "bg-emerald-600" : RED.has(n) ? "bg-red-600" : "bg-slate-800";

  return (
    <OriginalsShell
      gameKey="roulette"
      title="Roulette"
      tags={["# Roulette", "# Zeero Originals", "# Provably Fair"]}
      controls={
        <>
          {/* Manual / Auto tabs (Auto disabled) */}
          <div className="flex border-b border-white/[0.06]">
            <button
              type="button"
              className="flex-1 py-3 text-sm font-bold text-white relative"
            >
              Manual
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400" />
            </button>
            <button
              type="button"
              disabled
              className="flex-1 py-3 text-sm font-bold text-[#3a3d45] cursor-not-allowed"
            >
              Auto
            </button>
          </div>

          <div className="flex-1 p-4 space-y-4">
            {/* Wallet */}
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex bg-bg-deep-3 border border-white/[0.06] rounded-lg overflow-hidden">
                {(["fiat", "crypto"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => !busy && setWalletType(w)}
                    className={`px-3 py-1.5 font-bold uppercase transition-colors ${
                      walletType === w
                        ? "bg-rose-500/20 text-rose-300"
                        : "text-[#6b7280] hover:text-white"
                    }`}
                  >
                    {"USD"}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[#9ca3af]">
                {sym}
                {balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Chip selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
                  Chip Value
                </label>
                <span className="text-[11px] font-mono text-rose-300">
                  {sym}
                  {chipValue}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {CHIP_VALUES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setChipValue(v)}
                    className={`relative aspect-square rounded-full bg-gradient-to-br ${CHIP_COLORS[v]} text-white text-[10px] font-black flex items-center justify-center shadow-md transition-all ${
                      chipValue === v
                        ? "ring-2 ring-yellow-300 scale-110"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>

            {/* Total bet */}
            <div className="bg-bg-deep-3 border border-white/[0.06] rounded-xl p-3 space-y-1">
              <div className="text-[10px] uppercase text-[#6b7280] font-bold tracking-wider">
                Total Bet
              </div>
              <div className="text-xl font-mono font-black text-white">
                {sym}
                {totalStake.toLocaleString("en-US")}
              </div>
              <div className="text-[10px] text-[#6b7280]">
                {bets.length} chip{bets.length === 1 ? "" : "s"} placed
              </div>
            </div>

            {/* Stake controls */}
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={undo}
                disabled={busy || history.length === 0}
                className="flex items-center justify-center py-2 bg-bg-deep-3 border border-white/[0.06] rounded text-[#9ca3af] hover:text-white disabled:opacity-30"
                title="Undo"
              >
                <Undo2 size={13} />
              </button>
              <button
                type="button"
                onClick={halfBets}
                disabled={busy || bets.length === 0}
                className="py-2 bg-bg-deep-3 border border-white/[0.06] rounded text-[#9ca3af] text-[11px] font-bold hover:text-white disabled:opacity-30"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBets}
                disabled={busy || bets.length === 0}
                className="py-2 bg-bg-deep-3 border border-white/[0.06] rounded text-[#9ca3af] text-[11px] font-bold hover:text-white disabled:opacity-30"
              >
                2×
              </button>
              <button
                type="button"
                onClick={clearBets}
                disabled={busy || bets.length === 0}
                className="flex items-center justify-center py-2 bg-bg-deep-3 border border-white/[0.06] rounded text-[#9ca3af] hover:text-white disabled:opacity-30"
                title="Clear"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            {/* Bonus */}
            {walletType === "fiat" && (
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
                  Casino Bonus
                </span>
                <button
                  type="button"
                  onClick={() => setUseBonus(!useBonus)}
                  className={`relative w-10 h-5 rounded-full transition-all border ${
                    useBonus
                      ? "bg-green-500 border-green-500"
                      : "bg-bg-deep-3 border-white/[0.06]"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                      useBonus ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Spin */}
            <button
              type="button"
              onClick={play}
              disabled={busy || bets.length === 0}
              className="w-full py-4 bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? "Spinning…" : "Spin"}
            </button>
          </div>
        </>
      }
    >
      <div
        className="relative w-full h-full flex flex-col items-center p-3 md:p-5 gap-3 overflow-y-auto"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #2b0a10 0%, #1c090d 40%, #110507 100%)",
          minHeight: 360,
        }}
      >
        {/* Status */}
        <div className="text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06]">
          {result
            ? `Landed on ${result.result} (${result.resultColor}) · ${
                result.status === "WON"
                  ? `+${sym}${result.payout.toLocaleString("en-US")}`
                  : "no payout"
              }`
            : "Place chips and spin"}
        </div>

        {/* Wheel */}
        <RouletteWheel rotation={wheelRotation} />

        {/* Recent results */}
        {recentResults.length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-center">
            {recentResults.map((r, i) => (
              <div
                key={i}
                className={`w-7 h-7 rounded-full text-[11px] font-black text-white flex items-center justify-center ${
                  r.result === 0
                    ? "bg-emerald-600"
                    : RED.has(r.result)
                      ? "bg-red-600"
                      : "bg-slate-800"
                } ${i === 0 ? "ring-2 ring-yellow-300" : ""}`}
              >
                {r.result}
              </div>
            ))}
          </div>
        )}

        {/* Number table */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3 space-y-1.5 w-full max-w-3xl">
          <div className="flex items-stretch gap-1 overflow-x-auto">
            {/* Zero */}
            <button
              type="button"
              onClick={() => placeBet("number", 0)}
              disabled={busy}
              className="relative w-10 self-stretch bg-emerald-600 hover:brightness-110 rounded-l-md flex items-center justify-center text-white font-black text-sm flex-shrink-0"
            >
              0
              {getBetTotal("number", 0) > 0 && (
                <ChipBadge value={getBetTotal("number", 0)} />
              )}
            </button>

            <div className="flex-1 min-w-[440px] grid grid-cols-12 grid-rows-3 gap-1">
              {TABLE_ROWS.flatMap((row) =>
                row.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => placeBet("number", n)}
                    disabled={busy}
                    className={`relative ${numColor(n)} hover:brightness-110 rounded text-white text-xs font-black h-9 flex items-center justify-center`}
                  >
                    {n}
                    {getBetTotal("number", n) > 0 && (
                      <ChipBadge value={getBetTotal("number", n)} />
                    )}
                  </button>
                )),
              )}
            </div>

            <div className="grid grid-rows-3 gap-1 w-10 flex-shrink-0">
              {(["col3", "col2", "col1"] as BetKind[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => placeBet(c)}
                  disabled={busy}
                  className="relative bg-white/[0.06] hover:bg-white/[0.12] rounded text-[10px] text-white/80 font-bold h-9"
                >
                  2:1
                  {getBetTotal(c) > 0 && <ChipBadge value={getBetTotal(c)} />}
                </button>
              ))}
            </div>
          </div>

          {/* Dozens */}
          <div className="flex items-stretch gap-1">
            <div className="w-10 flex-shrink-0" />
            <div className="flex-1 grid grid-cols-3 gap-1 min-w-[440px]">
              {(["dozen1", "dozen2", "dozen3"] as BetKind[]).map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => placeBet(d)}
                  disabled={busy}
                  className="relative py-2 bg-white/[0.06] hover:bg-white/[0.12] rounded text-[11px] text-white/80 font-bold"
                >
                  {`${i + 1}ST 12`}
                  {getBetTotal(d) > 0 && <ChipBadge value={getBetTotal(d)} />}
                </button>
              ))}
            </div>
            <div className="w-10 flex-shrink-0" />
          </div>

          {/* Outside */}
          <div className="flex items-stretch gap-1">
            <div className="w-10 flex-shrink-0" />
            <div className="flex-1 grid grid-cols-6 gap-1 min-w-[440px]">
              <OutsideBtn
                badge={getBetTotal("low")}
                onClick={() => placeBet("low")}
                disabled={busy}
                label="1 to 18"
              />
              <OutsideBtn
                badge={getBetTotal("even")}
                onClick={() => placeBet("even")}
                disabled={busy}
                label="EVEN"
              />
              <OutsideBtn
                badge={getBetTotal("red")}
                onClick={() => placeBet("red")}
                disabled={busy}
                label=""
                className="bg-red-600 hover:brightness-110"
              />
              <OutsideBtn
                badge={getBetTotal("black")}
                onClick={() => placeBet("black")}
                disabled={busy}
                label=""
                className="bg-slate-800 hover:brightness-110"
              />
              <OutsideBtn
                badge={getBetTotal("odd")}
                onClick={() => placeBet("odd")}
                disabled={busy}
                label="ODD"
              />
              <OutsideBtn
                badge={getBetTotal("high")}
                onClick={() => placeBet("high")}
                disabled={busy}
                label="19 to 36"
              />
            </div>
            <div className="w-10 flex-shrink-0" />
          </div>
        </div>
      </div>
    </OriginalsShell>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ChipBadge({ value }: { value: number }) {
  return (
    <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-black rounded-full px-1 min-w-[14px] h-[14px] flex items-center justify-center shadow">
      {value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
    </span>
  );
}

function OutsideBtn({
  label,
  onClick,
  disabled,
  badge,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  badge: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative py-2 rounded text-[11px] font-bold text-white ${
        className || "bg-white/[0.06] hover:bg-white/[0.12]"
      }`}
    >
      {label}
      {badge > 0 && <ChipBadge value={badge} />}
    </button>
  );
}

function RouletteWheel({ rotation }: { rotation: number }) {
  const SEQUENCE = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
  ];
  const N = SEQUENCE.length;
  const SIZE = 220;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 100;
  const seg = 360 / N;
  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <div
        className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        style={{ top: -2 }}
      >
        <div
          className="w-0 h-0"
          style={{
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: "12px solid #A78BFA",
            filter: "drop-shadow(0 2px 3px rgba(167,139,250,0.4))",
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
        {SEQUENCE.map((n, i) => {
          const start = i * seg - seg / 2;
          const end = (i + 1) * seg - seg / 2;
          const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
          const x1 = CX + R * Math.cos(toRad(start));
          const y1 = CY + R * Math.sin(toRad(start));
          const x2 = CX + R * Math.cos(toRad(end));
          const y2 = CY + R * Math.sin(toRad(end));
          const fill =
            n === 0 ? "#059669" : RED.has(n) ? "#dc2626" : "#1e293b";
          return (
            <g key={i}>
              <path
                d={`M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`}
                fill={fill}
                stroke="#0b0d11"
                strokeWidth={0.5}
              />
              <text
                x={CX + (R - 14) * Math.cos(toRad(start + seg / 2))}
                y={CY + (R - 14) * Math.sin(toRad(start + seg / 2))}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="8"
                fill="white"
                fontWeight="bold"
                transform={`rotate(${start + seg / 2 + 90} ${CX + (R - 14) * Math.cos(toRad(start + seg / 2))} ${CY + (R - 14) * Math.sin(toRad(start + seg / 2))})`}
              >
                {n}
              </text>
            </g>
          );
        })}
        <circle
          cx={CX}
          cy={CY}
          r={36}
          fill="#11161f"
          stroke="#1e293b"
          strokeWidth={2}
        />
        <circle cx={CX} cy={CY} r={6} fill="#A78BFA" />
      </svg>
    </div>
  );
}
