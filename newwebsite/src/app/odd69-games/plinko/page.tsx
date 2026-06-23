"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import { useReducedMotion } from "framer-motion";
import Matter from "matter-js";
import { Zap, Clock, X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { getConfiguredSocketNamespace } from "@/utils/socketUrl";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import OriginalsAutoBet from "@/components/originals/OriginalsAutoBet";

type WalletType = "fiat" | "crypto";
type PlinkoRisk = "low" | "medium" | "high";
type PlinkoRows = 8 | 12 | 16;

const ACCENT = "#ff9a3d";

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
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
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

// Backend hard-validates rows ∈ {8,12,16} and risk ∈ {low,medium,high}
// (newbackend/src/plinko/plinko.service.ts isValidRows/isValidRisk).
const ROW_OPTIONS: readonly PlinkoRows[] = [8, 12, 16] as const;
const RISK_OPTIONS: ReadonlyArray<{ key: PlinkoRisk; label: string }> = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

// Mirrors PLINKO_MULTIPLIERS in newbackend/src/plinko/plinko.service.ts exactly
// so the rendered bucket strip matches the server-resolved multiplier.
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

/** Color-graded bucket fill keyed to the multiplier tier. */
function getSlotGradient(multiplier: number): string {
  if (multiplier >= 100) return "linear-gradient(180deg, #ff2d6b 0%, #d91044 100%)";
  if (multiplier >= 20) return "linear-gradient(180deg, #fa4950 0%, #c8353c 100%)";
  if (multiplier >= 5) return "linear-gradient(180deg, #f97316 0%, #c2570d 100%)";
  if (multiplier >= 2) return "linear-gradient(180deg, #ff7a1a 0%, #e85f00 100%)";
  if (multiplier >= 1) return "linear-gradient(180deg, #ff9a3d 0%, #e85f00 100%)";
  return "linear-gradient(180deg, #2f2418 0%, #241a10 100%)"; // cool sub-1× valley
}

function getSlotTextColor(multiplier: number): string {
  if (multiplier < 1) return "#ffb877";
  if (multiplier >= 2) return "#fff";
  return "#1a0a00";
}

function formatMultiplier(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(0)}k`;
  if (m >= 100) return m.toFixed(0);
  if (m >= 10) return m.toFixed(1);
  return m.toFixed(2);
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
  const {
    fiatBalance,
    cryptoBalance,
    refreshWallet,
    selectedWallet,
    setSelectedWallet,
  } = useWallet();
  const prefersReducedMotion = useReducedMotion();

  const socketRef = useRef<Socket | null>(null);

  // ── Physics / canvas refs ───────────────────────────────────────────
  const boardRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const rafRef = useRef<number | null>(null);
  const boardSizeRef = useRef({ w: 0, h: 0 });
  const lastPegSoundRef = useRef(0);
  const pegFlashRef = useRef<Map<number, number>>(new Map());

  // One in-flight ball per gameId; each carries its own server-derived steering
  // plan so multiple balls (rapid manual + autobet) bounce independently and
  // each settles in its own server slotIndex.
  interface BallState {
    body: Matter.Body;
    plan: { y: number; targetX: number }[];
    steerIdx: number;
    result: PlinkoResult;
    startedAt: number;
    settled: boolean;
    isDemo: boolean;
  }
  const ballsRef = useRef<Map<string, BallState>>(new Map());
  const settleTimerRef = useRef<number | null>(null);

  // hyperMode is read inside callbacks via a ref to avoid rebuilding them.
  const hyperRef = useRef(false);
  const instantRef = useRef(false);

  // ── React state (UI-only) ──────────────────────────────────────────
  const [walletType, setWalletType] = useState<WalletType>(selectedWallet);
  const [useBonus, setUseBonus] = useState(false);
  const [betInput, setBetInput] = useState("10");
  const [rows, setRows] = useState<PlinkoRows>(16);
  const [risk, setRisk] = useState<PlinkoRisk>("high");
  const [history, setHistory] = useState<PlinkoHistoryItem[]>([]);
  const [isDropping, setIsDropping] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [lastResult, setLastResult] = useState<PlinkoResult | null>(null);
  const [hyperMode, setHyperMode] = useState(false);
  const [instantBet, setInstantBet] = useState(false);
  const [resultBannerKey, setResultBannerKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [recentMultipliers, setRecentMultipliers] = useState<number[]>([]);

  const betAmount = parseFloat(betInput) || 0;
  const activeBalance = walletType === "crypto" ? cryptoBalance : fiatBalance;
  const sym = "$";
  const multiplierTable = useMemo(() => PLINKO_TABLES[rows][risk], [risk, rows]);
  const maxWin = useMemo(() => Math.max(...multiplierTable), [multiplierTable]);

  useEffect(() => { setWalletType(selectedWallet); }, [selectedWallet]);
  useEffect(() => { hyperRef.current = hyperMode; }, [hyperMode]);
  useEffect(() => { instantRef.current = instantBet; }, [instantBet]);

  // FIFO queue of resolvers for in-flight bets. Each plinko:play emit pushes a
  // resolver; the matching plinko:result / plinko:error shifts and fulfils it.
  // (One emit ⇒ one result, so FIFO ordering is correct for rapid/auto play.)
  const awaitingResolversRef = useRef<((r: { won: boolean; payout: number } | null) => void)[]>([]);
  // animateDrop changes identity when `rows` changes; read it through a ref so
  // the socket only connects once (never tears down mid-bet on a rows toggle).
  const animateDropRef = useRef<((r: PlinkoResult, demo?: boolean) => Promise<void>) | null>(null);

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

    // Tear down any prior engine + balls.
    if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
    if (engineRef.current) {
      Matter.World.clear(engineRef.current.world, false);
      Matter.Engine.clear(engineRef.current);
    }
    ballsRef.current.clear();

    const engine = Matter.Engine.create();
    engine.gravity.y = 1;
    engine.world.gravity.scale = 0.0014;
    engineRef.current = engine;

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
    const binTop = ((8 + 73) / 100) * h + pegR * 2;
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
    bodies.push(
      Matter.Bodies.rectangle(w / 2, floorY + 6, w, 12, {
        isStatic: true,
        restitution: 0,
        friction: 0.6,
        label: "floor",
      }),
    );
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

  // ── Render loop: draws every in-flight ball + steers each toward its slot ──
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

      const now = performance.now();
      const pegR = Math.max(3, w * (Math.max(5, 9 - rows * 0.15) / 2) / 680);

      // Peg flashes (fade over ~200ms; expired entries are pruned in place).
      pegFlashRef.current.forEach((t, id) => {
        const age = now - t;
        if (age > 200) { pegFlashRef.current.delete(id); return; }
        const a = 1 - age / 200;
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

      // Steer + draw each in-flight ball.
      ballsRef.current.forEach((state) => {
        const ball = state.body;
        const plan = state.plan;
        while (
          state.steerIdx < plan.length &&
          ball.position.y >= plan[state.steerIdx].y
        ) {
          state.steerIdx++;
        }
        const next = plan[state.steerIdx];
        if (next) {
          const dx = next.targetX - ball.position.x;
          const nudge = Math.max(-1.4, Math.min(1.4, dx * 0.018));
          Matter.Body.setVelocity(ball, {
            x: ball.velocity.x * 0.86 + nudge,
            y: ball.velocity.y,
          });
        } else {
          // Past the last peg row: hard-funnel into the exact target lane.
          const finalX = targetXForSlot(state.result.slotIndex, state.result.rows, w);
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
      });

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  }, [rows]);

  // ── Apply celebration / sound / UI strictly from the SERVER result ────
  const resolveResultUI = useCallback((result: PlinkoResult, isDemo: boolean) => {
    setLastResult(result);
    setResultBannerKey((k) => k + 1);
    setRecentMultipliers((prev) => [result.multiplier, ...prev].slice(0, 9));
    if (isDemo) return;
    if (result.status === "WON" && result.multiplier >= 1) {
      playSound("win");
      if (result.multiplier >= 10) fireBigWin();
      else fireWin();
    } else {
      playSound("lose");
    }
  }, []);

  // ── Build the per-ball steering plan from the SERVER path ─────────────
  const buildPlan = useCallback((result: PlinkoResult, w: number, h: number, pegR: number) => {
    const plan: { y: number; targetX: number }[] = [];
    let cum = 0;
    const path = Array.isArray(result.path) && result.path.length === result.rows
      ? result.path
      : Array.from({ length: result.rows }, (_, i) => (i < result.slotIndex ? 1 : 0));
    const binStartX = ((50 - PEG_X_SPREAD / 2) / 100) * w;
    const binW = ((PEG_X_SPREAD / 100) * w) / result.rows;
    const finalX = binStartX + (result.slotIndex + 0.5) * binW;
    const startXpx = w / 2;
    for (let r = 0; r < result.rows; r++) {
      cum += path[r] ? 1 : 0;
      const t = (r + 1) / result.rows;
      const pathBias = (cum / Math.max(1, result.rows)) - 0.5;
      const targetX = startXpx + (finalX - startXpx) * t + pathBias * binW * 0.6 * (1 - t);
      const py = (pegPercent(r, 0, result.rows).y / 100) * h - pegR;
      plan.push({ y: py, targetX });
    }
    return plan;
  }, []);

  // ── Drop a physics ball that MUST land in result.slotIndex ───────────
  // Returns a promise that resolves when the ball settles (or instantly in
  // reduced-motion / instant-bet) so callers can sequence (autobet).
  const animateDrop = useCallback((result: PlinkoResult, isDemo = false): Promise<void> => {
    const engine = engineRef.current;
    const { w, h } = boardSizeRef.current;

    // Reduced motion / instant-bet / no engine: resolve immediately.
    if (prefersReducedMotion || instantRef.current || !engine || w === 0) {
      resolveResultUI(result, isDemo);
      return Promise.resolve();
    }

    const pegR = Math.max(3, w * (Math.max(5, 9 - rows * 0.15) / 2) / 680);
    const ballR = pegR * 1.55;

    const plan = buildPlan(result, w, h, pegR);
    const dropX = w / 2 + (Math.random() - 0.5) * (pegR * 1.2);
    const ball = Matter.Bodies.circle(dropX, (5 / 100) * h, ballR, {
      restitution: 0.45,
      friction: 0.002,
      frictionAir: 0.012,
      density: 0.02,
      label: "ball",
    });
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.World.add(engine.world, ball);

    engine.timing.timeScale = hyperRef.current ? 1.9 : 1.0;

    const state: BallState = {
      body: ball,
      plan,
      steerIdx: 0,
      result,
      startedAt: performance.now(),
      settled: false,
      isDemo,
    };
    ballsRef.current.set(result.gameId, state);
    // Cap concurrent balls for perf — remove the oldest if we exceed the cap.
    if (ballsRef.current.size > 14) {
      const oldestKey = ballsRef.current.keys().next().value;
      if (oldestKey) {
        const old = ballsRef.current.get(oldestKey);
        if (old && engineRef.current) Matter.World.remove(engineRef.current.world, old.body);
        ballsRef.current.delete(oldestKey);
      }
    }

    startRenderLoop();

    return new Promise<void>((resolve) => {
      const maxMs = hyperRef.current ? 2200 : 4200;
      const watch = () => {
        const s = ballsRef.current.get(result.gameId);
        if (!s || s.settled) { resolve(); return; }
        const b = s.body;
        const elapsed = performance.now() - s.startedAt;
        const floorReached = b.position.y > h - ballR * 2.4;
        const resting = Math.abs(b.velocity.y) < 0.25 && b.position.y > ((8 + 73) / 100) * h;
        if ((floorReached && resting) || elapsed > maxMs) {
          s.settled = true;
          if (engineRef.current) {
            const finalX = targetXForSlot(result.slotIndex, result.rows, w);
            Matter.Body.setPosition(b, { x: finalX, y: h - ballR * 2.2 });
            Matter.Body.setVelocity(b, { x: 0, y: 0 });
          }
          resolveResultUI(result, s.isDemo);
          // Linger briefly in the bucket, then remove this ball.
          window.setTimeout(() => {
            if (engineRef.current) Matter.World.remove(engineRef.current.world, b);
            ballsRef.current.delete(result.gameId);
          }, 650);
          resolve();
          return;
        }
        window.setTimeout(watch, 60);
      };
      window.setTimeout(watch, 120);
    });
  }, [buildPlan, prefersReducedMotion, resolveResultUI, rows, startRenderLoop]);

  // Keep the ref pointed at the latest animateDrop so the socket can call it
  // without listing it as a dependency (avoids reconnect churn on rows change).
  useEffect(() => { animateDropRef.current = animateDrop; }, [animateDrop]);

  // Build / rebuild the matter world on mount + rows change + resize.
  useEffect(() => {
    buildWorld();
    startRenderLoop();
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (ballsRef.current.size === 0) buildWorld();
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
    // Snapshot the mutable ref container so the cleanup closes over the same
    // object (it's a ref, not a React node, but this satisfies the lint rule).
    const balls = ballsRef.current;
    return () => {
      if (settleTimerRef.current != null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
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
      balls.clear();
      // Reject any in-flight awaiters so autobet loops unwind cleanly.
      awaitingResolversRef.current.forEach((res) => res(null));
      awaitingResolversRef.current = [];
    };
  }, []);

  // ── Socket lifecycle ─────────────────────────────────────────────────
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

      // Hand this result to whichever caller is awaiting (FIFO — one emit, one
      // result), then animate. The promise resolves only once the ball settles.
      const resolver = awaitingResolversRef.current.shift();
      const drop = animateDropRef.current?.(result, false) ?? Promise.resolve();
      void drop.then(() => {
        setIsDropping(false);
        resolver?.({ won: result.status === "WON", payout: result.payout });
      });
    });

    socket.on("plinko:history", (items: PlinkoHistoryItem[]) => {
      setHistory(items);
      setRecentMultipliers(items.slice(0, 9).map((i) => i.multiplier));
    });

    socket.on("plinko:error", (payload: { message: string }) => {
      setIsDropping(false);
      void refreshWallet();
      toast.error(payload.message);
      // Fail the oldest awaiting caller so the autobet loop stops cleanly.
      const resolver = awaitingResolversRef.current.shift();
      resolver?.(null);
    });

    return () => { socket.disconnect(); };
  }, [refreshWallet]);

  const handleWalletTypeChange = useCallback((next: WalletType) => {
    setWalletType(next);
    void setSelectedWallet(next);
  }, [setSelectedWallet]);

  // ── Place ONE bet over the socket, resolving with the round outcome ───
  const placeBet = useCallback((bet: number): Promise<{ won: boolean; payout: number } | null> => {
    return new Promise((resolve) => {
      if (!socketRef.current || !socketRef.current.connected) {
        toast.error("Connecting to server…");
        resolve(null);
        return;
      }
      if (bet <= 0) { toast.error("Enter a bet amount"); resolve(null); return; }
      if (bet > activeBalance) { toast.error("Insufficient balance"); resolve(null); return; }

      setLastResult(null);
      setIsDropping(true);
      playSound("bet");
      awaitingResolversRef.current.push(resolve);
      socketRef.current.emit("plinko:play", {
        betAmount: bet,
        rows,
        risk,
        walletType,
        useBonus: walletType === "crypto" ? false : useBonus,
      });
    });
  }, [activeBalance, risk, rows, useBonus, walletType]);

  // Manual drop.
  const handleDrop = useCallback(() => {
    if (autoBusy) return;
    void placeBet(betAmount);
  }, [autoBusy, betAmount, placeBet]);

  // Auto-bet runner (used by <OriginalsAutoBet>).
  const runAutoBet = useCallback(
    (bet: number) => placeBet(bet),
    [placeBet],
  );

  // Spacebar hotkey for rapid manual play.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      if (!autoBusy) void placeBet(betAmount);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoBusy, betAmount, placeBet]);

  const pegNodes = useMemo(() => {
    return Array.from({ length: rows }, (_, rowIndex) => {
      const cols = rowIndex + 1;
      return Array.from({ length: cols }, (_, colIndex) => {
        const p = pegPercent(rowIndex, colIndex, rows);
        return { key: `${rowIndex}-${colIndex}`, x: p.x, y: p.y };
      });
    }).flat();
  }, [rows]);

  const controlsLocked = autoBusy;

  // ── Manual-mode game-specific controls (risk + rows) ──────────────────
  const gameControls = (
    <>
      {/* Risk */}
      <div>
        <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">Risk</label>
        <div className="flex gap-1.5 mt-1.5">
          {RISK_OPTIONS.map((opt) => {
            const active = risk === opt.key;
            const tone =
              opt.key === "low" ? "#22c55e" : opt.key === "medium" ? "#fbbf24" : "#ef4444";
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => !controlsLocked && setRisk(opt.key)}
                disabled={controlsLocked}
                className="flex-1 py-2.5 text-xs font-bold rounded-lg border transition-all disabled:opacity-50"
                style={
                  active
                    ? { background: `${tone}26`, borderColor: `${tone}66`, color: tone }
                    : { background: "var(--bg-deep-3, #0f1016)", borderColor: "rgba(255,255,255,0.06)", color: "#9ca3af" }
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rows (8 / 12 / 16 — the values the backend accepts) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">Rows</label>
          <span className="text-[13px] font-black text-white tabular-nums">{rows}</span>
        </div>
        <div className="flex gap-1.5">
          {ROW_OPTIONS.map((r) => {
            const active = rows === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => !controlsLocked && setRows(r)}
                disabled={controlsLocked}
                className="flex-1 py-2.5 text-xs font-bold rounded-lg border transition-all disabled:opacity-50"
                style={
                  active
                    ? { background: `${ACCENT}26`, borderColor: `${ACCENT}66`, color: ACCENT }
                    : { background: "var(--bg-deep-3, #0f1016)", borderColor: "rgba(255,255,255,0.06)", color: "#9ca3af" }
                }
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* RTP / max-win disclosure */}
      <div className="flex items-center justify-between text-[11px] pt-1">
        <span className="text-[#6b7280]">Max win</span>
        <span className="font-black tabular-nums" style={{ color: ACCENT }}>
          {formatMultiplier(maxWin)}×
        </span>
      </div>
    </>
  );

  const actionButton = (
    <button
      type="button"
      onClick={handleDrop}
      disabled={isDropping || autoBusy}
      id="plinko-bet-btn"
      className="w-full h-13 py-3.5 rounded-lg text-base font-black transition-all active:scale-[0.99] disabled:cursor-not-allowed"
      style={
        isDropping || autoBusy
          ? { background: `${ACCENT}4d`, color: "#0b0d10" }
          : { background: ACCENT, color: "#0b0d10", boxShadow: `0 4px 20px ${ACCENT}4d` }
      }
    >
      {isDropping ? "Dropping…" : "Bet"}
    </button>
  );

  const controls = (
    <OriginalsControls
      betInput={betInput}
      setBetInput={setBetInput}
      walletType={walletType}
      setWalletType={handleWalletTypeChange}
      useBonus={useBonus}
      setUseBonus={setUseBonus}
      locked={controlsLocked}
      minBet={10}
      accent={ACCENT}
      action={actionButton}
      autoPanel={
        <>
          {gameControls}
          <OriginalsAutoBet
            baseBet={betAmount}
            accent={ACCENT}
            disabled={betAmount <= 0 || betAmount > activeBalance}
            runBet={runAutoBet}
            onBusyChange={setAutoBusy}
          />
        </>
      }
    >
      {gameControls}
    </OriginalsControls>
  );

  return (
    <OriginalsShell gameKey="plinko" title="Plinko" controls={controls}>
      {/* ══════ Game stage ══════ */}
      <section className="flex-1 flex flex-col bg-bg-odd69 relative overflow-hidden min-h-[500px] h-full">

        {/* Result Banner */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[80%] max-w-[540px] h-11 z-30">
          {lastResult ? (
            <div
              key={resultBannerKey}
              className="w-full h-full rounded-lg flex items-center justify-center gap-3 border transition-all animate-[plinkoFade_0.3s_ease]"
              style={
                lastResult.multiplier >= 1
                  ? { background: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.3)" }
                  : { background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)" }
              }
            >
              <span className="text-lg font-black" style={{ color: lastResult.multiplier >= 1 ? "#34d399" : "#f87171" }}>
                {lastResult.multiplier >= 1 ? "+" : ""}{sym}{lastResult.payout.toFixed(2)}
              </span>
              <span className="text-[#6b7280] text-[12px] font-semibold">·</span>
              <span className="text-[14px] font-black" style={{ color: lastResult.multiplier >= 1 ? "#fff" : "#f87171" }}>
                {lastResult.multiplier.toFixed(2)}×
              </span>
            </div>
          ) : (
            <div className="w-full h-full rounded-lg bg-bg-modal-2 border border-white/[0.06] flex items-center justify-center">
              <span className="text-[#6b7280] text-[12px] font-semibold">Drop the ball to play</span>
            </div>
          )}
        </div>

        {/* Hyper + Instant + History toggles */}
        <div className="absolute top-5 right-5 flex items-center gap-3 z-30">
          <ToggleChip label="Instant" active={instantBet} onClick={() => setInstantBet((v) => !v)} />
          <ToggleChip label="Hyper" active={hyperMode} onClick={() => setHyperMode((v) => !v)} icon={hyperMode} />
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            title="Bet history"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all border"
            style={
              showHistory
                ? { background: `${ACCENT}26`, borderColor: `${ACCENT}66`, color: ACCENT }
                : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.06)", color: "#9ca3af" }
            }
          >
            <Clock size={14} />
          </button>
        </div>

        {/* History Panel Overlay */}
        {showHistory && (
          <div className="absolute inset-0 z-40 bg-bg-odd69/95 backdrop-blur-md flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Clock size={14} style={{ color: ACCENT }} /> Bet History
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-[#6b7280] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
              {history.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-[#6b7280] text-sm">No bets yet</div>
              ) : history.map((h, i) => (
                <div key={h.gameId + i} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={
                          h.status === "WON"
                            ? { background: "rgba(34,197,94,0.15)", color: "#34d399" }
                            : { background: "rgba(239,68,68,0.1)", color: "#f87171" }
                        }
                      >{h.status}</span>
                      <span className="text-[11px] text-[#6b7280]">{h.rows}R · {h.risk}</span>
                    </div>
                    <p className="text-[11px] text-[#6b7280] mt-0.5">{sym}{h.betAmount.toFixed(2)} bet</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black" style={{ color: h.status === "WON" ? "#34d399" : "#f87171" }}>
                      {h.multiplier.toFixed(2)}×
                    </p>
                    <p className="text-[11px] text-[#6b7280]">{sym}{h.payout.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent-results rail (Stake's signature vertical pills) */}
        <div className="absolute top-20 right-5 z-20 hidden sm:flex flex-col gap-1.5 w-[58px]">
          {recentMultipliers.map((m, i) => (
            <div
              key={i}
              className="h-7 rounded-md flex items-center justify-center text-[11px] font-black tabular-nums transition-all"
              style={{
                background: getSlotGradient(m),
                color: getSlotTextColor(m),
                opacity: 1 - i * 0.08,
              }}
            >
              {formatMultiplier(m)}×
            </div>
          ))}
        </div>

        {/* Plinko Board */}
        <div className="flex-1 flex items-center justify-center mt-16 p-3 relative z-10">
          <div
            ref={boardRef}
            className="w-full max-w-[680px] aspect-[1/1.05] relative"
            style={{ background: "radial-gradient(ellipse at 50% 35%, rgba(255,154,61,0.07), transparent 65%)" }}
          >
            {/* Pegs */}
            {pegNodes.map((peg) => (
              <div
                key={peg.key}
                className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${peg.x}%`,
                  top: `${peg.y}%`,
                  width: `${Math.max(5, 9 - rows * 0.15)}px`,
                  height: `${Math.max(5, 9 - rows * 0.15)}px`,
                  background: "rgba(255,255,255,0.85)",
                  boxShadow: "0 0 4px rgba(255,255,255,0.3)",
                }}
              />
            ))}

            {/* Physics ball canvas (matter-js). Sits above pegs, below slots. */}
            <canvas ref={canvasRef} className="absolute inset-0 z-20 pointer-events-none" />

            {/* Multiplier Slots */}
            <div className="absolute inset-x-[1%] bottom-[1%] h-[30px] sm:h-[36px] flex items-end gap-[2px] z-[25]">
              {multiplierTable.map((multiplier, index) => {
                const isLast = lastResult?.slotIndex === index && !!lastResult;
                return (
                  <div
                    key={`${rows}-${risk}-${index}`}
                    className="flex-1 h-full rounded-[4px] flex items-center justify-center relative overflow-hidden transition-all duration-200"
                    style={{
                      background: getSlotGradient(multiplier),
                      transform: isLast ? "translateY(2px) scaleY(0.92)" : "translateY(0)",
                      boxShadow: isLast
                        ? `0 0 14px ${ACCENT}d9, inset 0 0 0 1.5px rgba(255,255,255,0.6)`
                        : "0 3px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
                    }}
                  >
                    {isLast && <div className="absolute inset-0 bg-white/[0.16] animate-pulse" />}
                    <span
                      className="tabular-nums leading-none font-black relative z-10"
                      style={{
                        color: getSlotTextColor(multiplier),
                        fontSize: multiplierTable.length > 14 ? "8px" : multiplierTable.length > 10 ? "10px" : "12px",
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

      <style>{`
        @keyframes plinkoFade {
          from { opacity: 0; transform: translateY(-6px) translateX(-50%); }
          to { opacity: 1; transform: translateY(0) translateX(-50%); }
        }
      `}</style>
    </OriginalsShell>
  );
}

// ── Small local toggle chip for Hyper / Instant ─────────────────────────
function ToggleChip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] text-[#6b7280] font-semibold hidden sm:block">{label}</span>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className="w-9 h-5 rounded-full relative transition-colors border"
        style={
          active
            ? { background: ACCENT, borderColor: ACCENT }
            : { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }
        }
      >
        <div
          className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow transition-transform"
          style={{ transform: active ? "translateX(18px)" : "translateX(3px)" }}
        />
      </button>
      {icon && <Zap size={12} style={{ color: ACCENT }} className="animate-pulse" />}
    </div>
  );
}
