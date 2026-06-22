"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { useModal } from "@/context/ModalContext";
import { useOriginalsAccess } from "@/hooks/useOriginalsAccess";
import { useGameSounds } from "@/hooks/useGameSounds";
import { getConfiguredSocketNamespace } from "@/utils/socketUrl";
import { Volume2, VolumeX } from "lucide-react";

interface RollResult {
  gameId: string;
  roll: number;
  target: number;
  direction: "over" | "under";
  multiplier: number;
  winChance: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
}

interface HistoryItem {
  gameId: string;
  roll: number;
  target: number;
  direction: "over" | "under";
  multiplier: number;
  winChance: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
  createdAt: string;
}

type BetTab = "manual" | "auto";
type WalletType = "fiat" | "crypto";

function useAnimatedNum(target: number, dur = 700) {
  const [value, setValue] = useState(target);
  const rafRef = useRef(0);
  const valueRef = useRef(target);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const from = valueRef.current;
    const startedAt = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / dur, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(from + (target - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dur, target]);

  return value;
}

const RANGE_TYPES = [
  { key: "over", label: "Roll Over", icon: "➜" },
  { key: "under", label: "Roll Under", icon: "⬅" },
] as const;

function getWalletSymbol(walletType: WalletType) {
  return walletType === "crypto" ? "$" : "$";
}

export default function DicePage() {
  const { token, loading: authLoading } = useAuth();
  const { canAccessOriginals, loading: accessLoading } = useOriginalsAccess();
  const {
    fiatBalance,
    cryptoBalance,
    refreshWallet,
    selectedWallet,
    setSelectedWallet,
  } = useWallet();
  const { openLogin } = useModal();
  const socketRef = useRef<Socket | null>(null);
  const animationRef = useRef<number | null>(null);
  const hasSession = !!token;
  const {
    playDiceRoll,
    playWin,
    playCrash,
    playBet,
    muted,
    toggleMute,
  } = useGameSounds();

  useEffect(() => {
    if (!authLoading && !accessLoading && (!hasSession || !canAccessOriginals)) {
      window.location.href = "/";
    }
  }, [authLoading, hasSession, accessLoading, canAccessOriginals]);

  const [tab, setTab] = useState<BetTab>("manual");
  const [walletType, setWalletType] = useState<WalletType>(selectedWallet);
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<"over" | "under">("over");
  const [betInput, setBetInput] = useState("100");
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [rollDisplay, setRollDisplay] = useState(50);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [autoRounds, setAutoRounds] = useState("10");
  const [autoStopWin, setAutoStopWin] = useState("");
  const [autoStopLoss, setAutoStopLoss] = useState("");
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoRoundsLeft, setAutoRoundsLeft] = useState(0);
  const [autoProfit, setAutoProfit] = useState(0);

  const autoRunningRef = useRef(false);
  const autoProfitRef = useRef(0);
  const betAmountRef = useRef(0);
  const targetRef = useRef(target);
  const directionRef = useRef(direction);
  const walletTypeRef = useRef<WalletType>(walletType);
  const autoStopWinRef = useRef(autoStopWin);
  const autoStopLossRef = useRef(autoStopLoss);

  useEffect(() => {
    setWalletType(selectedWallet);
  }, [selectedWallet]);

  useEffect(() => {
    walletTypeRef.current = walletType;
  }, [walletType]);

  const animRoll = useAnimatedNum(rollDisplay, 800);
  const betAmount = parseFloat(betInput) || 0;
  const activeBalance = walletType === "crypto" ? cryptoBalance : fiatBalance;
  const activeSymbol = getWalletSymbol(walletType);

  useEffect(() => {
    betAmountRef.current = betAmount;
  }, [betAmount]);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    autoStopWinRef.current = autoStopWin;
  }, [autoStopWin]);

  useEffect(() => {
    autoStopLossRef.current = autoStopLoss;
  }, [autoStopLoss]);

  const winChance = direction === "over"
    ? parseFloat((99.99 - target).toFixed(2))
    : parseFloat(target.toFixed(2));
  const multiplier = winChance > 0
    ? parseFloat((99 / winChance).toFixed(4))
    : 0;
  const winAmount = parseFloat((betAmount * multiplier).toFixed(4));
  const won = lastResult?.status === "WON";

  const sliderGrad = direction === "over"
    ? `linear-gradient(to right, #22c55e 0%, #22c55e ${target}%, #ff7a1a ${target}%, #ff7a1a 100%)`
    : `linear-gradient(to right, #ff7a1a 0%, #ff7a1a ${target}%, #22c55e ${target}%, #22c55e 100%)`;

  const stopRollAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      window.clearInterval(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const startRollAnimation = useCallback(() => {
    stopRollAnimation();
    const intervalId = window.setInterval(() => {
      setRollDisplay(parseFloat((Math.random() * 99.99).toFixed(2)));
    }, 50);

    animationRef.current = intervalId;
    window.setTimeout(() => {
      if (animationRef.current === intervalId) {
        stopRollAnimation();
      }
    }, 600);
  }, [stopRollAnimation]);

  const stopAuto = useCallback((notice?: { type: "success" | "error"; message: string }) => {
    autoRunningRef.current = false;
    setAutoRunning(false);
    setAutoRoundsLeft(0);
    if (notice) {
      if (notice.type === "success") {
        toast.success(notice.message);
      } else {
        toast.error(notice.message);
      }
    }
  }, []);

  const emitRoll = useCallback(() => {
    if (!socketRef.current) {
      toast.error("Dice is still connecting");
      return;
    }

    setIsRolling(true);
    setLastResult(null);
    playBet();
    playDiceRoll();
    startRollAnimation();

    socketRef.current.emit("dice:roll", {
      betAmount: betAmountRef.current,
      target: targetRef.current,
      direction: directionRef.current,
      walletType: walletTypeRef.current,
    });
  }, [playBet, playDiceRoll, startRollAnimation]);

  useEffect(() => {
    const endpoint = getConfiguredSocketNamespace("originals");
    if (!endpoint) {
      return;
    }

    const token = localStorage.getItem("token") || "";
    const socket = io(endpoint.url, {
      path: endpoint.path,
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-originals", { game: "dice" });
      socket.emit("dice:history");
    });

    socket.on("dice:result", (result: RollResult) => {
      stopRollAnimation();
      setLastResult(result);
      setRollDisplay(result.roll);
      setIsRolling(false);
      setHistory((previous) => [
        {
          gameId: result.gameId,
          roll: result.roll,
          target: result.target,
          direction: result.direction,
          multiplier: result.multiplier,
          winChance: result.winChance,
          payout: result.payout,
          status: result.status,
          betAmount: result.betAmount,
          createdAt: new Date().toISOString(),
        },
        ...previous.slice(0, 29),
      ]);

      void refreshWallet();

      if (result.status === "WON") {
        playWin();
        toast.success(`Won ${getWalletSymbol(walletTypeRef.current)}${result.payout.toFixed(2)} at ${result.multiplier}×!`);
      } else {
        playCrash();
        toast(`Rolled ${result.roll.toFixed(2)} — lost`, { icon: "💥" });
      }

      if (!autoRunningRef.current) {
        return;
      }

      const netProfit = result.status === "WON"
        ? result.payout - result.betAmount
        : -result.betAmount;

      autoProfitRef.current += netProfit;
      setAutoProfit(autoProfitRef.current);

      setAutoRoundsLeft((previous) => {
        const next = previous - 1;
        if (next <= 0) {
          stopAuto();
          return 0;
        }

        const stopOnWin = parseFloat(autoStopWinRef.current) || 0;
        const stopOnLoss = parseFloat(autoStopLossRef.current) || 0;

        if (stopOnWin > 0 && autoProfitRef.current >= stopOnWin) {
          stopAuto({ type: "success", message: "Auto stopped: profit target reached" });
          return 0;
        }

        if (stopOnLoss > 0 && autoProfitRef.current <= -stopOnLoss) {
          stopAuto({ type: "error", message: "Auto stopped: loss limit reached" });
          return 0;
        }

        window.setTimeout(() => {
          if (autoRunningRef.current) {
            emitRoll();
          }
        }, 550);

        return next;
      });
    });

    socket.on("dice:history", (items: HistoryItem[]) => {
      setHistory(items);
    });

    socket.on("dice:error", (payload: { message: string }) => {
      stopRollAnimation();
      setIsRolling(false);
      void refreshWallet();
      toast.error(payload.message);

      if (autoRunningRef.current) {
        stopAuto();
      }
    });

    return () => {
      stopRollAnimation();
      socket.disconnect();
    };
  }, [emitRoll, playCrash, playWin, refreshWallet, stopAuto, stopRollAnimation]);

  const handleWalletTypeChange = useCallback((nextWallet: WalletType) => {
    setWalletType(nextWallet);
    void setSelectedWallet(nextWallet);
  }, [setSelectedWallet]);

  const handleManualRoll = useCallback(() => {
    if (!hasSession) {
      openLogin();
      return;
    }
    if (isRolling || autoRunning) {
      return;
    }
    if (betAmount < 10) {
      toast.error("Minimum bet is 10");
      return;
    }
    if (betAmount > activeBalance) {
      toast.error("Insufficient balance");
      return;
    }

    emitRoll();
  }, [activeBalance, autoRunning, betAmount, emitRoll, hasSession, isRolling, openLogin]);

  const handleStartAuto = useCallback(() => {
    if (!hasSession) {
      openLogin();
      return;
    }
    if (isRolling) {
      return;
    }
    if (betAmount < 10) {
      toast.error("Minimum bet is 10");
      return;
    }
    if (betAmount > activeBalance) {
      toast.error("Insufficient balance");
      return;
    }

    const rounds = Math.max(1, parseInt(autoRounds, 10) || 10);
    autoRunningRef.current = true;
    autoProfitRef.current = 0;
    setAutoRunning(true);
    setAutoProfit(0);
    setAutoRoundsLeft(rounds);
    emitRoll();
  }, [activeBalance, autoRounds, betAmount, emitRoll, hasSession, isRolling, openLogin]);

  const adjustBet = useCallback((action: "half" | "double") => {
    const current = parseFloat(betInput) || 0;
    if (action === "half") {
      setBetInput(String(Math.max(10, Math.floor(current / 2))));
      return;
    }

    setBetInput(String(Math.min(100000, current * 2)));
  }, [betInput]);

  return (
    <div className="min-h-screen md:h-screen overflow-y-auto md:overflow-hidden flex flex-col" style={{ background: "#1a1d26" }}>
      <Header />

      <div className="flex flex-1 md:overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
        <LeftSidebar />

        <main className="flex-1 min-w-0 flex flex-col md:flex-row md:overflow-hidden border-l" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div
            className="w-full md:w-[320px] flex-shrink-0 flex flex-col overflow-y-auto order-2 md:order-1"
            style={{ background: "#1e222d", borderRight: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {(["manual", "auto"] as const).map((currentTab) => (
                <button
                  key={currentTab}
                  onClick={() => !autoRunning && !isRolling && setTab(currentTab)}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors"
                  style={{
                    color: tab === currentTab ? "white" : "#52525b",
                    borderBottom: tab === currentTab ? "2px solid #22c55e" : "2px solid transparent",
                    background: tab === currentTab ? "rgba(34,197,94,0.05)" : "transparent",
                  }}
                >
                  {currentTab}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-4 flex-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-zinc-400 font-bold">Amount</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.04] p-0.5">
                      {(["crypto"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => handleWalletTypeChange(type)}
                          disabled={isRolling || autoRunning}
                          className="px-2 py-0.5 text-[10px] font-black rounded-full transition-colors disabled:opacity-40"
                          style={{
                            color: walletType === type ? "white" : "#71717a",
                            background: walletType === type ? "rgba(34,197,94,0.16)" : "transparent",
                          }}
                        >
                          {"$"}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={toggleMute}
                      title={muted ? "Unmute" : "Mute"}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.05] text-zinc-500 hover:text-white transition-colors"
                    >
                      {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center rounded-lg overflow-hidden" style={{ background: "#262b36", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="pl-3 text-zinc-500 text-sm font-bold">{activeSymbol}</span>
                  <input
                    type="number"
                    value={betInput}
                    onChange={(event) => setBetInput(event.target.value)}
                    disabled={isRolling || autoRunning}
                    className="flex-1 bg-transparent text-white font-bold text-sm py-2.5 px-2 outline-none disabled:opacity-40"
                  />
                  <button
                    onClick={() => adjustBet("half")}
                    disabled={isRolling || autoRunning}
                    className="px-2.5 py-2.5 text-xs font-black text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
                    style={{ background: "rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    ½
                  </button>
                  <button
                    onClick={() => adjustBet("double")}
                    disabled={isRolling || autoRunning}
                    className="px-2.5 py-2.5 text-xs font-black text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
                    style={{ background: "rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    2×
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1 mt-1.5">
                  {[50, 100, 500, 1000].map((value) => (
                    <button
                      key={value}
                      onClick={() => setBetInput(String(value))}
                      disabled={isRolling || autoRunning}
                      className="py-1.5 text-[10px] font-bold rounded text-zinc-500 hover:text-white transition-all disabled:opacity-30"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      {value >= 1000 ? `${value / 1000}k` : value}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-zinc-400 font-bold mb-1.5 block">Win Amount</span>
                <div className="flex items-center rounded-lg px-3 py-2.5" style={{ background: "#262b36", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-zinc-500 text-sm font-bold mr-2">{activeSymbol}</span>
                  <span className="text-white font-bold text-sm">{winAmount.toFixed(4)}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-zinc-400 font-bold mb-1.5 block">Range Type</span>
                <div className="flex gap-2">
                  {RANGE_TYPES.map((rangeType) => (
                    <button
                      key={rangeType.key}
                      onClick={() => !isRolling && !autoRunning && setDirection(rangeType.key)}
                      disabled={isRolling || autoRunning}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                      style={{
                        background: direction === rangeType.key ? "rgba(34,197,94,0.12)" : "#262b36",
                        border: direction === rangeType.key ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.06)",
                        color: direction === rangeType.key ? "#22c55e" : "#71717a",
                      }}
                    >
                      <span className="text-sm">{rangeType.icon}</span>
                      {rangeType.label}
                    </button>
                  ))}
                </div>
              </div>

              {tab === "auto" && (
                <div className="space-y-3 rounded-xl border border-white/[0.08] bg-bg-modal p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">Rounds</span>
                      <input
                        type="text"
                        value={autoRounds}
                        disabled={autoRunning}
                        onChange={(event) => setAutoRounds(event.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full rounded-lg bg-bg-surface-4 px-3 py-2 text-sm font-bold text-white outline-none disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">Stop Profit</span>
                      <input
                        type="text"
                        value={autoStopWin}
                        disabled={autoRunning}
                        placeholder="0"
                        onChange={(event) => setAutoStopWin(event.target.value.replace(/[^0-9.]/g, ""))}
                        className="w-full rounded-lg bg-bg-surface-4 px-3 py-2 text-sm font-bold text-white outline-none disabled:opacity-40 placeholder:text-zinc-600"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">Stop Loss</span>
                      <input
                        type="text"
                        value={autoStopLoss}
                        disabled={autoRunning}
                        placeholder="0"
                        onChange={(event) => setAutoStopLoss(event.target.value.replace(/[^0-9.]/g, ""))}
                        className="w-full rounded-lg bg-bg-surface-4 px-3 py-2 text-sm font-bold text-white outline-none disabled:opacity-40 placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600">Progress</span>
                    <span className="text-white font-bold">
                      {autoRunning ? `${autoRoundsLeft} rounds left` : "Ready"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600">Profit</span>
                    <span className="font-bold" style={{ color: autoProfit >= 0 ? "#22c55e" : "#ef4444" }}>
                      {autoProfit >= 0 ? "+" : ""}{activeSymbol}{autoProfit.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {tab === "manual" ? (
                <button
                  onClick={handleManualRoll}
                  disabled={isRolling || autoRunning}
                  className="w-full py-4 rounded-lg font-black text-base transition-all disabled:opacity-50 active:scale-[0.98]"
                  style={{
                    background: isRolling ? "#262b36" : "linear-gradient(135deg, #22c55e, #16a34a)",
                    color: "white",
                    boxShadow: isRolling ? "none" : "0 4px 20px rgba(34,197,94,0.35)",
                  }}
                >
                  {isRolling ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Rolling…
                    </span>
                  ) : "Bet"}
                </button>
              ) : autoRunning ? (
                <button
                  onClick={() => stopAuto()}
                  className="w-full py-4 rounded-lg font-black text-base transition-all active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #ef4444, #dc2626)",
                    color: "white",
                    boxShadow: "0 4px 20px rgba(239,68,68,0.28)",
                  }}
                >
                  Stop Auto ({autoRoundsLeft})
                </button>
              ) : (
                <button
                  onClick={handleStartAuto}
                  disabled={isRolling}
                  className="w-full py-4 rounded-lg font-black text-base transition-all disabled:opacity-50 active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #ff7a1a, #e85f00)",
                    color: "white",
                    boxShadow: "0 4px 20px rgba(255, 122, 26,0.28)",
                  }}
                >
                  Start Auto
                </button>
              )}

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-600">Balance</span>
                <span className="text-white font-bold">{activeSymbol}{activeBalance?.toFixed(2) ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-y-auto order-1 md:order-2" style={{ background: "#1a1d26" }}>
            <div className="flex-shrink-0 py-3 text-center border-b" style={{ background: "#21242e", borderColor: "rgba(255,255,255,0.05)" }}>
              {lastResult ? (
                <span className={`text-sm font-bold ${won ? "text-success-bright" : "text-danger"}`}>
                  {won
                    ? `Won ${activeSymbol}${lastResult.payout.toFixed(2)}`
                    : `Lost — Rolled ${lastResult.roll.toFixed(2)}`}
                </span>
              ) : (
                <span className="text-zinc-600 text-sm">Game result will be displayed</span>
              )}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 min-h-0">
              <div className="relative mb-8">
                <div className="relative w-[120px] h-[120px] flex items-center justify-center">
                  <div
                    className="absolute inset-0 transition-colors duration-300"
                    style={{
                      clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                      background: lastResult
                        ? (won ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, #ef4444, #dc2626)")
                        : "linear-gradient(135deg, #3f3f46, #27272a)",
                    }}
                  />
                  <div
                    className="absolute inset-[3px]"
                    style={{
                      clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                      background: "#21242e",
                    }}
                  />
                  <span className="relative z-10 text-3xl font-black text-white tabular-nums">
                    {animRoll.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="w-full max-w-[600px] mb-10">
                <div className="relative px-2">
                  <div className="relative h-1.5 rounded-full overflow-hidden mt-4 mb-3" style={{ background: "#3f3f46" }}>
                    <div className="absolute inset-0 rounded-full" style={{ background: sliderGrad }} />
                  </div>

                  {lastResult && (
                    <div
                      className="absolute top-0 h-1.5"
                      style={{ left: `calc(${lastResult.roll}% + ${(0.5 - lastResult.roll / 100) * 16}px)`, transform: "translateX(-50%)" }}
                    >
                      <div
                        className="w-0.5 h-6 -mt-2 rounded-full"
                        style={{
                          background: won ? "#22c55e" : "#ef4444",
                          boxShadow: `0 0 8px ${won ? "#22c55e" : "#ef4444"}`,
                        }}
                      />
                    </div>
                  )}

                  <input
                    type="range"
                    min={1}
                    max={98}
                    step={1}
                    value={target}
                    onChange={(event) => setTarget(Number(event.target.value))}
                    disabled={isRolling || autoRunning}
                    className="absolute inset-0 w-full h-1.5 mt-4 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    style={{ zIndex: 3 }}
                  />

                  <div
                    className="absolute top-0 h-1.5 pointer-events-none mt-4"
                    style={{ left: `calc(${target}% + ${(0.5 - target / 100) * 16}px)`, transform: "translateX(-50%)" }}
                  >
                    <div className="w-5 h-5 absolute top-[-7px] -ml-[10px] rounded-md bg-white shadow-lg" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }} />
                  </div>
                </div>

                <div className="flex justify-between mt-2 px-1">
                  {[0, 25, 50, 75, 100].map((number) => (
                    <span key={number} className="text-[11px] text-zinc-600 font-bold">{number}</span>
                  ))}
                </div>
              </div>

              <div className="w-full max-w-[600px] flex rounded-lg overflow-hidden" style={{ background: "#262b36", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex-1 p-3 flex flex-col" style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Payout</span>
                  <div className="flex items-center gap-1">
                    <span className="text-white font-black text-base tabular-nums">{multiplier.toFixed(4)}</span>
                    <span className="text-zinc-500 text-xs font-bold">×</span>
                  </div>
                </div>

                <div className="flex-1 p-3 flex flex-col">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Win Chance</span>
                  <div className="flex items-center gap-1">
                    <span className="text-white font-black text-base tabular-nums">{winChance.toFixed(2)}</span>
                    <span className="text-zinc-500 text-xs font-bold">%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar" style={{ background: "#21242e" }}>
                {history.length === 0 ? (
                  <span className="text-zinc-700 text-xs">No rolls yet</span>
                ) : (
                  history.slice(0, 30).map((item) => (
                    <span
                      key={item.gameId}
                      className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${item.status === "WON"
                        ? "bg-success-alpha-16 text-success-bright border border-success-primary/20"
                        : "bg-danger-alpha-10 text-danger border border-danger/20"}`}
                    >
                      {item.roll.toFixed(2)}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
