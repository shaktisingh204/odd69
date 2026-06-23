"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  motion,
  useAnimationControls,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { gsap } from "gsap";
import { Shuffle } from "lucide-react";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import OriginalsAutoBet from "@/components/originals/OriginalsAutoBet";
import { useWallet } from "@/context/WalletContext";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

// ---------------------------------------------------------------------------
// Backend contract (newbackend/src/originals/services/coinflip.service.ts)
//   POST /originals/coinflip/start   {betAmount,pick,walletType?,useBonus?}
//   POST /originals/coinflip/flip    {gameId,pick}
//   POST /originals/coinflip/cashout {gameId}
//   GET  /originals/coinflip/active
// Every endpoint returns the same `buildState` shape below. The chain doubles
// the multiplier on each correct flip: multiplier = 0.98 × 2^step, capped at
// step 20 (auto-cashed by the server). Animation always resolves to the
// SERVER-decided face — it never decides the outcome.
// ---------------------------------------------------------------------------

type Side = "heads" | "tails";
type GameStatus = "ACTIVE" | "LOST" | "CASHEDOUT";

interface CoinState {
  gameId: string;
  betAmount: number;
  status: GameStatus;
  step: number;
  multiplier: number;
  picks: Side[];
  results: Side[];
  currentResult: Side | null;
  payout: number;
  nextMultiplier: number | null;
  maxFlips: number;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
}

const ACCENT = "#ff9a3d";
const RTP = 0.98;
const MAX_FLIPS = 20;
// Multiplier locked after N consecutive correct flips: 0.98 × 2^N.
const multForStep = (step: number) =>
  step <= 0 ? 0 : Math.round(RTP * Math.pow(2, step) * 100) / 100;
// A "big win" threshold for the bigger celebration / sound emphasis.
const BIG_WIN_MULTIPLIER = 5;

function fmtMult(m: number): string {
  if (m >= 1000) return m.toLocaleString("en-US", { maximumFractionDigits: 0 }) + "×";
  return m.toFixed(2) + "×";
}
function fmtMoney(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// The coin's front (0deg / multiples of 360) is HEADS; the back (180deg) is
// TAILS. We always spin several full forward turns then ease to the half-turn
// that exposes the server-decided face.
function targetRotation(face: Side, current: number, spins: number) {
  const faceOffset = face === "heads" ? 0 : 180;
  const base = Math.floor(current / 360) * 360;
  let target = base + spins * 360 + faceOffset;
  while (target <= current + (spins > 0 ? 360 : 0)) target += 360;
  return target;
}

export default function CoinflipPage() {
  const { refreshWallet } = useWallet();

  // --- Controls ---
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  // Three-state pick: heads / tails / random (random resolves at flip time).
  const [pickMode, setPickMode] = useState<"heads" | "tails" | "random">("heads");
  const [busy, setBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);

  // --- Game state (mirror of the server's buildState) ---
  const [game, setGame] = useState<CoinState | null>(null);
  // Visual: which face is being shown + whether a flip is mid-air.
  const [flipping, setFlipping] = useState(false);
  // The face the coin is currently resting on (drives idle glow + label).
  const [shownFace, setShownFace] = useState<Side | null>(null);
  // Transient outcome banner for the most recent flip (win/lose/cashout).
  const [lastOutcome, setLastOutcome] = useState<
    null | { kind: "win" | "lose" | "cashout"; result: Side; multiplier: number; payout: number }
  >(null);

  const prefersReduced = useReducedMotion();
  const coinControls = useAnimationControls();
  const rotationRef = useRef(0);
  const glowTlRef = useRef<gsap.core.Timeline | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const flipSeqRef = useRef(0); // cancels stale animations across overlapping flips
  const gameRef = useRef<CoinState | null>(null);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const isActive = game?.status === "ACTIVE";
  const isTerminal = game?.status === "LOST" || game?.status === "CASHEDOUT";

  // Resolve which concrete side to send for the next flip.
  const resolvePick = useCallback(
    (): Side =>
      pickMode === "random"
        ? Math.random() < 0.5
          ? "heads"
          : "tails"
        : pickMode,
    [pickMode],
  );

  // ── Resume an in-flight chain on mount ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    api
      .get<CoinState | { gameId: null }>("/originals/coinflip/active")
      .then((res) => {
        if (cancelled || !res.data || !("status" in res.data)) return;
        const g = res.data as CoinState;
        setGame(g);
        const face = g.currentResult ?? null;
        setShownFace(face);
        if (face) {
          rotationRef.current = targetRotation(face, 0, 0);
          coinControls.set({ rotateY: rotationRef.current });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animate the coin to a SERVER-decided face. Resolves once landed. ───────
  const animateToFace = useCallback(
    (face: Side, opts?: { instant?: boolean }): Promise<void> => {
      const seq = ++flipSeqRef.current;
      glowTlRef.current?.kill();
      glowTlRef.current = null;

      const instant = opts?.instant || prefersReduced;
      if (instant) {
        rotationRef.current = targetRotation(face, rotationRef.current, 0);
        coinControls.set({ rotateY: rotationRef.current });
        setFlipping(false);
        setShownFace(face);
        return Promise.resolve();
      }

      setFlipping(true);
      setShownFace(null);
      playSound("bet");
      const finalRotation = targetRotation(face, rotationRef.current, 6);
      rotationRef.current = finalRotation;

      return coinControls
        .start({
          rotateY: finalRotation,
          // Parabolic "in the air" lift + tiny axis tilt for a real toss feel.
          rotateX: [0, 18, -10, 0],
          y: [0, -70, -90, 0],
          scale: [1, 1.06, 1.06, 1],
          transition: {
            duration: 1.9,
            ease: [0.16, 0.62, 0.2, 1],
            rotateX: { duration: 1.9, times: [0, 0.35, 0.7, 1] },
            y: { duration: 1.9, times: [0, 0.3, 0.55, 1] },
            scale: { duration: 1.9, times: [0, 0.3, 0.7, 1] },
          },
        })
        .then(() => {
          if (seq !== flipSeqRef.current) return; // superseded
          // Decaying landing wobble.
          void coinControls.start({
            rotateY: [finalRotation + 7, finalRotation - 3, finalRotation],
            transition: { duration: 0.42, ease: "easeOut" },
          });
          setFlipping(false);
          setShownFace(face);
        });
    },
    [coinControls, prefersReduced],
  );

  // ── Win / loss / cashout FX after a flip settles ───────────────────────────
  const playOutcomeFx = useCallback(
    (kind: "win" | "lose" | "cashout", multiplier: number) => {
      const won = kind !== "lose";
      const big = won && multiplier >= BIG_WIN_MULTIPLIER;

      if (haloRef.current) {
        const color = won
          ? "rgba(255,154,61,0.7)" // orange
          : "rgba(239,68,68,0.55)"; // red
        glowTlRef.current?.kill();
        glowTlRef.current = gsap.timeline();
        glowTlRef.current
          .fromTo(
            haloRef.current,
            { opacity: 0, scale: 0.6 },
            {
              opacity: 1,
              scale: 1,
              duration: 0.25,
              ease: "power2.out",
              "--glow-color": color,
            } as gsap.TweenVars,
          )
          .to(haloRef.current, {
            opacity: won ? 0.9 : 0.5,
            scale: 1.06,
            duration: 1.1,
            ease: "sine.inOut",
            repeat: kind === "win" ? -1 : 2,
            yoyo: true,
          });
      }

      if (kind === "lose") {
        playSound("crash");
        // Brief bust shake on the stage.
        if (stageRef.current && !prefersReduced) {
          gsap.fromTo(
            stageRef.current,
            { x: -6 },
            { x: 0, duration: 0.4, ease: "elastic.out(1,0.3)" },
          );
        }
        return;
      }

      playSound(kind === "cashout" ? "cashout" : "win");
      if (big) {
        fireBigWin();
      } else {
        const rect = haloRef.current?.getBoundingClientRect();
        if (rect) fireWin(rect.left + rect.width / 2, rect.top + rect.height / 2);
        else fireWin();
      }
    },
    [prefersReduced],
  );

  // ── Apply a server response: animate to its face, then fire FX. ───────────
  const applyResult = useCallback(
    async (next: CoinState, prevStep: number, opts?: { instant?: boolean }) => {
      const result = next.currentResult;
      if (!result) {
        setGame(next);
        return;
      }
      await animateToFace(result, opts);
      setGame(next);

      if (next.status === "LOST") {
        playOutcomeFx("lose", 0);
        setLastOutcome({ kind: "lose", result, multiplier: 0, payout: 0 });
      } else if (next.status === "CASHEDOUT") {
        // Server auto-cashed at the cap.
        playOutcomeFx("cashout", next.multiplier);
        setLastOutcome({
          kind: "cashout",
          result,
          multiplier: next.multiplier,
          payout: next.payout,
        });
      } else if (next.status === "ACTIVE" && next.step > prevStep) {
        playOutcomeFx("win", next.multiplier);
        setLastOutcome({
          kind: "win",
          result,
          multiplier: next.multiplier,
          payout: Math.round(next.betAmount * next.multiplier * 100) / 100,
        });
      }
    },
    [animateToFace, playOutcomeFx],
  );

  // ── START a new chain (first flip). ────────────────────────────────────────
  const start = useCallback(
    async (instant?: boolean): Promise<CoinState | null> => {
      const bet = parseFloat(betInput);
      if (!bet || bet <= 0) {
        toast.error("Invalid bet");
        return null;
      }
      const pick = resolvePick();
      setBusy(true);
      setLastOutcome(null);
      try {
        const res = await api.post<CoinState>("/originals/coinflip/start", {
          betAmount: bet,
          pick,
          walletType,
          useBonus,
        });
        await applyResult(res.data, 0, { instant });
        await refreshWallet();
        return res.data;
      } catch (e: any) {
        toast.error(e?.response?.data?.message || "Flip failed");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [betInput, resolvePick, walletType, useBonus, applyResult, refreshWallet],
  );

  // ── FLIP AGAIN (extend the active chain). ──────────────────────────────────
  const flipAgain = useCallback(
    async (instant?: boolean): Promise<CoinState | null> => {
      const g = gameRef.current;
      if (!g || g.status !== "ACTIVE") return null;
      const pick = resolvePick();
      const prevStep = g.step;
      setBusy(true);
      setLastOutcome(null);
      try {
        const res = await api.post<CoinState>("/originals/coinflip/flip", {
          gameId: g.gameId,
          pick,
        });
        await applyResult(res.data, prevStep, { instant });
        await refreshWallet();
        return res.data;
      } catch (e: any) {
        toast.error(e?.response?.data?.message || "Flip failed");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [resolvePick, applyResult, refreshWallet],
  );

  // ── CASH OUT the active chain. ─────────────────────────────────────────────
  const cashout = useCallback(async (): Promise<CoinState | null> => {
    const g = gameRef.current;
    if (!g || g.status !== "ACTIVE" || g.step < 1) return null;
    setBusy(true);
    try {
      const res = await api.post<CoinState>("/originals/coinflip/cashout", {
        gameId: g.gameId,
      });
      setGame(res.data);
      playOutcomeFx("cashout", res.data.multiplier);
      setLastOutcome({
        kind: "cashout",
        result: res.data.currentResult ?? shownFace ?? "heads",
        multiplier: res.data.multiplier,
        payout: res.data.payout,
      });
      toast.success(`Cashed out ${fmtMoney(res.data.payout)}`);
      await refreshWallet();
      return res.data;
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Cashout failed");
      return null;
    } finally {
      setBusy(false);
    }
  }, [shownFace, playOutcomeFx, refreshWallet]);

  // ── New round reset (clear terminal game so the picker re-enables). ────────
  const newRound = useCallback(() => {
    glowTlRef.current?.kill();
    glowTlRef.current = null;
    if (haloRef.current) gsap.set(haloRef.current, { opacity: 0 });
    setGame(null);
    setLastOutcome(null);
    setShownFace(null);
  }, []);

  // ── AUTO mode: one full chain per "bet" — auto-cash after `autoFlips`. ─────
  const [autoFlips, setAutoFlips] = useState("1");
  const runAutoBet = useCallback(
    async (bet: number): Promise<{ won: boolean; payout: number } | null> => {
      // Clear any prior terminal banner.
      setLastOutcome(null);

      // Place the opening flip.
      let state: CoinState;
      try {
        const startRes = await api.post<CoinState>("/originals/coinflip/start", {
          betAmount: bet,
          pick: resolvePick(),
          walletType,
          useBonus,
        });
        await applyResult(startRes.data, 0, { instant: true });
        state = startRes.data;
      } catch (e: any) {
        toast.error(e?.response?.data?.message || "Flip failed");
        return null; // abort the session
      }

      const target = Math.max(1, Math.floor(Number(autoFlips) || 1));

      // Extend the chain until we hit the target streak length or it busts.
      while (state.status === "ACTIVE" && state.step < target) {
        const prevStep = state.step;
        const pick = resolvePick();
        try {
          const res = await api.post<CoinState>("/originals/coinflip/flip", {
            gameId: state.gameId,
            pick,
          });
          await applyResult(res.data, prevStep, { instant: true });
          state = res.data;
        } catch {
          break;
        }
      }

      // If still alive at/after target → cash out for the win.
      if (state.status === "ACTIVE" && state.step >= 1) {
        try {
          const res = await api.post<CoinState>("/originals/coinflip/cashout", {
            gameId: state.gameId,
          });
          setGame(res.data);
          playOutcomeFx("cashout", res.data.multiplier);
          state = res.data;
        } catch {
          /* leave state as ACTIVE; treat as no payout below */
        }
      }

      await refreshWallet();

      const payout = state.status === "CASHEDOUT" ? state.payout : 0;
      return { won: payout > 0, payout };
    },
    [
      resolvePick,
      walletType,
      useBonus,
      autoFlips,
      applyResult,
      playOutcomeFx,
      refreshWallet,
    ],
  );

  // ── Cleanup gsap + animations on unmount. ──────────────────────────────────
  useEffect(() => {
    const seqRef = flipSeqRef;
    const glowRef = glowTlRef;
    return () => {
      seqRef.current++; // invalidate any in-flight flip resolution
      glowRef.current?.kill();
      glowRef.current = null;
      coinControls.stop();
    };
  }, [coinControls]);

  // ── Idle wobble between flips so the coin feels alive. ─────────────────────
  useEffect(() => {
    if (flipping || prefersReduced || busy || autoBusy) return;
    const ctrl = coinControls;
    void ctrl.start({
      rotateY: [
        rotationRef.current,
        rotationRef.current + 12,
        rotationRef.current,
      ],
      transition: { duration: 3.2, ease: "easeInOut", repeat: Infinity },
    });
    return () => {
      ctrl.stop();
    };
  }, [flipping, prefersReduced, busy, autoBusy, coinControls, game?.status]);

  // ── Hotkeys: Space/Enter flip · C cash out (manual mode). ──────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (autoBusy) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (busy) return;
        if (isActive) void flipAgain();
        else if (isTerminal) newRound();
        else void start();
      } else if (e.key.toLowerCase() === "c" && isActive && game!.step >= 1 && !busy) {
        e.preventDefault();
        void cashout();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, autoBusy, isActive, isTerminal, game, start, flipAgain, cashout, newRound]);

  // --- Derived display values ---
  const step = game?.step ?? 0;
  const curMult = isActive ? game!.multiplier : lastOutcome?.multiplier ?? 0;
  const betNum = parseFloat(betInput) || 0;
  const nextMult =
    game?.nextMultiplier ?? (step < MAX_FLIPS ? multForStep(step + 1) : null);
  const cashAmount = isActive ? betNum * game!.multiplier : 0;
  const profitOnNextWin =
    nextMult != null ? betNum * nextMult - betNum : 0;

  // Recent results strip (most recent first), capped to 12.
  const recent = (game?.results ?? []).slice(-12);

  // Status banner text.
  const banner = (() => {
    if (flipping) return { text: "Flipping…", tone: "neutral" as const };
    if (lastOutcome?.kind === "lose")
      return {
        text: `${lastOutcome.result.toUpperCase()} · busted`,
        tone: "lose" as const,
      };
    if (lastOutcome?.kind === "cashout")
      return {
        text: `Cashed out ${fmtMoney(lastOutcome.payout)}`,
        tone: "win" as const,
      };
    if (lastOutcome?.kind === "win")
      return {
        text: `${lastOutcome.result.toUpperCase()} · ${fmtMult(lastOutcome.multiplier)}`,
        tone: "win" as const,
      };
    if (isActive)
      return {
        text: `Streak ${step} · ${fmtMult(curMult)}`,
        tone: "win" as const,
      };
    return {
      text: `You picked ${pickMode === "random" ? "RANDOM" : pickMode.toUpperCase()}`,
      tone: "neutral" as const,
    };
  })();

  // ── Manual action button(s). ───────────────────────────────────────────────
  const manualAction = (() => {
    if (isActive) {
      const canCash = step >= 1;
      return (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void cashout()}
            disabled={busy || !canCash}
            className="w-full py-4 rounded-xl font-black text-base text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 relative overflow-hidden"
            style={{ background: ACCENT }}
          >
            {!busy && canCash && (
              <span
                className="absolute inset-0 animate-pulse"
                style={{
                  background:
                    "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.25), transparent 70%)",
                }}
                aria-hidden
              />
            )}
            <span className="relative">
              Cash Out {fmtMoney(cashAmount)} ({fmtMult(curMult)})
            </span>
          </button>
          <button
            type="button"
            onClick={() => void flipAgain()}
            disabled={busy || step >= MAX_FLIPS}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white bg-white/[0.06] border border-white/[0.12] hover:bg-white/[0.1] transition-all disabled:opacity-40"
          >
            {step >= MAX_FLIPS
              ? "Max chain reached"
              : nextMult != null
                ? `Flip Again → ${fmtMult(nextMult)}`
                : "Flip Again"}
          </button>
        </div>
      );
    }
    if (isTerminal) {
      return (
        <button
          type="button"
          onClick={newRound}
          disabled={busy}
          className="w-full py-4 rounded-xl font-black text-base text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          New Bet
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className="w-full py-4 rounded-xl font-black text-base text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
        style={{ background: ACCENT }}
      >
        {busy ? "Flipping…" : `Bet · Flip ${fmtMult(multForStep(1))}`}
      </button>
    );
  })();

  // The three-state pick selector is re-selectable before EVERY flip.
  const pickLocked = busy || flipping || autoBusy;
  const pickerDisabled = isTerminal || pickLocked;

  return (
    <OriginalsShell
      gameKey="coinflip"
      title="Coinflip"
      tags={["# Coinflip", "# ODD69 Originals", "# Provably Fair"]}
      historyGameKey="coinflip"
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={busy || isActive || autoBusy}
          accent={ACCENT}
          action={manualAction}
          footer={
            <div className="rounded-lg bg-bg-deep-3 border border-white/[0.06] p-3 space-y-1.5 text-[11px]">
              <StatRow label="Win Chance" value="50%" />
              <StatRow
                label="Next Multiplier"
                value={nextMult != null ? fmtMult(nextMult) : "—"}
              />
              <StatRow
                label="Profit on Win"
                value={
                  nextMult != null
                    ? fmtMoney(Math.round(profitOnNextWin * 100) / 100)
                    : "—"
                }
                valueClass="text-[#ff9a3d]"
              />
              {isActive && (
                <StatRow
                  label="Total Profit"
                  value={fmtMoney(Math.round((cashAmount - betNum) * 100) / 100)}
                  valueClass="text-[#22c55e]"
                />
              )}
            </div>
          }
          autoPanel={
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
                  Cash Out After (Flips)
                </label>
                <div className="flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg overflow-hidden mt-1.5 focus-within:border-white/20">
                  <input
                    type="number"
                    min={1}
                    max={MAX_FLIPS}
                    inputMode="numeric"
                    value={autoFlips}
                    disabled={autoBusy}
                    onChange={(e) => setAutoFlips(e.target.value)}
                    className="flex-1 bg-transparent py-2.5 px-3 text-white text-sm font-bold outline-none min-w-0"
                    aria-label="Auto-cash after this many consecutive wins"
                  />
                  <span className="pr-3 text-[11px] font-bold text-[#6b7280]">
                    {fmtMult(multForStep(Math.max(1, Math.floor(Number(autoFlips) || 1))))}
                  </span>
                </div>
              </div>
              <OriginalsAutoBet
                baseBet={betNum}
                accent={ACCENT}
                disabled={isActive}
                runBet={runAutoBet}
                onBusyChange={setAutoBusy}
              />
            </div>
          }
        >
          {/* Three-state pick: HEADS (orange) / TAILS (blue) / RANDOM */}
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Your Call {isActive ? "(next flip)" : ""}
            </label>
            <div className="grid grid-cols-3 gap-1">
              <PickButton
                active={pickMode === "heads"}
                disabled={pickerDisabled}
                onClick={() => setPickMode("heads")}
                color="#ff9a3d"
                label="Heads"
              />
              <PickButton
                active={pickMode === "tails"}
                disabled={pickerDisabled}
                onClick={() => setPickMode("tails")}
                color="#3b9dff"
                label="Tails"
              />
              <button
                type="button"
                onClick={() => !pickerDisabled && setPickMode("random")}
                disabled={pickerDisabled}
                className={`py-2 rounded text-[11px] font-bold uppercase flex items-center justify-center gap-1 transition-colors disabled:opacity-40 ${
                  pickMode === "random"
                    ? "bg-white/[0.12] text-white border border-white/30"
                    : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                }`}
              >
                <Shuffle size={12} /> Rand
              </button>
            </div>
          </div>
        </OriginalsControls>
      }
    >
      <div
        ref={stageRef}
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 28%, #2a1c06 0%, #1a1004 42%, #0f0902 100%)",
          minHeight: 420,
          perspective: "1200px",
        }}
      >
        {/* Status chip */}
        <AnimatePresence mode="wait">
          <motion.div
            key={banner.text}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            className={`absolute top-4 left-1/2 -translate-x-1/2 text-xs font-semibold px-4 py-1.5 backdrop-blur-md rounded-full border whitespace-nowrap z-10 ${
              banner.tone === "win"
                ? "text-orange-100 bg-orange-500/10 border-orange-400/30"
                : banner.tone === "lose"
                  ? "text-red-200 bg-red-500/10 border-red-400/30"
                  : "text-[#9ca3af] bg-black/40 border-white/[0.06]"
            }`}
          >
            {banner.text}
          </motion.div>
        </AnimatePresence>

        {/* Streak ladder — the chain at a glance */}
        <StreakLadder step={step} active={isActive} busted={game?.status === "LOST"} />

        {/* Coin stage */}
        <div className="mt-6 relative flex items-center justify-center">
          {/* Result halo (animated by gsap on settle) */}
          <div
            ref={haloRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 -m-8 rounded-full opacity-0"
            style={
              {
                background:
                  "radial-gradient(circle, var(--glow-color, rgba(255,154,61,0)) 0%, transparent 70%)",
                ["--glow-color" as string]: "rgba(255,154,61,0)",
              } as React.CSSProperties
            }
          />

          {/* The 3D coin */}
          <motion.div
            className="relative w-44 h-44 md:w-52 md:h-52"
            style={{ transformStyle: "preserve-3d" }}
            animate={coinControls}
            initial={{ rotateY: 0 }}
          >
            {/* HEADS — front face (0deg) — orange / circle motif */}
            <CoinFace
              side="heads"
              state={
                !flipping && shownFace === "heads"
                  ? game?.status === "LOST"
                    ? "lose"
                    : isActive || game?.status === "CASHEDOUT"
                      ? "win"
                      : "idle"
                  : "idle"
              }
            />
            {/* TAILS — back face (180deg) — blue / diamond motif */}
            <div
              className="absolute inset-0"
              style={{
                transform: "rotateY(180deg)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <CoinFace
                side="tails"
                state={
                  !flipping && shownFace === "tails"
                    ? game?.status === "LOST"
                      ? "lose"
                      : isActive || game?.status === "CASHEDOUT"
                        ? "win"
                        : "idle"
                    : "idle"
                }
              />
            </div>
          </motion.div>

          {/* Ground shadow reacting to the flight */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 h-4 w-44 rounded-[100%]"
            style={{
              background:
                "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)",
              filter: "blur(5px)",
            }}
            animate={
              prefersReduced
                ? { opacity: 0.5 }
                : flipping
                  ? { scaleX: [1, 0.6, 0.6, 1], opacity: [0.55, 0.25, 0.25, 0.55] }
                  : { scaleX: 1, opacity: 0.5 }
            }
            transition={
              flipping
                ? { duration: 1.9, times: [0, 0.3, 0.55, 1], ease: "easeInOut" }
                : { duration: 0.4 }
            }
          />
        </div>

        {/* Recent results strip */}
        <div className="mt-12 h-5 flex items-center gap-1.5">
          {recent.map((r, i) => (
            <span
              key={i}
              title={r}
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: r === "heads" ? "#ff9a3d" : "#3b9dff",
                boxShadow:
                  i === recent.length - 1
                    ? `0 0 8px ${r === "heads" ? "#ff9a3d" : "#3b9dff"}`
                    : "none",
                opacity: i === recent.length - 1 ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* Fairness chip (serverSeedHash / nonce) */}
        {game?.serverSeedHash && (
          <div className="mt-3 text-[10px] font-mono text-[#5a5f6a] flex items-center gap-2">
            <span title={game.serverSeedHash}>
              hash {game.serverSeedHash.slice(0, 10)}…
            </span>
            {typeof game.nonce === "number" && <span>· nonce {game.nonce}</span>}
          </div>
        )}
      </div>
    </OriginalsShell>
  );
}

// ---------------------------------------------------------------------------
// StatRow — a tiny label/value line in the live-stats footer.
// ---------------------------------------------------------------------------
function StatRow({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#6b7280]">{label}</span>
      <span className={`font-black tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PickButton — colored Heads/Tails toggle.
// ---------------------------------------------------------------------------
function PickButton({
  active,
  disabled,
  onClick,
  color,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  color: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onClick()}
      disabled={disabled}
      className="py-2 rounded text-[11px] font-bold uppercase transition-colors disabled:opacity-40 border"
      style={
        active
          ? {
              background: color + "26",
              borderColor: color + "66",
              color,
            }
          : {
              background: "transparent",
              borderColor: "rgba(255,255,255,0.06)",
              color: "#9ca3af",
            }
      }
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// StreakLadder — horizontal ladder of multiplier rungs (1.96× → …).
// Shows the current chain position; rungs ahead are dimmed.
// ---------------------------------------------------------------------------
const RTP_L = 0.98;
const ladderMult = (s: number) => Math.round(RTP_L * Math.pow(2, s) * 100) / 100;
function StreakLadder({
  step,
  active,
  busted,
}: {
  step: number;
  active: boolean;
  busted: boolean;
}) {
  // Show a window of rungs around the current step (always start at 1).
  const start = Math.max(1, Math.min(step - 1, MAX_FLIPS - 6));
  const rungs: number[] = [];
  for (let s = start; s < start + 7 && s <= MAX_FLIPS; s++) rungs.push(s);

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 max-w-[92%] overflow-hidden">
      {rungs.map((s) => {
        const reached = s <= step;
        const current = s === step && active;
        return (
          <motion.div
            key={s}
            initial={false}
            animate={
              current
                ? { scale: [1, 1.12, 1], opacity: 1 }
                : { scale: 1, opacity: reached ? 0.95 : 0.4 }
            }
            transition={{ duration: 0.4 }}
            className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-black tabular-nums border"
            style={{
              background: current
                ? "rgba(255,154,61,0.22)"
                : reached
                  ? busted
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(255,154,61,0.08)"
                  : "rgba(255,255,255,0.03)",
              borderColor: current
                ? "rgba(255,154,61,0.6)"
                : reached
                  ? busted
                    ? "rgba(239,68,68,0.35)"
                    : "rgba(255,154,61,0.3)"
                  : "rgba(255,255,255,0.06)",
              color: current
                ? "#ffb066"
                : reached
                  ? busted
                    ? "#fca5a5"
                    : "#ffc48f"
                  : "#6b7280",
            }}
          >
            {s >= 1000 ? `${Math.round(ladderMult(s) / 1000)}k×` : `${ladderMult(s)}×`}
          </motion.div>
        );
      })}
      {start + 7 <= MAX_FLIPS && (
        <span className="text-[10px] text-[#4a4f5a] font-bold px-1">…20</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CoinFace — one side of the coin. Heads = orange/circle, Tails = blue/diamond.
// ---------------------------------------------------------------------------
function CoinFace({
  side,
  state,
}: {
  side: Side;
  state: "idle" | "win" | "lose";
}) {
  const heads = side === "heads";
  const baseGradient = heads
    ? "linear-gradient(135deg, #ffd27a 0%, #ff9a3d 45%, #c05a10 100%)"
    : "linear-gradient(135deg, #9fd0ff 0%, #3b9dff 45%, #1456a3 100%)";
  const engrave = heads ? "rgba(120,55,5,0.4)" : "rgba(8,40,90,0.45)";
  const glyphColor = heads ? "#7a3705" : "#0a2a5a";

  const ring =
    state === "win"
      ? heads
        ? "border-orange-300 shadow-[0_0_60px_rgba(255,154,61,0.6)]"
        : "border-sky-300 shadow-[0_0_60px_rgba(59,157,255,0.55)]"
      : state === "lose"
        ? "border-red-400 shadow-[0_0_60px_rgba(239,68,68,0.5)] saturate-50"
        : heads
          ? "border-orange-300/60 shadow-[0_0_40px_rgba(255,154,61,0.3)]"
          : "border-sky-300/60 shadow-[0_0_40px_rgba(59,157,255,0.3)]";

  return (
    <div
      className={`absolute inset-0 rounded-full border-[10px] flex flex-col items-center justify-center transition-[box-shadow,border-color,filter] duration-500 ${ring}`}
      style={{
        background: baseGradient,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      {/* engraved ring */}
      <div
        className="absolute inset-3 rounded-full border-2"
        style={{ borderColor: engrave }}
      />
      {/* radial sheen */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 28%, rgba(255,255,255,0.55) 0%, transparent 45%)",
        }}
      />
      {/* Motif: heads = circle, tails = diamond */}
      {heads ? (
        <div
          className="relative rounded-full border-4"
          style={{
            width: "44%",
            height: "44%",
            borderColor: glyphColor,
          }}
        />
      ) : (
        <div
          className="relative border-4"
          style={{
            width: "38%",
            height: "38%",
            borderColor: glyphColor,
            transform: "rotate(45deg)",
          }}
        />
      )}
      <div
        className="relative mt-2 text-[10px] uppercase tracking-wider font-black"
        style={{ color: glyphColor }}
      >
        {side}
      </div>
    </div>
  );
}
