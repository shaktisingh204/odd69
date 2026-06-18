"use client";

import React, { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";
import { Sparkles, RotateCcw } from "lucide-react";

interface LottoResult {
  gameId: string;
  selected: number[];
  drawn: number[];
  hits: number;
  multiplier: number;
  payout: number;
  status: "WON" | "LOST";
}

const POOL = Array.from({ length: 49 }, (_, i) => i + 1);
const PAYTABLE = [
  { hits: 2, mult: 1 },
  { hits: 3, mult: 2 },
  { hits: 4, mult: 10 },
  { hits: 5, mult: 100 },
  { hits: 6, mult: 1000 },
];

export default function LottoPage() {
  const { refreshWallet } = useWallet();
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<"fiat" | "crypto">("fiat");
  const [useBonus, setUseBonus] = useState(false);
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LottoResult | null>(null);

  const togglePick = (n: number) => {
    if (busy) return;
    setResult(null);
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(n)) {
        next.delete(n);
      } else {
        if (next.size >= 6) {
          toast.error("Pick exactly 6");
          return prev;
        }
        next.add(n);
      }
      return next;
    });
  };
  const clear = () => {
    if (busy) return;
    setPicks(new Set());
    setResult(null);
  };
  const autoPick = () => {
    if (busy) return;
    setResult(null);
    const next = new Set<number>();
    while (next.size < 6) next.add(1 + Math.floor(Math.random() * 49));
    setPicks(next);
  };

  const play = useCallback(async () => {
    const bet = parseFloat(betInput);
    if (!bet || bet <= 0) return toast.error("Invalid bet");
    if (picks.size !== 6) return toast.error("Pick exactly 6 numbers");
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<LottoResult>("/originals/lotto/play", {
        betAmount: bet,
        selected: Array.from(picks),
        walletType,
        useBonus,
      });
      setResult(res.data);
      if (res.data.status === "WON") {
        toast.success(
          `+$${res.data.payout.toLocaleString("en-US")} (${res.data.hits}/6)`,
        );
      }
      await refreshWallet();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Play failed");
    } finally {
      setBusy(false);
    }
  }, [betInput, picks, walletType, useBonus, refreshWallet]);

  const drawnSet = new Set(result?.drawn || []);
  const hitSet = new Set(
    result ? result.drawn.filter((n) => picks.has(n)) : [],
  );

  return (
    <OriginalsShell
      gameKey="lotto"
      title="Lotto"
      tags={["# Lotto", "# Zeero Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={busy}
          accent="#2dd4bf"
          action={
            <button
              type="button"
              onClick={play}
              disabled={busy || picks.size !== 6}
              className="w-full py-4 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white font-black text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {busy ? "Drawing…" : "Buy Ticket"}
            </button>
          }
          footer={
            <div className="text-[10px] text-[#6b7280] text-center">
              {picks.size}/6 numbers selected
            </div>
          }
        >
          <div>
            <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-2 block">
              Quick Pick
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={autoPick}
                disabled={busy}
                className="flex items-center justify-center gap-1 py-1.5 bg-bg-deep-3 border border-white/[0.06] rounded text-[11px] text-[#9ca3af] hover:text-white hover:border-white/[0.12]"
              >
                <Sparkles size={11} /> Auto
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={busy}
                className="flex items-center justify-center gap-1 py-1.5 bg-bg-deep-3 border border-white/[0.06] rounded text-[11px] text-[#9ca3af] hover:text-white hover:border-white/[0.12]"
              >
                <RotateCcw size={11} /> Clear
              </button>
            </div>
          </div>
        </OriginalsControls>
      }
    >
      <div
        className="relative w-full h-full flex flex-col items-center p-4 md:p-6 gap-3"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #08201c 0%, #071713 40%, #04100d 100%)",
          minHeight: 360,
        }}
      >
        <div className="text-[#9ca3af] text-xs font-medium px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/[0.06]">
          {result
            ? `${result.hits}/6 hits · ${
                result.status === "WON"
                  ? `+$${result.payout.toLocaleString("en-US")} (×${result.multiplier})`
                  : "no payout"
              }`
            : `${picks.size}/6 numbers selected`}
        </div>

        {/* Number board */}
        <div className="relative z-10 w-full max-w-2xl mt-4">
          <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
            {POOL.map((n) => {
              const isPicked = picks.has(n);
              const isDrawn = drawnSet.has(n);
              const isHit = hitSet.has(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => togglePick(n)}
                  className={`aspect-square rounded-lg text-[11px] sm:text-sm font-black transition-all ${
                    isHit
                      ? "bg-emerald-500 border border-emerald-300 text-white scale-105 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                      : isDrawn && !isPicked
                        ? "bg-white/[0.1] border border-white/30 text-white/60"
                        : isPicked
                          ? "bg-teal-500/30 border border-teal-400 text-white"
                          : "bg-bg-elevated border border-[#3a3d45] text-[#9ca3af] hover:bg-bg-hover hover:border-[#4a4d55]"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          {/* Pay table */}
          <div className="mt-4 grid grid-cols-5 gap-2 text-[11px] text-[#9ca3af]">
            {PAYTABLE.map((p) => (
              <div
                key={p.hits}
                className={`rounded-lg p-2 text-center font-bold border ${
                  result?.hits === p.hits
                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                    : "bg-bg-deep-3 border-white/[0.06]"
                }`}
              >
                {p.hits} hits
                <div className="text-teal-300 font-black">×{p.mult}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </OriginalsShell>
  );
}
