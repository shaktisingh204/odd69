"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import { useReducedMotion } from "framer-motion";
import Matter from "matter-js";
import { ChevronUp, ChevronDown, Info, Zap, Volume2, VolumeX, BarChart3, Clock } from "lucide-react";
import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { useModal } from "@/context/ModalContext";
import { useOriginalsAccess } from "@/hooks/useOriginalsAccess";
import { useGameSounds } from "@/hooks/useGameSounds";
import { getConfiguredSocketNamespace } from "@/utils/socketUrl";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

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

// Same percent-coordinate layout the DOM pegs / slots use, kept in one place so
// the matter-js bodies line up pixel-perfect with the rendered chrome.
const PEG_X_SPREAD = 75; // total horizontal % the peg triangle spans (centered on 50%)
function pegPercent(rowIndex: number, colIndex: number, rows: number) {
  const cols = rowIndex + 1;
  const x = 50 + (colIndex - (cols - 1) / 2) * (PEG_X_SPREAD / rows);
  const y = 8 + ((rowIndex + 1) / rows) * 73;
  return { x, y };
}

// Pixel x of the center of a given bucket/lane (matches the DOM slot strip).
function targetXForSlot(slotIndex: number, rowCount: number, w: number) {
  const binStartX = ((50 - PEG_X_SPREAD / 2) / 100) * w;
  const binW = ((PEG_X_SPREAD / 100) * w) / rowCount;
  return binStartX + (slotIndex + 0.5) * binW;
}

export default function PlinkoPage() {
  const { token, loading: authLoading } = useAuth();
  const { canAccessOriginals, loading: accessLoading } = useOriginalsAccess();
  const { fiatBalance, cryptoBalance, refreshWallet, selectedWallet, setSelectedWallet } = useWallet();
  const { openLogin } = useModal();
  const { playBet, playCrash, playWin, muted, toggleMute } = useGameSounds();
  const prefersReducedMotion = useReducedMotion();

  const socketRef = useRef<Socket | null>(null);
  const hasSession = !!token;

  // ── Physics / canvas refs ───────────────────────────────────────────
  const boardRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const ballBodyRef = useRef<Matter.Body | null>(null);
  const rafRef = useRef<number | null>(null);
  const boardSizeRef = useRef({ w: 0, h: 0 });
  const lastPegSoundRef = useRef(0);
  const pegFlashRef = useRef<Map<number, number>>(new Map());
  // Per-row steering plan derived from the SERVER path so the ball settles in
  // exactly result.slotIndex. { y(px), targetX(px), dir }
  const steerRef = useRef<{ y: number; targetX: number }[]>([]);
  const steerIdxRef = useRef(0);
  const finishedRef = useRef(true);
  const settleTimerRef = useRef<number | null>(null);

  const [walletType, setWalletType] = useState<WalletType>(selectedWallet);
  const [betInput, setBetInput] = useState("10");
  const [rows, setRows] = useState<PlinkoRows>(16);
  const [risk, setRisk] = useState<PlinkoRisk>("high");
  const [history, setHistory] = useState<PlinkoHistoryItem[]>([]);
  const [isDropping, setIsDropping] = useState(false);
  const [lastResult, setLastResult] = useState<PlinkoResult | null>(null);
  const [hyperMode, setHyperMode] = useState(false);
  const [tab, setTab] = useState<"Manual" | "Auto">("Manual");
  const [resultBannerKey, setResultBannerKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

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

  // ── matter-js engine setup (persists across drops; rebuilds on rows/size) ──
  const buildWorld = useCallback(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;

    const rect = board.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w === 0 || h === 0) return;
    boardSizeRef.current = { w, h };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Tear down any prior engine.
    if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
    if (engineRef.current) {
      Matter.World.clear(engineRef.current.world, false);
      Matter.Engine.clear(engineRef.current);
    }

    const engine = Matter.Engine.create();
    engine.gravity.y = 1;
    engine.world.gravity.scale = 0.0014;
    engineRef.current = engine;
    ballBodyRef.current = null;

    const pegR = Math.max(3, w * (Math.max(5, 9 - rows * 0.15) / 2) / 680);
    const bodies: Matter.Body[] = [];

    // Pegs — static circles at the exact DOM percent positions.
    let pegId = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= r; c++) {
        const p = pegPercent(r, c, rows);
        const peg = Matter.Bodies.circle((p.x / 100) * w, (p.y / 100) * h, pegR, {
          isStatic: true,
          restitution: 0.4,
          friction: 0.0,
          label: `peg-${pegId++}`,
        });
        bodies.push(peg);
      }
    }

    // Bin dividers + floor under the last peg row, aligned to the slot strip.
    const slotCount = rows + 1;
    const binTopPct = 8 + (rows / rows) * 73; // y of last peg row in %
    const binTop = (binTopPct / 100) * h + pegR * 2;
    const binStartX = ((50 - PEG_X_SPREAD / 2) / 100) * w;
    const binW = ((PEG_X_SPREAD / 100) * w) / rows; // lane width == peg spacing
    const floorY = h - 2;
    const wallThick = Math.max(2, binW * 0.06);
    for (let i = 0; i <= slotCount; i++) {
      const x = binStartX + (i - 0.5) * binW + binW / 2;
      const divider = Matter.Bodies.rectangle(
        x,
        (binTop + floorY) / 2,
        wallThick,
        floorY - binTop,
        { isStatic: true, restitution: 0.1, friction: 0.4, label: "divider" },
      );
      bodies.push(divider);
    }
    // Floor.
    bodies.push(
      Matter.Bodies.rectangle(w / 2, floorY + 6, w, 12, {
        isStatic: true,
        restitution: 0,
        friction: 0.6,
        label: "floor",
      }),
    );
    // Outer side walls so a ball can never escape the board.
    bodies.push(Matter.Bodies.rectangle(-6, h / 2, 12, h, { isStatic: true, label: "wall" }));
    bodies.push(Matter.Bodies.rectangle(w + 6, h / 2, 12, h, { isStatic: true, label: "wall" }));

    Matter.World.add(engine.world, bodies);

    // Peg-hit feedback: throttled tick + brief visual flash on the struck peg.
    Matter.Events.on(engine, "collisionStart", (evt) => {
      for (const pair of evt.pairs) {
        const pegBody =
          pair.bodyA.label?.startsWith("peg-") ? pair.bodyA
          : pair.bodyB.label?.startsWith("peg-") ? pair.bodyB
          : null;
        if (!pegBody) continue;
        const now = performance.now();
        if (now - lastPegSoundRef.current > 38) {
          lastPegSoundRef.current = now;
          playSound("tick");
        }
        const id = Number(pegBody.label.slice(4));
        pegFlashRef.current.set(id, now);
      }
    });

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);
  }, [rows]);

  // ── Render loop: draws ball + steers it row-by-row toward the server slot ──
  const startRenderLoop = useCallback(() => {
    if (rafRef.current != null) return;
    const draw = () => {
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      if (!canvas || !engine) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext("2d");
      const { w, h } = boardSizeRef.current;
      if (!ctx || w === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, w, h);

      // Peg flashes (fade over ~180ms).
      const now = performance.now();
      const pegR = Math.max(3, w * (Math.max(5, 9 - rows * 0.15) / 2) / 680);
      pegFlashRef.current.forEach((t, id) => {
        const age = now - t;
        if (age > 200) { pegFlashRef.current.delete(id); return; }
        const a = 1 - age / 200;
        // resolve peg id -> position
        let counter = 0, found: { x: number; y: number } | null = null;
        for (let r = 0; r < rows && !found; r++) {
          for (let c = 0; c <= r; c++) {
            if (counter === id) { found = pegPercent(r, c, rows); break; }
            counter++;
          }
        }
        if (!found) return;
        const px = (found.x / 100) * w;
        const py = (found.y / 100) * h;
        ctx.beginPath();
        ctx.arc(px, py, pegR * (1.6 + a * 1.2), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,154,61,${0.32 * a})`;
        ctx.fill();
      });

      const ball = ballBodyRef.current;
      if (ball) {
        // Steer the ball as it descends past each row so the realistic bounce
        // resolves into the server's slotIndex. We nudge horizontal velocity
        // toward the lane target for the row the ball is currently entering.
        const plan = steerRef.current;
        while (
          steerIdxRef.current < plan.length &&
          ball.position.y >= plan[steerIdxRef.current].y
        ) {
          steerIdxRef.current++;
        }
        const next = plan[steerIdxRef.current];
        if (next) {
          const dx = next.targetX - ball.position.x;
          // Gentle proportional nudge — strong enough to guarantee the lane,
          // soft enough to keep visible, peg-deflected bouncing.
          const nudge = Math.max(-1.4, Math.min(1.4, dx * 0.018));
          Matter.Body.setVelocity(ball, {
            x: ball.velocity.x * 0.86 + nudge,
            y: ball.velocity.y,
          });
        } else {
          // Past the last peg row: hard-funnel into the exact target lane.
          const targetX = steerRef.current.length
            ? steerRef.current[steerRef.current.length - 1].targetX
            : ball.position.x;
          const finalX =
            (lastResult && engineRef.current)
              ? targetXForSlot(lastResult.slotIndex, rows, w)
              : targetX;
          const dx = finalX - ball.position.x;
          Matter.Body.setVelocity(ball, {
            x: ball.velocity.x * 0.7 + Math.max(-1.0, Math.min(1.0, dx * 0.05)),
            y: ball.velocity.y,
          });
        }

        // Draw the glowing ball.
        const bx = ball.position.x;
        const by = ball.position.y;
        const br = ball.circleRadius || pegR * 1.6;
        ctx.save();
        const grd = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br);
        grd.addColorStop(0, "#fff8aa");
        grd.addColorStop(0.5, "#ffc300");
        grd.addColorStop(1, "#e89000");
        ctx.shadowColor = "rgba(255,170,0,0.9)";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  }, [lastResult, rows]);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const resolveResult = useCallback((result: PlinkoResult, isDemo = false) => {
    setLastResult(result);
    setResultBannerKey((k) => k + 1);
    setIsDropping(false);
    finishedRef.current = true;
    if (isDemo) return;
    // Celebrations + sound driven STRICTLY by the server result.
    if (result.status === "WON" && result.multiplier >= 1) {
      playWin();
      playSound("win");
      if (result.multiplier >= 10) {
        fireBigWin();
      } else {
        fireWin();
      }
    } else {
      playCrash();
      playSound("lose");
    }
  }, [playCrash, playWin]);

  // ── Drop the physics ball; it MUST land in result.slotIndex ──────────
  const animateDrop = useCallback((result: PlinkoResult, isDemo = false) => {
    clearSettleTimer();
    finishedRef.current = false;

    const engine = engineRef.current;
    const { w, h } = boardSizeRef.current;

    // Reduced motion (or no engine yet): snap straight to the resolved result.
    if (prefersReducedMotion || !engine || w === 0) {
      if (ballBodyRef.current && engine) {
        Matter.World.remove(engine.world, ballBodyRef.current);
        ballBodyRef.current = null;
      }
      resolveResult(result, isDemo);
      return;
    }

    // Remove any existing ball.
    if (ballBodyRef.current) {
      Matter.World.remove(engine.world, ballBodyRef.current);
      ballBodyRef.current = null;
    }

    const pegR = Math.max(3, w * (Math.max(5, 9 - rows * 0.15) / 2) / 680);
    const ballR = pegR * 1.55;

    // Build the steering plan from the SERVER path. result.path is a list of
    // 0/1 right-deflections; the cumulative count == lane index after each row.
    // We compute the target lane center at every peg row and steer toward it.
    const plan: { y: number; targetX: number }[] = [];
    let cum = 0;
    const path = Array.isArray(result.path) && result.path.length === result.rows
      ? result.path
      : // Fallback: derive a balanced L/R path that sums to slotIndex.
        Array.from({ length: result.rows }, (_, i) => (i < result.slotIndex ? 1 : 0));
    const binStartX = ((50 - PEG_X_SPREAD / 2) / 100) * w;
    const binW = ((PEG_X_SPREAD / 100) * w) / result.rows;
    const finalX = binStartX + (result.slotIndex + 0.5) * binW;
    const startXpx = w / 2;
    for (let r = 0; r < result.rows; r++) {
      cum += path[r] ? 1 : 0;
      // Interpolate toward the server's final bucket, weighted by descent
      // progress. The cumulative right-count keeps the curve faithful to the
      // server path while guaranteeing arrival at result.slotIndex.
      const t = (r + 1) / result.rows;
      const pathBias = (cum / Math.max(1, result.rows)) - 0.5; // -0.5..+0.5 from path so far
      const targetX =
        startXpx + (finalX - startXpx) * t + pathBias * binW * 0.6 * (1 - t);
      const py = (pegPercent(r, 0, result.rows).y / 100) * h - pegR; // trigger slightly above the row
      plan.push({ y: py, targetX });
    }
    steerRef.current = plan;
    steerIdxRef.current = 0;

    // Drop position: a touch of randomness for organic feel; steering corrects it.
    const dropX = w / 2 + (Math.random() - 0.5) * (pegR * 1.2);
    const ball = Matter.Bodies.circle(dropX, (5 / 100) * h, ballR, {
      restitution: 0.45,
      friction: 0.002,
      frictionAir: 0.012,
      density: 0.02,
      label: "ball",
    });
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    ballBodyRef.current = ball;
    Matter.World.add(engine.world, ball);

    if (hyperMode) {
      engine.timing.timeScale = 1.9;
    } else {
      engine.timing.timeScale = 1.0;
    }

    startRenderLoop();

    // Detect rest in the bucket (or hard timeout) → resolve from the server.
    const startedAt = performance.now();
    const maxMs = hyperMode ? 2200 : 4200;
    const watch = () => {
      if (finishedRef.current) return;
      const b = ballBodyRef.current;
      const elapsed = performance.now() - startedAt;
      const floorReached = b && b.position.y > h - ballR * 2.4;
      const resting = b && Math.abs(b.velocity.y) < 0.25 && b.position.y > (8 + 73) / 100 * h;
      if ((floorReached && resting) || elapsed > maxMs) {
        // Snap the ball cleanly to the exact bucket center, then resolve.
        if (b && engineRef.current) {
          const finalX = targetXForSlot(result.slotIndex, result.rows, w);
          Matter.Body.setPosition(b, { x: finalX, y: h - ballR * 2.2 });
          Matter.Body.setVelocity(b, { x: 0, y: 0 });
        }
        resolveResult(result, isDemo);
        // Let the ball linger briefly in the bucket, then remove it.
        settleTimerRef.current = window.setTimeout(() => {
          if (ballBodyRef.current && engineRef.current) {
            Matter.World.remove(engineRef.current.world, ballBodyRef.current);
            ballBodyRef.current = null;
          }
        }, 650);
        return;
      }
      settleTimerRef.current = window.setTimeout(watch, 60);
    };
    settleTimerRef.current = window.setTimeout(watch, 120);
  }, [clearSettleTimer, hyperMode, prefersReducedMotion, resolveResult, rows, startRenderLoop]);

  // Build / rebuild the matter world whenever the board mounts or rows change,
  // and keep it sized to the responsive board via ResizeObserver.
  useEffect(() => {
    buildWorld();
    startRenderLoop();
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      // Debounce to the next frame; rebuild keeps bodies aligned to the box.
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!isDropping) buildWorld();
      });
    });
    ro.observe(board);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildWorld]);

  // Full teardown on unmount.
  useEffect(() => {
    return () => {
      clearSettleTimer();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (runnerRef.current) {
        Matter.Runner.stop(runnerRef.current);
        runnerRef.current = null;
      }
      if (engineRef.current) {
        Matter.World.clear(engineRef.current.world, false);
        Matter.Engine.clear(engineRef.current);
        engineRef.current = null;
      }
      ballBodyRef.current = null;
    };
  }, [clearSettleTimer]);

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
      clearSettleTimer();
      finishedRef.current = true;
      setIsDropping(false);
      if (ballBodyRef.current && engineRef.current) {
        Matter.World.remove(engineRef.current.world, ballBodyRef.current);
        ballBodyRef.current = null;
      }
      void refreshWallet();
      toast.error(payload.message);
    });

    return () => { socket.disconnect(); };
  }, [animateDrop, clearSettleTimer, refreshWallet]);

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
    setIsDropping(true);
    playBet();
    socketRef.current.emit("plinko:play", { betAmount, rows, risk, walletType });
  }, [activeBalance, betAmount, hasSession, isDropping, openLogin, playBet, risk, rows, walletType]);

  const pegNodes = useMemo(() => {
    return Array.from({ length: rows }, (_, rowIndex) => {
      const cols = rowIndex + 1;
      return Array.from({ length: cols }, (_, colIndex) => {
        const p = pegPercent(rowIndex, colIndex, rows);
        return { key: `${rowIndex}-${colIndex}`, x: p.x, y: p.y };
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
              <div ref={boardRef} className="w-full max-w-[680px] aspect-[1/1.05] relative">

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

                {/* Physics ball canvas (matter-js). Sits above pegs, below slots. */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 z-20 pointer-events-none"
                />

                {/* Multiplier Slots */}
                <div className="absolute inset-x-[1%] bottom-[1%] h-[30px] sm:h-[36px] flex items-end gap-[2px] z-[25]">
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
                            ? "0 0 14px rgba(255,154,61,0.85), inset 0 0 0 1.5px rgba(255,255,255,0.6)"
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
