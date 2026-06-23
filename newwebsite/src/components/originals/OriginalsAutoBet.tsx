"use client";

import React from "react";
import { Infinity as InfinityIcon, RotateCcw, TrendingUp } from "lucide-react";
import { playSound } from "@/utils/originalsFx";

/**
 * OriginalsAutoBet — a self-contained Stake-style AUTO-BET panel + engine.
 *
 * Drop this in as the `children` slot of <OriginalsControls> (or anywhere in a
 * game's control column). It owns its own strategy state, runs a sequential
 * betting loop calling the parent-supplied `runBet`, and reports busy state up
 * via `onBusyChange` so the parent can lock the rest of the controls.
 *
 * The parent stays in charge of *how* a single bet is placed (wallet, bonus,
 * server call, animation) — it just exposes `runBet(bet)` which resolves to the
 * round outcome `{ won, payout }` (payout is total returned, 0 on a loss) or
 * `null` to abort the session (error / insufficient balance / etc.).
 */
interface Props {
  /** The base bet the strategy starts from (and resets to on "Reset"). */
  baseBet: number;
  /** Accent color for the active toggles + Start button. */
  accent?: string;
  /** Disables the whole panel (e.g. logged out, invalid bet). */
  disabled?: boolean;
  /**
   * Place one bet of `bet`. Resolve with the round result, or `null` to stop
   * the session (insufficient funds, server error, etc.).
   */
  runBet: (bet: number) => Promise<{ won: boolean; payout: number } | null>;
  /** Notifies the parent when the auto loop starts / stops, so it can lock UI. */
  onBusyChange?: (busy: boolean) => void;
}

type WinLossAction = "reset" | "increase";

/** Minimum delay between rounds (ms) — gives outcomes time to animate/read. */
const ROUND_DELAY_MS = 250;

function fmtMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(n).toFixed(2);
}

export default function OriginalsAutoBet({
  baseBet,
  accent = "#ff9a3d",
  disabled = false,
  runBet,
  onBusyChange,
}: Props) {
  // --- Strategy inputs (strings so the user can clear them while typing) ---
  const [numBetsInput, setNumBetsInput] = React.useState("0");
  const [infinite, setInfinite] = React.useState(true);
  const [onWin, setOnWin] = React.useState<WinLossAction>("reset");
  const [onWinPct, setOnWinPct] = React.useState("0");
  const [onLoss, setOnLoss] = React.useState<WinLossAction>("reset");
  const [onLossPct, setOnLossPct] = React.useState("0");
  const [stopProfitInput, setStopProfitInput] = React.useState("0");
  const [stopLossInput, setStopLossInput] = React.useState("0");

  // --- Session state ---
  const [running, setRunning] = React.useState(false);
  const [betsPlayed, setBetsPlayed] = React.useState(0);
  const [wins, setWins] = React.useState(0);
  const [losses, setLosses] = React.useState(0);
  const [netProfit, setNetProfit] = React.useState(0);
  const [currentBet, setCurrentBet] = React.useState(baseBet);

  // Refs the async loop reads (so it always sees the latest values without
  // restarting / capturing stale closures).
  const runningRef = React.useRef(false);
  const baseBetRef = React.useRef(baseBet);
  const runBetRef = React.useRef(runBet);
  const onWinRef = React.useRef(onWin);
  const onWinPctRef = React.useRef(onWinPct);
  const onLossRef = React.useRef(onLoss);
  const onLossPctRef = React.useRef(onLossPct);
  const onBusyChangeRef = React.useRef(onBusyChange);

  React.useEffect(() => {
    baseBetRef.current = baseBet;
  }, [baseBet]);
  React.useEffect(() => {
    runBetRef.current = runBet;
  }, [runBet]);
  React.useEffect(() => {
    onWinRef.current = onWin;
  }, [onWin]);
  React.useEffect(() => {
    onWinPctRef.current = onWinPct;
  }, [onWinPct]);
  React.useEffect(() => {
    onLossRef.current = onLoss;
  }, [onLoss]);
  React.useEffect(() => {
    onLossPctRef.current = onLossPct;
  }, [onLossPct]);
  React.useEffect(() => {
    onBusyChangeRef.current = onBusyChange;
  }, [onBusyChange]);

  // Cancel the loop if the component unmounts mid-session.
  React.useEffect(() => {
    return () => {
      runningRef.current = false;
    };
  }, []);

  // Keep the displayed "current bet" in sync with baseBet while idle.
  React.useEffect(() => {
    if (!running) setCurrentBet(baseBet);
  }, [baseBet, running]);

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const stop = React.useCallback(() => {
    runningRef.current = false;
  }, []);

  const start = React.useCallback(async () => {
    if (runningRef.current || disabled) return;

    // Parse strategy parameters at the moment of starting.
    const parsedBets = Math.max(0, Math.floor(Number(numBetsInput) || 0));
    const stopProfit = Math.max(0, Number(stopProfitInput) || 0);
    const stopLoss = Math.max(0, Number(stopLossInput) || 0);

    // Reset the session tracker.
    let remaining = infinite ? Infinity : parsedBets;
    // A finite session of 0 bets is a no-op.
    if (!infinite && remaining <= 0) return;

    let workingBet = Math.max(0, baseBetRef.current);
    let net = 0;
    let played = 0;
    let winCount = 0;
    let lossCount = 0;

    setBetsPlayed(0);
    setWins(0);
    setLosses(0);
    setNetProfit(0);
    setCurrentBet(workingBet);

    runningRef.current = true;
    setRunning(true);
    onBusyChangeRef.current?.(true);

    try {
      while (runningRef.current && remaining > 0) {
        const result = await runBetRef.current(workingBet);

        // User stopped (or unmounted) while the bet was in flight.
        if (!runningRef.current) break;

        // Null → abort (error / insufficient balance / etc.).
        if (result === null) break;

        const { won, payout } = result;
        const roundProfit = payout - workingBet;
        net += roundProfit;
        played += 1;
        if (won) winCount += 1;
        else lossCount += 1;

        // Push the round into React state for the live tracker.
        setBetsPlayed(played);
        setWins(winCount);
        setLosses(lossCount);
        setNetProfit(net);

        // Apply the on-win / on-loss progression rule.
        if (won) {
          if (onWinRef.current === "reset") {
            workingBet = baseBetRef.current;
          } else {
            const pct = Number(onWinPctRef.current) || 0;
            workingBet = workingBet * (1 + pct / 100);
          }
        } else {
          if (onLossRef.current === "reset") {
            workingBet = baseBetRef.current;
          } else {
            const pct = Number(onLossPctRef.current) || 0;
            workingBet = workingBet * (1 + pct / 100);
          }
        }
        workingBet = Math.max(0, workingBet);
        setCurrentBet(workingBet);

        if (!infinite) remaining -= 1;

        // Stop conditions evaluated against running net profit.
        if (stopProfit > 0 && net >= stopProfit) break;
        if (stopLoss > 0 && -net >= stopLoss) break;
        if (remaining <= 0) break;

        // Brief pacing delay before the next round (lets outcomes settle).
        if (runningRef.current && remaining > 0) {
          await sleep(ROUND_DELAY_MS);
        }
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
      onBusyChangeRef.current?.(false);
      playSound(net >= 0 ? "cashout" : "lose");
    }
  }, [
    disabled,
    numBetsInput,
    infinite,
    stopProfitInput,
    stopLossInput,
  ]);

  const panelDisabled = disabled || running;
  const netPositive = netProfit >= 0;

  return (
    <div className="space-y-3">
      {/* Number of bets */}
      <div>
        <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
          Number of Bets
        </label>
        <div className="flex items-center gap-1.5 mt-1.5">
          <div
            className={`flex-1 flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg overflow-hidden transition-colors ${
              infinite ? "opacity-50" : "focus-within:border-white/20"
            }`}
          >
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={infinite ? "" : numBetsInput}
              placeholder={infinite ? "∞" : "0"}
              disabled={panelDisabled || infinite}
              onChange={(e) => setNumBetsInput(e.target.value)}
              className="flex-1 bg-transparent py-2.5 px-3 text-white text-sm font-bold outline-none min-w-0 placeholder:text-[#6b7280]"
              aria-label="Number of bets (0 for infinite)"
            />
          </div>
          <button
            type="button"
            onClick={() => !panelDisabled && setInfinite((v) => !v)}
            disabled={panelDisabled}
            aria-pressed={infinite}
            title="Infinite bets"
            className="px-3 py-2.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-40"
            style={
              infinite
                ? { background: accent, borderColor: accent, color: "#0b0d10" }
                : undefined
            }
          >
            <InfinityIcon
              size={16}
              className={infinite ? "" : "text-[#9ca3af]"}
            />
            {!infinite && (
              <span className="sr-only">Enable infinite bets</span>
            )}
          </button>
        </div>
      </div>

      {/* On Win */}
      <StrategyRow
        label="On Win"
        action={onWin}
        setAction={setOnWin}
        pct={onWinPct}
        setPct={setOnWinPct}
        accent={accent}
        disabled={panelDisabled}
      />

      {/* On Loss */}
      <StrategyRow
        label="On Loss"
        action={onLoss}
        setAction={setOnLoss}
        pct={onLossPct}
        setPct={setOnLossPct}
        accent={accent}
        disabled={panelDisabled}
      />

      {/* Stop on Profit / Stop on Loss */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
            Stop on Profit
          </label>
          <div className="flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg overflow-hidden mt-1.5 focus-within:border-white/20">
            <span className="pl-3 pr-1 text-sm font-bold text-[#9ca3af]">$</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={stopProfitInput}
              disabled={panelDisabled}
              onChange={(e) => setStopProfitInput(e.target.value)}
              className="flex-1 bg-transparent py-2.5 pr-2 text-white text-sm font-bold outline-none min-w-0"
              aria-label="Stop on profit amount (0 to disable)"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
            Stop on Loss
          </label>
          <div className="flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg overflow-hidden mt-1.5 focus-within:border-white/20">
            <span className="pl-3 pr-1 text-sm font-bold text-[#9ca3af]">$</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={stopLossInput}
              disabled={panelDisabled}
              onChange={(e) => setStopLossInput(e.target.value)}
              className="flex-1 bg-transparent py-2.5 pr-2 text-white text-sm font-bold outline-none min-w-0"
              aria-label="Stop on loss amount (0 to disable)"
            />
          </div>
        </div>
      </div>

      {/* Live session tracker */}
      <div className="rounded-lg bg-bg-deep-3 border border-white/[0.06] p-3 grid grid-cols-2 gap-y-2 gap-x-3 text-[11px]">
        <div className="flex items-center justify-between col-span-2">
          <span className="text-[#6b7280] font-bold uppercase tracking-wider">
            Net Profit
          </span>
          <span
            className="font-black tabular-nums"
            style={{ color: netPositive ? "#22c55e" : "#ef4444" }}
          >
            {fmtMoney(netProfit)}
          </span>
        </div>
        <Stat label="Bets" value={String(betsPlayed)} />
        <Stat label="Current Bet" value={fmtMoney(currentBet)} />
        <Stat label="Wins" value={String(wins)} valueClass="text-[#22c55e]" />
        <Stat
          label="Losses"
          value={String(losses)}
          valueClass="text-[#ef4444]"
        />
      </div>

      {/* Start / Stop */}
      <button
        type="button"
        onClick={running ? stop : () => void start()}
        disabled={disabled}
        className="w-full py-3.5 rounded-lg font-black text-sm uppercase tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
        style={
          running
            ? {
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.5)",
                color: "#ef4444",
              }
            : { background: accent, color: "#0b0d10" }
        }
      >
        {running ? "Stop Autobet" : "Start Autobet"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StrategyRow({
  label,
  action,
  setAction,
  pct,
  setPct,
  accent,
  disabled,
}: {
  label: string;
  action: WinLossAction;
  setAction: (a: WinLossAction) => void;
  pct: string;
  setPct: (v: string) => void;
  accent: string;
  disabled: boolean;
}) {
  const isIncrease = action === "increase";
  return (
    <div>
      <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
        {label}
      </label>
      <div className="flex items-center gap-1.5 mt-1.5">
        {/* Reset | Increase toggle */}
        <div className="flex flex-1 bg-bg-deep-3 border border-white/[0.06] rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => !disabled && setAction("reset")}
            disabled={disabled}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-bold transition-all disabled:opacity-40"
            style={
              !isIncrease
                ? { background: accent, color: "#0b0d10" }
                : { color: "#9ca3af" }
            }
            aria-pressed={!isIncrease}
          >
            <RotateCcw size={12} />
            Reset
          </button>
          <button
            type="button"
            onClick={() => !disabled && setAction("increase")}
            disabled={disabled}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-bold transition-all disabled:opacity-40"
            style={
              isIncrease
                ? { background: accent, color: "#0b0d10" }
                : { color: "#9ca3af" }
            }
            aria-pressed={isIncrease}
          >
            <TrendingUp size={12} />
            Increase
          </button>
        </div>
        {/* % input — only meaningful when "Increase" is selected */}
        <div
          className={`flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg overflow-hidden w-24 transition-opacity ${
            isIncrease ? "focus-within:border-white/20" : "opacity-40"
          }`}
        >
          <input
            type="number"
            min={0}
            inputMode="decimal"
            value={pct}
            disabled={disabled || !isIncrease}
            onChange={(e) => setPct(e.target.value)}
            className="flex-1 bg-transparent py-2.5 pl-3 pr-1 text-white text-sm font-bold outline-none min-w-0"
            aria-label={`${label} increase percentage`}
          />
          <span className="pr-3 text-sm font-bold text-[#9ca3af]">%</span>
        </div>
      </div>
    </div>
  );
}

function Stat({
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
