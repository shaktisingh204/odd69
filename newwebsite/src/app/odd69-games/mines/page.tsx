"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";
import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { useModal } from "@/context/ModalContext";
import { useOriginalsAccess } from "@/hooks/useOriginalsAccess";
import { useOriginalsSocket } from "@/hooks/useOriginalsSocket";
import toast from "react-hot-toast";
import { ChevronUp, ChevronDown, Star, Shield, RotateCcw, Play, StopCircle, Volume2, VolumeX } from "lucide-react";
import { useGameSounds } from "@/hooks/useGameSounds";

// ── Types ─────────────────────────────────────────────────────────────────────
type GameStatus = "idle" | "active" | "won" | "lost";
type TileState = "hidden" | "gem" | "mine" | "revealed-mine";
type BetMode = "manual" | "auto";

interface ActiveGame {
  gameId: string; mineCount: number; revealedTiles: number[];
  multiplier: number; potentialPayout: number; serverSeedHash: string;
  walletType: "fiat" | "crypto"; betAmount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TOTAL_TILES = 25;
const MIN_BET = 10;

function fmtBet(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}
// ── Colorful Gem Icon ──────────────────────────────────────────────────────────
function GemIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gemTop" x1="32" y1="0" x2="32" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a5f3fc" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="gemLeft" x1="0" y1="24" x2="32" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0e7490" />
          <stop offset="1" stopColor="#0c4a6e" />
        </linearGradient>
        <linearGradient id="gemRight" x1="64" y1="24" x2="32" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="gemCenter" x1="32" y1="24" x2="32" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      {/* Top facets */}
      <polygon points="32,4 52,22 32,22" fill="url(#gemTop)" opacity="0.9" />
      <polygon points="32,4 12,22 32,22" fill="url(#gemTop)" opacity="0.7" />
      {/* Side facets */}
      <polygon points="12,22 32,22 18,56" fill="url(#gemLeft)" />
      <polygon points="52,22 32,22 46,56" fill="url(#gemRight)" />
      {/* Center bottom */}
      <polygon points="32,22 18,56 46,56" fill="url(#gemCenter)" />
      {/* Top frame */}
      <polygon points="32,4 52,22 12,22" fill="none" stroke="#a5f3fc" strokeWidth="1" opacity="0.4" />
      {/* Highlight sparkle */}
      <circle cx="24" cy="16" r="2.5" fill="white" opacity="0.7" />
      <circle cx="28" cy="12" r="1.5" fill="white" opacity="0.5" />
    </svg>
  );
}

// ── Colorful Mine / Bomb Icon ─────────────────────────────────────────────────
function MineIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bombBody" cx="40%" cy="35%" r="65%">
          <stop stopColor="#9ca3af" />
          <stop offset="0.6" stopColor="#262936" />
          <stop offset="1" stopColor="#111827" />
        </radialGradient>
        <radialGradient id="explosion" cx="50%" cy="50%" r="50%">
          <stop stopColor="#C4B5FD" />
          <stop offset="0.4" stopColor="#f97316" />
          <stop offset="1" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Explosion rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <line key={i}
          x1={32 + Math.cos((deg * Math.PI) / 180) * 18}
          y1={32 + Math.sin((deg * Math.PI) / 180) * 18}
          x2={32 + Math.cos((deg * Math.PI) / 180) * 28}
          y2={32 + Math.sin((deg * Math.PI) / 180) * 28}
          stroke="#f97316" strokeWidth="3" strokeLinecap="round" opacity="0.8"
        />
      ))}
      {/* Body */}
      <circle cx="32" cy="34" r="18" fill="url(#bombBody)" />
      {/* Spikes */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <circle key={i}
          cx={32 + Math.cos((deg * Math.PI) / 180) * 18}
          cy={34 + Math.sin((deg * Math.PI) / 180) * 18}
          r="2.5" fill="#4b5563"
        />
      ))}
      {/* Fuse */}
      <path d="M32 16 Q38 8 44 10 Q50 12 48 6" stroke="#78716c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Fuse tip spark */}
      <circle cx="48" cy="6" r="3" fill="#ff9a3d" />
      <circle cx="48" cy="6" r="5" fill="#C4B5FD" opacity="0.5" />
      {/* Highlight on bomb */}
      <ellipse cx="26" cy="27" rx="5" ry="4" fill="white" opacity="0.15" transform="rotate(-30,26,27)" />
    </svg>
  );
}

// ── BigWin Overlay ─────────────────────────────────────────────────────────────
interface BigWinData {
  payout?: number;
  multiplier?: number;
}

function BigWinOverlay({ data, onClose }: { data: BigWinData | null; onClose: () => void }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {data && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-success-soft border border-green-500/40 rounded-2xl p-10 text-center max-w-xs mx-4 shadow-xl"
            style={{ boxShadow: "0 0 60px rgba(34,197,94,0.4)" }}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            transition={prefersReducedMotion ? { duration: 0.15 } : { type: "spring", stiffness: 320, damping: 20 }}
          >
            <motion.div
              className="flex justify-center mb-3"
              animate={prefersReducedMotion ? undefined : { rotate: [0, -8, 8, -5, 0], scale: [1, 1.12, 1] }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              <GemIcon size={64} />
            </motion.div>
            <div className="text-green-400 font-black text-xs tracking-widest uppercase mb-1">ODD69 MINES</div>
            <h2 className="text-3xl font-black text-white mb-1">BIG WIN!</h2>
            <div className="text-5xl font-black text-green-400 my-3">${data.payout?.toFixed(2)}</div>
            <div className="text-2xl text-yellow-400 font-black mb-6">{data.multiplier?.toFixed(2)}×</div>
            <button onClick={onClose} className="w-full py-3 bg-green-500 hover:bg-green-400 text-white font-black rounded-xl transition-all">
              Awesome! 🎯
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MinesPage() {
  const { token, loading: authLoading } = useAuth();
  const { canAccessOriginals, loading: accessLoading } = useOriginalsAccess();
  const { fiatBalance, cryptoBalance, refreshWallet, selectedWallet } = useWallet();
  const { openLogin } = useModal();
  const { playBet, playGemReveal, playMineExplosion, playWin, playBigWin, muted, toggleMute } = useGameSounds();
  const hasSession = !!token;
  const prefersReducedMotion = useReducedMotion();

  // Access gate — redirect non-allowed users
  useEffect(() => {
    if (!authLoading && !accessLoading && (!hasSession || !canAccessOriginals)) {
      window.location.href = "/";
    }
  }, [hasSession, authLoading, accessLoading, canAccessOriginals]);

  // Control state
  const [betMode, setBetMode] = useState<BetMode>("manual");
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [mineCount, setMineCount] = useState(4);
  const [useBonus, setUseBonus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Game state
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [tiles, setTiles] = useState<TileState[]>(Array(TOTAL_TILES).fill("hidden"));
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [potentialPayout, setPotentialPayout] = useState(0);
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [nearMissTiles, setNearMissTiles] = useState<Set<number>>(new Set());
  const [bigWin, setBigWin] = useState<BigWinData | null>(null);
  const [activePlayers, setActivePlayers] = useState(0);
  const [showFairness, setShowFairness] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // wait for reconnect event on mount
  const [boardShake, setBoardShake] = useState(0); // bump to trigger an explosion shake (visual only)
  const [explodedTile, setExplodedTile] = useState<number | null>(null); // the mine the player actually hit
  const [multiplierPulse, setMultiplierPulse] = useState(0); // bump to pulse the multiplier on each gem (visual only)

  // ── Auto mode state ────────────────────────────────────────────────────────
  const [autoRounds, setAutoRounds] = useState(10);
  const [autoRoundsLeft, setAutoRoundsLeft] = useState(0);
  const [autoCashoutGems, setAutoCashoutGems] = useState(3);   // cash out after N gems
  const [autoStopOnWin, setAutoStopOnWin] = useState(0);       // 0 = disabled
  const [autoStopOnLoss, setAutoStopOnLoss] = useState(0);     // 0 = disabled
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [autoProfit, setAutoProfit] = useState(0);

  const autoRunningRef = useRef(false);
  const activeGameRef = useRef<ActiveGame | null>(null);
  const tilesRef = useRef<TileState[]>(Array(TOTAL_TILES).fill("hidden"));
  const gemsRevealedRef = useRef(0);
  const engagementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs to avoid stale closures in auto callbacks
  const betInputRef = useRef(betInput);
  const mineCountRef = useRef(mineCount);
  const walletTypeRef = useRef(walletType);
  const useBonusRef = useRef(useBonus);
  const autoCashoutGemsRef = useRef(autoCashoutGems);
  const autoStopOnWinRef = useRef(autoStopOnWin);
  const autoStopOnLossRef = useRef(autoStopOnLoss);
  const autoProfitRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { betInputRef.current = betInput; }, [betInput]);
  useEffect(() => { mineCountRef.current = mineCount; }, [mineCount]);
  useEffect(() => { walletTypeRef.current = walletType; }, [walletType]);
  useEffect(() => { useBonusRef.current = useBonus; }, [useBonus]);
  useEffect(() => { autoCashoutGemsRef.current = autoCashoutGems; }, [autoCashoutGems]);
  useEffect(() => { autoStopOnWinRef.current = autoStopOnWin; }, [autoStopOnWin]);
  useEffect(() => { autoStopOnLossRef.current = autoStopOnLoss; }, [autoStopOnLoss]);

  useEffect(() => {
    setWalletType(selectedWallet as "fiat" | "crypto");
    if (selectedWallet === "crypto") setUseBonus(false);
  }, [selectedWallet]);
  useEffect(() => { activeGameRef.current = activeGame; }, [activeGame]);
  useEffect(() => { tilesRef.current = tiles; }, [tiles]);



  const betAmount = parseFloat(betInput) || 0;
  const activeBalance = walletType === "crypto" ? cryptoBalance : fiatBalance;
  const gemsRevealed = tiles.filter(t => t === "gem").length;
  const isGameActive = gameStatus === "active";

  // ── Socket ──────────────────────────────────────────────────────────────────
  const { connected, startGame: socketStart, revealTile: socketReveal, cashout: socketCashout } =
    useOriginalsSocket({
      game: "mines",
      onStarted: (data) => {
        setIsLoading(false);
        const game: ActiveGame = {
          gameId: data.gameId, betAmount, mineCount,
          revealedTiles: [], multiplier: 1,
          potentialPayout: 0, serverSeedHash: data.serverSeedHash, walletType,
        };
        setActiveGame(game);
        activeGameRef.current = game;
        setServerSeedHash(data.serverSeedHash);
        setTiles(Array(TOTAL_TILES).fill("hidden"));
        tilesRef.current = Array(TOTAL_TILES).fill("hidden");
        gemsRevealedRef.current = 0;
        setNearMissTiles(new Set());
        setExplodedTile(null);
        setCurrentMultiplier(1); setPotentialPayout(0);
        setGameStatus("active");
        refreshWallet();
        playBet();

        // Auto: start revealing tiles with delay
        if (autoRunningRef.current) {
          setTimeout(() => autoRevealNextTile(data.gameId, []), 600);
        }
      },
      onTileResult: (data) => {
        setIsLoading(false);
        playGemReveal();
        setTiles(prev => {
          const n = [...prev]; n[data.tileIndex] = "gem";
          tilesRef.current = n;
          gemsRevealedRef.current = n.filter(t => t === "gem").length;
          return n;
        });
        setCurrentMultiplier(data.multiplier);
        setPotentialPayout(data.potentialPayout);
        setActiveGame(prev => prev ? { ...prev, multiplier: data.multiplier, potentialPayout: data.potentialPayout } : null);
        setMultiplierPulse(p => p + 1); // animate the multiplier on each safe reveal (visual only)

        if (data.nearMiss) {
          const row = Math.floor(data.tileIndex / 5), col = data.tileIndex % 5;
          const adj = new Set<number>();
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < 5 && c >= 0 && c < 5) adj.add(r * 5 + c);
          }
          setNearMissTiles(adj);
          setTimeout(() => setNearMissTiles(new Set()), 1500);
        }

        // Auto: check if we should cash out now
        if (autoRunningRef.current && activeGameRef.current) {
          const revealed = gemsRevealedRef.current;
          if (revealed >= autoCashoutGemsRef.current) {
            // Cash out!
            setTimeout(() => {
              if (activeGameRef.current) socketCashout(activeGameRef.current.gameId);
            }, 400);
          } else {
            // Reveal next tile
            setTimeout(() => {
              if (activeGameRef.current) {
                autoRevealNextTile(activeGameRef.current.gameId, tilesRef.current);
              }
            }, 600);
          }
        }
      },
      onGameOver: (data) => {
        setIsLoading(false);
        playMineExplosion();
        playSound("lose"); // shared FX util — descending lose tone on mine hit
        setExplodedTile(data.tileIndex); // visualize the exact mine the server says was hit
        setBoardShake(s => s + 1); // trigger explosion shake (visual only)
        setTiles(prev => {
          const n = [...prev]; n[data.tileIndex] = "mine";
          (data.minePositions as number[]).forEach(mi => { if (mi !== data.tileIndex) n[mi] = "revealed-mine"; });
          tilesRef.current = n;
          return n;
        });
        setNearMissTiles(new Set());
        setGameStatus("lost"); setActiveGame(null);
        activeGameRef.current = null;
        refreshWallet();

        if (autoRunningRef.current) {
          const lossAmount = parseFloat(betInputRef.current) || 0;
          autoProfitRef.current -= lossAmount;
          setAutoProfit(autoProfitRef.current);
          const shouldStop = (autoStopOnLossRef.current > 0 && Math.abs(autoProfitRef.current) >= autoStopOnLossRef.current && autoProfitRef.current < 0);
          setAutoRoundsLeft(r => {
            const next = r - 1;
            if (next <= 0 || shouldStop) {
              stopAuto();
            } else {
              setTimeout(() => startAutoRound(), 1500);
            }
            return next;
          });
        }
      },
      onCashoutSuccess: (data) => {
        setIsLoading(false);
        if (data.multiplier >= 10) { playBigWin(); } else { playWin(); }
        // shared FX util — confetti + cashout chime driven by the server result
        playSound("cashout");
        if (data.multiplier >= 10) { fireBigWin(); } else { fireWin(); }
        setTiles(prev => {
          const n = [...prev];
          (data.minePositions as number[]).forEach(mi => { if (n[mi] === "hidden") n[mi] = "revealed-mine"; });
          tilesRef.current = n;
          return n;
        });
        setNearMissTiles(new Set());
        setCurrentMultiplier(data.multiplier);
        setGameStatus("won"); setActiveGame(null);
        activeGameRef.current = null;
        refreshWallet();
        if (data.multiplier >= 10) setBigWin(data);

        if (autoRunningRef.current) {
          const lastBet = parseFloat(betInputRef.current) || 0;
          const winAmount = (data.potentialPayout ?? 0) - lastBet;
          autoProfitRef.current += winAmount;
          setAutoProfit(autoProfitRef.current);
          const shouldStop = (autoStopOnWinRef.current > 0 && autoProfitRef.current >= autoStopOnWinRef.current);
          setAutoRoundsLeft(r => {
            const next = r - 1;
            if (next <= 0 || shouldStop) {
              stopAuto();
            } else {
              setTimeout(() => startAutoRound(), 1500);
            }
            return next;
          });
        }
      },
      onReconnected: (data) => {
        setActiveGame(data); setMineCount(data.mineCount);
        setBetInput(String(data.betAmount));
        setCurrentMultiplier(data.multiplier); setPotentialPayout(data.potentialPayout ?? 0);
        setServerSeedHash(data.serverSeedHash); setWalletType(data.walletType);
        const r: TileState[] = Array(TOTAL_TILES).fill("hidden");
        (data.revealedTiles as number[]).forEach((i: number) => { r[i] = "gem"; });
        setTiles(r); tilesRef.current = r;
        setGameStatus("active");
      },
      onError: (err) => {
        setIsLoading(false);
        toast.error(err.message);
        // If auto is running, stop it on any error to prevent infinite failure loop
        if (autoRunningRef.current) {
          stopAuto();
        }
      },
      onLiveBet: (data) => {
        const username = (data.username as string) || "Player";
        const amount = (data.betAmount as number) || 0;
        if (amount > 0) {
          toast(`${username} bet ${"$"}${amount.toFixed(0)} on Mines`, {
            duration: 2000,
            style: { background: "#1a1d24", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 11, padding: "6px 10px" },
          });
        }
      },
      onBigWin: (data) => { setBigWin(data); setTimeout(() => setBigWin(null), 8000); },
      onEngagement: (data) => {
        if (engagementTimeoutRef.current) clearTimeout(engagementTimeoutRef.current);
        toast(data.message, { duration: 4000, icon: "🎯", style: { background: "#1a1208", border: "1px solid #22c55e", color: "#22c55e", fontWeight: "bold" } });
      },
      onStats: (data) => setActivePlayers(data.activePlayers ?? 0),
    });

  // Wait 2.5s after connect for server to replay active game before enabling Bet button
  // This prevents 'already have active game' errors when page is refreshed mid-game
  useEffect(() => {
    if (!connected) { setIsInitializing(true); return; }
    const t = setTimeout(() => setIsInitializing(false), 2500);
    return () => clearTimeout(t);
  }, [connected]);

  // Clear initializing immediately when active game comes in via onReconnected
  useEffect(() => {
    if (activeGame) setIsInitializing(false);
  }, [activeGame]);

  // ── Auto helpers ────────────────────────────────────────────────────────────
  const autoRevealNextTile = useCallback((gameId: string, currentTiles: TileState[]) => {
    if (!autoRunningRef.current) return;
    const hidden = currentTiles
      .map((t, i) => ({ t, i }))
      .filter(x => x.t === "hidden")
      .map(x => x.i);
    if (hidden.length === 0) return;
    const randomIdx = hidden[Math.floor(Math.random() * hidden.length)];
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 800);
    socketReveal(gameId, randomIdx);
  }, [socketReveal]);

  const startAutoRound = useCallback(() => {
    if (!autoRunningRef.current) return;
    // Read fresh values from refs — avoids stale closures
    const bet = parseFloat(betInputRef.current) || 0;
    const mines = mineCountRef.current;
    const wallet = walletTypeRef.current;
    const bonus = useBonusRef.current;
    setIsLoading(true);
    setGameStatus("idle");
    setTiles(Array(TOTAL_TILES).fill("hidden"));
    tilesRef.current = Array(TOTAL_TILES).fill("hidden");
    gemsRevealedRef.current = 0;
    setExplodedTile(null);
    // Extra guard: make sure no active game exists
    if (activeGameRef.current !== null) {
      console.warn("[Auto] Tried to start but activeGame exists, skipping");
      setIsLoading(false);
      return;
    }
    setTimeout(() => {
      if (!autoRunningRef.current) { setIsLoading(false); return; }
      socketStart({ betAmount: bet, mineCount: mines, walletType: wallet, useBonus: bonus });
    }, 400);
  }, [socketStart]);

  const stopAuto = useCallback(() => {
    autoRunningRef.current = false;
    setIsAutoRunning(false);
    setAutoRoundsLeft(0);
    toast.success("Auto mode stopped");
  }, []);

  const handleStartAuto = () => {
    if (!hasSession) { openLogin(); return; }
    if (betAmount < MIN_BET) { toast.error(`Min bet $${MIN_BET}`); return; }
    if (betAmount > activeBalance) { toast.error("Insufficient balance"); return; }

    // Validation: must have at least 1 gem-reveal set
    if (autoCashoutGems < 1) {
      toast.error("Set at least 1 gem to reveal before auto-cashing out"); return;
    }
    if (autoCashoutGems > 25 - mineCount) {
      toast.error(`Can't reveal ${autoCashoutGems} gems with ${mineCount} mines (only ${25 - mineCount} gems exist)`); return;
    }

    // Guard: don't start if there's an unfinished game
    if (activeGame || gameStatus === "active") {
      toast.error("Finish or cash out your current game first"); return;
    }

    autoProfitRef.current = 0;
    autoRunningRef.current = true;
    setIsAutoRunning(true);
    setAutoProfit(0);
    setAutoRoundsLeft(autoRounds);
    startAutoRound();
  };

  // ── Manual actions ──────────────────────────────────────────────────────────
  const handleBet = () => {
    if (!hasSession) { openLogin(); return; }
    if (betAmount < MIN_BET) { toast.error(`Min bet $${MIN_BET}`); return; }
    if (betAmount > activeBalance) { toast.error("Insufficient balance"); return; }
    setIsLoading(true);
    socketStart({ betAmount, mineCount, walletType, useBonus });
  };

  const handleTile = (idx: number) => {
    if (!activeGame || !isGameActive || isLoading || isAutoRunning || tiles[idx] !== "hidden") return;
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
    socketReveal(activeGame.gameId, idx);
  };

  const handleCashout = () => {
    if (!activeGame) return;
    setIsLoading(true);
    socketCashout(activeGame.gameId);
  };

  const handleReset = () => {
    setGameStatus("idle");
    setTiles(Array(TOTAL_TILES).fill("hidden"));
    tilesRef.current = Array(TOTAL_TILES).fill("hidden");
    setNearMissTiles(new Set());
    setExplodedTile(null);
    setCurrentMultiplier(1); setPotentialPayout(0);
    setActiveGame(null); activeGameRef.current = null; setIsLoading(false);
  };

  const adjustBet = (mult: number | "half") => {
    if (isGameActive || isAutoRunning) return;
    const cur = parseFloat(betInput) || 0;
    if (mult === "half") setBetInput(String(Math.max(MIN_BET, Math.floor(cur / 2))));
    else setBetInput(String(Math.min(Math.floor(cur * (mult as number)), Math.floor(activeBalance))));
  };

  const QUICK_BETS = [10, 100, 1000, 10000];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen md:h-screen overflow-y-auto md:overflow-hidden bg-bg-odd69 flex flex-col">
      <Header />

      <div className="flex flex-1 md:overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
        <LeftSidebar />

        <main className="flex-1 min-w-0 flex flex-col md:overflow-hidden border-l border-white/[0.04]">
          <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">

            {/* ── LEFT CONTROL PANEL (mobile: order 2, desktop: order 1 left) */}
            <div className="w-full md:w-72 xl:w-80 flex-shrink-0 bg-bg-modal-2 border-t md:border-t-0 md:border-r border-white/[0.04] flex flex-col overflow-y-auto order-2 md:order-1">

              {/* Manual / Auto tabs */}
              <div className="flex border-b border-white/[0.06]">
                {(["manual", "auto"] as const).map((m) => (
                  <button key={m} onClick={() => !isGameActive && !isAutoRunning && setBetMode(m)}
                    className={`flex-1 py-3 text-sm font-bold capitalize transition-all relative
                      ${betMode === m ? "text-white" : "text-[#6b7280] hover:text-white"}`}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                    {betMode === m && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400" />}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-4 space-y-4">

                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">Amount</label>
                    <div className="flex items-center gap-1 text-[11px] text-[#6b7280]">
                      <span className={`px-1.5 py-0.5 rounded cursor-pointer hover:text-white transition-colors ${walletType === "fiat" ? "text-white" : ""}`}
                        onClick={() => !isGameActive && !isAutoRunning && setWalletType("fiat")}>$</span>
                      <span className="opacity-30">|</span>
                      <span className={`px-1.5 py-0.5 rounded cursor-pointer hover:text-white transition-colors ${walletType === "crypto" ? "text-white" : ""}`}
                        onClick={() => { if (!isGameActive && !isAutoRunning) { setWalletType("crypto"); setUseBonus(false); } }}>$</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 relative flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg overflow-hidden focus-within:border-green-500/40">
                      <div className="pl-3 pr-1 text-sm font-bold text-[#9ca3af]">{"$"}</div>
                      <input type="number" value={betInput} disabled={isGameActive || isAutoRunning}
                        onChange={(e) => setBetInput(e.target.value)}
                        className="flex-1 bg-transparent py-2.5 pr-2 text-white text-sm font-bold outline-none min-w-0" />
                      <div className="flex flex-col border-l border-white/[0.06]">
                        <button onClick={() => !isGameActive && !isAutoRunning && setBetInput(String((parseFloat(betInput) || 0) + 1))}
                          disabled={isGameActive || isAutoRunning}
                          className="px-2 py-1 hover:bg-white/[0.05] text-[#6b7280] hover:text-white transition-colors disabled:opacity-40">
                          <ChevronUp size={12} />
                        </button>
                        <button onClick={() => !isGameActive && !isAutoRunning && setBetInput(String(Math.max(MIN_BET, (parseFloat(betInput) || 0) - 1)))}
                          disabled={isGameActive || isAutoRunning}
                          className="px-2 py-1 hover:bg-white/[0.05] text-[#6b7280] hover:text-white transition-colors disabled:opacity-40 border-t border-white/[0.06]">
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                    <button onClick={() => adjustBet("half")} disabled={isGameActive || isAutoRunning}
                      className="px-3 py-2.5 bg-bg-deep-3 border border-white/[0.06] rounded-lg text-xs font-bold text-[#9ca3af] hover:text-white hover:border-white/[0.12] transition-all disabled:opacity-40">½</button>
                    <button onClick={() => adjustBet(2)} disabled={isGameActive || isAutoRunning}
                      className="px-3 py-2.5 bg-bg-deep-3 border border-white/[0.06] rounded-lg text-xs font-bold text-[#9ca3af] hover:text-white hover:border-white/[0.12] transition-all disabled:opacity-40">2×</button>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {QUICK_BETS.map(n => (
                      <button key={n} onClick={() => !isGameActive && !isAutoRunning && setBetInput(String(n))}
                        disabled={isGameActive || isAutoRunning}
                        className="py-1.5 bg-bg-deep-3 border border-white/[0.06] hover:border-white/[0.12] hover:text-white rounded-lg text-[#9ca3af] text-xs font-bold transition-all disabled:opacity-40">
                        {fmtBet(n)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mines slider */}
                <div>
                  <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-3 block">Mines</label>
                  <div className="flex items-center gap-3">
                    <span className="text-white text-sm font-black w-5 text-right">1</span>
                    <div className="relative flex-1 h-1.5 mt-2 mb-2">
                      <div className="absolute inset-0 bg-bg-deep-3 rounded-full border border-white/[0.06] overflow-hidden">
                        <div className="absolute left-0 top-0 h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${((mineCount - 1) / 23) * 100}%` }} />
                      </div>
                      <input type="range" min={1} max={24} value={mineCount}
                        onChange={(e) => !isGameActive && !isAutoRunning && setMineCount(parseInt(e.target.value))}
                        disabled={isGameActive || isAutoRunning}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed h-1.5 z-20" />
                      <div className="absolute top-[-7px] w-5 h-5 bg-white rounded-full border-2 border-green-500 shadow-lg pointer-events-none transition-all z-10"
                        style={{ left: `calc(${((mineCount - 1) / 23) * 100}% - 10px)` }} />
                    </div>
                    <span className="text-white text-sm font-black w-5">24</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[#6b7280] text-[11px]">Mines: <strong className="text-white">{mineCount}</strong></span>
                    <span className="text-[#6b7280] text-[11px]">Gems: <strong className="text-green-400">{25 - mineCount}</strong></span>
                  </div>
                </div>

                {/* ── AUTO MODE SETTINGS ─────────────────────────────────── */}
                {betMode === "auto" && (
                  <div className="space-y-3 border-t border-white/[0.06] pt-3">
                    <p className="text-[10px] text-[#6b7280] font-bold uppercase tracking-wider">Auto Settings</p>

                    {/* Number of rounds */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#9ca3af]">Number of Bets</span>
                      <div className="flex items-center gap-1">
                        {[5, 10, 20, 50, 100].map(n => (
                          <button key={n} onClick={() => setAutoRounds(n)}
                            className={`w-8 h-7 rounded text-[10px] font-black transition-all border
                              ${autoRounds === n ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-bg-deep-3 border-white/[0.06] text-[#6b7280] hover:text-white"}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cash out after N gems */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#9ca3af]">Cash out at gems</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setAutoCashoutGems(g => Math.max(1, g - 1))}
                          className="w-6 h-6 bg-bg-deep-3 border border-white/[0.06] rounded text-[#6b7280] hover:text-white flex items-center justify-center">−</button>
                        <span className="text-white font-black text-sm w-5 text-center">{autoCashoutGems}</span>
                        <button onClick={() => setAutoCashoutGems(g => Math.min(25 - mineCount, g + 1))}
                          className="w-6 h-6 bg-bg-deep-3 border border-white/[0.06] rounded text-[#6b7280] hover:text-white flex items-center justify-center">+</button>
                      </div>
                    </div>

                    {/* Stop on win */}
                    <div>
                      <label className="text-[11px] text-[#9ca3af] block mb-1">Stop on Win (profit ≥)</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#6b7280] text-xs">{"$"}</span>
                        <input type="number" value={autoStopOnWin || ""}
                          onChange={e => setAutoStopOnWin(parseFloat(e.target.value) || 0)}
                          placeholder="0 = disabled"
                          className="flex-1 bg-bg-deep-3 border border-white/[0.06] focus:border-green-500/40 rounded-lg px-2 py-1.5 text-white text-xs font-bold outline-none" />
                      </div>
                    </div>

                    {/* Stop on loss */}
                    <div>
                      <label className="text-[11px] text-[#9ca3af] block mb-1">Stop on Loss (loss ≥)</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#6b7280] text-xs">{"$"}</span>
                        <input type="number" value={autoStopOnLoss || ""}
                          onChange={e => setAutoStopOnLoss(parseFloat(e.target.value) || 0)}
                          placeholder="0 = disabled"
                          className="flex-1 bg-bg-deep-3 border border-white/[0.06] focus:border-green-500/40 rounded-lg px-2 py-1.5 text-white text-xs font-bold outline-none" />
                      </div>
                    </div>

                    {/* Auto profit tracker */}
                    {isAutoRunning && (
                      <div className="bg-bg-deep-3 border border-white/[0.06] rounded-xl px-3 py-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#6b7280]">Rounds left</span>
                          <span className="text-white font-black">{autoRoundsLeft}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#6b7280]">Net profit</span>
                          <span className={`font-black ${autoProfit >= 0 ? "text-green-400" : "text-danger"}`}>
                            {autoProfit >= 0 ? "+" : ""}{"$"}{autoProfit.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bonus toggle */}
                {betMode === "manual" && (
                  <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                    <span className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">Casino Bonus</span>
                    <button onClick={() => !isGameActive && walletType !== "crypto" && setUseBonus(v => !v)}
                      disabled={isGameActive || walletType === "crypto"}
                      className={`relative w-10 h-5 rounded-full transition-all border flex-shrink-0
                        ${useBonus && walletType !== "crypto" ? "bg-green-500 border-green-500" : "bg-bg-deep-3 border-white/[0.06]"}
                        ${isGameActive || walletType === "crypto" ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${useBonus && walletType !== "crypto" ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  </div>
                )}

                {/* Balance */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#6b7280]">Balance</span>
                  <span className="text-white font-black">{"$"}{activeBalance.toFixed(2)}</span>
                </div>

                {/* Live stats while active */}
                {isGameActive && (
                  <div className="bg-bg-deep-3 border border-white/[0.06] rounded-xl p-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6b7280]">Gems found</span>
                      <span className="text-white font-black">{gemsRevealed}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6b7280]">Multiplier</span>
                      <motion.span
                        key={multiplierPulse}
                        className="text-yellow-400 font-black"
                        initial={prefersReducedMotion ? false : { scale: 1.35, color: "#ff9a3d" }}
                        animate={{ scale: 1, color: "#facc15" }}
                        transition={{ type: "spring", stiffness: 500, damping: 18 }}
                      >
                        {currentMultiplier.toFixed(4)}×
                      </motion.span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6b7280]">Cash out</span>
                      <span className="text-green-400 font-black">{"$"}{potentialPayout.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Action button */}
                {!hasSession ? (
                  <button onClick={openLogin}
                    className="w-full py-4 bg-green-500 hover:bg-green-400 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                    Login to Play
                  </button>
                ) : betMode === "auto" ? (
                  isAutoRunning ? (
                    <button onClick={stopAuto}
                      className="w-full py-4 bg-danger-alpha-16 border border-red-500/50 hover:bg-red-500/30 text-danger font-black text-base rounded-xl transition-all flex items-center justify-center gap-2">
                      <StopCircle size={18} /> Stop Auto
                    </button>
                  ) : (
                    <button onClick={handleStartAuto} disabled={isLoading || !connected || isInitializing}
                      className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                      {isInitializing ? <><RotateCcw size={18} className="animate-spin" /> Checking…</> : <><Play size={18} fill="currentColor" /> Start Auto ({autoRounds} bets)</>}
                    </button>
                  )
                ) : gameStatus === "idle" ? (
                  <button onClick={handleBet} disabled={isLoading || !connected || isInitializing}
                    className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                    {isInitializing
                      ? <><RotateCcw size={18} className="animate-spin" /> Checking…</>
                      : isLoading ? <><RotateCcw size={18} className="animate-spin" /> Starting…</> : "Bet"}
                  </button>
                ) : gameStatus === "active" ? (
                  <button onClick={handleCashout} disabled={isLoading || gemsRevealed === 0}
                    className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                    {isLoading ? <RotateCcw size={18} className="animate-spin" /> : null}
                    Cash Out {"$"}{potentialPayout.toFixed(2)}
                  </button>
                ) : (
                  <button onClick={handleReset}
                    className="w-full py-4 bg-bg-deep-3 border border-white/[0.06] hover:border-white/[0.12] text-white font-black text-base rounded-xl transition-all flex items-center justify-center gap-2">
                    <RotateCcw size={16} /> New Game
                  </button>
                )}

              </div>

              {/* Bottom bar */}
              <div className="border-t border-white/[0.06] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-[#6b7280]">
                  <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                  {activePlayers > 0 && (
                    <div className="flex items-center gap-1 text-[11px]">
                      <Star size={11} /><span>{activePlayers}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.05] text-[#6b7280] hover:text-white transition-colors">
                    {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                  <button onClick={() => setShowFairness(v => !v)}
                    className="flex items-center gap-1.5 text-[11px] text-[#6b7280] hover:text-white transition-colors">
                    <Shield size={12} /> Provably Fair
                  </button>
                </div>
              </div>
              {showFairness && (
                <div className="border-t border-white/[0.06] p-4 bg-bg-deep-3 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-[#6b7280] font-bold uppercase tracking-wider">Server Seed Hash</p>
                      {serverSeedHash && (
                        <button onClick={() => { navigator.clipboard.writeText(serverSeedHash); toast.success("Copied!"); }}
                          className="text-[9px] text-[#6b7280] hover:text-white transition-colors">Copy</button>
                      )}
                    </div>
                    <p className="text-[9px] text-[#9ca3af] break-all font-mono leading-relaxed bg-black/20 rounded px-2 py-1.5 border border-white/[0.04]">
                      {serverSeedHash || "Place a bet to generate seed"}
                    </p>
                  </div>
                  <div className="text-[10px] text-[#6b7280] leading-relaxed">
                    <p className="font-bold uppercase tracking-wider mb-1">How it works</p>
                    <p>Before each game, the server generates a seed and shows you its SHA-256 hash. After the game, the original seed is revealed so you can verify the hash matches — proving the outcome was predetermined and not manipulated.</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT GAME BOARD ────────────────────────────────────────── */}
            <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden md:order-2 order-1"
              style={{ background: "radial-gradient(ellipse at 50% 30%, #1a2a1a 0%, #0d1117 40%, #080b10 100%)", minHeight: 340 }}>

              {/* Atmospheric Background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                <div className="absolute top-4 right-16 w-20 h-20 rounded-full opacity-20"
                  style={{ background: "radial-gradient(circle, #c8d8ff 0%, transparent 70%)" }} />
                <div className="absolute bottom-0 left-0 right-0 h-24 opacity-30"
                  style={{ background: "linear-gradient(to top, #0a1a0a 0%, transparent 100%)" }} />
                {[{ x: "15%", y: "20%" }, { x: "80%", y: "15%" }, { x: "25%", y: "75%" }, { x: "90%", y: "70%" }, { x: "60%", y: "85%" }].map((s, i) => (
                  <div key={i} className="absolute text-white/30 text-xs animate-pulse"
                    style={{ left: s.x, top: s.y, animationDelay: `${i * 0.7}s` }}>✦</div>
                ))}
              </div>

              {/* Status text */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[#6b7280] text-xs font-medium px-4 py-1.5 bg-black/30 backdrop-blur-md rounded-full border border-white/[0.04]">
                {isAutoRunning
                  ? `🤖 Auto · Round ${autoRounds - autoRoundsLeft + 1}/${autoRounds} · ${gemsRevealed} gems`
                  : gameStatus === "idle" ? "Game result will be displayed"
                    : gameStatus === "active" ? `💎 ${gemsRevealed} gem${gemsRevealed !== 1 ? "s" : ""} found · ${currentMultiplier.toFixed(4)}×`
                      : gameStatus === "won" ? `🎉 Cashed out at ${currentMultiplier.toFixed(4)}×`
                        : "💥 Mine hit! Try again"}
              </div>

              {/* Animated multiplier readout — visualizes the server-returned multiplier */}
              <AnimatePresence>
                {(isGameActive || gameStatus === "won") && gemsRevealed > 0 && (
                  <motion.div
                    key="mult-readout"
                    className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center"
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  >
                    <motion.div
                      key={multiplierPulse}
                      className="font-black tabular-nums"
                      style={{
                        fontSize: "clamp(28px, 6vw, 52px)",
                        color: gameStatus === "won" ? "#22c55e" : "#ff9a3d",
                        textShadow: gameStatus === "won"
                          ? "0 0 30px rgba(34,197,94,0.5)"
                          : "0 0 28px rgba(255,154,61,0.45)",
                      }}
                      initial={prefersReducedMotion ? false : { scale: 1.3 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 480, damping: 16 }}
                    >
                      {currentMultiplier.toFixed(2)}×
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 5×5 Grid — board shakes on a mine hit (server-driven game-over) */}
              <motion.div
                className="relative z-10 grid gap-2 md:gap-3 p-3 md:p-4 w-full"
                style={{ gridTemplateColumns: "repeat(5, 1fr)", maxWidth: "min(640px, 100%)", margin: "0 auto" }}
                animate={
                  boardShake && !prefersReducedMotion
                    ? { x: [0, -10, 9, -7, 5, -3, 0], y: [0, 4, -3, 3, -2, 1, 0] }
                    : { x: 0, y: 0 }
                }
                transition={{ duration: 0.45, ease: "easeOut" }}
                key={`shake-${boardShake}`}
              >
                {tiles.map((state, idx) => {
                  const clickable = state === "hidden" && isGameActive && !isLoading && !isAutoRunning;
                  const isNearMiss = nearMissTiles.has(idx) && state === "hidden";
                  const isExploded = state === "mine" && explodedTile === idx;
                  const revealed = state !== "hidden";

                  return (
                    <motion.button key={idx} onClick={() => handleTile(idx)} disabled={!clickable}
                      whileHover={clickable && !prefersReducedMotion ? { scale: 1.06 } : undefined}
                      whileTap={clickable && !prefersReducedMotion ? { scale: 0.92 } : undefined}
                      className={`
                        aspect-square rounded-xl border relative overflow-hidden
                        ${state === "hidden"
                          ? clickable
                            ? `bg-bg-elevated border-[#3a3d45] hover:bg-bg-hover hover:border-[#4a4d55] cursor-pointer
                               ${isNearMiss ? "border-orange-400/40 shadow-[0_0_12px_rgba(251,146,60,0.25)]" : ""}`
                            : `bg-bg-surface-3 border-[#2a2d35] cursor-not-allowed ${isGameActive && !isAutoRunning ? "" : "opacity-60"}`
                          : ""}
                        ${state === "gem" ? "bg-success-soft border-cyan-500/50" : ""}
                        ${state === "mine" ? "bg-danger-soft border-red-500/60" : ""}
                        ${state === "revealed-mine" ? "bg-danger-soft border-red-900/20 opacity-40" : ""}
                      `}
                      style={{ transformStyle: "preserve-3d", perspective: 600 }}
                    >
                      {/* Tile shine (hidden state) */}
                      {state === "hidden" && (
                        <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/[0.03] rounded-t-xl" />
                      )}

                      {/* Animated reveal content — flip-in driven by the server result */}
                      <AnimatePresence>
                        {revealed && (
                          <motion.div
                            key={state}
                            className="absolute inset-0 flex items-center justify-center"
                            initial={
                              prefersReducedMotion
                                ? { opacity: 1, scale: 1, rotateY: 0 }
                                : state === "gem"
                                  ? { opacity: 0, scale: 0.4, rotateY: 90 }
                                  : state === "mine"
                                    ? { opacity: 0, scale: 0.55 }
                                    : { opacity: 0, scale: 0.7 }
                            }
                            animate={
                              prefersReducedMotion
                                ? { opacity: state === "revealed-mine" ? 0.35 : 1, scale: 1, rotateY: 0 }
                                : state === "gem"
                                  ? { opacity: 1, scale: [0.4, 1.12, 1.03], rotateY: [90, -8, 0] }
                                  : state === "mine"
                                    ? { opacity: 1, scale: [0.55, 1.32, 0.95, 1.03] }
                                    : { opacity: 0.35, scale: 1 }
                            }
                            transition={
                              prefersReducedMotion
                                ? { duration: 0 }
                                : state === "gem"
                                  ? { duration: 0.34, ease: "easeOut" }
                                  : state === "mine"
                                    ? { duration: 0.38, ease: "easeOut" }
                                    : { duration: 0.25, ease: "easeOut" }
                            }
                          >
                            {/* Gem with sparkle halo */}
                            {state === "gem" && (
                              <>
                                <div className="absolute inset-0 bg-cyan-500/5" />
                                {!prefersReducedMotion && (
                                  <motion.div
                                    className="absolute inset-0 rounded-xl"
                                    style={{ background: "radial-gradient(circle at 50% 45%, rgba(34,211,238,0.45) 0%, transparent 60%)" }}
                                    initial={{ opacity: 0.9, scale: 0.6 }}
                                    animate={{ opacity: 0, scale: 1.6 }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                  />
                                )}
                                <motion.div
                                  className="relative z-10"
                                  animate={prefersReducedMotion ? undefined : { y: [0, -2, 0] }}
                                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                                >
                                  <GemIcon size={36} />
                                </motion.div>
                                {/* Sparkle twinkles */}
                                {!prefersReducedMotion && [
                                  { x: "22%", y: "26%", d: 0 },
                                  { x: "74%", y: "34%", d: 0.18 },
                                  { x: "60%", y: "72%", d: 0.3 },
                                ].map((s, i) => (
                                  <motion.span
                                    key={i}
                                    className="absolute z-20 text-white text-[10px] select-none"
                                    style={{ left: s.x, top: s.y }}
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
                                    transition={{ duration: 0.7, delay: 0.15 + s.d, ease: "easeOut" }}
                                  >
                                    ✦
                                  </motion.span>
                                ))}
                              </>
                            )}

                            {/* Mine hit — explosion flash on the tile the server returned */}
                            {state === "mine" && (
                              <>
                                {isExploded && !prefersReducedMotion && (
                                  <motion.div
                                    className="absolute inset-0 rounded-xl z-20"
                                    style={{ background: "radial-gradient(circle at 50% 50%, #fff 0%, #ff9a3d 35%, rgba(220,38,38,0) 75%)" }}
                                    initial={{ opacity: 1, scale: 0.3 }}
                                    animate={{ opacity: 0, scale: 2.2 }}
                                    transition={{ duration: 0.55, ease: "easeOut" }}
                                  />
                                )}
                                <div className="absolute inset-0 bg-danger-alpha-10 animate-pulse" />
                                <motion.div
                                  className="relative z-10"
                                  animate={prefersReducedMotion ? undefined : { rotate: [0, -8, 8, -4, 0] }}
                                  transition={{ duration: 0.4, ease: "easeOut" }}
                                >
                                  <MineIcon size={36} />
                                </motion.div>
                              </>
                            )}

                            {/* Revealed (non-hit) mine */}
                            {state === "revealed-mine" && (
                              <div className="opacity-90">
                                <MineIcon size={28} />
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </motion.div>

              {/* Mobile cashout — hidden since controls panel is below on mobile now */}
            </div>
          </div>

          {/* Bottom info bar */}
          <div className="flex-shrink-0 px-5 py-3 bg-bg-deep-3 border-t border-white/[0.04] flex items-center justify-between">
            <div>
              <span className="text-white text-sm font-black">Mines</span>
              <span className="text-[#6b7280] text-xs ml-2">by ODD69 Originals</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] px-2.5 py-1 bg-bg-modal-2 border border-white/[0.06] rounded-full text-[#9ca3af]"># Mining</span>
              <span className="text-[11px] px-2.5 py-1 bg-bg-modal-2 border border-white/[0.06] rounded-full text-[#9ca3af]"># ODD69 Originals</span>
              <span className="text-[11px] px-2.5 py-1 bg-bg-modal-2 border border-white/[0.06] rounded-full text-[#9ca3af]"># Provably Fair</span>
            </div>
          </div>
        </main>
      </div>

      <BigWinOverlay data={bigWin} onClose={() => setBigWin(null)} />
    </div>
  );
}
