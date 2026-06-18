"use client";

import React, { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";

interface JackpotResult {
  gameId: string;
  tier: "BUST" | "MINI" | "SMALL" | "BIG" | "MEGA" | "GRAND";
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
}

const TIERS: { tier: JackpotResult["tier"]; mult: number; color: string }[] = [
  { tier: "BUST", mult: 0, color: "bg-slate-700 text-slate-300 border border-slate-600" },
  { tier: "MINI", mult: 1.4, color: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40" },
  { tier: "SMALL", mult: 2.8, color: "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40" },
  { tier: "BIG", mult: 8, color: "bg-violet-500/20 text-violet-200 border border-violet-400/40" },
  { tier: "MEGA", mult: 28, color: "bg-pink-500/20 text-pink-200 border border-pink-400/40" },
  { tier: "GRAND", mult: 180, color: "bg-yellow-500/20 text-yellow-200 border border-yellow-400/40" },
];

export default function JackpotPage() {
  const { refreshWallet } = useWallet();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("fiat");
  const [useBonus, setUseBonus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<JackpotResult | null>(null);

  const play = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Invalid bet");
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<JackpotResult>("/originals/jackpot/play", {
        betAmount: bet,
        walletType,
        useBonus,
      });
      setResult(res.data);
      if (res.data.status === "WON") {
        toast.success(
          `${res.data.tier} ×${res.data.multiplier} · +$${res.data.payout.toLocaleString("en-US")}`,
        );
      }
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Spin failed");
    } finally {
      setBusy(false);
    }
  }, [betInput, walletType, useBonus, refreshWallet]);

  return (
    <OriginalsShell
      gameKey="jackpot"
      title="Jackpot"
      tags={["# Jackpot", "# Zeero Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={busy}
          accent="#8B5CF6"
          action={
            <button
              type="button"
              onClick={play}
              disabled={busy}
              className="w-full py-4 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? "Rolling…" : "Spin Jackpot"}
            </button>
          }
        />
      }
    >
      <div
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #2a1404 0%, #1b0d03 40%, #100702 100%)",
          minHeight: 360,
        }}
      >
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06]">
          {result
            ? result.status === "WON"
              ? `🎉 ${result.tier} × ${result.multiplier} · +$${result.payout.toLocaleString("en-US")}`
              : `${result.tier} · Bust`
            : "Spin for the jackpot"}
        </div>

        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
          {TIERS.map((t) => {
            const active = result?.tier === t.tier;
            return (
              <div
                key={t.tier}
                className={`rounded-2xl p-5 text-center font-black transition-all ${t.color} ${
                  active
                    ? "ring-4 ring-yellow-300/60 scale-110 shadow-[0_0_30px_rgba(250,204,21,0.4)]"
                    : ""
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider opacity-80">
                  {t.tier}
                </div>
                <div className="text-3xl">×{t.mult}</div>
              </div>
            );
          })}
        </div>
      </div>
    </OriginalsShell>
  );
}
