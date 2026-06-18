"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getOriginalsHistory, forceCloseGame } from "@/actions/originals";
import {
  ArrowLeft, RefreshCcw, Loader2, Bomb, Gem,
  ChevronLeft, ChevronRight, XCircle, Search,
} from "lucide-react";
import toast from "react-hot-toast";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

const formatPlinkoPath = (path: number[] = []) => path.map((step) => (step ? "R" : "L")).join("");

export default function GameHistoryPage() {
  const params = useParams();
  const game = params.game as string;
  const isPlinko = game === "plinko";

  const [games, setGames] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchUserId, setSearchUserId] = useState("");
  const [forceClosing, setForceClosing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const uid = searchUserId ? parseInt(searchUserId) : undefined;
    const res = await getOriginalsHistory(game, page, 50, uid);
    if (res.success) {
      setGames(res.data?.games || []);
      setTotal(res.data?.total || 0);
      setPages(res.data?.pages || 1);
    }
    setLoading(false);
  }, [game, page, searchUserId]);

  useEffect(() => { load(); }, [load]);

  const handleForceClose = async (gameId: string) => {
    if (!confirm(`Force-close this game? It will be marked as LOST with no payout.`)) return;
    setForceClosing(gameId);
    const res = await forceCloseGame(gameId);
    setForceClosing(null);
    if (res.success) { toast.success("Game force-closed"); load(); }
    else toast.error(res.error || "Failed to force-close");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/originals/${game}`}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-white capitalize">{game} — Game History</h1>
            <p className="text-slate-400 text-xs">{total.toLocaleString()} total games</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
          <RefreshCcw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="number" placeholder="Filter by User ID" value={searchUserId}
            onChange={(e) => { setSearchUserId(e.target.value); setPage(1); }}
            className="bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-lg pl-8 pr-3 py-2 text-white text-sm outline-none w-48 placeholder:text-slate-600"
          />
        </div>
        {searchUserId && (
          <button onClick={() => { setSearchUserId(""); setPage(1); }}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 text-xs rounded-lg transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase bg-slate-900/60 border-b border-slate-700">
                  {(isPlinko
                    ? ["ID", "User", "Bet", "Rows", "Risk", "Path", "Slot", "Multiplier", "Payout", "Wallet", "Status", "Time"]
                    : ["ID", "User", "Bet", "Mines", "Tiles", "Multiplier", "Payout", "Wallet", "Status", "Time", "Action"]
                  ).map((h) => (
                    <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {games.length === 0 && (
                  <tr>
                    <td colSpan={isPlinko ? 12 : 11} className="px-4 py-10 text-center text-slate-500 text-sm">
                      No games found.
                    </td>
                  </tr>
                )}
                {games.map((g: any) => {
                  const gid: string = g.gameId || String(g._id || "");
                  const plinkoPayoutClass = g.status === "WON"
                    ? "text-emerald-400"
                    : g.payout > 0
                      ? "text-amber-300"
                      : "text-red-400";

                  if (isPlinko) {
                    return (
                      <tr key={gid} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{gid.slice(-8)}</td>
                        <td className="px-4 py-2.5">
                          <div className="text-white text-xs font-medium">{g.user?.username || "—"}</div>
                          <div className="text-slate-500 text-[10px]">#{g.userId}</div>
                        </td>
                        <td className="px-4 py-2.5 text-white text-xs font-bold">{fmt(g.betAmount)}</td>
                        <td className="px-4 py-2.5 text-slate-300 text-xs font-semibold">{g.rows}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            g.risk === "high"
                              ? "bg-rose-500/10 text-rose-300"
                              : g.risk === "medium"
                                ? "bg-amber-500/10 text-amber-300"
                                : "bg-emerald-500/10 text-emerald-300"
                          }`}>
                            {g.risk}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 text-[10px] font-mono">{formatPlinkoPath(g.path)}</td>
                        <td className="px-4 py-2.5 text-slate-300 text-xs font-semibold">{g.slotIndex}</td>
                        <td className="px-4 py-2.5 text-brand-gold text-xs font-bold">
                          {Number(g.multiplier || 0).toFixed(2)}×
                        </td>
                        <td className={`px-4 py-2.5 text-xs font-bold ${plinkoPayoutClass}`}>
                          {fmt(g.payout || 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase
                            ${g.walletType === "crypto" ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"}`}>
                            {g.walletType}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1 w-fit
                            ${g.status === "WON" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-300"}`}>
                            {g.status === "WON" ? <Gem size={9} /> : <Bomb size={9} />}
                            {g.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-[10px] whitespace-nowrap">
                          {new Date(g.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={gid} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{gid.slice(-8)}</td>
                      <td className="px-4 py-2.5">
                        <div className="text-white text-xs font-medium">{g.user?.username || "—"}</div>
                        <div className="text-slate-500 text-[10px]">#{g.userId}</div>
                      </td>
                      <td className="px-4 py-2.5 text-white text-xs font-bold">{fmt(g.betAmount)}</td>
                      <td className="px-4 py-2.5 text-red-400 text-xs font-bold">{g.mineCount} 💣</td>
                      <td className="px-4 py-2.5 text-slate-300 text-xs">{g.revealedTiles?.length ?? 0}</td>
                      <td className="px-4 py-2.5 text-brand-gold text-xs font-bold">
                        {g.multiplier?.toFixed(3)}×
                      </td>
                      <td className={`px-4 py-2.5 text-xs font-bold ${g.status === "CASHEDOUT" ? "text-emerald-400" : "text-red-400"}`}>
                        {g.status === "CASHEDOUT" ? fmt(g.payout) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase
                          ${g.walletType === "crypto" ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"}`}>
                          {g.walletType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1 w-fit
                          ${g.status === "CASHEDOUT" ? "bg-emerald-500/10 text-emerald-400" :
                            g.status === "LOST" ? "bg-red-500/10 text-red-400" :
                            "bg-amber-500/10 text-amber-400"}`}>
                          {g.status === "CASHEDOUT" ? <Gem size={9} /> : g.status === "LOST" ? <Bomb size={9} /> : null}
                          {g.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-[10px] whitespace-nowrap">
                        {new Date(g.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-2.5">
                        {g.status === "ACTIVE" && !isPlinko && (
                          <button
                            onClick={() => handleForceClose(gid)}
                            disabled={forceClosing === gid}
                            className="flex items-center gap-1 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded transition-colors disabled:opacity-50">
                            {forceClosing === gid ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-xs">
            Page {page} of {pages} · {total} total games
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, pages - 4)) + i;
              return p <= pages ? (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${p === page ? "bg-indigo-600 text-white" : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"}`}>
                  {p}
                </button>
              ) : null;
            })}
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
