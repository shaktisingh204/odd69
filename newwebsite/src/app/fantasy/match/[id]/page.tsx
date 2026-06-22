"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Users,
  Award,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FantasyShell from "@/components/fantasy/FantasyShell";
import api from "@/services/api";

interface MatchDetail {
  _id: string;
  externalMatchId: number;
  title: string;
  competitionTitle: string;
  format: string;
  teamA: any;
  teamB: any;
  startDate: string;
  status: number;
  statusNote: string;
  venue: string;
  scoreA: any;
  scoreB: any;
  playing11Announced?: boolean;
}

type ContestPhase = "full" | "innings1" | "innings2" | "powerplay";

interface Contest {
  _id: string;
  title: string;
  type: string;
  phase?: ContestPhase;
  entryFee: number;
  totalPrize: number;
  maxSpots: number;
  filledSpots: number;
  prizeBreakdown: Array<{ rankFrom: number; rankTo: number; prize: number }>;
}

const PHASE_TABS: Array<{ id: ContestPhase; label: string }> = [
  { id: "full", label: "Full Match" },
  { id: "innings1", label: "1st Inn" },
  { id: "innings2", label: "2nd Inn" },
  { id: "powerplay", label: "Powerplay" },
];

const TABS = [
  { id: "contests", label: "Contests" },
  { id: "my-teams", label: "My Teams" },
  { id: "winnings", label: "Winnings" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function FantasyMatchPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabId>("contests");
  const [phase, setPhase] = useState<ContestPhase>("full");
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [contests, setContests] = useState<Contest[]>([]);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [myEntries, setMyEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [matchRes, contestsRes, teamsRes, historyRes] = await Promise.all([
        api.get(`/fantasy/matches/${id}`),
        api.get(`/fantasy/matches/${id}/contests`),
        user ? api.get(`/fantasy/my-teams/${id}`).catch(() => null) : null,
        user ? api.get("/fantasy/history", { params: { limit: 100 } }).catch(() => null) : null,
      ]);
      setMatch(matchRes.data);
      setContests(contestsRes.data || []);
      if (teamsRes?.data) setMyTeams(teamsRes.data);
      if (historyRes?.data?.entries) {
        setMyEntries(historyRes.data.entries.filter((e: any) => String(e.matchId) === String(id)));
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (!authLoading && user) fetchData();
  }, [authLoading, user, fetchData]);

  const joinedContestIds = useMemo(() => new Set(myEntries.map((e) => e.contestId)), [myEntries]);

  const startDate = match ? new Date(match.startDate) : new Date();
  const diffMs = startDate.getTime() - Date.now();
  const isLive = match?.status === 3;   // EntitySport: 3=Live
  const isUpcoming = match?.status === 1; // EntitySport: 1=Upcoming
  const isCompleted = match?.status === 2; // EntitySport: 2=Result/Completed

  // After the match, the Contests tab only shows contests the user joined.
  // Before/during the match, also filter by the selected phase tab.
  const visibleContests = useMemo(() => {
    const base = isCompleted
      ? contests.filter((c) => joinedContestIds.has(c._id))
      : contests;
    return base.filter((c) => (c.phase ?? "full") === phase);
  }, [contests, joinedContestIds, isCompleted, phase]);

  const phaseCounts = useMemo(() => {
    const counts: Record<ContestPhase, number> = { full: 0, innings1: 0, innings2: 0, powerplay: 0 };
    const base = isCompleted
      ? contests.filter((c) => joinedContestIds.has(c._id))
      : contests;
    for (const c of base) counts[(c.phase ?? "full") as ContestPhase]++;
    return counts;
  }, [contests, joinedContestIds, isCompleted]);

  const countdown = useMemo(() => {
    if (!isUpcoming || diffMs <= 0) return "Started";
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    const s = Math.floor((diffMs % 60000) / 1000);
    return { h, m, s };
  }, [diffMs, isUpcoming]);

  const handleJoin = (contest: Contest) => {
    if (!isUpcoming) return;
    if (joinedContestIds.has(contest._id)) return;
    router.push(`/fantasy/match/${id}/contest/${contest._id}/join`);
  };

  const toggleExpand = (cid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  };

  if (authLoading || !user || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f5f6f8]">
        <Loader2 className="w-7 h-7 animate-spin text-[#d13239]" />
      </div>
    );
  }

  if (!match) {
    return (
      <FantasyShell title="Match Not Found" backHref="/fantasy">
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-500 text-sm font-semibold">Match not found or not yet synced.</p>
        </div>
      </FantasyShell>
    );
  }

  return (
    <FantasyShell
      title={match.teamA.short + " vs " + match.teamB.short}
      subtitle={match.competitionTitle}
      backHref="/fantasy"
      hideSubNav
    >
      {/* Hero — dark navy band with teams + countdown (Dream11 style) */}
      <div className="bg-gradient-to-br from-[#1a1f3a] via-[#151a32] to-[#0f1428] rounded-2xl p-5 md:p-6 mb-4 text-white shadow-xl shadow-black/10 relative overflow-hidden">
        {/* subtle stripe pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, transparent 0 18px, rgba(255,255,255,0.8) 18px 19px)",
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/60">
              {match.competitionTitle}
            </span>
            {isLive && (
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold bg-[#d13239] px-2.5 py-1 rounded-md uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Live
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <TeamHero team={match.teamA} score={match.scoreA} />

            <div className="flex flex-col items-center shrink-0">
              {isUpcoming && typeof countdown !== "string" ? (
                <>
                  <span className="text-[9px] font-extrabold uppercase text-white/60 tracking-widest">
                    Starts in
                  </span>
                  <div className="flex items-center gap-1 mt-1.5">
                    <CountdownBlock label="H" value={countdown.h} />
                    <span className="text-white/40 font-extrabold">:</span>
                    <CountdownBlock label="M" value={countdown.m} />
                    <span className="text-white/40 font-extrabold">:</span>
                    <CountdownBlock label="S" value={countdown.s} />
                  </div>
                </>
              ) : isLive ? (
                <>
                  <span className="text-[9px] font-extrabold uppercase text-white/60 tracking-widest">
                    Status
                  </span>
                  <span className="font-extrabold text-base mt-1 tracking-tight">In Play</span>
                </>
              ) : (
                <>
                  <span className="text-[9px] font-extrabold uppercase text-white/60 tracking-widest">
                    Result
                  </span>
                  <span className="font-extrabold text-xs mt-1 text-center max-w-[140px] leading-tight">
                    {match.statusNote || "Completed"}
                  </span>
                </>
              )}
            </div>

            <TeamHero team={match.teamB} score={match.scoreB} />
          </div>

          <div className="flex items-center justify-center gap-1 text-[10px] text-white/70 font-bold mt-4">
            <MapPin size={11} strokeWidth={2.5} />
            <span className="truncate">{match.venue || "TBD"}</span>
          </div>
        </div>
      </div>

      {/* Create-team CTA — shown first when user has no teams and the match
          is still open. The user must create a team before seeing contests. */}
      {isUpcoming && myTeams.length === 0 && (
        <div className="bg-gradient-to-br from-[#d13239] to-[#a31923] rounded-2xl p-5 mb-3 text-white shadow-lg shadow-[#d13239]/20">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              <Users size={20} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-[15px] tracking-tight">
                Create your first team
              </p>
              <p className="text-white/80 text-[11px] font-semibold mt-0.5">
                Pick 11 players, then choose a contest to join.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/fantasy/match/${id}/create`)}
            className="mt-4 w-full bg-white text-[#d13239] font-extrabold text-[13px] py-3 rounded-lg uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <Plus size={15} strokeWidth={3} /> Create Team
          </button>
        </div>
      )}

      {/* My Teams summary */}
      {myTeams.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-3.5 mb-3 flex items-center justify-between">
          <div>
            <p className="text-gray-900 font-extrabold text-sm tracking-tight">
              {myTeams.length} Team{myTeams.length > 1 ? "s" : ""} Created
            </p>
            <p className="text-gray-500 text-[11px] font-semibold">
              {myEntries.length} contest{myEntries.length !== 1 ? "s" : ""} joined
            </p>
          </div>
          <button
            onClick={() => setTab("my-teams")}
            className="flex items-center gap-1 text-[#d13239] font-extrabold text-xs hover:text-[#a31923] uppercase tracking-wide"
          >
            View <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 px-1 flex items-center mb-3 sticky top-2 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-[13px] font-extrabold py-3 transition-all relative tracking-tight ${
              tab === t.id ? "text-[#d13239]" : "text-gray-500"
            }`}
          >
            {t.label}
            {t.id === "my-teams" && myTeams.length > 0 && (
              <span className={`ml-1 text-[10px] font-extrabold ${tab === t.id ? "text-[#d13239]" : "text-gray-400"}`}>
                ({myTeams.length})
              </span>
            )}
            {tab === t.id && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-[3px] bg-[#d13239] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {tab === "contests" && (
        isUpcoming && myTeams.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <Users size={32} className="text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-gray-900 font-extrabold text-sm mb-1">Create a team to see contests</p>
            <p className="text-gray-500 text-xs">Contests unlock once you've built your first team for this match.</p>
          </div>
        ) : (
          <>
            {/* Phase filter pills — full match / innings / powerplay */}
            <div className="flex items-center gap-2 mb-3 overflow-x-auto -mx-1 px-1 scrollbar-none">
              {PHASE_TABS.map((p) => {
                const active = phase === p.id;
                const count = phaseCounts[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => setPhase(p.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide px-3 py-1.5 rounded-full border transition-all ${
                      active
                        ? "bg-[#d13239] border-[#d13239] text-white shadow-sm shadow-[#d13239]/30"
                        : "bg-white border-gray-200 text-gray-600 hover:border-[#d13239]/40"
                    }`}
                  >
                    {p.label}
                    <span
                      className={`text-[10px] font-extrabold ${
                        active ? "text-white/80" : "text-gray-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <ContestsList
              contests={visibleContests}
              joined={joinedContestIds}
              expanded={expanded}
              canJoin={isUpcoming}
              onJoin={handleJoin}
              onToggle={toggleExpand}
              matchId={match.externalMatchId}
              emptyLabel={
                isCompleted
                  ? "You didn't join any contest in this phase."
                  : `No ${PHASE_TABS.find((p) => p.id === phase)?.label ?? ""} contests yet.`
              }
            />
          </>
        )
      )}

      {tab === "my-teams" && (
        <MyTeamsList teams={myTeams} matchId={match.externalMatchId} disabled={!isUpcoming} />
      )}

      {tab === "winnings" && <MyWinningsList entries={myEntries} />}

      {/* Sticky helper hint */}
      {isUpcoming && tab === "contests" && (
        <div className="fixed bottom-[80px] md:bottom-6 left-0 right-0 z-40 px-4 md:max-w-sm md:mx-auto md:px-0 pointer-events-none">
          <div className="flex items-center justify-center gap-2 bg-[#1a1f3a]/95 backdrop-blur-sm text-white rounded-xl py-3 font-extrabold text-[12px] shadow-xl tracking-wide uppercase">
            <Plus size={15} strokeWidth={2.75} />
            {myTeams.length === 0 ? "Create a Team to start" : "Pick a Contest to join"}
          </div>
        </div>
      )}
    </FantasyShell>
  );
}

function TeamHero({ team, score }: { team: any; score: any }) {
  const img = team.thumb || team.logo;
  const scoreStr =
    score && typeof score === "object"
      ? score.scores_full || score.scores || ""
      : "";
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center overflow-hidden ring-2 ring-white/20 shadow-lg">
        {img ? (
          <img
            src={img}
            alt={team.short}
            className="w-11 h-11 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              if (e.target instanceof HTMLImageElement && e.target.parentElement) {
                e.target.parentElement.innerHTML = `<span class='text-[#1a1f3a] font-extrabold text-sm'>${team.short}</span>`;
              }
            }}
          />
        ) : (
          <span className="text-[#1a1f3a] font-extrabold text-sm">{team.short}</span>
        )}
      </div>
      <p className="text-white font-extrabold text-base tracking-tight">{team.short}</p>
      {scoreStr && <p className="text-amber-300 font-extrabold text-[11px]">{scoreStr}</p>}
    </div>
  );
}

function CountdownBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-md px-2 py-1 min-w-[28px] text-center">
        <span className="font-extrabold text-base tracking-tight">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[8px] font-extrabold text-white/50 uppercase mt-0.5 tracking-widest">
        {label}
      </span>
    </div>
  );
}

function ContestsList({
  contests,
  joined,
  expanded,
  canJoin,
  onJoin,
  onToggle,
  matchId,
  emptyLabel,
}: {
  contests: Contest[];
  joined: Set<string>;
  expanded: Set<string>;
  canJoin: boolean;
  onJoin: (c: Contest) => void;
  onToggle: (id: string) => void;
  matchId: number;
  emptyLabel: string;
}) {
  if (contests.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <p className="text-gray-500 font-semibold text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-24">
      {contests.map((c) => {
        const isJoined = joined.has(c._id);
        const pct = c.maxSpots > 0 ? Math.min(100, Math.round((c.filledSpots / c.maxSpots) * 100)) : 0;
        const firstPrize = c.prizeBreakdown[0]?.prize || c.totalPrize;
        const winnerCount = c.prizeBreakdown.reduce(
          (s, t) => s + (t.rankTo - t.rankFrom + 1),
          0,
        );
        const isExpanded = expanded.has(c._id);

        return (
          <Link
            key={c._id}
            href={`/fantasy/match/${matchId}/contest/${c._id}`}
            className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-[#d13239]/40 hover:shadow-md transition-all"
          >
            {/* Top: prize pool + entry */}
            <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-1">
                  Prize Pool
                </p>
                <p className="text-gray-900 font-extrabold text-2xl leading-none tracking-tight">
                  ${c.totalPrize.toLocaleString("en-US")}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onJoin(c);
                }}
                disabled={!canJoin || isJoined}
                className={`shrink-0 text-[13px] font-extrabold px-5 py-2.5 rounded-lg transition-all min-w-[84px] tracking-wide ${
                  isJoined
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : !canJoin
                      ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                      : "bg-[#008856] text-white hover:bg-[#006a42] shadow-sm shadow-green-700/20"
                }`}
              >
                {isJoined
                  ? "View"
                  : !canJoin
                    ? "Closed"
                    : c.entryFee === 0
                      ? "FREE"
                      : `$${c.entryFee}`}
              </button>
            </div>

            {/* Progress bar */}
            <div className="px-4 pb-2.5">
              <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-[#d13239]" : "bg-[#ff7a1a]"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px] font-extrabold">
                <span className="text-[#d13239]">
                  {c.maxSpots - c.filledSpots > 0
                    ? `${(c.maxSpots - c.filledSpots).toLocaleString("en-US")} spots left`
                    : "Contest Full"}
                </span>
                <span className="text-gray-500">
                  {c.maxSpots.toLocaleString("en-US")} spots
                </span>
              </div>
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/80 text-[10px] flex-wrap">
              <Badge icon="🏆" label={`1st $${firstPrize.toLocaleString("en-US")}`} />
              <Badge icon="👥" label={`${winnerCount || 1} Winner${winnerCount > 1 ? "s" : ""}`} />
              {c.maxSpots === 2 && <Badge icon="⚔️" label="H2H" />}
              {c.entryFee === 0 && <Badge icon="🎁" label="Free" />}
              {c.phase === "innings1" && <Badge icon="🏏" label="1st Inn" />}
              {c.phase === "innings2" && <Badge icon="🎯" label="2nd Inn" />}
              {c.phase === "powerplay" && <Badge icon="⚡" label="Powerplay" />}
            </div>

            {c.prizeBreakdown.length > 0 && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(c._id);
                }}
                className="w-full flex items-center justify-center gap-1 px-4 py-2.5 border-t border-gray-100 text-[#d13239] font-extrabold text-[11px] hover:bg-red-50/50 transition-colors uppercase tracking-wide"
              >
                {isExpanded ? "Hide" : "View"} Prize Breakup
                <ChevronDown
                  size={13}
                  strokeWidth={2.75}
                  className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>
            )}

            {isExpanded && c.prizeBreakdown.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-red-50/40">
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-[11px]">
                  <div className="font-extrabold text-gray-500 uppercase text-[9px] tracking-widest">Rank</div>
                  <div className="font-extrabold text-gray-500 uppercase text-[9px] text-right tracking-widest">Prize</div>
                  {c.prizeBreakdown.map((t, i) => (
                    <React.Fragment key={i}>
                      <div className="text-gray-800 font-bold">
                        #{t.rankFrom}
                        {t.rankTo > t.rankFrom ? ` – #${t.rankTo}` : ""}
                      </div>
                      <div className="text-gray-900 font-extrabold text-right">
                        ${t.prize.toLocaleString("en-US")}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function Badge({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2 py-0.5 font-extrabold text-gray-700 text-[10px]">
      <span className="text-[10px]">{icon}</span>
      {label}
    </span>
  );
}

function MyTeamsList({
  teams,
  matchId,
  disabled,
}: {
  teams: any[];
  matchId: number;
  disabled: boolean;
}) {
  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <Users size={32} className="text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-gray-900 font-extrabold text-sm mb-1">No teams created yet</p>
        <p className="text-gray-500 text-xs mb-4">Create your first dream team to start playing</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-24">
      {teams.map((team) => {
        const captain = team.players?.find((p: any) => p.playerId === team.captainId);
        const viceCaptain = team.players?.find((p: any) => p.playerId === team.viceCaptainId);
        const roleCounts: Record<string, number> = {};
        for (const p of team.players || []) roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;

        return (
          <Link
            key={team._id}
            href={`/fantasy/match/${matchId}/team/${team._id}`}
            className="block bg-white rounded-xl border border-gray-200 hover:border-[#d13239]/40 transition-all overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <span className="text-gray-900 font-extrabold text-sm tracking-tight">
                {team.teamName}
              </span>
              <span className="text-[10px] font-extrabold text-[#d13239] bg-red-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                {team.players?.length || 0} Players
              </span>
            </div>
            <div className="px-4 py-3">
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div className="bg-[#fff4f4] border border-red-200 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] font-extrabold uppercase text-[#d13239] tracking-widest">
                      Captain
                    </p>
                    <span className="text-[8px] font-extrabold bg-[#d13239] text-white px-1 py-[1px] rounded tracking-wide">
                      2x
                    </span>
                  </div>
                  <p className="text-gray-900 font-extrabold text-xs truncate tracking-tight">
                    {captain?.name || "—"}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] font-extrabold uppercase text-amber-700 tracking-widest">
                      Vice Captain
                    </p>
                    <span className="text-[8px] font-extrabold bg-amber-500 text-white px-1 py-[1px] rounded tracking-wide">
                      1.5x
                    </span>
                  </div>
                  <p className="text-gray-900 font-extrabold text-xs truncate tracking-tight">
                    {viceCaptain?.name || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-3">
                  <RoleCount label="WK" count={roleCounts.keeper || 0} />
                  <RoleCount label="BAT" count={roleCounts.batsman || 0} />
                  <RoleCount label="AR" count={roleCounts.allrounder || 0} />
                  <RoleCount label="BOWL" count={roleCounts.bowler || 0} />
                </div>
                <ChevronRight size={15} className="text-gray-300" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function RoleCount({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-400 font-extrabold text-[9px] tracking-wide">{label}</span>
      <span className="text-gray-900 font-extrabold text-[11px]">{count}</span>
    </div>
  );
}

function MyWinningsList({ entries }: { entries: any[] }) {
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <Award size={32} className="text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-gray-900 font-extrabold text-sm mb-1">No contests joined yet</p>
        <p className="text-gray-500 text-xs">Your winnings will appear here after you join contests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-24">
      {entries.map((e) => {
        const isWon = e.winnings > 0;
        const isSettled = e.status === "settled";
        return (
          <div key={e._id} className="bg-white rounded-xl border border-gray-200 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase text-gray-500 truncate tracking-wide">
                {e.contest?.title || "Contest"}
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide ${
                  isWon
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : isSettled
                      ? "bg-red-50 text-[#d13239] border border-red-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {isWon ? "WON" : isSettled ? "LOST" : "LIVE"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Rank</p>
                <p className="text-gray-900 font-extrabold text-sm tracking-tight">
                  {e.rank > 0 ? `#${e.rank.toLocaleString("en-US")}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Entry</p>
                <p className="text-gray-900 font-extrabold text-sm tracking-tight">
                  ${e.entryFee}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 text-right font-bold uppercase tracking-wide">
                  {isWon ? "Winnings" : isSettled ? "Result" : "Status"}
                </p>
                <p
                  className={`font-extrabold text-sm text-right tracking-tight ${
                    isWon ? "text-green-600" : isSettled ? "text-[#d13239]" : "text-amber-600"
                  }`}
                >
                  {isWon ? `+$${e.winnings}` : isSettled ? "No win" : "Live"}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
