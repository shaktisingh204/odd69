"use client";

import React, { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";

type Pick = "red" | "green" | "violet" | "number";

interface ColorResult {
  gameId: string;
  pick: Pick;
  pickNumber?: number;
  result: number;
  resultColors: string[];
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
  betAmount: number;
}

const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function colorsForNumber(n: number) {
  if (n === 0) return ["red", "violet"];
  if (n === 5) return ["green", "violet"];
  if (n % 2 === 1) return ["green"];
  return ["red"];
}

function bg(colors: string[]) {
  if (colors.includes("violet") && colors.length > 1) {
    return colors[0] === "red"
      ? "bg-gradient-to-br from-red-500 to-orange-500"
      : "bg-gradient-to-br from-emerald-500 to-orange-500";
  }
  if (colors[0] === "red") return "bg-red-500";
  if (colors[0] === "green") return "bg-emerald-500";
  return "bg-orange-500";
}

export default function ColorPage() {
  const { refreshWallet } = useWallet();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [pick, setPick] = useState<Pick>("red");
  const [pickNumber, setPickNumber] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ColorResult | null>(null);

  const play = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Invalid bet");
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<ColorResult>("/originals/color/play", {
        betAmount: bet,
        pick,
        pickNumber: pick === "number" ? pickNumber : undefined,
        walletType,
        useBonus,
      });
      setResult(res.data);
      if (res.data.status === "WON") {
        toast.success(`+$${res.data.payout.toLocaleString("en-US")}`);
      }
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Bet failed");
    } finally {
      setBusy(false);
    }
  }, [betInput, pick, pickNumber, walletType, useBonus, refreshWallet]);

  return (
    <OriginalsShell
      gameKey="color"
      title="Color"
      tags={["# Color", "# ODD69 Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={busy}
          accent="#f472b6"
          action={
            <button
              type="button"
              onClick={play}
              disabled={busy}
              className="w-full py-4 bg-pink-500 hover:bg-pink-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? "Playing…" : "Bet"}
            </button>
          }
        >
          {/* Color picker */}
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Pick
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(["red", "green", "violet"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => !busy && setPick(c)}
                  className={`py-2 rounded text-[10px] font-bold uppercase ${
                    pick === c
                      ? c === "red"
                        ? "bg-red-500/30 text-red-200 border border-red-400/50"
                        : c === "green"
                          ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/50"
                          : "bg-orange-500/30 text-orange-200 border border-orange-400/50"
                      : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => !busy && setPick("number")}
              className={`mt-2 w-full py-2 rounded text-[10px] font-bold uppercase ${
                pick === "number"
                  ? "bg-pink-500/30 text-pink-200 border border-pink-400/50"
                  : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
              }`}
            >
              Number × 9
            </button>
            {pick === "number" && (
              <div className="grid grid-cols-5 gap-1 mt-2">
                {NUMBERS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPickNumber(n)}
                    className={`py-1.5 rounded text-xs font-bold ${
                      pickNumber === n
                        ? "bg-pink-500/30 text-pink-200 border border-pink-400/50"
                        : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </OriginalsControls>
      }
    >
      <div
        className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-6"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #2a0917 0%, #1a0810 40%, #10040a 100%)",
          minHeight: 360,
        }}
      >
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06]">
          {result
            ? result.status === "WON"
              ? `🎉 ${result.result} (${result.resultColors.join(" + ")}) · +$${result.payout.toLocaleString("en-US")}`
              : `${result.result} (${result.resultColors.join(" + ")}) · no payout`
            : "Pick a color or number"}
        </div>

        <div className="mt-12 grid grid-cols-5 gap-3 max-w-xl">
          {NUMBERS.map((n) => {
            const colors = colorsForNumber(n);
            const isResult = result?.result === n;
            return (
              <div
                key={n}
                className={`relative aspect-square rounded-xl flex items-center justify-center text-white text-3xl font-black ${bg(colors)} ${
                  isResult
                    ? "ring-4 ring-yellow-300 scale-110 shadow-[0_0_30px_rgba(250,204,21,0.5)]"
                    : "opacity-90"
                }`}
              >
                {n}
              </div>
            );
          })}
        </div>
      </div>
    </OriginalsShell>
  );
}
