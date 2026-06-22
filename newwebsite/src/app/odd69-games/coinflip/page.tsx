"use client";

import React, { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";

interface CoinResult {
  gameId: string;
  pick: "heads" | "tails";
  result: "heads" | "tails";
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
}

export default function CoinflipPage() {
  const { refreshWallet } = useWallet();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("fiat");
  const [useBonus, setUseBonus] = useState(false);
  const [pick, setPick] = useState<"heads" | "tails">("heads");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CoinResult | null>(null);

  const play = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Invalid bet");
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<CoinResult>("/originals/coinflip/play", {
        betAmount: bet,
        pick,
        walletType,
        useBonus,
      });
      setResult(res.data);
      if (res.data.status === "WON") {
        toast.success(`+$${res.data.payout.toLocaleString("en-US")}`);
      }
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Flip failed");
    } finally {
      setBusy(false);
    }
  }, [betInput, pick, walletType, useBonus, refreshWallet]);

  return (
    <OriginalsShell
      gameKey="coinflip"
      title="Coinflip"
      tags={["# Coinflip", "# ODD69 Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={busy}
          accent="#ff9a3d"
          action={
            <button
              type="button"
              onClick={play}
              disabled={busy}
              className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? "Flipping…" : "Flip × 1.96"}
            </button>
          }
        >
          {/* Pick */}
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Your Call
            </label>
            <div className="grid grid-cols-2 gap-1">
              {(["heads", "tails"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => !busy && setPick(p)}
                  className={`py-2 rounded text-xs font-bold uppercase ${
                    pick === p
                      ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400/40"
                      : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </OriginalsControls>
      }
    >
      <div
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #241804 0%, #181004 40%, #0f0902 100%)",
          minHeight: 360,
        }}
      >
        {/* Status */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06]">
          {result
            ? result.status === "WON"
              ? `🎉 ${result.result.toUpperCase()} · +$${result.payout.toLocaleString("en-US")}`
              : `${result.result.toUpperCase()} · no payout`
            : `You picked ${pick.toUpperCase()}`}
        </div>

        {/* Coin */}
        <div className="mt-12 flex items-center justify-center">
          <div
            className={`w-48 h-48 rounded-full border-[10px] flex flex-col items-center justify-center transition-all duration-500 ${
              result?.status === "WON"
                ? "border-emerald-400 shadow-[0_0_60px_rgba(16,185,129,0.5)]"
                : result?.status === "LOST"
                  ? "border-red-400 shadow-[0_0_60px_rgba(239,68,68,0.4)]"
                  : "border-yellow-400/60 shadow-[0_0_40px_rgba(250,204,21,0.3)]"
            } bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-700`}
          >
            <div className="text-yellow-900 text-7xl font-black">
              {result ? (result.result === "heads" ? "H" : "T") : "?"}
            </div>
            <div className="text-[10px] text-yellow-900/80 uppercase tracking-wider font-bold">
              {result ? result.result : "place a bet"}
            </div>
          </div>
        </div>
      </div>
    </OriginalsShell>
  );
}
