"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import { ChevronUp, ChevronDown, Info, Zap, Volume2, VolumeX, BarChart3, Clock } from "lucide-react";
import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { useModal } from "@/context/ModalContext";
import { useOriginalsAccess } from "@/hooks/useOriginalsAccess";
import { useGameSounds } from "@/hooks/useGameSounds";
import { getConfiguredSocketNamespace } from "@/utils/socketUrl";

type WalletType = "fiat" | "crypto";
type PlinkoRisk = "low" | "medium" | "high";
type PlinkoRows = 8 | 12 | 16;

interface PlinkoResult {
  gameId: string;
  rows: PlinkoRows;
  risk: PlinkoRisk;
  path: number[];
  slotIndex: number;
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
}

interface PlinkoHistoryItem {
  gameId: string;
  rows: PlinkoRows;
  risk: PlinkoRisk;
  path: number[];
  slotIndex: number;
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
  createdAt: string;
}

const ROW_OPTIONS: readonly PlinkoRows[] = [8, 12, 16] as const;
const RISK_OPTIONS: ReadonlyArray<{ key: PlinkoRisk; label: string; color: string }> = [
  { key: "low", label: "Low", color: "text-emerald-400" },
  { key: "medium", label: "Medium", color: "text-amber-400" },
  { key: "high", label: "High", color: "text-red-400" },
];

const PLINKO_TABLES: Record<PlinkoRows, Record<PlinkoRisk, number[]>> = {
  8: {
    low: [5.6, 2.0, 1.1, 1.0, 0.4, 1.0, 1.1, 2.0, 5.6],
    medium: [13, 3.0, 1.3, 0.7, 0.3, 0.7, 1.3, 3.0, 13],
    high: [29, 4.0, 1.5, 0.3, 0.1, 0.3, 1.5, 4.0, 29],
  },
  12: {
    low: [9.0, 2.9, 1.6, 1.3, 1.1, 0.9, 0.6, 0.9, 1.1, 1.3, 1.6, 2.9, 9.0],
    medium: [20, 6.0, 3.0, 1.8, 1.2, 0.7, 0.3, 0.7, 1.2, 1.8, 3.0, 6.0, 20],
    high: [45, 11, 4.0, 2.5, 1.0, 0.5, 0.2, 0.5, 1.0, 2.5, 4.0, 11, 45],
  },
  16: {
    low: [12, 6.0, 3.0, 1.8, 1.4, 1.1, 1.0, 0.9, 0.7, 0.9, 1.0, 1.1, 1.4, 1.8, 3.0, 6.0, 12],
    medium: [18, 8.0, 4.0, 2.2, 1.6, 1.4, 1.1, 0.8, 0.45, 0.8, 1.1, 1.4, 1.6, 2.2, 4.0, 8.0, 18],
    high: [1000, 162, 38, 9, 3, 1.5, 0.5, 0.2, 0.1, 0.2, 0.5, 1.5, 3, 9, 38, 162, 1000],
  },
};

/** Returns a CSS background color based on position and multiplier value */
function getSlotGradient(_index: number, _totalCols: number, multiplier: number): string {
  if (multiplier >= 100) return "linear-gradient(180deg, #ff2d6b 0%, #d91044 100%)";
  if (multiplier >= 20) return "linear-gradient(180deg, #fa4950 0%, #c8353c 100%)";
  if (multiplier >= 5) return "linear-gradient(180deg, #f97316 0%, #c2570d 100%)";
  if (multiplier >= 2) return "linear-gradient(180deg, #ff7a1a 0%, #e85f00 100%)";
  if (multiplier >= 1) return "linear-gradient(180deg, #ff9a3d 0%, #e85f00 100%)";
  return "linear-gradient(180deg, #ff9a3d 0%, #e85f00 100%)";
}

function getSlotTextColor(multiplier: number): string {
  if (multiplier >= 2) return "#fff";
  return "#1a0a00";
}

function formatMultiplier(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(0)}k`;
  if (m >= 100) return m.toFixed(0);
  if (m >= 10) return m.toFixed(1);
  return m.toFixed(2);
}

function getWalletSymbol(walletType: WalletType) {
  return walletType === "crypto" ? "$" : "$";
}

export default function PlinkoPage() {
  const { token, loading: authLoading } = useAuth();
  const { canAccessOriginals, loading: accessLoading } = useOriginalsAccess();
  const { fiatBalance, cryptoBalance, refreshWallet, selectedWallet, setSelectedWallet } = useWallet();
  const { openLogin } = useModal();
  const { playBet, playCrash, playTick, playWin, muted, toggleMute } = useGameSounds();

  const socketRef = useRef<Socket | null>(null);
  const timeoutRefs = useRef<number[]>([]);
  const hasSession = !!token;

  const [walletType, setWalletType] = useState<WalletType>(selectedWallet);
  const [betInput, setBetInput] = useState("10");
  const [rows, setRows] = useState<PlinkoRows>(16);
  const [risk, setRisk] = useState<PlinkoRisk>("high");
  const [history, setHistory] = useState<PlinkoHistoryItem[]>([]);
  const [isDropping, setIsDropping] = useState(false);
  const [lastResult, setLastResult] = useState<PlinkoResult | null>(null);
  const [ball, setBall] = useState({ visible: false, x: 50, y: 2 });
  const [hyperMode, setHyperMode] = useState(false);
  const [tab, setTab] = useState<"Manual" | "Auto">("Manual");
  const [resultBannerKey, setResultBannerKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  // Trail of ball positions for glow effect
  const [ballTrail, setBallTrail] = useState<{ x: number; y: number; id: number }[]>([]);
  const trailCounter = useRef(0);

  const betAmount = parseFloat(betInput) || 0;
  const activeBalance = walletType === "crypto" ? cryptoBalance : fiatBalance;
  const activeSymbol = getWalletSymbol(walletType);
  const multiplierTable = useMemo(() => PLINKO_TABLES[rows][risk], [risk, rows]);

  useEffect(() => { setWalletType(selectedWallet); }, [selectedWallet]);

  useEffect(() => {
    if (!authLoading && !accessLoading && (!hasSession || !canAccessOriginals)) {
      window.location.href = "/";
    }
  }, [authLoading, accessLoading, canAccessOriginals, hasSession]);

  const clearDropTimers = useCallback(() => {
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
  }, []);

  const animateDrop = useCallback((result: PlinkoResult, isDemo = false) => {
    clearDropTimers();
    setBallTrail([]);
    setBall({ visible: true, x: 50, y: 2 });
    setIsDropping(true);

    const pegSpacing = 75 / result.rows;
    let rights = 0;
    const stepDelay = hyperMode ? 45 : 110;

    result.path.forEach((step, index) => {
      const id = window.setTimeout(() => {
        rights += step;
        const stepCount = index + 1;
        const x = 50 + (rights - stepCount / 2) * pegSpacing;
        const y = 6 + (stepCount / result.rows) * 74;
        setBall({ visible: true, x, y });
        // Add trail point
        const trailId = trailCounter.current++;
        setBallTrail((prev) => [...prev.slice(-4), { x, y, id: trailId }]);
        if (!isDemo) playTick(1 + stepCount / 4);
      }, index * stepDelay);
      timeoutRefs.current.push(id);
    });

    const settleId = window.setTimeout(() => {
      const x = 50 + (result.slotIndex - result.rows / 2) * pegSpacing;
      setBall({ visible: true, x, y: 88 });
      setBallTrail([]);
    }, result.path.length * stepDelay + (hyperMode ? 15 : 35));
    timeoutRefs.current.push(settleId);

    const finishId = window.setTimeout(() => {
      setLastResult(result);
      setResultBannerKey((k) => k + 1);
      setIsDropping(false);
      if (!isDemo) {
        if (result.multiplier >= 1) {
          playWin();
        } else {
          playCrash();
        }
      }
    }, result.path.length * stepDelay + (hyperMode ? 80 : 480));
    timeoutRefs.current.push(finishId);
  }, [clearDropTimers, hyperMode, playCrash, playTick, playWin]);

  useEffect(() => {
    const endpoint = getConfiguredSocketNamespace("originals");
    if (!endpoint) return;
    const authToken = localStorage.getItem("token") || "";
    const socket = io(endpoint.url, {
      path: endpoint.path,
      auth: { token: authToken },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-originals", { game: "plinko" });
      socket.emit("plinko:history");
    });

    socket.on("plinko:result", (result: PlinkoResult) => {
      void refreshWallet();
      setHistory((prev) => [
        {
          gameId: result.gameId, rows: result.rows, risk: result.risk, path: result.path,
          slotIndex: result.slotIndex, multiplier: result.multiplier, payout: result.payout,
          status: result.status, betAmount: result.betAmount, createdAt: new Date().toISOString(),
        },
        ...prev.slice(0, 29),
      ]);
      animateDrop(result, false);
    });

    socket.on("plinko:history", (items: PlinkoHistoryItem[]) => { setHistory(items); });

    socket.on("plinko:error", (payload: { message: string }) => {
      clearDropTimers();
      setIsDropping(false);
      setBall((c) => ({ ...c, visible: false }));
      setBallTrail([]);
      void refreshWallet();
      toast.error(payload.message);
    });

    return () => { clearDropTimers(); socket.disconnect(); };
  }, [animateDrop, clearDropTimers, refreshWallet]);

  const handleWalletTypeChange = useCallback((next: WalletType) => {
    setWalletType(next);
    void setSelectedWallet(next);
  }, [setSelectedWallet]);

  const handleDrop = useCallback(() => {
    if (!hasSession) return openLogin();
    if (isDropping) return;
    if (betAmount <= 0) return toast.error("Enter a bet amount");
    if (betAmount > activeBalance) return toast.error("Insufficient balance");
    if (!socketRef.current) return toast.error("Connecting to server…");
    setLastResult(null);
    setBall({ visible: true, x: 50, y: 2 });
    playBet();
    socketRef.current.emit("plinko:play", { betAmount, rows, risk, walletType });
  }, [activeBalance, betAmount, hasSession, isDropping, openLogin, playBet, risk, rows, walletType]);

  const pegNodes = useMemo(() => {
    return Array.from({ length: rows }, (_, rowIndex) => {
      const cols = rowIndex + 1;
      return Array.from({ length: cols }, (_, colIndex) => {
        const x = 50 + (colIndex - (cols - 1) / 2) * (75 / rows);
        const y = 8 + ((rowIndex + 1) / rows) * 73;
        return { key: `${rowIndex}-${colIndex}`, x, y };
      });
    }).flat();
  }, [rows]);

  const sliderPct = ((rows - 8) / 8) * 100;

  if (authLoading || accessLoading || !hasSession || !canAccessOriginals) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0C0D12]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-[#00e701]/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-t-[#00e701] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-[#8892A4] text-sm font-medium">Loading Plinko…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:h-screen overflow-y-auto md:overflow-hidden bg-[#0C0D12] flex flex-col font-sans">
      <Header />

      <div className="flex flex-1 md:overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
        <LeftSidebar />

        <main className="flex-1 min-w-0 flex flex-col md:flex-row bg-[#0C0D12] md:overflow-hidden">

          {/* ══════ LEFT — Betting Controls ══════ */}
          <aside className="w-full md:w-[330px] shrink-0 bg-[#171921] flex flex-col order-2 md:order-1 relative z-10 border-r border-white/[0.06]">

            {/* Mode Tabs */}
            <div className="flex bg-[#0F1016] mx-3 mt-4 rounded-lg overflow-hidden border border-white/[0.05] shrink-0">
              {(["Manual", "Auto"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-[13px] font-bold relative transition-all ${
                    tab === t ? "text-white bg-[#171921]" : "text-[#6B7280] hover:text-[#8892A4]"
                  }`}
                >
                  {t}
                  {tab === t && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00e701] rounded-t-full" />}
                </button>
              ))}
            </div>

            <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#8892A4]">
                    Amount <Info size={13} className="text-[#4d5563] cursor-help" />
                  </div>
                  <button
                    onClick={() => handleWalletTypeChange(walletType === "crypto" ? "fiat" : "crypto")}
                    className="text-[11px] font-semibold text-[#6B7280] hover:text-[#8892A4] transition-colors"
                  >
                    Bal: {activeSymbol}{activeBalance.toFixed(2)}
                  </button>
                </div>

                {/* Main bet input */}
                <div className={`flex bg-[#0F1016] border rounded-lg h-11 items-center overflow-hidden transition-colors ${
                  isDropping ? "border-[#1C1E28]" : "border-[#1C1E28] hover:border-[#262936] focus-within:border-[#00e701]/50"
                }`}>
                  <div className="pl-3 pr-2 shrink-0">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#f2782b] to-[#e05a1a] flex items-center justify-center text-white text-[10px] font-black">
                      {activeSymbol}
                    </div>
                  </div>
                  <input
                    type="number"
                    value={betInput}
                    onChange={(e) => setBetInput(e.target.value)}
                    disabled={isDropping}
                    className="flex-1 bg-transparent text-[15px] font-bold text-white outline-none min-w-0 py-2 disabled:opacity-50"
                  />
                  <div className="flex items-center h-full pr-1 gap-1 shrink-0">
                    <button
                      onClick={() => setBetInput(String(Math.max(10, Math.floor((parseFloat(betInput) || 0) / 2))))}
                      disabled={isDropping}
                      className="px-2 h-8 bg-[#1C1E28] hover:bg-[#353a4b] text-[#8892A4] hover:text-white text-[11px] font-bold rounded-md transition-all disabled:opacity-40"
                    >½</button>
                    <button
                      onClick={() => setBetInput(String((parseFloat(betInput) || 0) * 2))}
                      disabled={isDropping}
                      className="px-2 h-8 bg-[#1C1E28] hover:bg-[#353a4b] text-[#8892A4] hover:text-white text-[11px] font-bold rounded-md transition-all disabled:opacity-40"
                    >2×</button>
                    <div className="flex flex-col h-8 ml-0.5 rounded-md bg-[#1C1E28] overflow-hidden w-6">
                      <button
                        onClick={() => setBetInput(String((parseFloat(betInput) || 0) + 10))}
                        disabled={isDropping}
                        className="flex-1 flex items-center justify-center hover:bg-[#353a4b] text-[#8892A4] hover:text-white transition-colors disabled:opacity-40"
                      ><ChevronUp size={11} strokeWidth={3} /></button>
                      <button
                        onClick={() => setBetInput(String(Math.max(0, (parseFloat(betInput) || 0) - 10)))}
                        disabled={isDropping}
                        className="flex-1 flex items-center justify-center hover:bg-[#353a4b] text-[#8892A4] hover:text-white transition-colors border-t border-[#0F1016] disabled:opacity-40"
                      ><ChevronDown size={11} strokeWidth={3} /></button>
                    </div>
                  </div>
                </div>

                {/* Quick amounts */}
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[10, 100, 1000, 10000].map((val) => (
                    <button
                      key={val}
                      onClick={() => setBetInput(String(val))}
                      disabled={isDropping}
                      className={`h-8 rounded-md text-[11px] font-bold transition-all disabled:opacity-40 border ${
                        parseFloat(betInput) === val
                          ? "bg-[#00e701]/15 border-[#00e701]/40 text-[#00e701]"
                          : "bg-[#0F1016] border-[#1C1E28] text-[#6B7280] hover:text-white hover:border-[#262936]"
                      }`}
                    >
                      {val >= 1000 ? `${val / 1000}k` : val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk Mode */}
              <div>
                <label className="text-[13px] font-semibold text-[#8892A4] block mb-2">Risk Level</label>
                <div className="flex gap-2">
                  {RISK_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => !isDropping && setRisk(opt.key)}
                      disabled={isDropping}
                      className={`flex-1 py-2 text-[12px] font-bold rounded-lg border transition-all disabled:opacity-50 ${
                        risk === opt.key
                          ? opt.key === "low"
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                            : opt.key === "medium"
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                            : "bg-red-500/15 border-red-500/40 text-red-400"
                          : "bg-[#0F1016] border-[#1C1E28] text-[#6B7280] hover:text-white hover:border-[#262936]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row Slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[13px] font-semibold text-[#8892A4]">Rows</label>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-black text-white tabular-nums">{rows}</span>
                    <span className="text-[11px] text-[#6B7280]">pegs</span>
                  </div>
                </div>

                {/* Visual slider with labeled stops */}
                <div className="relative h-1.5 mt-4 mb-3">
                  <div className="absolute inset-0 bg-[#0F1016] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00e701] to-[#00b300] rounded-full transition-all duration-200"
                      style={{ width: `${sliderPct}%` }}
                    />
                  </div>
                  <input
                    type="range" min={8} max={16} step={4} value={rows}
                    onChange={(e) => !isDropping && setRows(Number(e.target.value) as PlinkoRows)}
                    disabled={isDropping}
                    className="w-full absolute inset-0 z-20 opacity-0 cursor-pointer h-1.5 disabled:cursor-not-allowed"
                  />
                  {/* Thumb indicator */}
                  <div
                    className="absolute top-[-7px] h-5 w-5 bg-white rounded-md shadow-lg pointer-events-none z-10 flex items-center justify-center transition-all duration-200"
                    style={{ left: `calc(${sliderPct}% - 10px)` }}
                  >
                    <div className="flex gap-[2px]">
                      <div className="w-px h-2.5 bg-[#cbd5e1]" />
                      <div className="w-px h-2.5 bg-[#cbd5e1]" />
                    </div>
                  </div>
                </div>
                {/* Stop labels */}
                <div className="flex justify-between px-1 mt-1">
                  {ROW_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => !isDropping && setRows(r)}
                      className={`text-[11px] font-bold transition-colors ${
                        rows === r ? "text-[#00e701]" : "text-[#262936] hover:text-[#8892A4]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bet Button */}
              <button
                onClick={handleDrop}
                disabled={isDropping}
                id="plinko-bet-btn"
                className={`w-full h-14 rounded-xl text-[17px] font-black transition-all relative overflow-hidden ${
                  isDropping
                    ? "bg-[#00e701]/30 cursor-not-allowed text-[#00e701]/60"
                    : "bg-[#00e701] hover:bg-[#00d400] active:scale-[0.98] text-[#0d1117] shadow-[0_4px_20px_rgba(0,231,1,0.3)] hover:shadow-[0_6px_28px_rgba(0,231,1,0.4)]"
                }`}
              >
                {isDropping ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-[#00e701]/60 border-t-[#00e701] animate-spin" />
                    Dropping…
                  </span>
                ) : "Bet"}
              </button>
            </div>

            {/* Bottom Controls Bar */}
            <div className="p-3 flex items-center justify-between border-t border-white/[0.05] bg-[#0F1016] shrink-0">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={toggleMute}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#171921] hover:bg-[#1C1E28] text-[#6B7280] hover:text-white transition-all"
                  title={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                    showHistory ? "bg-[#00e701]/15 text-[#00e701]" : "bg-[#171921] hover:bg-[#1C1E28] text-[#6B7280] hover:text-white"
                  }`}
                  title="Bet history"
                >
                  <BarChart3 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <Zap size={12} className="text-[#00e701]" />
                <span className="text-[11px] font-semibold text-[#262936]">ODD69 Plinko</span>
              </div>
            </div>
          </aside>

          {/* ══════ RIGHT — Game Board ══════ */}
          <section className="flex-1 flex flex-col bg-[#0C0D12] relative order-1 md:order-2 overflow-hidden min-h-[500px]">

            {/* Result Banner */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[80%] max-w-[540px] h-11 z-30">
              {lastResult ? (
                <div
                  key={resultBannerKey}
                  className={`w-full h-full rounded-lg flex items-center justify-center gap-3 border transition-all animate-[fadeSlideIn_0.3s_ease] ${
                    lastResult.multiplier >= 1
                      ? "bg-emerald-500/15 border-emerald-500/30"
                      : "bg-red-500/10 border-red-500/20"
                  }`}
                >
                  <span className={`text-lg font-black ${lastResult.multiplier >= 1 ? "text-emerald-400" : "text-red-400"}`}>
                    {lastResult.multiplier >= 1 ? "+" : ""}{activeSymbol}{lastResult.payout.toFixed(2)}
                  </span>
                  <span className="text-[#6B7280] text-[12px] font-semibold">·</span>
                  <span className={`text-[14px] font-black ${lastResult.multiplier >= 1 ? "text-white" : "text-red-400"}`}>
                    {lastResult.multiplier.toFixed(2)}×
                  </span>
                </div>
              ) : (
                <div className="w-full h-full rounded-lg bg-[#171921] border border-[#1C1E28] flex items-center justify-center">
                  <span className="text-[#262936] text-[12px] font-semibold">Drop the ball to play</span>
                </div>
              )}
            </div>

            {/* Hyper Mode Toggle */}
            <div className="absolute top-5 right-5 flex items-center gap-2 z-30">
              <span className="text-[12px] text-[#6B7280] font-semibold hidden sm:block">Hyper</span>
              <button
                onClick={() => setHyperMode(!hyperMode)}
                className={`w-9 h-5 rounded-full relative transition-colors border ${
                  hyperMode ? "bg-[#00e701] border-[#00e701]" : "bg-[#1C1E28] border-[#1C1E28]"
                }`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow transition-transform ${
                  hyperMode ? "translate-x-[18px]" : "translate-x-[3px]"
                }`} />
              </button>
              {hyperMode && <Zap size={12} className="text-[#00e701] animate-pulse" />}
            </div>

            {/* History Panel Overlay */}
            {showHistory && (
              <div className="absolute top-0 left-0 right-0 bottom-0 z-40 bg-[#0C0D12]/95 backdrop-blur-md flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Clock size={14} className="text-[#00e701]" /> Bet History
                  </h3>
                  <button onClick={() => setShowHistory(false)} className="text-[#6B7280] hover:text-white transition-colors text-xs font-bold">Close ×</button>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
                  {history.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-[#262936] text-sm">No bets yet</div>
                  ) : history.map((h, i) => (
                    <div key={h.gameId + i} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            h.status === "WON" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/10 text-red-400"
                          }`}>{h.status}</span>
                          <span className="text-[11px] text-[#6B7280]">{h.rows}R · {h.risk}</span>
                        </div>
                        <p className="text-[11px] text-[#262936] mt-0.5">{activeSymbol}{h.betAmount.toFixed(2)} bet</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${h.status === "WON" ? "text-emerald-400" : "text-red-400"}`}>
                          {h.multiplier.toFixed(2)}×
                        </p>
                        <p className="text-[11px] text-[#6B7280]">{activeSymbol}{h.payout.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Plinko Board */}
            <div className="flex-1 flex items-center justify-center mt-16 p-3 relative z-10">
              <div className="w-full max-w-[680px] aspect-[1/1.05] relative">

                {/* Pegs */}
                {pegNodes.map((peg) => (
                  <div
                    key={peg.key}
                    className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 bg-white/[0.06]0"
                    style={{
                      left: `${peg.x}%`,
                      top: `${peg.y}%`,
                      width: `${Math.max(5, 9 - rows * 0.15)}px`,
                      height: `${Math.max(5, 9 - rows * 0.15)}px`,
                      boxShadow: "0 0 4px rgba(255,255,255,0.3)",
                    }}
                  />
                ))}

                {/* Ball Trail */}
                {ballTrail.map((pt, i) => (
                  <div
                    key={pt.id}
                    className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                      left: `${pt.x}%`,
                      top: `${pt.y}%`,
                      width: "14px",
                      height: "14px",
                      background: "rgba(255,195,0,0.15)",
                      opacity: (i + 1) / ballTrail.length * 0.6,
                    }}
                  />
                ))}

                {/* Ball */}
                {ball.visible && (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                    style={{
                      left: `${ball.x}%`,
                      top: `${ball.y}%`,
                      width: `${Math.max(14, 20 - rows * 0.2)}px`,
                      height: `${Math.max(14, 20 - rows * 0.2)}px`,
                      transition: hyperMode
                        ? "left 45ms ease-out, top 45ms ease-out"
                        : "left 100ms cubic-bezier(0.25,0.1,0.25,1), top 100ms cubic-bezier(0.25,0.1,0.25,1)",
                    }}
                  >
                    <div
                      className="w-full h-full rounded-full"
                      style={{
                        background: "radial-gradient(circle at 35% 35%, #fff8aa, #ffc300 50%, #e89000)",
                        boxShadow: "0 0 12px rgba(255,195,0,0.9), 0 0 24px rgba(255,150,0,0.5)",
                      }}
                    />
                  </div>
                )}

                {/* Multiplier Slots */}
                <div className="absolute inset-x-[1%] bottom-[1%] h-[30px] sm:h-[36px] flex items-end gap-[2px]">
                  {multiplierTable.map((multiplier, index) => {
                    const isLast = lastResult?.slotIndex === index;
                    return (
                      <div
                        key={`${rows}-${risk}-${index}`}
                        className="flex-1 h-full rounded-[4px] flex items-center justify-center relative overflow-hidden transition-all duration-200"
                        style={{
                          background: getSlotGradient(index, multiplierTable.length, multiplier),
                          transform: isLast ? "translateY(2px) scaleY(0.95)" : "translateY(0)",
                          boxShadow: isLast
                            ? "none"
                            : `0 3px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)`,
                        }}
                      >
                        {isLast && (
                          <div className="absolute inset-0 bg-white/[0.16] animate-pulse" />
                        )}
                        <span
                          className="tabular-nums leading-none font-black relative z-10"
                          style={{
                            color: getSlotTextColor(multiplier),
                            fontSize: multiplierTable.length > 14
                              ? "8px"
                              : multiplierTable.length > 10
                              ? "10px"
                              : "12px",
                          }}
                        >
                          {formatMultiplier(multiplier)}
                        </span>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>

          </section>
        </main>
      </div>

      {/* CSS for the result banner animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px) translateX(-50%); }
          to { opacity: 1; transform: translateY(0) translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
