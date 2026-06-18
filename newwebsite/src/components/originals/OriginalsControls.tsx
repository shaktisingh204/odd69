"use client";

import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

interface OriginalsControlsProps {
  /** Current bet input string (so the parent owns its own state) */
  betInput: string;
  setBetInput: (v: string) => void;
  walletType: "fiat" | "crypto";
  setWalletType: (w: "fiat" | "crypto") => void;
  useBonus: boolean;
  setUseBonus: (v: boolean) => void;
  /** Locks the amount/wallet/bonus controls while a round is in flight */
  locked?: boolean;
  /** Min bet (defaults to 10) */
  minBet?: number;
  /** Custom controls slot (sliders, risk pickers, etc.) — appears between amount and action */
  children?: React.ReactNode;
  /** The Bet / Cashout / etc button — fully styled by the caller */
  action: React.ReactNode;
  /** Optional under-the-button stats (e.g. live multiplier) */
  footer?: React.ReactNode;
  /** Accent color used for the active manual tab underline */
  accent?: string;
}

const QUICK_BETS = [10, 100, 1000, 10000];

function fmtBet(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}

/**
 * Standard left-panel content shared by every Zeero Originals page.
 * Mirrors the mines.page.tsx control structure 1:1 so all the new games
 * (keno, hilo, …) feel consistent. Game-specific controls are passed in
 * via `children` (rendered between the amount block and the action button).
 *
 * Wrap this with `<OriginalsShell controls={<OriginalsControls .../>}>...
 */
export default function OriginalsControls({
  betInput,
  setBetInput,
  walletType,
  setWalletType,
  useBonus,
  setUseBonus,
  locked,
  minBet = 10,
  children,
  action,
  footer,
  accent = "#22c55e",
}: OriginalsControlsProps) {
  const { fiatBalance, cryptoBalance } = useWallet();
  const balance = walletType === "crypto" ? cryptoBalance : fiatBalance;
  const sym = walletType === "crypto" ? "$" : "$";

  const adjust = (mult: number | "half") => {
    if (locked) return;
    const cur = parseFloat(betInput) || 0;
    if (mult === "half") {
      setBetInput(String(Math.max(minBet, Math.floor(cur / 2))));
    } else {
      setBetInput(
        String(Math.min(Math.floor(cur * (mult as number)), Math.floor(balance))),
      );
    }
  };

  return (
    <>
      {/* Manual / Auto tabs (auto disabled for these games) */}
      <div className="flex border-b border-white/[0.06]">
        <button
          type="button"
          className="flex-1 py-3 text-sm font-bold text-white relative"
        >
          Manual
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: accent }}
          />
        </button>
        <button
          type="button"
          disabled
          className="flex-1 py-3 text-sm font-bold text-[#3a3d45] cursor-not-allowed"
          title="Auto mode coming soon"
        >
          Auto
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Amount */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
              Amount
            </label>
            <div className="flex items-center gap-1 text-[11px] text-[#6b7280]">
              <span
                className={`px-1.5 py-0.5 rounded cursor-pointer hover:text-white transition-colors ${
                  walletType === "fiat" ? "text-white" : ""
                }`}
                onClick={() => !locked && setWalletType("fiat")}
              >
                $
              </span>
              <span className="opacity-30">|</span>
              <span
                className={`px-1.5 py-0.5 rounded cursor-pointer hover:text-white transition-colors ${
                  walletType === "crypto" ? "text-white" : ""
                }`}
                onClick={() => {
                  if (!locked) {
                    setWalletType("crypto");
                    setUseBonus(false);
                  }
                }}
              >
                $
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 relative flex items-center bg-bg-deep-3 border border-white/[0.06] rounded-lg overflow-hidden focus-within:border-green-500/40">
              <div className="pl-3 pr-1 text-sm font-bold text-[#9ca3af]">
                {sym}
              </div>
              <input
                type="number"
                value={betInput}
                disabled={locked}
                onChange={(e) => setBetInput(e.target.value)}
                className="flex-1 bg-transparent py-2.5 pr-2 text-white text-sm font-bold outline-none min-w-0"
              />
              <div className="flex flex-col border-l border-white/[0.06]">
                <button
                  type="button"
                  onClick={() =>
                    !locked &&
                    setBetInput(String((parseFloat(betInput) || 0) + 1))
                  }
                  disabled={locked}
                  className="px-2 py-1 hover:bg-white/[0.05] text-[#6b7280] hover:text-white transition-colors disabled:opacity-40"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    !locked &&
                    setBetInput(
                      String(
                        Math.max(
                          minBet,
                          (parseFloat(betInput) || 0) - 1,
                        ),
                      ),
                    )
                  }
                  disabled={locked}
                  className="px-2 py-1 hover:bg-white/[0.05] text-[#6b7280] hover:text-white transition-colors disabled:opacity-40 border-t border-white/[0.06]"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => adjust("half")}
              disabled={locked}
              className="px-3 py-2.5 bg-bg-deep-3 border border-white/[0.06] rounded-lg text-xs font-bold text-[#9ca3af] hover:text-white hover:border-white/[0.12] transition-all disabled:opacity-40"
            >
              ½
            </button>
            <button
              type="button"
              onClick={() => adjust(2)}
              disabled={locked}
              className="px-3 py-2.5 bg-bg-deep-3 border border-white/[0.06] rounded-lg text-xs font-bold text-[#9ca3af] hover:text-white hover:border-white/[0.12] transition-all disabled:opacity-40"
            >
              2×
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1 mt-2">
            {QUICK_BETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => !locked && setBetInput(String(n))}
                disabled={locked}
                className="py-1.5 bg-bg-deep-3 border border-white/[0.06] hover:border-white/[0.12] hover:text-white rounded-lg text-[#9ca3af] text-xs font-bold transition-all disabled:opacity-40"
              >
                {fmtBet(n)}
              </button>
            ))}
          </div>
        </div>

        {/* Game-specific controls slot */}
        {children}

        {/* Bonus toggle */}
        <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
          <span className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
            Casino Bonus
          </span>
          <button
            type="button"
            onClick={() =>
              !locked && walletType !== "crypto" && setUseBonus(!useBonus)
            }
            disabled={locked || walletType === "crypto"}
            className={`relative w-10 h-5 rounded-full transition-all border flex-shrink-0 ${
              useBonus && walletType !== "crypto"
                ? "bg-green-500 border-green-500"
                : "bg-bg-deep-3 border-white/[0.06]"
            } ${locked || walletType === "crypto" ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                useBonus && walletType !== "crypto" ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {/* Balance */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#6b7280]">Balance</span>
          <span className="text-white font-black">
            {sym}
            {balance.toFixed(2)}
          </span>
        </div>

        {footer}

        {/* Action button(s) */}
        {action}
      </div>
    </>
  );
}
