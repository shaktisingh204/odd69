"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
import { Volume2, VolumeX, Users } from "lucide-react";

const FIRE_FRAME_H = 96;
const FIRE_TOTAL_FRAMES = 27;

interface LiveBet { username: string; betAmount: number; targetMultiplier?: number; resultMultiplier?: number; result?: "WIN" | "LOSE"; payout?: number; }
interface HistoryRound { roundId: number; crashPoint: number; serverSeedHash?: string; }
interface StarDot { width: number; height: number; top: string; left: string; opacity: number; animation: string; animationDelay: string; }
type WalletType = "fiat" | "crypto";
type GamePhase = "BETTING" | "FLYING" | "CRASHED";

function getWalletSymbol(walletType: WalletType) {
  return walletType === "crypto" ? "$" : "$";
}

function buildStarField(): StarDot[] {
  return Array.from({ length: 30 }, (_, index) => ({
    width: 1 + ((index * 7) % 3),
    height: 1 + ((index * 11) % 3),
    top: `${(index * 17) % 100}%`,
    left: `${(index * 29) % 100}%`,
    opacity: 0.25 + (((index * 13) % 50) / 100),
    animation: `twinkle ${2 + (index % 5) * 0.6}s ease-in-out infinite`,
    animationDelay: `${(index % 7) * 0.35}s`,
  }));
}

function ResultPill({ r }: { r: HistoryRound }) {
  const isWin = r.crashPoint >= 2.0; // Arbitrary styling threshold like Aviator
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 100,
      background: isWin ? "#0a2a0a" : "#2a0a0a",
      color: isWin ? "#2ecc71" : "#e74c3c",
      border: `1px solid ${isWin ? "#2ecc7133" : "#e74c3c33"}`,
      whiteSpace: "nowrap",
    }}>
      {r.crashPoint.toFixed(2)}×
    </span>
  );
}

export default function LimboPage() {
  const { token, loading: authLoading } = useAuth();
  const { canAccessOriginals, loading: accessLoading } = useOriginalsAccess();
  const { fiatBalance, cryptoBalance, refreshWallet, selectedWallet, setSelectedWallet } = useWallet();
  const { openLogin } = useModal();
  const socketRef = useRef<Socket | null>(null);
  const { playBet, playLimboRise, playWin, playCrash, muted, toggleMute } = useGameSounds();
  const lastRiseSoundRef = useRef(0);
  const hasSession = !!token;

  useEffect(() => {
    if (!authLoading && !accessLoading && (!hasSession || !canAccessOriginals)) {
      window.location.href = "/";
    }
  }, [hasSession, authLoading, accessLoading, canAccessOriginals]);

  const [betInput, setBetInput] = useState("100.00");
  const [targetInput, setTargetInput] = useState("2.00");
  const [walletType, setWalletType] = useState<WalletType>(selectedWallet);
  const [betTab, setBetTab] = useState<"manual" | "auto">("manual");
  const [showMobileBets, setShowMobileBets] = useState(false);
  
  // Game States
  const [phase, setPhase] = useState<GamePhase>("BETTING");
  const [multiplier, setMultiplier] = useState(1.00);
  const [historyItems, setHistoryItems] = useState<HistoryRound[]>([]);
  const [roundBets, setRoundBets] = useState<LiveBet[]>([]);
  const [roundId, setRoundId] = useState(0);

  // Auto Bet
  const [autoEnabled, setAutoEnabled] = useState(false);
  const autoEnabledRef = useRef(false);

  // Player state
  const [hasBetNextRound, setHasBetNextRound] = useState(false);
  const [activeBetAmount, setActiveBetAmount] = useState(0);
  const [hasBetThisRound, setHasBetThisRound] = useState(false);
  const [playerCashedOut, setPlayerCashedOut] = useState(false);

  const multiplierRef = useRef(multiplier);
  const phaseRef = useRef(phase);
  const walletTypeRef = useRef<WalletType>(walletType);
  const betInputRef = useRef(betInput);
  const targetInputRef = useRef(targetInput);
  const betTabRef = useRef(betTab);
  const hasBetNextRoundRef = useRef(false);
  const roundIdRef = useRef(roundId);

  useEffect(() => { multiplierRef.current = multiplier; }, [multiplier]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { walletTypeRef.current = walletType; }, [walletType]);
  useEffect(() => { betInputRef.current = betInput; }, [betInput]);
  useEffect(() => { targetInputRef.current = targetInput; }, [targetInput]);
  useEffect(() => { betTabRef.current = betTab; }, [betTab]);
  useEffect(() => { hasBetNextRoundRef.current = hasBetNextRound; }, [hasBetNextRound]);
  useEffect(() => { roundIdRef.current = roundId; }, [roundId]);
  useEffect(() => { setWalletType(selectedWallet); }, [selectedWallet]);

  // Animation Refs
  const [fireFrame, setFireFrame] = useState(0);
  const stars = useMemo<StarDot[]>(() => buildStarField(), []);
  
  // Fire animation
  useEffect(() => {
    if (phase !== "FLYING") return;
    let raf: number;
    let lastT = 0;
    const tick = (ts: number) => {
      if (ts - lastT > 60) { setFireFrame(f => (f + 1) % FIRE_TOTAL_FRAMES); lastT = ts; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Handle Rocket Sound
  useEffect(() => {
    if (phase === "FLYING") {
      const now = Date.now();
      if (now - lastRiseSoundRef.current >= 300) {
        playLimboRise(multiplier);
        lastRiseSoundRef.current = now;
      }
    }
  }, [phase, multiplier, playLimboRise]);

  /* ── Socket ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const endpoint = getConfiguredSocketNamespace("limbo");
    if (!endpoint) return;

    const tkn = localStorage.getItem("token") || "";
    const s = io(endpoint.url, { path: endpoint.path, auth: { token: tkn }, transports: ["websocket", "polling"], upgrade: true, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 15000 });
    socketRef.current = s;

    s.on("limbo:state", (d: { status: GamePhase; roundId: number; multiplier: number }) => {
      setPhase(d.status);
      setRoundId(d.roundId);
      setMultiplier(d.multiplier);
      if (d.status === "BETTING") {
        setHasBetThisRound(false);
        setPlayerCashedOut(false);
        setRoundBets([]);
      }
    });

    s.on("limbo:history", (d: HistoryRound[]) => {
      setHistoryItems(d);
    });

    s.on("limbo:betting", (d: { roundId: number; status: GamePhase }) => {
      setPhase(d.status);
      setRoundId(d.roundId);
      setMultiplier(1.0);
      setRoundBets([]);
      setPlayerCashedOut(false);

      // Transition queued bets or auto bets
      setHasBetThisRound(false);

      setTimeout(() => {
        if (autoEnabledRef.current || hasBetNextRoundRef.current) {
          const ba = parseFloat(betInputRef.current) || 100;
          const target = betTabRef.current === "auto" ? parseFloat(targetInputRef.current) || 0 : 0;
          s.emit("limbo:bet", { roundId: d.roundId, betAmount: ba, autoCashoutAt: target, walletType: walletTypeRef.current });
          setHasBetNextRound(false);
          hasBetNextRoundRef.current = false;
          playBet();
        }
      }, 500); // Wait a bit into the betting phase
    });

    s.on("limbo:start", (d: { roundId: number; status: GamePhase }) => {
      setPhase(d.status);
      setMultiplier(1.0);
    });

    s.on("limbo:tick", (d: { roundId: number; multiplier: number }) => {
      setMultiplier(d.multiplier);
    });

    s.on("limbo:crash", (d: { roundId: number; crashPoint: number }) => {
      setPhase("CRASHED");
      setMultiplier(d.crashPoint);
      setHistoryItems(prev => [{ roundId: d.roundId, crashPoint: d.crashPoint }, ...prev.slice(0, 29)]);
      playCrash();
    });

    s.on("limbo:bet-placed", (d: { betId: string; roundId: number; betAmount: number }) => {
      if (d.roundId === roundIdRef.current) {
        setHasBetThisRound(true);
        setActiveBetAmount(d.betAmount);
        void refreshWallet();
        toast.success("Bet placed");
      } else {
        setHasBetNextRound(true);
        hasBetNextRoundRef.current = true;
        setActiveBetAmount(d.betAmount);
        toast.success("Waiting for next round");
      }
    });

    s.on("limbo:cashout-success", (d: { userId: number; payout: number; multiplier: number; auto: boolean }) => {
      setPlayerCashedOut(true);
      if (d.auto) {
        toast.success(`Auto cashed out at ${d.multiplier.toFixed(2)}× for ${getWalletSymbol(walletTypeRef.current)}${d.payout.toFixed(2)}`);
      } else {
        toast.success(`Cashed out at ${d.multiplier.toFixed(2)}× for ${getWalletSymbol(walletTypeRef.current)}${d.payout.toFixed(2)}`);
      }
      playWin();
      void refreshWallet();
    });

    s.on("limbo:player-bet", (d: { username: string; betAmount: number }) => {
      setRoundBets(prev => [...prev, { username: d.username, betAmount: d.betAmount }]);
    });

    s.on("limbo:player-cashout", (d: { username: string; multiplier: number; payout: number }) => {
      setRoundBets(prev => prev.map(b => 
        b.username === d.username && !b.resultMultiplier 
          ? { ...b, resultMultiplier: d.multiplier, payout: d.payout, result: "WIN" as const }
          : b
      ));
    });

    s.on("limbo:error", (d: { message: string }) => {
      toast.error(d.message);
      setAutoEnabled(false);
      autoEnabledRef.current = false;
      setHasBetNextRound(false);
      void refreshWallet();
    });

    s.on("disconnect", (reason) => {
      if (reason === "io server disconnect") {
        setTimeout(() => s.connect(), 2000);
      }
    });

    s.on("connect_error", () => {
      toast.error("Connection lost. Reconnecting...");
    });

    s.on("connect", () => {
      // Re-request state on reconnect
      s.emit("limbo:get-history");
    });

    return () => { s.disconnect(); };
  }, [hasSession, playBet, playWin, playCrash, refreshWallet]);

  const betAmount = parseFloat(betInput) || 0;
  const targetMulti = parseFloat(targetInput) || 2;
  const activeBalance = walletType === "crypto" ? cryptoBalance : fiatBalance;
  const activeSymbol = getWalletSymbol(walletType);

  const handleWalletTypeChange = useCallback((nextWallet: WalletType) => {
    setWalletType(nextWallet);
    void setSelectedWallet(nextWallet);
  }, [setSelectedWallet]);

  const handleBetClick = useCallback(() => {
    if (!hasSession) { openLogin(); return; }
    if (betAmount <= 0) { toast.error("Enter a bet amount"); return; }
    if (betAmount > activeBalance) { toast.error("Insufficient balance"); return; }

    if (phase === "BETTING" && !hasBetThisRound) {
      socketRef.current?.emit("limbo:bet", { roundId: roundIdRef.current, betAmount, autoCashoutAt: betTab === "auto" ? targetMulti : 0, walletType: walletTypeRef.current });
      playBet();
    } else {
      setHasBetNextRound(true);
      hasBetNextRoundRef.current = true;
      toast.success("Bet queued for next round");
    }
  }, [hasSession, openLogin, betAmount, activeBalance, phase, hasBetThisRound, betTab, targetMulti, playBet]);

  const handleCancelHit = useCallback(() => {
    setHasBetNextRound(false);
    hasBetNextRoundRef.current = false;
    toast.success("Queued bet cancelled");
  }, []);

  const handleCashout = useCallback(() => {
    if (!hasBetThisRound || playerCashedOut || phase !== "FLYING") return;
    socketRef.current?.emit("limbo:cashout", { roundId: roundIdRef.current });
  }, [hasBetThisRound, playerCashedOut, phase]);

  const handleAutoToggle = useCallback(() => {
    if (!hasSession) { openLogin(); return; }
    if (!autoEnabled) {
      setAutoEnabled(true);
      autoEnabledRef.current = true;
      if (phase === "BETTING" && !hasBetThisRound) {
        handleBetClick();
      } else if (!hasBetThisRound) {
        setHasBetNextRound(true);
        toast.success("Auto bet queued for next round");
      }
    } else {
      setAutoEnabled(false);
      autoEnabledRef.current = false;
      setHasBetNextRound(false);
    }
  }, [hasSession, openLogin, autoEnabled, phase, hasBetThisRound, handleBetClick]);

  const adjustBet = (dir: "up" | "down") => {
    const cur = parseFloat(betInput) || 0;
    setBetInput(dir === "down" ? Math.max(10, cur - 10).toFixed(2) : (cur + 10).toFixed(2));
  };
  const adjustTarget = (dir: "up" | "down") => {
    const cur = parseFloat(targetInput) || 2;
    setTargetInput(dir === "down" ? Math.max(1.01, cur - 0.1).toFixed(2) : (cur + 0.1).toFixed(2));
  };

  const rocketY = Math.min(55, 5 + Math.min((multiplier - 1) / 4, 1) * 50);

  return (
    <div className="min-h-screen md:h-screen overflow-y-auto md:overflow-hidden flex flex-col" style={{ background: "#0e0e0e", fontFamily: "'Roboto', sans-serif" }}>
      <Header />
      <div className="flex flex-1 md:overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
        <LeftSidebar />
        <main className="flex-1 min-w-0 flex flex-col md:flex-row md:overflow-hidden" style={{ borderLeft: "1px solid #0F1016" }}>

          {/* ═══ LEFT — Live bets ═══════════════════════════════════════ */}
          <div className="hidden md:flex flex-col w-[280px] flex-shrink-0" style={{ background: "#141516" }}>
            <div className="px-3 py-2" style={{ borderBottom: "1px solid #1e1e1e" }}>
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold">
                Live Bets <span className="text-green-500">{roundBets.length}</span>
              </span>
            </div>
            <div className="flex px-2 py-1 text-[10px] text-zinc-600 font-bold uppercase" style={{ borderBottom: "1px solid #0F1016" }}>
              <div style={{ width: "28%" }}>User</div>
              <div style={{ width: "22%", textAlign: "center" }}>Bet</div>
              <div style={{ width: "22%", textAlign: "center" }}>Multi</div>
              <div style={{ width: "28%", textAlign: "right" }}>Payout</div>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
              {roundBets.length === 0 ? (
                <div className="text-center text-zinc-700 text-xs py-10">No bets yet</div>
              ) : roundBets.map((b, i) => (
                <div key={i} className="flex items-center px-2" style={{
                  height: 32, margin: "1px 2px", borderRadius: 16, fontSize: 11, fontWeight: 600,
                  background: b.result === "WIN" ? "linear-gradient(85deg,#0a2a0a,#0f1214)" : "linear-gradient(85deg,#1a0a0a,#0f1214)",
                  border: b.result === "WIN" ? "1px solid #2ecc7133" : "1px solid #0F1016",
                }}>
                  <div style={{ width: "28%" }} className="truncate text-zinc-400">{b.username}</div>
                  <div style={{ width: "22%", textAlign: "center" }} className="text-zinc-300">{b.betAmount}</div>
                  <div style={{ width: "22%", textAlign: "center" }}>
                    {b.resultMultiplier ? (
                      <span style={{ color: "#2ecc71", fontWeight: 800 }}>{b.resultMultiplier.toFixed(2)}×</span>
                    ) : (
                      "-"
                    )}
                  </div>
                  <div style={{ width: "28%", textAlign: "right" }} className="text-zinc-300">
                    {b.result === "WIN" && b.payout ? `+$${b.payout.toFixed(0)}` : "-"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ CENTER — Game + Controls ═══════════════════════════════ */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ padding: "0 10px 10px" }}>

            {/* History strip */}
            <div className="flex items-center" style={{ minHeight: 36, maxHeight: 36 }}>
              <div className="flex-1 overflow-hidden relative">
                <div className="flex gap-1 items-center overflow-x-auto no-scrollbar py-1">
                  {historyItems.length === 0
                    ? <span className="text-zinc-700 text-xs">Waiting for history…</span>
                    : historyItems.slice(0, 25).map((h, i) => <ResultPill key={i} r={h} />)}
                </div>
                <div style={{ position: "absolute", right: 0, top: 0, width: 30, height: "100%", background: "linear-gradient(to left, #0e0e0e, transparent)", pointerEvents: "none" }} />
              </div>
            </div>

            {/* Stage */}
            <div className="flex-1 relative min-h-0" style={{
              background: "linear-gradient(180deg, #1a1d23 0%, #12141a 50%, #0e1016 100%)",
              borderRadius: 16, border: "1px solid #2A2B2E", overflow: "hidden",
            }}>
              <div className="absolute inset-0" style={{ opacity: 0.4 }}>
                {stars.map((star, i) => (
                  <div key={i} className="absolute rounded-full bg-white" style={star} />
                ))}
              </div>

              {/* Multiplier display */}
              <div className="absolute inset-0 flex items-start justify-center pt-8 md:pt-12" style={{ zIndex: 3, pointerEvents: "none" }}>
                {phase === "BETTING" && (
                  <div className="text-center mt-4">
                    <div className="text-zinc-500 font-bold text-sm uppercase tracking-[0.15em] mb-2">
                       Waiting For Next Round
                    </div>
                    <div className="text-zinc-600 font-black tabular-nums" style={{ fontSize: "clamp(36px, 10vw, 80px)", lineHeight: 1 }}>
                      1.00<span style={{ fontSize: "0.65em" }}>×</span>
                    </div>
                  </div>
                )}
                {phase === "FLYING" && (
                  <div className="text-center font-black tabular-nums" style={{
                    color: "#ff8c00", fontSize: "clamp(40px, 10vw, 90px)", lineHeight: 1,
                    textShadow: "0 0 30px rgba(255,140,0,0.4)",
                  }}>
                    {multiplier.toFixed(2)}<span style={{ fontSize: "0.65em" }}>×</span>
                  </div>
                )}
                {phase === "CRASHED" && (
                  <div className="text-center">
                    <div className="font-black tabular-nums" style={{
                      color: "#e74c3c", fontSize: "clamp(40px, 10vw, 90px)", lineHeight: 1,
                      textShadow: "0 0 30px rgba(231,76,60,0.4)",
                    }}>
                      {multiplier.toFixed(2)}<span style={{ fontSize: "0.65em" }}>×</span>
                    </div>
                    <div className="mt-2 font-bold text-sm uppercase tracking-[0.2em]" style={{ color: "#e74c3c" }}>CRASHED</div>
                  </div>
                )}
                
                {/* Local Player Floating Cashout Message */}
                {playerCashedOut && phase === "FLYING" && (
                  <div className="absolute top-[60%] text-center font-black animate-pulse" style={{ color: "#2ecc71", fontSize: "24px" }}>
                    CASHED OUT!
                  </div>
                )}
              </div>

              {/* Rocket + flame */}
              <div style={{
                position: "absolute", left: "50%", bottom: `${rocketY}%`,
                transform: "translateX(-50%)", zIndex: 2,
                transition: phase === "FLYING" ? "none" : "bottom 600ms ease-out",
                display: "flex", flexDirection: "column", alignItems: "center",
              }}>
                <img
                  src="/limbo/rocket.png"
                  alt="Limbo Rocket"
                  width={110}
                  height={110}
                  loading="eager"
                  decoding="async"
                  style={{
                    width: "clamp(70px, 12vw, 110px)", height: "auto", display: "block",
                    filter: phase === "CRASHED" ? "grayscale(0.7) brightness(0.5)" : "drop-shadow(0 10px 30px rgba(0,0,0,0.5))",
                    transition: "filter 0.3s, transform 0.3s",
                    transform: phase === "CRASHED" ? "rotate(15deg)" : "rotate(0deg)",
                  }}
                />
                {(phase === "FLYING" || phase === "BETTING") && (
                  <div style={{
                    width: 81, height: 96, marginTop: -10,
                    backgroundRepeat: "no-repeat", backgroundSize: "81px auto",
                    backgroundImage: "url('/limbo/fire.png')",
                    backgroundPosition: `0px -${fireFrame * FIRE_FRAME_H}px`,
                  }} />
                )}
              </div>
            </div>

            {/* ── Bet controls ──────────────────────────────────────────── */}
            <div className="flex-shrink-0 pt-2">
              <div style={{ borderRadius: 16, border: "1px solid #2A2B2E", overflow: "hidden", background: "#191a1b" }}>

                {/* Manual / Auto tabs */}
                <div className="flex" style={{ borderBottom: "1px solid #2A2B2E" }}>
                  {(["manual", "auto"] as const).map(t => (
                    <button key={t} onClick={() => { if (!hasBetThisRound && !hasBetNextRound && phase === "BETTING" && !autoEnabled) setBetTab(t); }}
                      className="flex-1 py-2 text-xs font-bold uppercase tracking-[0.12em]"
                      disabled={hasBetThisRound || hasBetNextRound || autoEnabled}
                      style={{
                        color: betTab === t ? "#fff" : "#555",
                        borderBottom: betTab === t ? "2px solid #28a909" : "2px solid transparent",
                        background: "transparent",
                        opacity: (hasBetThisRound || hasBetNextRound || autoEnabled) ? 0.5 : 1
                      }}>
                      {t}
                    </button>
                  ))}
                </div>

                <div className="flex items-start gap-3 p-3 flex-wrap">
                  {/* Amount */}
                  <div className="flex flex-col gap-1" style={{ minWidth: 130 }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Amount</div>
                      <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.04] p-0.5">
                        {(["crypto"] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => handleWalletTypeChange(type)}
                            disabled={hasBetThisRound || hasBetNextRound || autoEnabled}
                            className="px-2 py-0.5 text-[10px] font-black rounded-full transition-colors disabled:opacity-40"
                            style={{
                              color: walletType === type ? "#fff" : "#71717a",
                              background: walletType === type ? "rgba(46,204,113,0.18)" : "transparent",
                            }}
                          >
                            {"$"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center" style={{ height: 34, borderRadius: 22, background: "#000", border: "1px solid #3C3C42", paddingLeft: 10, paddingRight: 4 }}>
                      <span style={{ color: "#e74c3c", marginRight: 4, fontSize: 13, fontWeight: 700 }}>{activeSymbol}</span>
                      <input type="text" value={betInput} disabled={hasBetThisRound || hasBetNextRound || autoEnabled}
                        onChange={e => setBetInput(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*?)\..*/g, "$1"))}
                        className="flex-1 bg-transparent text-white font-bold text-sm outline-none min-w-0" />
                      <div className="flex items-center gap-0.5 ml-1">
                        <button onClick={() => { if (!hasBetThisRound && !hasBetNextRound && !autoEnabled) adjustBet("down"); }} className="spin-btn">−</button>
                        <button onClick={() => { if (!hasBetThisRound && !hasBetNextRound && !autoEnabled) adjustBet("up"); }} className="spin-btn">+</button>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {[100, 200, 500, 1000].map(v => (
                        <button key={v} onClick={() => { if (!hasBetThisRound && !hasBetNextRound && !autoEnabled) setBetInput(v.toFixed(2)); }} className="quick-btn">{activeSymbol}{v}</button>
                      ))}
                    </div>
                  </div>

                  {/* Target (AUTO only) */}
                  {betTab === "auto" && (
                    <div className="flex flex-col gap-1" style={{ minWidth: 130 }}>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Target Multiplier</div>
                      <div className="flex items-center" style={{ height: 34, borderRadius: 22, background: "#000", border: "1px solid #3C3C42", paddingLeft: 10, paddingRight: 4 }}>
                        <input type="text" value={targetInput} disabled={autoEnabled}
                          onChange={e => setTargetInput(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*?)\..*/g, "$1"))}
                          className="flex-1 bg-transparent text-white font-bold text-sm outline-none min-w-0" />
                        <span className="text-zinc-500 font-bold text-sm mr-1">×</span>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => { if (!autoEnabled) adjustTarget("down"); }} className="spin-btn">‹</button>
                          <button onClick={() => { if (!autoEnabled) adjustTarget("up"); }} className="spin-btn">›</button>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {[1.5, 2, 5, 10, 100].map(v => (
                          <button key={v} onClick={() => { if (!autoEnabled) setTargetInput(v.toFixed(2)); }}
                            className="quick-btn" style={targetInput === v.toFixed(2) ? { background: "#1a2a1a", borderColor: "#2ecc71", color: "#2ecc71" } : {}}>
                            {v}×
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action button */}
                  <div className="flex-1 min-w-[120px] flex flex-col justify-end gap-1">
                    {betTab === "manual" ? (
                      <>
                        {hasBetThisRound && !playerCashedOut && phase === "FLYING" ? (
                          <button onClick={handleCashout} style={{
                            width: "100%", height: 64, borderRadius: 20, border: 0, cursor: "pointer",
                            backgroundColor: "#2ecc71", color: "#000", fontWeight: 800, fontSize: 18,
                            textTransform: "uppercase", transition: "all 0.15s",
                            boxShadow: "0 10px 15px -10px #2ecc71, inset 0 1px 1px rgba(255,255,255,0.5)",
                          }}>
                            CASH OUT ({activeSymbol}{(activeBetAmount * multiplier).toFixed(2)})
                          </button>
                        ) : hasBetNextRound ? (
                           <button onClick={handleCancelHit} style={{
                              width: "100%", height: 64, borderRadius: 20, border: 0, cursor: "pointer",
                              backgroundColor: "#c53030", color: "#fff", fontWeight: 800, fontSize: 16,
                              textTransform: "uppercase", transition: "all 0.15s",
                            }}>
                              CANCEL QUEUED BET
                            </button>
                        ) : (
                          <button onClick={handleBetClick} disabled={hasBetThisRound} style={{
                            width: "100%", height: 64, borderRadius: 20, border: 0,
                            cursor: hasBetThisRound ? "not-allowed" : "pointer",
                            backgroundColor: hasBetThisRound ? "#555" : "#28a909",
                            color: "#fff", fontWeight: 800, fontSize: 20,
                            textShadow: "0 1px 2px rgba(0,0,0,0.5)", textTransform: "uppercase",
                            boxShadow: hasBetThisRound ? "none" : "0 10px 15px -10px #28a909, inset 0 1px 1px rgba(255,255,255,0.5)",
                            transition: "all 0.15s",
                          }}>
                            {hasBetThisRound ? "PLAYING" : (phase === "BETTING" ? "BET" : "BET NEXT ROUND")}
                          </button>
                        )}
                      </>
                    ) : (
                      <button onClick={handleAutoToggle} style={{
                        width: "100%", height: 64, borderRadius: 20, border: 0, cursor: "pointer",
                        backgroundColor: autoEnabled ? "#c53030" : "#e69308", color: "#fff", fontWeight: 800, fontSize: 18,
                        textShadow: "0 1px 2px rgba(0,0,0,0.5)", textTransform: "uppercase",
                        boxShadow: autoEnabled ? "none" : "0 10px 15px -10px #e69308, inset 0 1px 1px rgba(255,255,255,0.5)",
                        transition: "all 0.15s",
                      }}>
                        {autoEnabled ? "STOP AUTO" : "START AUTO"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom row */}
                <div className="flex items-center justify-between px-3 py-2" style={{ background: "#111215", borderRadius: "0 0 16px 16px" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-600">Limbo Multiplayer</span>
                    <button onClick={() => setShowMobileBets(v => !v)}
                      className="md:hidden flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors"
                      style={{
                        background: showMobileBets ? "rgba(46,204,113,0.15)" : "rgba(255,255,255,0.05)",
                        color: showMobileBets ? "#2ecc71" : "#71717a",
                        border: showMobileBets ? "1px solid rgba(46,204,113,0.3)" : "1px solid rgba(255,255,255,0.1)",
                      }}>
                      <Users size={10} /> {roundBets.length}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.05] text-zinc-500 hover:text-white transition-colors">
                      {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                    <div className="text-[10px] text-zinc-500">
                      Balance: <span className="text-white font-bold">{activeSymbol}{activeBalance?.toFixed(2) ?? "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Live Bets Panel */}
            {showMobileBets && (
              <div className="md:hidden flex-shrink-0" style={{ background: "#141516", borderTop: "1px solid #1e1e1e", maxHeight: 240, overflow: "hidden" }}>
                <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid #1e1e1e" }}>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold">
                    Live Bets <span className="text-green-500">{roundBets.length}</span>
                  </span>
                  <button onClick={() => setShowMobileBets(false)} className="text-zinc-500 hover:text-white text-xs font-bold">Close</button>
                </div>
                <div className="flex px-2 py-1 text-[10px] text-zinc-600 font-bold uppercase" style={{ borderBottom: "1px solid #0F1016" }}>
                  <div style={{ width: "28%" }}>User</div>
                  <div style={{ width: "22%", textAlign: "center" }}>Bet</div>
                  <div style={{ width: "22%", textAlign: "center" }}>Multi</div>
                  <div style={{ width: "28%", textAlign: "right" }}>Payout</div>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 170, scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                  {roundBets.length === 0 ? (
                    <div className="text-center text-zinc-700 text-xs py-6">No bets yet</div>
                  ) : roundBets.map((b, i) => (
                    <div key={i} className="flex items-center px-2" style={{
                      height: 32, margin: "1px 2px", borderRadius: 16, fontSize: 11, fontWeight: 600,
                      background: b.result === "WIN" ? "linear-gradient(85deg,#0a2a0a,#0f1214)" : "linear-gradient(85deg,#1a0a0a,#0f1214)",
                      border: b.result === "WIN" ? "1px solid #2ecc7133" : "1px solid #0F1016",
                    }}>
                      <div style={{ width: "28%" }} className="truncate text-zinc-400">{b.username}</div>
                      <div style={{ width: "22%", textAlign: "center" }} className="text-zinc-300">{b.betAmount}</div>
                      <div style={{ width: "22%", textAlign: "center" }}>
                        {b.resultMultiplier ? (
                          <span style={{ color: "#2ecc71", fontWeight: 800 }}>{b.resultMultiplier.toFixed(2)}×</span>
                        ) : "-"}
                      </div>
                      <div style={{ width: "28%", textAlign: "right" }} className="text-zinc-300">
                        {b.result === "WIN" && b.payout ? `+${activeSymbol}${b.payout.toFixed(0)}` : "-"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <style jsx global>{`
        @keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .spin-btn { width: 18px; height: 18px; border-radius: 18px; background: #747474; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #000; font-size: 14px; font-weight: 700; line-height: 1; }
        .quick-btn { font-size: 10px; padding: 2px 4px; border: 1px solid #36363C; border-radius: 100px; background: #252528; color: #83878e; text-align: center; cursor: pointer; flex: 1; white-space: nowrap; transition: all 0.1s; }
        .quick-btn:hover { border-color: #555; color: #ccc; }
      `}</style>
    </div>
  );
}
