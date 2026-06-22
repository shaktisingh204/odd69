"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, type Transition } from "framer-motion";
import Lottie from "lottie-react";
import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/context/ModalContext";
import api from "@/services/api";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DayReward {
  day: number;
  reward: number;
  currency: string;
  claimed: boolean;
  isCurrent: boolean;
}

interface CheckInStatus {
  streak: number;
  canClaimToday: boolean;
  lastCheckin: string | null;
  rewards: DayReward[];
  totalEarned: number;
}

interface Props {
  onClose: () => void;
  hasDeposited?: boolean;
}

// ─── Lottie URLs ─────────────────────────────────────────────────────────────
const CONFETTI_URL = "https://assets9.lottiefiles.com/packages/lf20_u4yrau.json";
const FIRE_URL     = "https://assets9.lottiefiles.com/packages/lf20_xlkxtmul.json";
const COIN_URL     = "https://assets9.lottiefiles.com/packages/lf20_vnikge3g.json";

// ─── Day reward config ────────────────────────────────────────────────────────
const BASE_REWARDS: Omit<DayReward, "claimed" | "isCurrent">[] = [
  { day: 1, reward: 10,  currency: "INR" },
  { day: 2, reward: 20,  currency: "INR" },
  { day: 3, reward: 30,  currency: "INR" },
  { day: 4, reward: 50,  currency: "INR" },
  { day: 5, reward: 75,  currency: "INR" },
  { day: 6, reward: 100, currency: "INR" },
  { day: 7, reward: 200, currency: "INR" },
];

const DAY_ICONS = ["🎁", "⚡", "💎", "🔥", "⭐", "🏆", "👑"];

function formatReward(amount: number, currency: string): string {
  if (currency === "INR") return `$${amount}`;
  if (currency === "USD") return `$${amount}`;
  return `${amount} ${currency}`;
}

// ─── Circular Progress ────────────────────────────────────────────────────────
function CircularProgress({ value, max, size = 56 }: { value: number; max: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / max) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
      <motion.circle
        cx={size/2} cy={size/2} r={radius}
        fill="none" stroke="url(#ciGrad)" strokeWidth={5} strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
      />
      <defs>
        <linearGradient id="ciGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff7a1a" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Day Card ─────────────────────────────────────────────────────────────────
function DayCard({ day, reward, currency, claimed, isCurrent, index, locked }: DayReward & { index: number; locked: boolean }) {
  const icon = DAY_ICONS[index] || "🎁";
  const isLastDay = index === 6;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.88 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.05 * index, type: "spring", stiffness: 240, damping: 22 }}
      className="relative flex flex-col items-center gap-1 select-none"
    >
      {/* Card */}
      <div
        className={`
          relative w-full rounded-2xl p-2 flex flex-col items-center gap-1.5 overflow-hidden
          transition-all duration-300 cursor-default
          ${claimed
            ? "bg-gradient-to-b from-success-primary/20 to-success-soft border border-success-primary/40"
            : isCurrent && !locked
              ? "bg-gradient-to-b from-amber-500/25 to-orange-900/20 border border-amber-400/70 shadow-[0_0_20px_rgba(255, 122, 26,0.4)]"
              : isLastDay && !locked
                ? "bg-gradient-to-b from-yellow-500/15 to-yellow-900/10 border border-yellow-400/30"
                : "bg-white/[0.04] border border-white/[0.07]"
          }
          ${locked ? "opacity-45 grayscale-[0.4]" : ""}
        `}
      >
        {/* Claimed animated check */}
        {claimed && (
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400 }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-success-primary flex items-center justify-center shadow-lg z-10 border-2 border-bg-deep"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        )}

        {/* Lock badge */}
        {isCurrent && locked && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center z-10 border-2 border-[#1A1A2E]">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        )}

        {/* Crown for day 7 */}
        {isLastDay && !claimed && (
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1 left-1 text-[10px] leading-none"
          >👑</motion.div>
        )}

        {/* Current-day pulse ring */}
        {isCurrent && !claimed && !locked && (
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="absolute inset-0 rounded-2xl border-2 border-amber-400/60 pointer-events-none"
          />
        )}

        {/* Day label */}
        <span className={`text-[9px] font-black tracking-widest uppercase ${
          claimed ? "text-success-bright" : isCurrent && !locked ? "text-warning-bright" : isLastDay ? "text-yellow-400/70" : "text-white/25"
        }`}>D{day}</span>

        {/* Icon */}
        <span className={`text-xl leading-none transition-transform ${isCurrent && !locked && !claimed ? "scale-110" : ""}`}>{icon}</span>

        {/* Reward */}
        <span className={`text-[10px] font-black ${
          claimed ? "text-success-bright" : isCurrent && !locked ? "text-amber-200" : isLastDay ? "text-yellow-300" : "text-white/35"
        }`}>
          {formatReward(reward, currency)}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function DailyCheckInModal({ onClose, hasDeposited = false }: Props) {
  const { user, token } = useAuth();
  const { openDeposit } = useModal();

  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimedReward, setClaimedReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const [confettiData, setConfettiData] = useState<object | null>(null);
  const [fireData, setFireData] = useState<object | null>(null);
  const [coinData, setCoinData] = useState<object | null>(null);

  const confettiRef = useRef<any>(null);

  // ── Detect mobile ─────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Lottie fetches ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetch_ = async (url: string, set: (d: object) => void) => {
      try {
        const r = await fetch(url);
        if (r.ok) set(await r.json());
      } catch {}
    };
    fetch_(CONFETTI_URL, setConfettiData);
    fetch_(FIRE_URL, setFireData);
    fetch_(COIN_URL, setCoinData);
  }, []);

  // ── Build status from API (fallback to localStorage) ────────────────────
  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try API first
      if (token) {
        try {
          const res = await api.get("/daily-checkin/status");
          const d = res.data;
          const rewards: DayReward[] = (d.rewards || []).map((r: any) => ({
            day: r.day, reward: r.reward, currency: r.currency || "INR",
            claimed: r.claimed, isCurrent: r.isCurrent,
          }));
          setStatus({ streak: d.streak, canClaimToday: d.canClaimToday, lastCheckin: d.lastClaimDate, rewards, totalEarned: d.totalEarned || 0 });
          setIsLoading(false);
          return;
        } catch {}
      }
      // Fallback to localStorage
      const storedKey = `checkin_${user?.id || "guest"}`;
      const stored = localStorage.getItem(storedKey);
      let sd: { streak: number; lastCheckin: string | null } = { streak: 0, lastCheckin: null };
      if (stored) sd = JSON.parse(stored);

      const today = new Date().toDateString();
      const canClaimToday = !sd.lastCheckin || new Date(sd.lastCheckin).toDateString() !== today;
      const cycleDay = sd.streak === 0 ? 1 : ((sd.streak - 1) % 7) + 1;

      const rewards: DayReward[] = BASE_REWARDS.map((r, i) => ({
        ...r,
        claimed: i + 1 < cycleDay || (!canClaimToday && i + 1 === cycleDay),
        isCurrent: canClaimToday && i + 1 === cycleDay,
      }));

      if (!canClaimToday && sd.streak > 0) {
        const prev = cycleDay === 1 ? 7 : cycleDay - 1;
        rewards.forEach((r, i) => { if (i + 1 <= prev) r.claimed = true; });
      }

      setStatus({ streak: sd.streak, canClaimToday, lastCheckin: sd.lastCheckin, rewards, totalEarned: 0 });
    } catch {
      setError("Failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, [user, token]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ── Claim ─────────────────────────────────────────────────────────────────
  const handleClaim = useCallback(async () => {
    if (!status?.canClaimToday || isClaiming || claimed || !hasDeposited) return;
    setIsClaiming(true);
    setError(null);
    try {
      let earned = 0;
      let newStreak = 1;

      if (token) {
        try {
          const r = await api.post("/daily-checkin/claim", { useSpinWheel: false });
          earned = r.data?.reward ?? 0;
          newStreak = r.data?.streak ?? 1;
        } catch (err: any) {
          const msg = err?.response?.data?.message;
          if (msg) { setError(msg); setIsClaiming(false); return; }
        }
      }

      // Fallback calculation if API didn't return a reward
      if (earned === 0) {
        const storedKey = `checkin_${user?.id || "guest"}`;
        const stored = localStorage.getItem(storedKey);
        let sd: { streak: number; lastCheckin: string | null } = { streak: 0, lastCheckin: null };
        if (stored) sd = JSON.parse(stored);
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const lastDay = sd.lastCheckin ? new Date(sd.lastCheckin).toDateString() : null;
        newStreak = lastDay === yesterday ? sd.streak + 1 : 1;
        if (newStreak > 7) newStreak = 1;
        earned = BASE_REWARDS[newStreak - 1]?.reward ?? 10;
      }

      // Sync localStorage
      const storedKey = `checkin_${user?.id || "guest"}`;
      localStorage.setItem(storedKey, JSON.stringify({ streak: newStreak, lastCheckin: new Date().toDateString() }));

      setClaimedReward(earned);
      setClaimed(true);
      if (confettiRef.current) confettiRef.current.goToAndPlay(0, true);
      await fetchStatus();
    } catch {
      setError("Failed to claim. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  }, [status, isClaiming, claimed, hasDeposited, token, user, fetchStatus]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const displayStreak = status?.streak ?? 0;
  const cycleDay = displayStreak === 0 ? 1 : ((displayStreak - 1) % 7) + 1;
  const displayDay = status?.canClaimToday ? cycleDay : Math.min(cycleDay, 7);
  const progressVal = displayStreak % 7 === 0 && displayStreak > 0 ? 7 : displayStreak % 7;

  const handleDepositRedirect = () => { onClose(); openDeposit(); };

  // ─── Animation variants ──────────────────────────────────────────────────
  const desktopVariants = {
    hidden:  { opacity: 0, scale: 0.90, y: 32 },
    visible: { opacity: 1, scale: 1,    y: 0  },
    exit:    { opacity: 0, scale: 0.92, y: 20 },
  };

  const bottomSheetVariants = {
    hidden:  { y: "100%", opacity: 1 },
    visible: { y: "0%",   opacity: 1 },
    exit:    { y: "100%", opacity: 1 },
  };

  const variants = isMobile ? bottomSheetVariants : desktopVariants;
  const transition: Transition = isMobile
    ? { type: "spring" as const, damping: 30, stiffness: 300 }
    : { type: "spring" as const, stiffness: 260, damping: 24 };

  // ─── Inner content ───────────────────────────────────────────────────────
  const Content = () => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Confetti ── */}
      {claimed && confettiData && (
        <div className="absolute inset-0 z-50 pointer-events-none rounded-3xl overflow-hidden">
          <Lottie lottieRef={confettiRef} animationData={confettiData} loop={false} autoplay
            style={{ width: "100%", height: "100%" }} />
        </div>
      )}

      {/* ── Mobile drag handle ── */}
      {isMobile && (
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-2">

        {/* ── Header ── */}
        <div className="relative text-center pt-5 pb-3">
          {/* Close button */}
          <button onClick={onClose}
            className="absolute top-4 right-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.07] hover:bg-white/[0.14] transition-colors z-10">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="#9B9793" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>

          {/* Animated gift icon */}
          <motion.div
            animate={{ rotate: [-6, 6, -6], y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 text-4xl"
            style={{
              background: "linear-gradient(135deg, rgba(255, 122, 26,0.25) 0%, rgba(239,68,68,0.15) 100%)",
              border: "1px solid rgba(255, 122, 26,0.35)",
              boxShadow: "0 0 30px rgba(255, 122, 26,0.25)",
            }}
          >🎁</motion.div>

          <h2 className="text-[18px] font-black text-white tracking-tight">Daily Rewards</h2>
          <p className="text-[12px] text-white/40 mt-0.5">
            {hasDeposited
              ? "Check in every day to build your streak!"
              : "Deposit once to unlock daily bonuses!"}
          </p>
        </div>

        {/* ── Streak banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl mb-4 overflow-hidden"
          style={{
            background: "linear-gradient(120deg, rgba(255, 122, 26,0.12) 0%, rgba(239,68,68,0.06) 100%)",
            border: "1px solid rgba(255, 122, 26,0.18)",
            opacity: hasDeposited ? 1 : 0.5,
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-11 h-11 flex-shrink-0">
              {fireData
                ? <Lottie animationData={fireData} loop autoplay />
                : <span className="text-3xl">🔥</span>}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-0.5">Current Streak</p>
              <div className="flex items-baseline gap-1.5">
                <motion.span
                  key={displayStreak}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-black"
                  style={{
                    background: "linear-gradient(135deg, #ff7a1a 0%, #EF4444 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >{displayStreak}</motion.span>
                <span className="text-white/35 text-xs">day{displayStreak !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Progress ring */}
            <div className="relative flex-shrink-0">
              <CircularProgress value={progressVal} max={7} size={52} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black text-warning-bright">{progressVal}/7</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Deposit gate banner ── */}
        {!hasDeposited && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl mb-4 overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(30,15,15,0.9) 100%)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger-alpha-16 flex items-center justify-center text-2xl flex-shrink-0">🔒</div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-danger mb-0.5">Deposit Required</p>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Make your first deposit to unlock daily reward collection.
                </p>
              </div>
            </div>
            <div className="px-4 pb-4">
              <motion.button
                onClick={handleDepositRedirect}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                className="w-full py-2.5 rounded-xl font-bold text-[13px] text-[#1A1208] relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #ff7a1a 0%, #EF4444 100%)",
                  boxShadow: "0 6px 20px rgba(255, 122, 26,0.35)",
                }}
              >
                <motion.span
                  animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                    backgroundSize: "200% 100%",
                  }}
                />
                <span className="relative">💳 Deposit Now</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── Day reward grid ── */}
        <div className="mb-4">
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl skeleton-block skeleton-shimmer" />
              ))}
            </div>
          ) : status ? (
            <div className="grid grid-cols-7 gap-1.5">
              {status.rewards.map((r, i) => (
                <DayCard key={r.day} {...r} index={i} locked={!hasDeposited} />
              ))}
            </div>
          ) : null}

          {/* Week progress bar */}
          {status && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(progressVal / 7) * 100}%` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #ff7a1a, #EF4444)" }}
                />
              </div>
              <span className="text-[10px] text-white/25 font-semibold">{progressVal}/7</span>
            </div>
          )}
        </div>

        {/* ── Claimed success ── */}
        <AnimatePresence>
          {claimed && claimedReward !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="rounded-2xl p-4 flex items-center gap-3 mb-4"
              style={{
                background: "linear-gradient(120deg, rgba(16,185,129,0.18) 0%, rgba(6,78,59,0.6) 100%)",
                border: "1px solid rgba(16,185,129,0.4)",
              }}
            >
              <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-success-alpha-20 flex items-center justify-center">
                {coinData ? <Lottie animationData={coinData} loop autoplay /> : <span className="text-2xl">🪙</span>}
              </div>
              <div>
                <p className="text-[10px] text-success-bright/70 font-bold uppercase tracking-widest mb-0.5">Reward Claimed!</p>
                <p className="text-lg font-black text-success-bright">
                  +{formatReward(claimedReward, "INR")}
                  <span className="text-[12px] text-success-bright/60 font-medium ml-1.5">added to wallet</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-xs text-danger text-center mb-3 px-2"
            >{error}</motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ── Sticky CTA footer ── */}
      <div className="flex-shrink-0 px-4 pt-2 pb-4" style={{ paddingBottom: isMobile ? "max(16px, env(safe-area-inset-bottom))" : "16px" }}>
        {!hasDeposited ? (
          <button
            onClick={handleDepositRedirect}
            className="w-full py-3.5 rounded-2xl font-bold text-[13px] text-center text-white/30 border border-white/08 bg-white/04"
          >
            🔒 Deposit first to unlock rewards
          </button>
        ) : !claimed && status?.canClaimToday ? (
          /* Claim button */
          <motion.button
            onClick={handleClaim}
            disabled={isClaiming || isLoading}
            whileHover={{ scale: isClaiming ? 1 : 1.015 }}
            whileTap={{ scale: isClaiming ? 1 : 0.975 }}
            className="w-full py-4 rounded-2xl font-black text-[15px] relative overflow-hidden disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #ff7a1a 0%, #EF4444 60%, #ff7a1a 100%)",
              backgroundSize: "200% 100%",
              color: "#1A1208",
              boxShadow: "0 10px 32px rgba(255, 122, 26,0.5), 0 2px 8px rgba(239,68,68,0.3)",
            }}
          >
            {/* Sweep shimmer */}
            <motion.span
              animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)",
                backgroundSize: "200% 100%",
              }}
            />
            <span className="relative flex items-center justify-center gap-2">
              {isClaiming ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                  </svg>
                  Claiming…
                </>
              ) : (
                <>🎁 Claim Day {displayDay} Reward — {formatReward(BASE_REWARDS[displayDay - 1]?.reward ?? 10, "INR")}</>
              )}
            </span>
          </motion.button>
        ) : claimed ? (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={onClose}
            whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.975 }}
            className="w-full py-4 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2"
            style={{
              background: "rgba(16,185,129,0.14)",
              border: "1px solid rgba(16,185,129,0.4)",
              color: "#34D399",
            }}
          >
            ✅ Claimed! Come back tomorrow
          </motion.button>
        ) : (
          <div
            className="w-full py-4 rounded-2xl font-bold text-[13px] text-center text-white/30"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            ✅ Already claimed today
          </div>
        )}

        {/* Next reward teaser */}
        {hasDeposited && !status?.canClaimToday && !claimed && status && (
          <p className="text-[11px] text-center text-white/25 mt-2.5">
            Next: <span className="text-warning-bright font-bold">
              {formatReward(BASE_REWARDS[cycleDay % 7]?.reward ?? 10, "INR")}
            </span> in 24h
          </p>
        )}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        key="ci-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex"
        style={{
          background: isMobile
            ? "rgba(0,0,0,0.8)"
            : "radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.9) 100%)",
          backdropFilter: "blur(16px)",
          alignItems: isMobile ? "flex-end" : "center",
          justifyContent: "center",
          padding: isMobile ? 0 : 16,
        }}
        onClick={onClose}
      >
        <motion.div
          key="ci-modal"
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={transition}
          onClick={(e) => e.stopPropagation()}
          className="relative overflow-hidden"
          style={
            isMobile
              ? {
                  width: "100%",
                  maxHeight: "92dvh",
                  borderRadius: "24px 24px 0 0",
                  background: "linear-gradient(180deg, #12141C 0%, #0C0D12 100%)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderBottom: "none",
                  boxShadow: "0 -20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
                  display: "flex",
                  flexDirection: "column",
                }
              : {
                  width: "100%",
                  maxWidth: 380,
                  maxHeight: "90dvh",
                  borderRadius: 28,
                  background: "linear-gradient(160deg, #12141C 0%, #0F1016 55%, #0C0D12 100%)",
                  border: "1px solid rgba(255, 122, 26,0.025)",
                  boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(255, 122, 26,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
                  display: "flex",
                  flexDirection: "column",
                }
          }
        >
          <Content />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
