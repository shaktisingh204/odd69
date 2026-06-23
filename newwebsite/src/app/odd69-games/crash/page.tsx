"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { useModal } from "@/context/ModalContext";
import { useOriginalsAccess } from "@/hooks/useOriginalsAccess";
import { useGameSounds } from "@/hooks/useGameSounds";
import { getConfiguredSocketNamespace } from "@/utils/socketUrl";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";
import { Volume2, VolumeX } from "lucide-react";

type Phase = "BETTING" | "FLYING" | "CRASHED" | "IDLE";
interface LiveBet { username: string; betAmount: number; cashedOut?: boolean; multiplier?: number; payout?: number; }
interface HistoryRound { roundId: number; crashPoint: number; }
type WalletType = "fiat" | "crypto";

function getWalletSymbol(walletType: WalletType) {
  return walletType === "crypto" ? "$" : "$";
}

/* ═══ History pill ═══════════════════════════════════════════════════════ */
function HistoryPill({ h }: { h: HistoryRound }) {
  const color = h.crashPoint < 2 ? "#e74c3c" : h.crashPoint < 5 ? "#2ecc71" : h.crashPoint < 10 ? "#3498db" : "#f39c12";
  return (
    <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 64 }}>
      <span className="text-[10px] text-zinc-600 tabular-nums">{h.roundId}</span>
      <span className="font-extrabold text-xs tabular-nums" style={{ color }}>{h.crashPoint.toFixed(2)}x</span>
    </div>
  );
}

/* ═══ Canvas — crash graph with smooth curve + rocket trail + grid ══════ */
function useCrashCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  phase: Phase,
  multiplier: number,
  startTime: number,
  reduceMotion: boolean,
) {
  const rafRef = useRef(0);
  // Latest values, read inside the RAF loop so the loop itself never restarts
  // (smoother animation — only data drives it, never a React re-render churn).
  const stateRef = useRef({ phase, multiplier, startTime });
  useEffect(() => {
    stateRef.current = { phase, multiplier, startTime };
  }, [phase, multiplier, startTime]);

  // Smoothed (eased) multiplier so the curve glides between server ticks
  // instead of snapping. This is purely cosmetic: the *target* is always the
  // server-reported multiplier, we only interpolate the in-between frames.
  const smoothMultiRef = useRef(1.0);
  // Eased axis extents so the graph rescales smoothly instead of jumping when
  // the server multiplier ticks (cosmetic only).
  const axisYRef = useRef(2);
  const axisXRef = useRef(5);
  // Particle puffs trailing behind the rocket while flying.
  const trailRef = useRef<{ x: number; y: number; life: number; r: number }[]>([]);
  const lastTrailRef = useRef(0);
  // Stars drifting in the background while flying (parallax depth).
  const starsRef = useRef<{ x: number; y: number; r: number; tw: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = 1;
    const resize = () => {
      const p = canvas.parentElement;
      if (!p) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = p.clientWidth * dpr;
      canvas.height = p.clientHeight * dpr;
      canvas.style.width = p.clientWidth + "px";
      canvas.style.height = p.clientHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let lastFrame = performance.now();

    const draw = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      const { phase, multiplier, startTime } = stateRef.current;

      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      if (W === 0 || H === 0) { rafRef.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, W, H);

      const padL = 45;
      const padR = 15;
      const padT = 20;
      const padB = 30;
      const gW = W - padL - padR;
      const gH = H - padT - padB;

      /* ── Ease the displayed multiplier toward the server value ── */
      if (phase === "CRASHED" || reduceMotion) {
        smoothMultiRef.current = multiplier; // snap on crash / reduced motion
      } else if (phase === "FLYING") {
        const k = 1 - Math.pow(0.0001, dt); // frame-rate independent lerp
        smoothMultiRef.current += (multiplier - smoothMultiRef.current) * k;
      } else {
        smoothMultiRef.current = 1.0;
        axisYRef.current = 2;   // reset eased axes between rounds
        axisXRef.current = 5;
      }
      const dispMulti = phase === "CRASHED" ? multiplier : Math.max(1, smoothMultiRef.current);

      /* ── Heat colour: green climbing → gold past ~10x (cosmetic) ── */
      const flying0 = phase === "FLYING";
      const crashed0 = phase === "CRASHED";
      // 0 at 1x, ramps to 1 around 10x for a smooth green→gold shift.
      const heat = Math.min(1, Math.max(0, (dispMulti - 2) / 8));
      const lerpC = (a: number[], b: number[], t: number) =>
        `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
      const GREEN = [46, 204, 113];
      const GOLD = [255, 196, 74];
      const RED = [231, 76, 60];
      const accent = crashed0 ? `rgb(${RED[0]},${RED[1]},${RED[2]})` : lerpC(GREEN, GOLD, heat);
      const accentRGB = crashed0 ? RED : [
        Math.round(GREEN[0] + (GOLD[0] - GREEN[0]) * heat),
        Math.round(GREEN[1] + (GOLD[1] - GREEN[1]) * heat),
        Math.round(GREEN[2] + (GOLD[2] - GREEN[2]) * heat),
      ];

      /* ── Grid lines ─────────────────────────────────────── */
      ctx.strokeStyle = "#1a1f2e";
      ctx.lineWidth = 1;

      // Horizontal grid + Y labels — eased toward target so it never jumps.
      const targetY = Math.max(2, dispMulti * 1.3);
      {
        const k = reduceMotion || crashed0 ? 1 : 1 - Math.pow(0.002, dt);
        axisYRef.current += (targetY - axisYRef.current) * k;
      }
      const maxMulti = axisYRef.current;
      const ySteps = Math.max(2, Math.min(10, Math.ceil(maxMulti)));
      for (let i = 0; i <= ySteps; i++) {
        const val = 1 + (maxMulti - 1) * (i / ySteps);
        const y = padT + gH - (gH * i / ySteps);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();
        // Label
        ctx.fillStyle = "#555";
        ctx.font = "11px Roboto, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(val.toFixed(1) + "x", padL - 6, y + 4);
      }

      // Vertical grid + X labels (time in seconds) — eased rescale.
      const elapsed = (phase === "FLYING" || phase === "CRASHED") ? (Date.now() - startTime) / 1000 : 0;
      const targetX = Math.max(5, elapsed * 1.2);
      {
        const k = reduceMotion || crashed0 ? 1 : 1 - Math.pow(0.002, dt);
        axisXRef.current += (targetX - axisXRef.current) * k;
      }
      const maxTime = axisXRef.current;
      const xSteps = Math.min(8, Math.max(3, Math.ceil(maxTime)));
      for (let i = 0; i <= xSteps; i++) {
        const x = padL + gW * (i / xSteps);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + gH);
        ctx.strokeStyle = "#1a1f2e";
        ctx.stroke();
        // Label
        const tVal = (maxTime * i / xSteps).toFixed(0);
        ctx.fillStyle = "#555";
        ctx.font = "11px Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(tVal + "s", x, padT + gH + 18);
      }

      const flying = flying0;
      const crashed = crashed0;
      const [ar, ag, ab] = accentRGB;

      /* ── Parallax starfield (flying only, cosmetic) ── */
      if (flying && !reduceMotion) {
        if (starsRef.current.length === 0) {
          for (let i = 0; i < 36; i++) {
            starsRef.current.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, tw: Math.random() * Math.PI * 2 });
          }
        }
        for (const st of starsRef.current) {
          st.x -= dt * (12 + st.r * 18); // faster = closer (parallax)
          if (st.x < 0) { st.x = W; st.y = Math.random() * H; }
          const a = 0.25 + 0.25 * Math.sin(now / 600 + st.tw);
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fill();
        }
      } else {
        starsRef.current = [];
      }

      /* ── Curve ──────────────────────────────────────────── */
      if ((flying || crashed) && dispMulti > 1) {
        // Generate curve points using exponential growth.
        const points: [number, number][] = [];
        const numPts = 90;
        for (let i = 0; i <= numPts; i++) {
          const t = i / numPts;
          const m = 1 + (dispMulti - 1) * (Math.exp(t * 2.5) - 1) / (Math.exp(2.5) - 1);
          const x = padL + gW * (t * elapsed / maxTime);
          const y = padT + gH - gH * ((m - 1) / (maxMulti - 1));
          points.push([x, y]);
        }
        const lastPt = points[points.length - 1];

        // Filled area under curve (smooth quadratic path).
        ctx.beginPath();
        ctx.moveTo(padL, padT + gH);
        ctx.lineTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i][0] + points[i + 1][0]) / 2;
          const yc = (points[i][1] + points[i + 1][1]) / 2;
          ctx.quadraticCurveTo(points[i][0], points[i][1], xc, yc);
        }
        ctx.lineTo(lastPt[0], lastPt[1]);
        ctx.lineTo(lastPt[0], padT + gH);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, padT, 0, padT + gH);
        grad.addColorStop(0, `rgba(${ar},${ag},${ab},0.28)`);
        grad.addColorStop(1, `rgba(${ar},${ag},${ab},0.02)`);
        ctx.fillStyle = grad;
        ctx.fill();

        // Glowing stroke (smooth quadratic path).
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i][0] + points[i + 1][0]) / 2;
          const yc = (points[i][1] + points[i + 1][1]) / 2;
          ctx.quadraticCurveTo(points[i][0], points[i][1], xc, yc);
        }
        ctx.lineTo(lastPt[0], lastPt[1]);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3.5;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowColor = accent;
        ctx.shadowBlur = flying ? 12 + heat * 10 : 6; // glow intensifies as it climbs
        ctx.stroke();
        ctx.shadowBlur = 0;

        /* ── Rocket trail particles (flying only) ── */
        if (flying && !reduceMotion) {
          // Spawn a fresh puff a few times per second near the rocket tip.
          if (now - lastTrailRef.current > 38) {
            lastTrailRef.current = now;
            trailRef.current.push({
              x: lastPt[0] - 2,
              y: lastPt[1] + 4,
              life: 1,
              r: 3 + Math.random() * 3,
            });
            if (trailRef.current.length > 26) trailRef.current.shift();
          }
        } else {
          trailRef.current = [];
        }
        // Draw + age the puffs.
        for (let i = trailRef.current.length - 1; i >= 0; i--) {
          const p = trailRef.current[i];
          p.life -= dt * 1.6;
          p.y += dt * 14;
          p.x -= dt * 10;
          if (p.life <= 0) { trailRef.current.splice(i, 1); continue; }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.6 + p.life * 0.7), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,154,61,${0.18 * p.life})`;
          ctx.fill();
        }

        /* ── Rocket head ── */
        if (flying) {
          // Pulsing halo (heat-tinted).
          const pulse = 7 + Math.sin(now / 120) * 2;
          ctx.beginPath();
          ctx.arc(lastPt[0], lastPt[1], pulse + 6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${ar},${ag},${ab},0.12)`;
          ctx.fill();
          // Rocket emoji rotated along the curve direction, scaled up a touch with heat.
          const prev = points[points.length - 2] ?? points[0];
          const ang = Math.atan2(lastPt[1] - prev[1], lastPt[0] - prev[0]);
          ctx.save();
          ctx.translate(lastPt[0], lastPt[1]);
          ctx.rotate(ang + Math.PI / 4); // emoji points up-right by default
          ctx.font = `${Math.round(20 + heat * 4)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🚀", 0, 0);
          ctx.restore();
        } else {
          // Crashed: a small ember where the curve ended.
          ctx.beginPath();
          ctx.arc(lastPt[0], lastPt[1], 4, 0, Math.PI * 2);
          ctx.fillStyle = accent;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
    // Loop reads live values from stateRef, so it only needs to (re)mount on
    // canvas/reduced-motion changes — keeping the RAF loop stable & smooth.
  }, [canvasRef, reduceMotion]);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function CrashPage() {
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { playBet, playTick, playWin, playCrash, muted, toggleMute } = useGameSounds();
  const hasSession = !!token;

  // ── Visual/motion layer (does NOT touch any data flow) ──
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = !!prefersReducedMotion;
  const stageControls = useAnimationControls(); // screen-shake on crash
  const lastTickSoundRef = useRef(0);            // throttle shared 'tick' sound
  const reduceMotionRef = useRef(reduceMotion);
  useEffect(() => { reduceMotionRef.current = reduceMotion; }, [reduceMotion]);
  // Keep the shared FX util's mute state in sync with the page's mute toggle so
  // the single mute button silences both sound systems.
  useEffect(() => {
    void import("@/utils/originalsFx").then((fx) => fx.setSoundMuted(muted));
  }, [muted]);

  useEffect(() => {
    if (!authLoading && !accessLoading && (!hasSession || !canAccessOriginals)) {
      window.location.href = "/";
    }
  }, [hasSession, authLoading, accessLoading, canAccessOriginals]);

  const multiplierRef = useRef(1.0);
  const roundIdRef = useRef(0);
  const [startTime, setStartTime] = useState(0);
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [multiplier, setMultiplier] = useState(1.0);
  const [betInput, setBetInput] = useState("100.00");
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashoutMulti, setCashoutMulti] = useState(0);
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const [betTab, setBetTab] = useState<"manual" | "auto">("manual");
  const [autoCashOut, setAutoCashOut] = useState(false);
  const [autoCashOutAt, setAutoCashOutAt] = useState("2.00");
  const [walletType, setWalletType] = useState<WalletType>(selectedWallet);

  // Auto-bet state
  const [autoRounds, setAutoRounds] = useState("10");
  const [autoStopWin, setAutoStopWin] = useState("");
  const [autoStopLoss, setAutoStopLoss] = useState("");
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoRoundsLeft, setAutoRoundsLeft] = useState(0);
  const [autoProfit, setAutoProfit] = useState(0);
  // On-win / On-loss progression (Stake-style): reset to base OR increase by N%.
  const [onWinMode, setOnWinMode] = useState<"reset" | "increase">("reset");
  const [onLossMode, setOnLossMode] = useState<"reset" | "increase">("reset");
  const [onWinPct, setOnWinPct] = useState("0");
  const [onLossPct, setOnLossPct] = useState("0");
  const autoRunningRef = useRef(false);
  const autoProfitRef = useRef(0);
  const lastBetAmountRef = useRef(0);
  const baseBetRef = useRef(0);          // the base stake autobet returns to on reset
  const nextBetRef = useRef(0);          // the stake to use for the next auto round
  const betInputRef = useRef(betInput);
  const autoCashOutAtRef = useRef(autoCashOutAt);
  const autoStopWinRef = useRef(autoStopWin);
  const autoStopLossRef = useRef(autoStopLoss);
  const onWinModeRef = useRef(onWinMode);
  const onLossModeRef = useRef(onLossMode);
  const onWinPctRef = useRef(onWinPct);
  const onLossPctRef = useRef(onLossPct);
  const walletTypeRef = useRef<WalletType>(walletType);

  useEffect(() => { betInputRef.current = betInput; }, [betInput]);
  useEffect(() => { autoCashOutAtRef.current = autoCashOutAt; }, [autoCashOutAt]);
  useEffect(() => { autoStopWinRef.current = autoStopWin; }, [autoStopWin]);
  useEffect(() => { autoStopLossRef.current = autoStopLoss; }, [autoStopLoss]);
  useEffect(() => { onWinModeRef.current = onWinMode; }, [onWinMode]);
  useEffect(() => { onLossModeRef.current = onLossMode; }, [onLossMode]);
  useEffect(() => { onWinPctRef.current = onWinPct; }, [onWinPct]);
  useEffect(() => { onLossPctRef.current = onLossPct; }, [onLossPct]);
  useEffect(() => { walletTypeRef.current = walletType; }, [walletType]);
  useEffect(() => { setWalletType(selectedWallet); }, [selectedWallet]);

  useCrashCanvas(canvasRef, phase, multiplier, startTime, reduceMotion);

  /* ── Socket — /aviator (crash engine) ───────────────────────────────── */
  useEffect(() => {
    const endpoint = getConfiguredSocketNamespace("aviator");
    if (!endpoint) {
      return;
    }

    const token = localStorage.getItem("token") || "";
    const s = io(endpoint.url, { path: endpoint.path, auth: { token }, transports: ["websocket", "polling"], upgrade: true, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 15000 });
    socketRef.current = s;

    s.on("aviator:state", (d: { status: string; roundId: number; multiplier: number }) => {
      roundIdRef.current = d.roundId;
      const p = d.status as Phase;
      setPhase(p);
      if (p === "FLYING") { multiplierRef.current = d.multiplier; setMultiplier(d.multiplier); setStartTime(Date.now() - 1000); }
    });
    s.on("aviator:betting", (d: { roundId: number }) => {
      roundIdRef.current = d.roundId;
      setPhase("BETTING"); multiplierRef.current = 1.0; setMultiplier(1.0);
      setHasBet(false); setCashedOut(false); setCashoutMulti(0); setLiveBets([]);

      // Auto-bet: place bet automatically when new round starts
      if (autoRunningRef.current) {
        setAutoRoundsLeft(prev => {
          if (prev <= 0) { autoRunningRef.current = false; setAutoRunning(false); return 0; }
          // Check stop limits
          const sw = parseFloat(autoStopWinRef.current) || 0;
          const sl = parseFloat(autoStopLossRef.current) || 0;
          if (sw > 0 && autoProfitRef.current >= sw) { autoRunningRef.current = false; setAutoRunning(false); toast.success("Auto stopped: profit target reached"); return 0; }
          if (sl > 0 && autoProfitRef.current <= -sl) { autoRunningRef.current = false; setAutoRunning(false); toast.error("Auto stopped: loss limit reached"); return 0; }
          // Fire bet — uses the progression-adjusted stake (falls back to base/input).
          const ba = nextBetRef.current > 0 ? nextBetRef.current : (parseFloat(betInputRef.current) || 100);
          const acAt = parseFloat(autoCashOutAtRef.current) || 0;
          lastBetAmountRef.current = ba;
          // Reflect the live auto stake in the amount field so the player sees it.
          setBetInput(ba.toFixed(2));
          setTimeout(() => {
            if (autoRunningRef.current && s.connected) {
              s.emit("aviator:bet", { roundId: d.roundId, betAmount: ba, autoCashoutAt: acAt, walletType: walletTypeRef.current });
            }
          }, 500);
          return prev - 1;
        });
      }
    });
    s.on("aviator:start", (d: { roundId: number }) => {
      roundIdRef.current = d.roundId;
      setPhase("FLYING"); setStartTime(Date.now());
    });
    s.on("aviator:tick", (d: { roundId: number; multiplier: number }) => {
      multiplierRef.current = d.multiplier; setMultiplier(d.multiplier);
      playTick(d.multiplier);
      // Shared FX: throttled blip while flying (max ~5/s) so fast ticks don't spam audio.
      const now = Date.now();
      if (now - lastTickSoundRef.current > 200) {
        lastTickSoundRef.current = now;
        playSound("tick");
      }
    });
    s.on("aviator:crash", (d: { roundId: number; crashPoint: number }) => {
      setPhase("CRASHED"); multiplierRef.current = d.crashPoint; setMultiplier(d.crashPoint);
      playCrash();
      playSound("crash");
      // Crash burst + screen shake (visualizing the SERVER crashPoint — never altering it).
      if (!reduceMotionRef.current) {
        stageControls.start({
          x: [0, -10, 9, -7, 5, -3, 0],
          y: [0, 6, -5, 4, -2, 1, 0],
          transition: { duration: 0.5, ease: "easeOut" },
        });
      }
      setHistory(prev => [{ roundId: d.roundId, crashPoint: d.crashPoint }, ...prev.slice(0, 29)]);
      // Auto-bet: track loss if we had a bet and didn't cash out
      if (autoRunningRef.current && lastBetAmountRef.current > 0) {
        const lost = lastBetAmountRef.current;
        autoProfitRef.current -= lost;
        setAutoProfit(autoProfitRef.current);
        // On-loss progression: reset to base OR increase by N%.
        if (onLossModeRef.current === "increase") {
          const pct = parseFloat(onLossPctRef.current) || 0;
          nextBetRef.current = +(lost * (1 + pct / 100)).toFixed(2);
        } else {
          nextBetRef.current = baseBetRef.current;
        }
        lastBetAmountRef.current = 0;
      }
    });
    s.on("aviator:bet-placed", () => {
      setHasBet(true);
      playBet();
      void refreshWallet();
    });
    s.on("aviator:cashout-success", (d: { multiplier: number; payout: number }) => {
      const winMulti = d.multiplier || multiplierRef.current;
      setCashedOut(true);
      setCashoutMulti(winMulti);
      playWin();
      // Shared FX celebration — visualizes the SERVER-confirmed cashout.
      playSound("cashout");
      if (winMulti >= 10) fireBigWin();
      else fireWin();
      void refreshWallet();
      toast.success(`Won ${getWalletSymbol(walletTypeRef.current)}${d.payout.toFixed(2)} at ${winMulti.toFixed(2)}×`);
      // Auto: track profit (cashout-success fires before crash, so reset lastBetAmount to prevent double counting)
      if (autoRunningRef.current) {
        const staked = lastBetAmountRef.current;
        const net = d.payout - staked;
        autoProfitRef.current += net;
        setAutoProfit(autoProfitRef.current);
        // On-win progression: reset to base OR increase by N%.
        if (onWinModeRef.current === "increase") {
          const pct = parseFloat(onWinPctRef.current) || 0;
          nextBetRef.current = +(staked * (1 + pct / 100)).toFixed(2);
        } else {
          nextBetRef.current = baseBetRef.current;
        }
        lastBetAmountRef.current = 0;
      }
    });
    s.on("aviator:player-bet", (d: { username: string; betAmount: number }) => {
      setLiveBets(prev => [...prev, { username: d.username, betAmount: d.betAmount }]);
    });
    s.on("aviator:player-cashout", (d: { username: string; multiplier: number; payout: number }) => {
      setLiveBets(prev => prev.map(b => b.username === d.username && !b.cashedOut ? { ...b, cashedOut: true, multiplier: d.multiplier, payout: d.payout } : b));
    });
    s.on("aviator:history", (d: HistoryRound[]) => setHistory(d));
    s.on("aviator:error", (d: { message: string }) => {
      toast.error(d.message);
      setHasBet(false);
      autoRunningRef.current = false;
      setAutoRunning(false);
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
      s.emit("aviator:get-history");
    });

    return () => { s.disconnect(); };
  }, [playBet, playCrash, playTick, playWin, refreshWallet, stageControls]);

  const betAmount = parseFloat(betInput) || 0;
  const activeBalance = walletType === "crypto" ? cryptoBalance : fiatBalance;
  const activeSymbol = getWalletSymbol(walletType);

  const handleWalletTypeChange = useCallback((nextWallet: WalletType) => {
    setWalletType(nextWallet);
    void setSelectedWallet(nextWallet);
  }, [setSelectedWallet]);

  const handleBet = useCallback(() => {
    if (!hasSession) { openLogin(); return; }
    if (betAmount <= 0) { toast.error("Enter a bet amount"); return; }
    if (betAmount > activeBalance) { toast.error("Insufficient balance"); return; }
    const acAt = autoCashOut ? parseFloat(autoCashOutAt) || 0 : 0;
    socketRef.current?.emit("aviator:bet", { roundId: roundIdRef.current, betAmount, autoCashoutAt: acAt, walletType: walletTypeRef.current });
  }, [activeBalance, autoCashOut, autoCashOutAt, betAmount, hasSession, openLogin]);

  const handleCashout = useCallback(() => {
    socketRef.current?.emit("aviator:cashout", { roundId: roundIdRef.current });
  }, []);

  // Hotkeys: Space / Enter → bet (during betting) or cash out (during flight).
  // Skipped while typing in an input and while autobet is running.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (autoRunningRef.current || betTab === "auto") return;
      e.preventDefault();
      if (hasBet && !cashedOut && phase === "FLYING") handleCashout();
      else if (!hasBet && (phase === "BETTING" || phase === "IDLE")) handleBet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [betTab, hasBet, cashedOut, phase, handleBet, handleCashout]);

  const handleStartAuto = useCallback(() => {
    if (!hasSession) { openLogin(); return; }
    if (betAmount <= 0) { toast.error("Enter a bet amount"); return; }
    if (betAmount > activeBalance) { toast.error("Insufficient balance"); return; }
    const rounds = parseInt(autoRounds) || 10;
    autoProfitRef.current = 0;
    setAutoProfit(0);
    setAutoRoundsLeft(rounds);
    autoRunningRef.current = true;
    setAutoRunning(true);
    lastBetAmountRef.current = 0;
    // Seed the progression with the current amount as the base stake.
    baseBetRef.current = betAmount;
    nextBetRef.current = betAmount;
    // If currently in BETTING phase, place bet immediately
    if (phase === "BETTING") {
      const acAt = parseFloat(autoCashOutAtRef.current) || 0;
      lastBetAmountRef.current = betAmount;
      socketRef.current?.emit("aviator:bet", { roundId: roundIdRef.current, betAmount, autoCashoutAt: acAt, walletType: walletTypeRef.current });
      setAutoRoundsLeft(rounds - 1);
    }
  }, [activeBalance, autoRounds, betAmount, hasSession, openLogin, phase]);

  const handleStopAuto = useCallback(() => {
    autoRunningRef.current = false;
    setAutoRunning(false);
  }, []);

  const adjustBet = (dir: "up" | "down") => {
    const cur = parseFloat(betInput) || 0;
    setBetInput(dir === "down" ? Math.max(10, cur - 10).toFixed(2) : (cur + 10).toFixed(2));
  };

  const chance = autoCashOut && parseFloat(autoCashOutAt) > 1
    ? (99 / parseFloat(autoCashOutAt)).toFixed(2)
    : "—";

  return (
    <div className="min-h-screen md:h-screen overflow-y-auto md:overflow-hidden flex flex-col" style={{ background: "#0e0e0e", fontFamily: "'Roboto', sans-serif" }}>
      <Header />
      <div className="flex flex-1 md:overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
        <LeftSidebar />
        <main className="flex-1 min-w-0 flex flex-col md:flex-row md:overflow-hidden" style={{ borderLeft: "1px solid #0F1016" }}>

          {/* ═══ LEFT — Graph + Controls ═════════════════════════════════ */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* ── History strip ─────────────────────────────────────────── */}
            <div className="flex items-center px-2" style={{ minHeight: 40, maxHeight: 40, background: "#111216", borderBottom: "1px solid #1a1f2e" }}>
              <div className="flex-1 overflow-hidden relative">
                <div className="flex gap-0 items-center overflow-x-auto no-scrollbar">
                  {history.length === 0
                    ? <span className="text-zinc-700 text-xs px-2">Waiting…</span>
                    : history.slice(0, 12).map(h => <HistoryPill key={h.roundId} h={h} />)}
                </div>
                <div style={{ position: "absolute", right: 0, top: 0, width: 30, height: "100%", background: "linear-gradient(to left, #111216, transparent)", pointerEvents: "none" }} />
              </div>
              {/* Real-money credibility tags */}
              <div className="hidden sm:flex items-center gap-1.5 mr-2 flex-shrink-0">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide" style={{ background: "rgba(46,204,113,0.12)", color: "#2ecc71", border: "1px solid rgba(46,204,113,0.25)" }}>99% RTP</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide" style={{ background: "rgba(255,196,74,0.10)", color: "#ffc44a", border: "1px solid rgba(255,196,74,0.22)" }}>MAX 1,000,000×</span>
              </div>
              <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"}
                className="ml-1 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.05] text-zinc-500 hover:text-white transition-colors">
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>

            {/* ── Game area — canvas + multiplier ──────────────────────── */}
            <div className="flex-1 relative min-h-0 overflow-hidden" style={{ background: "#0f1117" }}>
              {/* Shake stage — wraps canvas + overlay so a crash jolts the whole board */}
              <motion.div className="absolute inset-0" animate={stageControls}>
              {/* Canvas */}
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

              {/* Crash flash overlay (radial red pulse, snaps invisible on reduced motion) */}
              {phase === "CRASHED" && !reduceMotion && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ zIndex: 1, background: "radial-gradient(circle at 50% 45%, rgba(231,76,60,0.35), transparent 60%)" }}
                  initial={{ opacity: 0.9 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              )}

              {/* Multiplier overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: 2, pointerEvents: "none" }}>
                {phase === "FLYING" && (() => {
                  // Heat-shift the glow + × accent green→gold as the multiplier climbs,
                  // matching the canvas curve (cosmetic only).
                  const heat = Math.min(1, Math.max(0, (multiplier - 2) / 8));
                  const gr = Math.round(46 + (255 - 46) * heat);
                  const gg = Math.round(204 + (196 - 204) * heat);
                  const gb = Math.round(113 + (74 - 113) * heat);
                  const glowC = `rgba(${gr},${gg},${gb},${0.45 + heat * 0.2})`;
                  const xC = `rgb(${gr},${gg},${gb})`;
                  return (
                  <motion.div
                    className="font-black tabular-nums"
                    initial={false}
                    animate={reduceMotion ? {} : { scale: [1, 1.035, 1] }}
                    transition={reduceMotion ? undefined : { duration: 0.45, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      color: "#fff", fontSize: "clamp(48px, 12vw, 100px)", lineHeight: 1,
                      textShadow: `0 2px ${24 + heat * 16}px ${glowC}`,
                    }}
                  >
                    {multiplier.toFixed(2)}<span style={{ fontSize: "0.65em", color: xC }}>×</span>
                  </motion.div>
                  );
                })()}
                {phase === "CRASHED" && (
                  <motion.div
                    className="text-center"
                    initial={reduceMotion ? false : { scale: 1.25, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.35, ease: "backOut" }}
                  >
                    <div className="font-black tabular-nums" style={{
                      color: "#e74c3c", fontSize: "clamp(48px, 12vw, 100px)", lineHeight: 1,
                      textShadow: "0 2px 24px rgba(231,76,60,0.5)",
                    }}>
                      {multiplier.toFixed(2)}<span style={{ fontSize: "0.65em" }}>×</span>
                    </div>
                    <div className="text-zinc-500 text-sm font-bold uppercase tracking-[0.2em] mt-2">Crashed</div>
                  </motion.div>
                )}
                {phase === "BETTING" && (
                  <div className="text-center">
                    <motion.div
                      className="text-zinc-500 font-bold text-sm uppercase tracking-[0.15em] mb-1"
                      animate={reduceMotion ? {} : { opacity: [0.5, 1, 0.5] }}
                      transition={reduceMotion ? undefined : { duration: 1, repeat: Infinity, ease: "easeInOut" }}
                    >
                      Starting in…
                    </motion.div>
                    <div className="text-zinc-400 font-black tabular-nums" style={{ fontSize: "clamp(30px, 8vw, 60px)", lineHeight: 1 }}>
                      1.00<span style={{ fontSize: "0.65em" }}>×</span>
                    </div>
                    {/* Draining countdown bar (~5s betting window, cosmetic). */}
                    <div className="mx-auto mt-3 h-1 w-[160px] rounded-full overflow-hidden" style={{ background: "#1a1f2e" }}>
                      <motion.div
                        key={roundIdRef.current}
                        className="h-full rounded-full"
                        style={{ background: "linear-gradient(90deg,#2ecc71,#ffc44a)" }}
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: reduceMotion ? 0 : 5, ease: "linear" }}
                      />
                    </div>
                  </div>
                )}
                {phase === "IDLE" && (
                  <div className="text-zinc-600 font-bold text-sm uppercase tracking-[0.2em]">Connecting…</div>
                )}

                {/* Network status */}
                <div className="absolute bottom-2 right-3 flex items-center gap-1">
                  <span className="text-[10px] text-zinc-600">Network Status</span>
                  <div className="flex gap-0.5">
                    <div className="w-1 h-2 rounded-sm" style={{ background: "#2ecc71" }} />
                    <div className="w-1 h-3 rounded-sm" style={{ background: "#2ecc71" }} />
                    <div className="w-1 h-4 rounded-sm" style={{ background: "#2ecc71" }} />
                    <div className="w-1 h-5 rounded-sm" style={{ background: "#2ecc71" }} />
                  </div>
                </div>
              </div>
              </motion.div>
            </div>

            {/* ── Bet controls ──────────────────────────────────────────── */}
            <div style={{ background: "#14161b", borderTop: "1px solid #1a1f2e", padding: "0 8px 8px" }}>
              {/* Manual / Auto tab */}
              <div className="flex" style={{ borderBottom: "1px solid #1a1f2e" }}>
                {(["manual", "auto"] as const).map(t => (
                  <button key={t} onClick={() => { if (!autoRunning) setBetTab(t); }}
                    className="flex-1 py-2 text-xs font-bold uppercase tracking-[0.12em]" style={{
                    color: betTab === t ? "#fff" : "#555",
                    borderBottom: betTab === t ? "2px solid #2ecc71" : "2px solid transparent",
                    background: "transparent", cursor: autoRunning ? "not-allowed" : "pointer",
                  }}>
                    {t}
                  </button>
                ))}
              </div>

              <div className="py-2 space-y-2">
                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-zinc-400 font-bold">Amount</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.04] p-0.5">
                        {(["crypto"] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => handleWalletTypeChange(type)}
                            disabled={autoRunning}
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
                      <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.05] text-zinc-500 hover:text-white transition-colors">
                        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center" style={{ height: 36, borderRadius: 6, background: "#12141C", border: "1px solid #1C1E28", paddingLeft: 8, paddingRight: 4 }}>
                    <span style={{ color: "#2ecc71", marginRight: 6, fontSize: 14, fontWeight: 700 }}>{activeSymbol}</span>
                    <input type="text" value={betInput}
                      onChange={e => setBetInput(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*?)\..*/g, "$1"))}
                      disabled={autoRunning}
                      className="flex-1 bg-transparent text-white font-bold text-sm outline-none min-w-0 disabled:opacity-40" />
                    <div className="flex items-center gap-1 ml-1 border-l border-[#1C1E28] pl-1">
                      <button onClick={() => setBetInput((betAmount / 2).toFixed(2))} disabled={autoRunning}
                        className="text-[10px] font-bold px-1.5 py-1 rounded bg-[#252830] border border-[#1C1E28] text-zinc-500 hover:text-white transition-colors disabled:opacity-30 cursor-pointer">½</button>
                      <button onClick={() => setBetInput((betAmount * 2).toFixed(2))} disabled={autoRunning}
                        className="text-[10px] font-bold px-1.5 py-1 rounded bg-[#252830] border border-[#1C1E28] text-zinc-500 hover:text-white transition-colors disabled:opacity-30 cursor-pointer">2×</button>
                      <div className="flex flex-col">
                        <button onClick={() => adjustBet("up")} disabled={autoRunning}
                          className="w-[18px] h-3 flex items-center justify-center bg-[#252830] border border-[#1C1E28] rounded-t text-zinc-500 hover:text-white text-[8px] leading-none cursor-pointer disabled:opacity-30">▲</button>
                        <button onClick={() => adjustBet("down")} disabled={autoRunning}
                          className="w-[18px] h-3 flex items-center justify-center bg-[#252830] border border-[#1C1E28] rounded-b text-zinc-500 hover:text-white text-[8px] leading-none cursor-pointer disabled:opacity-30 -mt-px">▼</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {[10, 100, 1000, 10000].map(v => (
                      <button key={v} onClick={() => setBetInput(v.toFixed(2))} disabled={autoRunning}
                        className="flex-1 h-[26px] rounded text-[11px] font-semibold bg-[#12141C] border border-[#1C1E28] text-zinc-500 hover:text-white cursor-pointer transition-all disabled:opacity-30">
                        {v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}
                      </button>
                    ))}
                    <button onClick={() => setBetInput(Math.max(0, activeBalance || 0).toFixed(2))} disabled={autoRunning}
                      className="flex-1 h-[26px] rounded text-[11px] font-bold bg-[#12141C] border border-[#1C1E28] text-[#2ecc71] hover:brightness-125 cursor-pointer transition-all disabled:opacity-30">
                      MAX
                    </button>
                  </div>
                </div>

                {/* Auto cash out */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400 font-bold">Auto Cash Out</span>
                      <button onClick={() => setAutoCashOut(v => !v)}
                        className={`relative w-8 h-4 rounded-full transition-all border flex-shrink-0 ${autoCashOut ? "bg-[#2ecc71] border-[#2ecc71]" : "bg-[#1C1E28] border-[#3a3d4a]"}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${autoCashOut ? "left-[16px]" : "left-0.5"}`} />
                      </button>
                    </div>
                    {autoCashOut && <span className="text-[10px] text-zinc-600">Chance {chance}%</span>}
                  </div>
                  <div className={`flex items-center transition-opacity ${autoCashOut ? "" : "opacity-40 pointer-events-none"}`} style={{ height: 36, borderRadius: 6, background: "#12141C", border: "1px solid #1C1E28", paddingLeft: 8, paddingRight: 4 }}>
                    <input type="text" value={autoCashOutAt}
                      onChange={e => setAutoCashOutAt(e.target.value)}
                      disabled={!autoCashOut}
                      className="flex-1 bg-transparent text-white font-bold text-sm outline-none min-w-0 disabled:opacity-50" />
                    <span className="text-zinc-500 text-sm font-bold mr-1">×</span>
                    <div className="flex items-center gap-1 ml-1 border-l border-[#1C1E28] pl-1">
                      <button onClick={() => setAutoCashOutAt(Math.max(1.01, parseFloat(autoCashOutAt) - 0.1).toFixed(2))}
                        className="w-5 h-5 rounded bg-[#252830] border border-[#1C1E28] text-zinc-500 hover:text-white flex items-center justify-center text-sm cursor-pointer">‹</button>
                      <button onClick={() => setAutoCashOutAt((parseFloat(autoCashOutAt) + 0.1).toFixed(2))}
                        className="w-5 h-5 rounded bg-[#252830] border border-[#1C1E28] text-zinc-500 hover:text-white flex items-center justify-center text-sm cursor-pointer">›</button>
                    </div>
                  </div>
                  <div className={`flex gap-1 mt-1.5 transition-opacity ${autoCashOut ? "" : "opacity-40 pointer-events-none"}`}>
                    {[1.01, 2, 10, 100].map(v => (
                      <button key={v} onClick={() => setAutoCashOutAt(v.toFixed(2))}
                        className="flex-1 h-[26px] rounded text-[11px] font-semibold cursor-pointer transition-all"
                        style={{
                          background: autoCashOutAt === v.toFixed(2) ? "#2a3a2a" : "#12141C",
                          border: autoCashOutAt === v.toFixed(2) ? "1px solid #2ecc71" : "1px solid #1C1E28",
                          color: autoCashOutAt === v.toFixed(2) ? "#2ecc71" : "#888",
                        }}>
                        {v}×
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto settings — only shown when Auto tab selected */}
                {betTab === "auto" && (
                  <div className="space-y-2 rounded-lg border border-white/[0.06] bg-[#0C0D12] p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Rounds</div>
                        <input type="text" value={autoRounds} disabled={autoRunning}
                          onChange={e => setAutoRounds(e.target.value.replace(/[^0-9]/g, ""))}
                          className="w-full bg-[#12141C] border border-[#1C1E28] text-white font-bold text-xs outline-none h-[26px] rounded px-1.5 disabled:opacity-40" />
                        <div className="flex gap-0.5 mt-1">
                          {[10, 25, 50, 100].map(v => (
                            <button key={v} onClick={() => { if (!autoRunning) setAutoRounds(String(v)); }}
                              className="flex-1 text-[9px] py-0.5 rounded bg-[#252830] border border-[#1C1E28] text-zinc-500 cursor-pointer disabled:cursor-not-allowed"
                              disabled={autoRunning}>{v}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Stop Profit</div>
                        <input type="text" value={autoStopWin} disabled={autoRunning} placeholder="0"
                          onChange={e => setAutoStopWin(e.target.value.replace(/[^0-9.]/g, ""))}
                          className="w-full bg-[#12141C] border border-[#1C1E28] text-white font-bold text-xs outline-none h-[26px] rounded px-1.5 disabled:opacity-40 placeholder:text-zinc-700" />
                      </div>
                      <div>
                        <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Stop Loss</div>
                        <input type="text" value={autoStopLoss} disabled={autoRunning} placeholder="0"
                          onChange={e => setAutoStopLoss(e.target.value.replace(/[^0-9.]/g, ""))}
                          className="w-full bg-[#12141C] border border-[#1C1E28] text-white font-bold text-xs outline-none h-[26px] rounded px-1.5 disabled:opacity-40 placeholder:text-zinc-700" />
                      </div>
                    </div>

                    {/* On Win / On Loss progression */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
                      {([
                        { label: "On Win", mode: onWinMode, setMode: setOnWinMode, pct: onWinPct, setPct: setOnWinPct },
                        { label: "On Loss", mode: onLossMode, setMode: setOnLossMode, pct: onLossPct, setPct: setOnLossPct },
                      ] as const).map((row) => (
                        <div key={row.label}>
                          <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">{row.label}</div>
                          <div className="flex gap-0.5 mb-1">
                            {(["reset", "increase"] as const).map((m) => (
                              <button key={m} disabled={autoRunning}
                                onClick={() => { if (!autoRunning) row.setMode(m); }}
                                className="flex-1 text-[9px] py-[3px] rounded font-bold capitalize transition-colors disabled:cursor-not-allowed"
                                style={{
                                  background: row.mode === m ? "rgba(46,204,113,0.18)" : "#12141C",
                                  border: row.mode === m ? "1px solid #2ecc71" : "1px solid #1C1E28",
                                  color: row.mode === m ? "#2ecc71" : "#888",
                                }}>
                                {m === "reset" ? "Reset" : "Increase"}
                              </button>
                            ))}
                          </div>
                          <div className={`flex items-center bg-[#12141C] border border-[#1C1E28] rounded h-[26px] px-1.5 transition-opacity ${row.mode === "increase" ? "" : "opacity-40 pointer-events-none"}`}>
                            <input type="text" value={row.pct} disabled={autoRunning || row.mode !== "increase"}
                              onChange={e => row.setPct(e.target.value.replace(/[^0-9.]/g, ""))}
                              className="flex-1 bg-transparent text-white font-bold text-xs outline-none min-w-0 disabled:opacity-60" />
                            <span className="text-zinc-500 text-[11px] font-bold">%</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {autoRunning && (
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/[0.06]">
                        <span className="text-zinc-600">Profit</span>
                        <span className="font-bold tabular-nums" style={{ color: autoProfit >= 0 ? "#2ecc71" : "#e74c3c" }}>
                          {autoProfit >= 0 ? "+" : ""}{activeSymbol}{autoProfit.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action button */}
                {betTab === "manual" ? (
                  <>
                    {!hasBet && (phase === "BETTING" || phase === "IDLE") && (
                      <button onClick={handleBet} className="w-full h-[52px] rounded-lg font-bold text-[15px] transition-all hover:brightness-110 active:scale-[0.98]"
                        style={{ backgroundColor: "#2ecc71", color: "#000", boxShadow: "0 4px 15px rgba(46,204,113,0.3)" }}>
                        Bet<br /><span className="text-[10px] opacity-70">(Next Round)</span>
                      </button>
                    )}
                    {hasBet && phase === "BETTING" && (
                      <div className="w-full min-h-[52px] rounded-lg bg-[#171921] border border-[#262936] flex items-center justify-center flex-col gap-0.5 text-white font-bold text-[15px]">
                        <span>Bet Queued</span>
                        <span className="text-[10px] text-zinc-400">Locked for the next round</span>
                      </div>
                    )}
                    {hasBet && !cashedOut && phase === "FLYING" && (
                      <button onClick={handleCashout} className="w-full h-[52px] rounded-lg font-extrabold text-base transition-all hover:brightness-110 active:scale-[0.98]"
                        style={{ backgroundColor: "#2ecc71", color: "#000", boxShadow: "0 4px 15px rgba(46,204,113,0.3)" }}>
                        Cash Out ({activeSymbol}{(betAmount * multiplier).toFixed(2)})
                      </button>
                    )}
                    {cashedOut && phase === "FLYING" && (
                      <div className="text-center py-3 rounded-lg" style={{ background: "#123405", border: "1px solid #4EAF11" }}>
                        <div className="text-[#4EAF11] text-xs font-bold">CASHED OUT</div>
                        <div className="text-white text-lg font-extrabold">{cashoutMulti.toFixed(2)}×</div>
                      </div>
                    )}
                    {phase === "CRASHED" && (
                      <button disabled className="w-full h-[52px] rounded-lg bg-[#12141C] border border-[#1C1E28] text-zinc-600 font-bold text-sm cursor-not-allowed">
                        Waiting…
                      </button>
                    )}
                    {!hasBet && phase === "FLYING" && (
                      <button disabled className="w-full h-[52px] rounded-lg bg-[#12141C] border border-[#1C1E28] text-zinc-600 font-bold text-sm cursor-not-allowed">
                        Bet (Next Round)
                      </button>
                    )}
                  </>
                ) : autoRunning ? (
                  <button onClick={handleStopAuto}
                    className="w-full h-[52px] rounded-lg font-extrabold text-[15px] uppercase transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{ backgroundColor: "#c53030", color: "#fff" }}>
                    STOP AUTO ({autoRoundsLeft} left)
                  </button>
                ) : (
                  <button onClick={handleStartAuto}
                    className="w-full h-[52px] rounded-lg font-extrabold text-[15px] uppercase transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{ backgroundColor: "#e69308", color: "#fff", boxShadow: "0 4px 15px rgba(230,147,8,0.3)" }}>
                    START AUTO
                  </button>
                )}

                {/* Balance + hotkey hint */}
                <div className="flex items-center justify-between px-1 pt-1">
                  <span className="text-[10px] text-zinc-600">Balance</span>
                  <span className="text-[11px] text-white font-bold">{activeSymbol}{activeBalance?.toFixed(2) ?? "—"}</span>
                </div>
                {betTab === "manual" && (
                  <div className="flex items-center justify-center gap-1 pt-0.5">
                    <kbd className="px-1.5 py-px rounded text-[9px] font-bold text-zinc-500 bg-[#12141C] border border-[#1C1E28]">Space</kbd>
                    <span className="text-[9px] text-zinc-600">to bet / cash out</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT SIDEBAR — Player bets ════════════════════════════ */}
          <div className="hidden md:flex flex-col w-[320px] flex-shrink-0" style={{ background: "#111318", borderLeft: "1px solid #1a1f2e" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid #1a1f2e" }}>
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold">
                Live Bets <span className="text-green-500">{liveBets.length}</span>
              </span>
              <span className="text-[11px] text-white font-bold">{activeSymbol}{liveBets.reduce((s, b) => s + b.betAmount, 0).toFixed(2)}</span>
            </div>

            {/* Column headers */}
            <div className="flex items-center px-3 py-1 text-[10px] text-zinc-600 font-bold uppercase" style={{ borderBottom: "1px solid #1a1f2e" }}>
              <div className="flex-1">Player</div>
              <div style={{ width: 60, textAlign: "center" }}>Cashout</div>
              <div style={{ width: 90, textAlign: "right" }}>Amount</div>
            </div>

            {/* Players list */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#222 transparent" }}>
              {liveBets.length === 0 ? (
                <div className="text-center text-zinc-700 text-xs py-10">Waiting for bets…</div>
              ) : liveBets.map((b, i) => {
                const m = b.multiplier || 0;
                // Payout tier color: red <2x, green 2-10x, gold ≥10x.
                const tier = m < 2 ? "#e74c3c" : m < 10 ? "#2ecc71" : "#ffc44a";
                return (
                <div key={i} className="flex items-center px-3 py-[6px] transition-colors" style={{
                  borderBottom: "1px solid #111318",
                  background: b.cashedOut ? "rgba(46,204,113,0.07)" : undefined,
                }}>
                  <div className="flex-1 text-[12px] font-medium truncate" style={{ color: b.cashedOut ? "#cbf3d8" : "#d4d4d8" }}>{b.username}</div>
                  <div style={{ width: 60, textAlign: "center" }}>
                    {b.cashedOut
                      ? <span className="text-[12px] font-bold tabular-nums" style={{ color: tier }}>{m.toFixed(2)}x</span>
                      : <span className="text-zinc-700 text-[12px]">—</span>}
                  </div>
                  <div style={{ width: 90, textAlign: "right" }} className="flex items-center justify-end gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: b.cashedOut ? tier : "#3a3d4a" }} />
                    <span className="text-[12px] font-bold tabular-nums" style={{ color: b.cashedOut ? tier : "#fff" }}>
                      {activeSymbol}{(b.cashedOut ? (b.payout || 0) : b.betAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
