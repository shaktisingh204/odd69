"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Trophy, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FantasyShell from "@/components/fantasy/FantasyShell";
import api from "@/services/api";

interface HistoryEntry {
  _id: string; matchId: number; contestId: string; teamId: string; entryFee: number; status: string;
  rank: number; totalPoints: number; winnings: number; createdAt: string;
  match?: { title: string; competitionTitle: string; teamA: { short: string; color: string }; teamB: { short: string; color: string }; startDate: string; status: number };
  contest?: { title: string; maxSpots: number; filledSpots: number };
}

const FILTERS = ["All", "Won", "Lost"] as const;
type Filter = (typeof FILTERS)[number];

export default function FantasyHistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<Filter>("All");
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) router.replace("/"); }, [authLoading, user, router]);

  const fetchData = useCallback(async () => {
    try {
      const [historyRes, statsRes] = await Promise.all([api.get("/fantasy/history", { params: { limit: 50 } }), api.get("/fantasy/stats")]);
      setEntries(historyRes.data?.entries || []); setStats(statsRes.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!authLoading && user) fetchData(); }, [authLoading, user, fetchData]);

  if (authLoading || !user) return <div className="h-screen flex items-center justify-center bg-[#f5f6f8] text-gray-400 text-sm">Loading...</div>;

  const filtered = entries.filter((e) => {
    if (filter === "All") return true;
    if (filter === "Won") return e.winnings > 0;
    return e.winnings === 0 && e.status === "settled";
  });

  const wonCount = stats?.won || 0;
  const lostCount = stats?.lost || 0;
  const totalWinnings = stats?.totalWinnings || 0;
  const winRate = stats?.winRate || 0;
  const totalMatches = stats?.totalMatches || 0;

  return (
    <FantasyShell title="My Matches" subtitle="Your contests, ranks and winnings" backHref="/fantasy">
      {/* Stats hero — Dream11 winnings card */}
      <div className="bg-gradient-to-br from-[#d13239] via-[#c41f2a] to-[#a31923] rounded-2xl p-5 md:p-6 mb-4 shadow-lg shadow-[#d13239]/25 text-white relative overflow-hidden">
        {/* Subtle trophy watermark */}
        <Trophy size={140} className="absolute -right-6 -bottom-6 text-white/5" strokeWidth={1.5} />

        <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-6">
          <div className="flex items-center gap-4 shrink-0">
            <div className="w-16 h-16 md:w-18 md:h-18 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Trophy size={30} className="text-amber-300" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/70 mb-0.5">
                {totalMatches} Contests Joined
              </p>
              <p className="text-3xl md:text-4xl font-extrabold tracking-tight">
                ${totalWinnings.toLocaleString("en-US")}
              </p>
              <p className="text-xs font-extrabold text-amber-300 mt-0.5">Total Winnings</p>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-2 md:pl-6 md:border-l md:border-white/15">
            <Stat label="Won" value={wonCount.toString()} />
            <Stat label="Lost" value={lostCount.toString()} />
            <Stat label="Win Rate" value={`${winRate}%`} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="inline-flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-full mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-5 text-[11px] font-extrabold py-1.5 rounded-full transition-all uppercase tracking-wide ${filter === f ? "bg-[#d13239] text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-[#d13239]" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => {
            const isWon = e.winnings > 0;
            const matchDate = e.match?.startDate ? new Date(e.match.startDate).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "";
            return (
              <Link key={e._id} href={`/fantasy/match/${e.matchId}`}
                className="block bg-white rounded-xl border border-gray-200 hover:border-[#d13239]/40 transition-all overflow-hidden">
                <div className="flex items-center gap-3 p-3.5">
                  <div className={`w-1.5 self-stretch rounded-full ${isWon ? "bg-green-500" : e.status === "settled" ? "bg-[#d13239]" : "bg-amber-400"}`} />
                  {e.match?.teamA && e.match?.teamB && (
                    <div className="flex -space-x-2 shrink-0">
                      <div className="w-9 h-9 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-extrabold text-gray-700">{e.match.teamA.short}</div>
                      <div className="w-9 h-9 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-extrabold text-gray-700">{e.match.teamB.short}</div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wide truncate">{e.match?.competitionTitle || e.contest?.title}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400 font-bold">{matchDate}</span>
                    </div>
                    <p className="text-gray-900 font-extrabold text-[13px] flex items-center gap-1 tracking-tight">
                      <Users size={11} className="text-gray-400" strokeWidth={2.5} />
                      {e.rank > 0 ? `Rank #${e.rank.toLocaleString("en-US")}` : "Pending"}
                    </p>
                    <p className="text-gray-500 text-[10px] font-bold">
                      {e.status === "settled" ? (isWon ? "Won" : "Settled") : "In progress"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-extrabold text-[15px] tracking-tight ${isWon ? "text-green-600" : e.status === "settled" ? "text-[#d13239]" : "text-amber-600"}`}>
                      {isWon ? `+$${e.winnings.toLocaleString("en-US")}` : e.status === "settled" ? `-$${e.entryFee}` : "Pending"}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-gray-500 font-semibold text-sm">{entries.length === 0 ? "No contests joined yet. Start playing!" : "No matches in this filter."}</p>
            </div>
          )}
        </div>
      )}
    </FantasyShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 p-2.5 text-center">
      <p className="font-extrabold text-lg text-white tracking-tight">{value}</p>
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-white/70">{label}</p>
    </div>
  );
}
