"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FantasyShell from "@/components/fantasy/FantasyShell";
import api from "@/services/api";

// EntitySport status codes: 1=Upcoming, 2=Result, 3=Live, 4=Cancelled
interface FantasyMatch {
  _id: string;
  externalMatchId: number;
  title: string;
  shortTitle?: string;
  competitionTitle: string;
  format: string;
  teamA: { id: number; name: string; short: string; logo: string; thumb?: string; color: string };
  teamB: { id: number; name: string; short: string; logo: string; thumb?: string; color: string };
  startDate: string;
  status: number;
  venue: string;
  scoreA: any;
  scoreB: any;
  playing11Announced?: boolean;
  isManaged?: boolean;
}

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "live", label: "Live" },
  { id: "completed", label: "Completed" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Sub-tabs within Upcoming
const UPCOMING_SUBTABS = [
  { id: "managed", label: "Pre-Squad", desc: "Credits locked" },
  { id: "all", label: "All Upcoming" },
] as const;
type UpcomingSubTab = (typeof UPCOMING_SUBTABS)[number]["id"];

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export default function FantasyPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabId>("upcoming");
  const [upcomingSubTab, setUpcomingSubTab] = useState<UpcomingSubTab>("managed");
  const [matches, setMatches] = useState<FantasyMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoadingMatches(true);
    try {
      // EntitySport status: 1=Upcoming, 2=Result, 3=Live, 4=Cancelled
      const statusMap: Record<TabId, number> = { upcoming: 1, live: 3, completed: 2 };
      const params: Record<string, any> = { status: statusMap[tab], limit: 50 };

      if (tab === "upcoming" && upcomingSubTab === "managed") {
        params.managed = true;
      }

      const matchRes = await api.get("/fantasy/matches", { params }).catch(() => null);
      setMatches(matchRes?.data?.matches || []);
    } catch {
      /* ignore */
    } finally {
      setLoadingMatches(false);
    }
  }, [user, tab, upcomingSubTab]);

  // Fetch on tab / sub-tab change
  useEffect(() => {
    if (!authLoading && user) {
      fetchData(false);
    }
  }, [authLoading, user, fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!authLoading && user) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => fetchData(true), AUTO_REFRESH_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [authLoading, user, fetchData]);

  if (authLoading || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f5f6f8] text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <FantasyShell
      title="Fantasy Cricket"
      subtitle="Pick. Play. Win real cash."
    >
      {/* Main tabs: Upcoming / Live / Completed */}
      <div className="bg-white rounded-xl border border-gray-200 px-1 flex items-center mb-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-[13px] font-extrabold py-3 transition-all relative tracking-tight ${
              tab === t.id ? "text-[#d13239]" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-[3px] bg-[#d13239] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Sub-tabs for Upcoming only */}
      {tab === "upcoming" && (
        <div className="flex gap-2 mb-4">
          {UPCOMING_SUBTABS.map((st) => (
            <button
              key={st.id}
              onClick={() => setUpcomingSubTab(st.id)}
              className={`flex-1 py-2 rounded-lg border text-[12px] font-extrabold transition-all ${
                upcomingSubTab === st.id
                  ? "bg-[#d13239] border-[#d13239] text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-[#d13239]/40"
              }`}
            >
              {st.id === "managed" && (
                <ShieldCheck size={11} className="inline-block mr-1 mb-0.5" />
              )}
              {st.label}
            </button>
          ))}
        </div>
      )}

      {loadingMatches ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-[#d13239]" />
        </div>
      ) : matches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-3">
            <span className="text-3xl">🏏</span>
          </div>
          <p className="text-gray-900 font-extrabold text-sm mb-1">
            {tab === "upcoming" && upcomingSubTab === "managed"
              ? "No pre-squad matches yet"
              : `No ${tab} matches`}
          </p>
          <p className="text-gray-500 text-xs">
            {tab === "upcoming" && upcomingSubTab === "managed"
              ? "Pre-squad matches have locked player credits. Check All Upcoming."
              : "Check back soon for new fixtures."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {matches.map((m) => (
            <MatchCard key={m._id} match={m} />
          ))}
        </div>
      )}
    </FantasyShell>
  );
}

function MatchCard({ match }: { match: FantasyMatch }) {
  const startDate = new Date(match.startDate);
  const now = Date.now();
  const diffMs = startDate.getTime() - now;

  // EntitySport: 1=Upcoming, 2=Result/Completed, 3=Live, 4=Cancelled
  const isLive = match.status === 3;
  const isCompleted = match.status === 2;
  const isUpcoming = match.status === 1;

  const countdown = useMemo(() => {
    if (!isUpcoming || diffMs <= 0) return null;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m`;
    const days = Math.floor(hrs / 24);
    return `${days}d ${hrs % 24}h`;
  }, [diffMs, isUpcoming]);

  const dateStr = startDate.toLocaleDateString("en-US", { day: "numeric", month: "short" });

  const scoreAStr =
    match.scoreA && typeof match.scoreA === "object"
      ? match.scoreA.scores_full || match.scoreA.scores || ""
      : "";
  const scoreBStr =
    match.scoreB && typeof match.scoreB === "object"
      ? match.scoreB.scores_full || match.scoreB.scores || ""
      : "";

  return (
    <Link
      href={`/fantasy/match/${match.externalMatchId}`}
      className="block bg-white rounded-xl border border-gray-200 hover:border-[#d13239]/40 hover:shadow-lg hover:shadow-red-100/40 transition-all overflow-hidden"
    >
      {/* Header: series name + badges */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 gap-2">
        <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider truncate flex-1">
          {match.competitionTitle || match.format}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {match.isManaged && isUpcoming && (
            <span className="flex items-center gap-1 text-[9px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md uppercase tracking-wide">
              <ShieldCheck size={8} />
              Pre-Squad
            </span>
          )}
          {match.playing11Announced && isUpcoming && (
            <span className="flex items-center gap-1 text-[9px] font-extrabold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Lineups Out
            </span>
          )}
          {isLive && (
            <span className="flex items-center gap-1 text-[9px] font-extrabold text-white bg-[#d13239] px-2 py-0.5 rounded-md uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Teams + countdown row */}
      <div className="px-4 py-5">
        <div className="flex items-center justify-between">
          {/* Team A */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <TeamAvatar team={match.teamA} />
            <div className="min-w-0">
              <p className="text-gray-900 font-extrabold text-[15px] truncate tracking-tight">
                {match.teamA.short}
              </p>
              {scoreAStr && (
                <p className="text-gray-600 text-[11px] font-bold truncate">{scoreAStr}</p>
              )}
            </div>
          </div>

          {/* Center countdown */}
          <div className="flex flex-col items-center shrink-0 px-3">
            {isUpcoming && countdown ? (
              <>
                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">
                  Starts in
                </span>
                <span className="text-[#d13239] font-extrabold text-[15px] mt-0.5 tracking-tight">
                  {countdown}
                </span>
              </>
            ) : isLive ? (
              <>
                <span className="text-[9px] font-extrabold text-[#d13239] uppercase tracking-widest">
                  In Play
                </span>
                <Clock size={16} className="text-[#d13239] mt-0.5" strokeWidth={2.5} />
              </>
            ) : (
              <>
                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">
                  VS
                </span>
                <span className="text-gray-600 text-[11px] font-bold mt-0.5">{dateStr}</span>
              </>
            )}
          </div>

          {/* Team B */}
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <p className="text-gray-900 font-extrabold text-[15px] truncate tracking-tight">
                {match.teamB.short}
              </p>
              {scoreBStr && (
                <p className="text-gray-600 text-[11px] font-bold truncate">{scoreBStr}</p>
              )}
            </div>
            <TeamAvatar team={match.teamB} />
          </div>
        </div>
      </div>

      {/* Footer: mega prize + CTA */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#fff4f4] to-[#fff9f0] border-t border-red-100">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">🏆</span>
          <div>
            <p className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest leading-none">
              Mega Prize
            </p>
            <p className="text-[#d13239] font-extrabold text-sm leading-tight mt-0.5">$5 Lakhs</p>
          </div>
        </div>
        <span
          className={`text-[11px] font-extrabold uppercase tracking-wide px-4 py-1.5 rounded-md ${
            isCompleted
              ? "bg-gray-200 text-gray-700"
              : isLive
                ? "bg-[#d13239] text-white"
                : "bg-[#008856] text-white"
          }`}
        >
          {isCompleted ? "View" : isLive ? "Track" : "Join"}
        </span>
      </div>
    </Link>
  );
}

function TeamAvatar({ team }: { team: FantasyMatch["teamA"] }) {
  const img = team.thumb || team.logo;
  return (
    <div className="w-11 h-11 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
      {img ? (
        <img
          src={img}
          alt={team.short}
          className="w-8 h-8 object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            if (e.target instanceof HTMLImageElement && e.target.parentElement) {
              e.target.parentElement.innerHTML = `<span class="text-gray-700 font-extrabold text-[10px]">${team.short}</span>`;
            }
          }}
        />
      ) : (
        <span className="text-gray-700 font-extrabold text-[10px]">{team.short}</span>
      )}
    </div>
  );
}
