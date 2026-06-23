"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import { motion, useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { Zap } from "lucide-react";

import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import OriginalsAutoBet from "@/components/originals/OriginalsAutoBet";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { useModal } from "@/context/ModalContext";
import { getConfiguredSocketNamespace } from "@/utils/socketUrl";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

// ─────────────────────────────────────────────────────────────────────────────
// Contract (UNCHANGED socket model — newbackend/src/originals/originals.gateway.ts
// + dice.service.ts):
//   emit  "dice:roll"   { betAmount, target(int 1-98), direction, walletType, useBonus? }
//   recv  "dice:result" { gameId, roll, target, direction, multiplier, winChance,
//                         payout, status, betAmount, serverSeedHash, clientSeed, nonce }
//   emit  "dice:history" -> recv "dice:history" HistoryItem[] (last 30)
//   recv  "dice:error"  { message }
// Win math is server-authoritative; the readouts below mirror the SAME formulae
// (Over winChance = 99.99 - target, Under = target, multiplier = 99 / winChance)
// so the live display matches exactly what the server settles.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#ff9a3d";
const WIN = "#22c55e";
const LOSE = "#ef4444";
const HOUSE_RTP = 99; // (100 - 1% house edge)
const MIN_TARGET = 1;
const MAX_TARGET = 98;

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
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
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

type WalletType = "fiat" | "crypto";

// ── pure math helpers (mirror the backend exactly) ──────────────────────────
function winChanceFor(target: number, direction: "over" | "under"): number {
  return direction === "over"
    ? parseFloat((99.99 - target).toFixed(2))
    : parseFloat(target.toFixed(2));
}
function multiplierFor(winChance: number): number {
  if (winChance <= 0 || winChance >= 100) return 0;
  return parseFloat((HOUSE_RTP / winChance).toFixed(4));
}
/** Invert: given a desired win-chance %, what integer target yields it? */
function targetFromWinChance(
  winChance: number,
  direction: "over" | "under",
): number {
  const raw = direction === "over" ? 99.99 - winChance : winChance;
  return Math.min(MAX_TARGET, Math.max(MIN_TARGET, Math.round(raw)));
}

export default function DicePage() {
  const { token } = useAuth();
  const {
    fiatBalance,
    cryptoBalance,
    refreshWallet,
    selectedWallet,
    setSelectedWallet,
  } = useWallet();
  const { openLogin } = useModal();
  const prefersReducedMotion = useReducedMotion();
  const hasSession = !!token;

  // ── refs ──────────────────────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const shuffleRef = useRef<number | null>(null);
  const markerTweenRef = useRef<gsap.core.Tween | null>(null);
  const payoutTweenRef = useRef<gsap.core.Tween | null>(null);
  const numberTweenRef = useRef<gsap.core.Tween | null>(null);
  // A single in-flight roll promise resolver, so manual + auto share one socket
  // round-trip (emit -> once "dice:result"/"dice:error").
  const pendingRef = useRef<{
    resolve: (r: RollResult | null) => void;
  } | null>(null);
  const reducedRef = useRef(prefersReducedMotion);

  // ── state ───────────────────────────────────────────────────────────────────
  const [walletType, setWalletType] = useState<WalletType>(selectedWallet);
  const [useBonus, setUseBonus] = useState(false);
  const [betInput, setBetInput] = useState("100");
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<"over" | "under">("over");
  const [instantBet, setInstantBet] = useState(false);

  const [busy, setBusy] = useState(false); // a roll (manual) is animating
  const [autoBusy, setAutoBusy] = useState(false); // auto loop active
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [resultPulse, setResultPulse] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // animated visual values (driven by the SERVER result, never the outcome)
  const [rollDisplay, setRollDisplay] = useState(50);
  const [markerPos, setMarkerPos] = useState<number | null>(null);
  const [payoutDisplay, setPayoutDisplay] = useState(0);

  // editable-field "draft" strings (so typing 1.0102 isn't clobbered mid-type)
  const [multDraft, setMultDraft] = useState<string | null>(null);
  const [chanceDraft, setChanceDraft] = useState<string | null>(null);

  useEffect(() => {
    reducedRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);
  useEffect(() => setWalletType(selectedWallet), [selectedWallet]);

  // ── derived ─────────────────────────────────────────────────────────────────
  const betAmount = parseFloat(betInput) || 0;
  const activeBalance = walletType === "crypto" ? cryptoBalance : fiatBalance;
  const sym = "$";
  const winChance = winChanceFor(target, direction);
  const multiplier = multiplierFor(winChance);
  const profitOnWin = parseFloat((betAmount * (multiplier - 1)).toFixed(2));
  const won = lastResult?.status === "WON";
  const locked = busy || autoBusy;

  const sliderGrad = useMemo(() => {
    const pct = ((target - 0) / 100) * 100;
    return direction === "over"
      ? `linear-gradient(to right, ${LOSE} 0%, ${LOSE} ${pct}%, ${WIN} ${pct}%, ${WIN} 100%)`
      : `linear-gradient(to right, ${WIN} 0%, ${WIN} ${pct}%, ${LOSE} ${pct}%, ${LOSE} 100%)`;
  }, [target, direction]);

  // ── linked field handlers (typing one moves the slider + recomputes the rest)
  const commitMultiplier = useCallback(
    (raw: string) => {
      setMultDraft(null);
      const m = parseFloat(raw);
      if (!Number.isFinite(m) || m <= 1) return;
      const wc = parseFloat((HOUSE_RTP / m).toFixed(2));
      setTarget(targetFromWinChance(wc, direction));
    },
    [direction],
  );
  const commitChance = useCallback(
    (raw: string) => {
      setChanceDraft(null);
      const wc = parseFloat(raw);
      if (!Number.isFinite(wc) || wc <= 0) return;
      setTarget(targetFromWinChance(wc, direction));
    },
    [direction],
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Visual result animation — purely presentational. It animates the marker to
  // the value the SERVER already returned and counts the SERVER payout up; it
  // can never change win/loss.
  // ─────────────────────────────────────────────────────────────────────────────
  const stopShuffle = useCallback(() => {
    if (shuffleRef.current !== null) {
      window.clearInterval(shuffleRef.current);
      shuffleRef.current = null;
    }
  }, []);

  const startShuffle = useCallback(() => {
    if (reducedRef.current || instantBet) return;
    stopShuffle();
    const id = window.setInterval(() => {
      setRollDisplay(parseFloat((Math.random() * 99.99).toFixed(2)));
    }, 70);
    shuffleRef.current = id;
    window.setTimeout(() => {
      if (shuffleRef.current === id) stopShuffle();
    }, 240);
  }, [instantBet, stopShuffle]);

  const animateResult = useCallback(
    (result: RollResult) => {
      const reduced = reducedRef.current;
      markerTweenRef.current?.kill();
      payoutTweenRef.current?.kill();
      numberTweenRef.current?.kill();

      const targetPayout = result.status === "WON" ? result.payout : 0;

      if (reduced) {
        setRollDisplay(result.roll);
        setMarkerPos(result.roll);
        setPayoutDisplay(targetPayout);
        return;
      }

      // Marker slide — instant mode = short ease, normal = elastic settle.
      const markerObj = { pos: markerPos ?? result.target };
      markerTweenRef.current = gsap.to(markerObj, {
        pos: result.roll,
        duration: instantBet ? 0.16 : 0.55,
        ease: instantBet ? "power2.out" : "elastic.out(1, 0.6)",
        onUpdate: () => setMarkerPos(markerObj.pos),
        onComplete: () => setMarkerPos(result.roll),
      });

      // Big number snaps quickly to the final roll (small count from current).
      const numObj = { v: rollDisplay };
      numberTweenRef.current = gsap.to(numObj, {
        v: result.roll,
        duration: instantBet ? 0.08 : 0.22,
        ease: "power2.out",
        onUpdate: () => setRollDisplay(parseFloat(numObj.v.toFixed(2))),
        onComplete: () => setRollDisplay(result.roll),
      });

      // Payout count-up from 0 (only meaningful on a win).
      setPayoutDisplay(0);
      if (targetPayout > 0) {
        const payObj = { v: 0 };
        payoutTweenRef.current = gsap.to(payObj, {
          v: targetPayout,
          duration: instantBet ? 0.25 : 0.8,
          ease: "power2.out",
          onUpdate: () => setPayoutDisplay(payObj.v),
          onComplete: () => setPayoutDisplay(targetPayout),
        });
      }
    },
    [instantBet, markerPos, rollDisplay],
  );
  const animateResultRef = useRef(animateResult);
  useEffect(() => {
    animateResultRef.current = animateResult;
  }, [animateResult]);

  // ── socket lifecycle ──────────────────────────────────────────────────────
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
      socket.emit("join-originals", { game: "dice" });
      socket.emit("dice:history");
    });

    socket.on("dice:result", (result: RollResult) => {
      // Resolve any pending runBet() promise first (drives manual + auto).
      pendingRef.current?.resolve(result);
      pendingRef.current = null;

      setHistory((prev) => [
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
        ...prev,
      ].slice(0, 30));

      void refreshWallet();
    });

    socket.on("dice:history", (items: HistoryItem[]) => {
      if (Array.isArray(items)) setHistory(items.slice(0, 30));
    });

    socket.on("dice:error", (payload: { message?: string }) => {
      pendingRef.current?.resolve(null);
      pendingRef.current = null;
      void refreshWallet();
      toast.error(payload?.message || "Dice roll failed");
    });

    return () => {
      pendingRef.current?.resolve(null);
      pendingRef.current = null;
      socket.off("dice:result");
      socket.off("dice:history");
      socket.off("dice:error");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [refreshWallet]);

  // Cleanup timers / tweens on unmount.
  useEffect(
    () => () => {
      stopShuffle();
      markerTweenRef.current?.kill();
      payoutTweenRef.current?.kill();
      numberTweenRef.current?.kill();
    },
    [stopShuffle],
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Core: place ONE roll. Wraps the socket emit + one-shot result/error listener
  // in a promise so both the manual button and OriginalsAutoBet can await it.
  // Returns { won, payout } for the auto engine, or null on abort/error.
  // ─────────────────────────────────────────────────────────────────────────────
  const rollOnce = useCallback(
    (
      stakeOverride?: number,
    ): Promise<{ won: boolean; payout: number } | null> => {
      return new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
          toast.error("Dice is still connecting");
          resolve(null);
          return;
        }
        // Guard against an overlapping in-flight roll.
        if (pendingRef.current) {
          resolve(null);
          return;
        }

        const stake = parseFloat(
          (stakeOverride ?? betAmount).toFixed(2),
        );

        setLastResult(null);
        setPayoutDisplay(0);
        playSound("bet");
        startShuffle();

        // Safety timeout so a dropped packet doesn't wedge the auto loop.
        const timer = window.setTimeout(() => {
          if (pendingRef.current) {
            pendingRef.current = null;
            stopShuffle();
            resolve(null);
          }
        }, 12000);

        pendingRef.current = {
          resolve: (result: RollResult | null) => {
            window.clearTimeout(timer);
            stopShuffle();

            if (!result) {
              resolve(null);
              return;
            }

            setLastResult(result);
            setResultPulse((v) => v + 1);
            animateResultRef.current(result);

            if (result.status === "WON") {
              playSound("win");
              if (result.multiplier >= 10) fireBigWin();
              else fireWin();
            } else {
              playSound("lose");
            }

            resolve({
              won: result.status === "WON",
              payout: result.status === "WON" ? result.payout : 0,
            });
          },
        };

        socket.emit("dice:roll", {
          betAmount: stake,
          target,
          direction,
          walletType,
          useBonus,
        });
      });
    },
    [
      betAmount,
      target,
      direction,
      walletType,
      useBonus,
      startShuffle,
      stopShuffle,
    ],
  );

  // ── manual bet ──────────────────────────────────────────────────────────────
  const handleManualRoll = useCallback(async () => {
    if (!hasSession) {
      openLogin();
      return;
    }
    if (locked) return;
    if (betAmount < 10) {
      toast.error("Minimum bet is 10");
      return;
    }
    if (betAmount > activeBalance) {
      toast.error("Insufficient balance");
      return;
    }
    setBusy(true);
    try {
      await rollOnce();
    } finally {
      setBusy(false);
    }
  }, [hasSession, locked, betAmount, activeBalance, rollOnce, openLogin]);

  // ── auto bet runner (passed to OriginalsAutoBet) ──────────────────────────
  const runBet = useCallback(
    async (bet: number): Promise<{ won: boolean; payout: number } | null> => {
      if (!hasSession) {
        openLogin();
        return null;
      }
      if (bet < 10) {
        toast.error("Minimum bet is 10");
        return null;
      }
      if (bet > (walletType === "crypto" ? cryptoBalance : fiatBalance)) {
        toast.error("Insufficient balance");
        return null;
      }
      return rollOnce(bet);
    },
    [hasSession, walletType, cryptoBalance, fiatBalance, rollOnce, openLogin],
  );

  // hotkeys: Space = bet (manual), [ ] = halve/double, U = toggle over/under,
  //          I = toggle instant bet.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!autoBusy) void handleManualRoll();
      } else if (e.key === "[") {
        setBetInput((s) => String(Math.max(10, Math.floor((parseFloat(s) || 0) / 2))));
      } else if (e.key === "]") {
        setBetInput((s) => String(Math.min(1000000, (parseFloat(s) || 0) * 2)));
      } else if (e.key.toLowerCase() === "u") {
        if (!locked) setDirection((d) => (d === "over" ? "under" : "over"));
      } else if (e.key.toLowerCase() === "i") {
        if (!locked) setInstantBet((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleManualRoll, locked, autoBusy]);

  const handleWalletType = useCallback(
    (w: WalletType) => {
      setWalletType(w);
      void setSelectedWallet(w);
    },
    [setSelectedWallet],
  );

  // ── linked manual controls (over/under + slider + editable readouts) ──────
  const manualControls = (
    <div className="space-y-4">
      {/* Profit on win + multiplier + win chance (editable, bidirectionally linked) */}
      <div className="grid grid-cols-2 gap-2">
        <LinkedField
          label="Multiplier"
          suffix="×"
          value={
            multDraft ?? (multiplier > 0 ? multiplier.toFixed(4) : "—")
          }
          disabled={locked}
          onChange={setMultDraft}
          onCommit={commitMultiplier}
        />
        <LinkedField
          label="Win Chance"
          suffix="%"
          value={chanceDraft ?? winChance.toFixed(2)}
          disabled={locked}
          onChange={setChanceDraft}
          onCommit={commitChance}
        />
      </div>

      <div>
        <span className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
          Profit on Win
        </span>
        <div className="mt-1.5 flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg px-3 py-2.5">
          <span className="text-sm font-bold text-[#9ca3af] mr-2">{sym}</span>
          <span className="text-white text-sm font-black tabular-nums">
            {profitOnWin > 0 ? profitOnWin.toFixed(2) : "0.00"}
          </span>
        </div>
      </div>

      {/* Roll Over / Roll Under */}
      <div>
        <span className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
          Roll Direction
        </span>
        <div className="mt-1.5 flex gap-2">
          {(["over", "under"] as const).map((d) => {
            const active = direction === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => !locked && setDirection(d)}
                disabled={locked}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                style={{
                  background: active ? "rgba(255,154,61,0.14)" : "var(--tw-bg, #1a1d26)",
                  border: active
                    ? `1px solid ${ACCENT}66`
                    : "1px solid rgba(255,255,255,0.06)",
                  color: active ? ACCENT : "#6b7280",
                }}
              >
                <span className="text-sm">{d === "over" ? "▲" : "▼"}</span>
                Roll {d === "over" ? "Over" : "Under"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Instant Bet toggle */}
      <button
        type="button"
        onClick={() => !locked && setInstantBet((v) => !v)}
        disabled={locked}
        className="w-full flex items-center justify-between py-2 px-1 disabled:opacity-40"
      >
        <span className="flex items-center gap-1.5 text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
          <Zap size={13} style={{ color: instantBet ? ACCENT : "#6b7280" }} />
          Instant Bet
        </span>
        <span
          className="relative w-10 h-5 rounded-full transition-all border flex-shrink-0"
          style={{
            background: instantBet ? ACCENT : "rgba(255,255,255,0.04)",
            borderColor: instantBet ? ACCENT : "rgba(255,255,255,0.08)",
          }}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
            style={{ left: instantBet ? "22px" : "2px" }}
          />
        </span>
      </button>
    </div>
  );

  const betAction = (
    <button
      type="button"
      onClick={handleManualRoll}
      disabled={locked || !hasSession}
      className="w-full py-3.5 rounded-lg font-black text-base uppercase tracking-wide transition-all disabled:opacity-50 active:scale-[0.98]"
      style={{
        background: busy ? "rgba(255,255,255,0.06)" : ACCENT,
        color: busy ? "#9ca3af" : "#0b0d10",
        boxShadow: busy ? "none" : "0 6px 24px rgba(255,154,61,0.28)",
      }}
    >
      {busy ? "Rolling…" : "Bet"}
    </button>
  );

  const autoPanel = (
    <OriginalsAutoBet
      baseBet={betAmount}
      accent={ACCENT}
      disabled={!hasSession || betAmount < 10}
      runBet={runBet}
      onBusyChange={setAutoBusy}
    />
  );

  return (
    <OriginalsShell
      gameKey="dice"
      title="Dice"
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={handleWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={locked}
          minBet={10}
          accent={ACCENT}
          action={betAction}
          autoPanel={autoPanel}
        >
          {manualControls}
        </OriginalsControls>
      }
    >
      <DiceStage
        sym={sym}
        target={target}
        setTarget={setTarget}
        locked={locked}
        direction={direction}
        sliderGrad={sliderGrad}
        rollDisplay={rollDisplay}
        markerPos={markerPos}
        lastResult={lastResult}
        won={won}
        resultPulse={resultPulse}
        payoutDisplay={payoutDisplay}
        multiplier={multiplier}
        winChance={winChance}
        history={history}
        prefersReducedMotion={!!prefersReducedMotion}
      />
    </OriginalsShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Editable, bidirectionally-linked numeric field (Multiplier / Win Chance).
// Typing a value and blurring/Enter recomputes the slider target.
// ─────────────────────────────────────────────────────────────────────────────
function LinkedField({
  label,
  suffix,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  suffix: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  return (
    <div>
      <span className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
        {label}
      </span>
      <div className="mt-1.5 flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg overflow-hidden focus-within:border-white/20">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="flex-1 min-w-0 bg-transparent py-2.5 px-3 text-white text-sm font-black tabular-nums outline-none disabled:opacity-50"
        />
        <span className="pr-3 text-sm font-bold text-[#9ca3af]">{suffix}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right-pane game stage: result banner, hex readout, hero slider with the
// result marker, 3-up stat bar, and the history pill strip.
// ─────────────────────────────────────────────────────────────────────────────
function DiceStage({
  sym,
  target,
  setTarget,
  locked,
  direction,
  sliderGrad,
  rollDisplay,
  markerPos,
  lastResult,
  won,
  resultPulse,
  payoutDisplay,
  multiplier,
  winChance,
  history,
  prefersReducedMotion,
}: {
  sym: string;
  target: number;
  setTarget: (n: number) => void;
  locked: boolean;
  direction: "over" | "under";
  sliderGrad: string;
  rollDisplay: number;
  markerPos: number | null;
  lastResult: RollResult | null;
  won: boolean;
  resultPulse: number;
  payoutDisplay: number;
  multiplier: number;
  winChance: number;
  history: HistoryItem[];
  prefersReducedMotion: boolean;
}) {
  const hexFill = lastResult
    ? won
      ? `linear-gradient(135deg, ${WIN}, #16a34a)`
      : `linear-gradient(135deg, ${LOSE}, #dc2626)`
    : "linear-gradient(135deg, #3f3f46, #27272a)";

  return (
    <div className="flex flex-col h-full min-h-[520px]">
      {/* Result banner */}
      <div
        className="flex-shrink-0 py-3 text-center border-b border-white/[0.05]"
        style={{ background: "#21242e" }}
      >
        {lastResult ? (
          <motion.span
            key={resultPulse}
            initial={prefersReducedMotion ? false : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            className="inline-block text-sm font-bold"
            style={{ color: won ? WIN : LOSE }}
          >
            {won
              ? `Won ${sym}${payoutDisplay.toFixed(2)} · ${lastResult.multiplier}×`
              : `Lost — Rolled ${lastResult.roll.toFixed(2)}`}
          </motion.span>
        ) : (
          <span className="text-[#6b7280] text-sm">
            Set your target and roll
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 min-h-0">
        {/* Hex number readout */}
        <div className="relative mb-10">
          <motion.div
            key={resultPulse}
            className="relative w-[120px] h-[120px] flex items-center justify-center"
            animate={
              lastResult && !prefersReducedMotion
                ? {
                    scale: [1, won ? 1.12 : 0.94, 1],
                    rotate: won ? [0, -5, 5, 0] : [0, -3, 3, 0],
                    filter: [
                      "drop-shadow(0 0 0px rgba(0,0,0,0))",
                      `drop-shadow(0 0 24px ${won ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.65)"})`,
                      "drop-shadow(0 0 0px rgba(0,0,0,0))",
                    ],
                  }
                : undefined
            }
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <div
              className="absolute inset-0 transition-colors duration-300"
              style={{
                clipPath:
                  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                background: hexFill,
              }}
            />
            <div
              className="absolute inset-[3px]"
              style={{
                clipPath:
                  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                background: "#21242e",
              }}
            />
            <span className="relative z-10 text-3xl font-black text-white tabular-nums">
              {rollDisplay.toFixed(2)}
            </span>
          </motion.div>
        </div>

        {/* Hero slider */}
        <div className="w-full max-w-[600px] mb-10">
          <div className="relative px-2">
            <div
              className="relative h-2 rounded-full overflow-hidden mt-4 mb-3"
              style={{ background: "#3f3f46" }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: sliderGrad }}
              />
            </div>

            {/* Result marker pin (lands on the server roll) */}
            {markerPos !== null && lastResult && (
              <div
                className="absolute top-0 h-2"
                style={{
                  left: `calc(${markerPos}% + ${(0.5 - markerPos / 100) * 16}px)`,
                  transform: "translateX(-50%)",
                  willChange: "left",
                }}
              >
                <motion.div
                  key={resultPulse}
                  className="w-1 h-8 -mt-3 rounded-full"
                  style={{ background: won ? WIN : LOSE }}
                  initial={
                    prefersReducedMotion
                      ? false
                      : { boxShadow: `0 0 6px ${won ? WIN : LOSE}` }
                  }
                  animate={
                    prefersReducedMotion
                      ? { boxShadow: `0 0 8px ${won ? WIN : LOSE}` }
                      : {
                          boxShadow: [
                            `0 0 6px ${won ? WIN : LOSE}`,
                            `0 0 22px ${won ? WIN : LOSE}`,
                            `0 0 8px ${won ? WIN : LOSE}`,
                          ],
                          scaleY: [1, 1.25, 1],
                        }
                  }
                  transition={{ duration: 0.7, ease: "easeOut" }}
                >
                  {/* roll value bubble */}
                  <span
                    className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-black px-1.5 py-0.5 rounded tabular-nums whitespace-nowrap"
                    style={{
                      background: won ? WIN : LOSE,
                      color: "#0b0d10",
                    }}
                  >
                    {lastResult.roll.toFixed(2)}
                  </span>
                </motion.div>
              </div>
            )}

            {/* Range input (integer 1-98 — matches backend) */}
            <input
              type="range"
              min={1}
              max={98}
              step={1}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              disabled={locked}
              className="absolute inset-0 w-full h-2 mt-4 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              style={{ zIndex: 3 }}
              aria-label="Target"
            />

            {/* Draggable handle with target bubble */}
            <div
              className="absolute top-0 h-2 pointer-events-none mt-4"
              style={{
                left: `calc(${target}% + ${(0.5 - target / 100) * 16}px)`,
                transform: "translateX(-50%)",
              }}
            >
              <div
                className="w-5 h-6 absolute top-[-8px] -ml-[10px] rounded-md bg-white"
                style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
              />
              <span
                className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-black px-1.5 py-0.5 rounded bg-white text-[#0b0d10] tabular-nums"
              >
                {target.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex justify-between mt-2 px-1">
            {[0, 25, 50, 75, 100].map((n) => (
              <span key={n} className="text-[11px] text-[#6b7280] font-bold">
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* 3-up stat bar: Multiplier · Win Chance · Roll (target/result) */}
        <div
          className="w-full max-w-[600px] flex rounded-lg overflow-hidden"
          style={{ background: "#262b36", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <StatCell label="Multiplier" suffix="×">
            {multiplier.toFixed(4)}
          </StatCell>
          <StatCell label="Win Chance" suffix="%" divider>
            {winChance.toFixed(2)}
          </StatCell>
          <StatCell
            label={direction === "over" ? "Roll Over" : "Roll Under"}
            valueColor={lastResult ? (won ? WIN : LOSE) : undefined}
          >
            {lastResult ? lastResult.roll.toFixed(2) : target.toFixed(2)}
          </StatCell>
        </div>
      </div>

      {/* History strip */}
      <div className="flex-shrink-0 border-t border-white/[0.05]">
        <div
          className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar"
          style={{ background: "#21242e" }}
        >
          {history.length === 0 ? (
            <span className="text-[#3a3d45] text-xs">No rolls yet</span>
          ) : (
            history.map((item, i) => (
              <motion.span
                key={item.gameId || i}
                initial={
                  prefersReducedMotion ? false : { x: -12, opacity: 0 }
                }
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap tabular-nums"
                style={{
                  background:
                    item.status === "WON"
                      ? "rgba(34,197,94,0.16)"
                      : "rgba(239,68,68,0.12)",
                  color: item.status === "WON" ? WIN : LOSE,
                  border: `1px solid ${item.status === "WON" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                }}
              >
                {item.roll.toFixed(2)}
              </motion.span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCell({
  label,
  suffix,
  divider,
  valueColor,
  children,
}: {
  label: string;
  suffix?: string;
  divider?: boolean;
  valueColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex-1 p-3 flex flex-col"
      style={
        divider ? { borderRight: "1px solid rgba(255,255,255,0.06)", borderLeft: "1px solid rgba(255,255,255,0.06)" } : undefined
      }
    >
      <span className="text-[10px] text-[#6b7280] font-bold uppercase mb-1">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <span
          className="font-black text-base tabular-nums"
          style={{ color: valueColor ?? "#fff" }}
        >
          {children}
        </span>
        {suffix && (
          <span className="text-[#6b7280] text-xs font-bold">{suffix}</span>
        )}
      </div>
    </div>
  );
}
