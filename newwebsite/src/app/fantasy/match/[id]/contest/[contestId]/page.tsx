"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Crown,
  Loader2,
  Lock,
  Star,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FantasyShell from "@/components/fantasy/FantasyShell";
import CricketField, {
  CricketFieldTeam,
  FieldPlayer,
} from "@/components/fantasy/CricketField";
import api from "@/services/api";

interface Contest {
  _id: string;
  matchId: number;
  title: string;
  type: string;
  entryFee: number;
  totalPrize: number;
  maxSpots: number;
  filledSpots: number;
  prizeBreakdown: Array<{ rankFrom: number; rankTo: number; prize: number }>;
  multiEntry?: number;
  isGuaranteed?: boolean;
  isSettled?: boolean;
}

interface EntryTeamPlayer {
  playerId: number;
  name: string;
  role: string;
  teamId: number;
  credit?: number;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
}

interface EntryTeam {
  _id?: string;
  teamName: string;
  captainId?: number;
  viceCaptainId?: number;
  players?: EntryTeamPlayer[];
}

interface Entry {
  _id: string;
  userId: number;
  teamId: string;
  rank: number;
  totalPoints: number;
  winnings: number;
  status: string;
  username?: string;
  team?: EntryTeam;
  teamsVisible?: boolean;
}

export default function ContestDetailPage() {
  const router = useRouter();
  const { id, contestId } = useParams<{ id: string; contestId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [leaderboard, setLeaderboard] = useState<Entry[]>([]);
  const [teamA, setTeamA] = useState<CricketFieldTeam | null>(null);
  const [teamB, setTeamB] = useState<CricketFieldTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"leaderboard" | "prizes">("leaderboard");
  const [viewEntry, setViewEntry] = useState<Entry | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!id || !contestId) return;
    (async () => {
      setLoading(true);
      const [contestsRes, lbRes, squadsRes] = await Promise.all([
        api.get(`/fantasy/matches/${id}/contests`).catch(() => null),
        api
          .get(`/fantasy/contests/${contestId}/leaderboard`, {
            params: { limit: 100 },
          })
          .catch(() => null),
        api.get(`/fantasy/matches/${id}/squads`).catch(() => null),
      ]);
      const found = (contestsRes?.data || []).find(
        (c: Contest) => c._id === contestId,
      );
      setContest(found || null);
      setLeaderboard(lbRes?.data || []);
      setTeamA(squadsRes?.data?.teamA || null);
      setTeamB(squadsRes?.data?.teamB || null);
      setLoading(false);
    })();
  }, [id, contestId]);

  const teamsVisible = useMemo(
    () => leaderboard.some((e) => e.teamsVisible),
    [leaderboard],
  );

  const pct = contest
    ? Math.round((contest.filledSpots / contest.maxSpots) * 100)
    : 0;
  const topPrize = contest?.prizeBreakdown?.[0]?.prize ?? contest?.totalPrize ?? 0;

  if (authLoading || !user)
    return (
      <div className="h-screen flex items-center justify-center bg-[#f5f6f8] text-gray-400 text-sm">
        Loading...
      </div>
    );

  return (
    <FantasyShell
      title={contest?.title || "Contest"}
      subtitle={contest?.type}
      backHref={`/fantasy/match/${id}`}
      hideSubNav
    >
      {loading || !contest ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#d13239]" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">
                  Prize Pool
                </p>
                <p className="text-3xl font-black text-[#d13239]">
                  ${contest.totalPrize.toLocaleString("en-US")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">
                  Entry
                </p>
                <p className="text-2xl font-black text-gray-900">
                  {contest.entryFee === 0 ? "FREE" : `$${contest.entryFee}`}
                </p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#d13239] to-orange-400"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] mt-1.5">
              <span className="text-emerald-600 font-bold">
                {contest.maxSpots - contest.filledSpots} spots left
              </span>
              <span className="text-gray-400 font-semibold">
                {contest.filledSpots}/{contest.maxSpots}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-black uppercase tracking-widest">
              <Chip
                icon={Crown}
                text={`1st $${topPrize.toLocaleString("en-US")}`}
              />
              <Chip
                icon={Users}
                text={`${contest.multiEntry || 1}x entries`}
              />
              {contest.isGuaranteed && <Chip icon={Target} text="Guaranteed" />}
            </div>
          </div>

          <div className="flex gap-2">
            {(["leaderboard", "prizes"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                  tab === t
                    ? "bg-[#d13239] text-white shadow-md"
                    : "bg-white text-gray-500 border border-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "leaderboard" ? (
            <>
              {!teamsVisible && leaderboard.length > 0 && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-800 text-[11px] font-extrabold">
                  <Lock size={13} />
                  Rival teams unlock once the match starts.
                </div>
              )}
              {leaderboard.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center text-gray-400 text-sm">
                  No entries yet. Be the first to join!
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {leaderboard.map((e, i) => {
                    const isMe = user && Number(user.id) === e.userId;
                    const canView = teamsVisible && !!e.team?.players?.length;
                    return (
                      <button
                        key={e._id}
                        onClick={() => {
                          if (canView) setViewEntry(e);
                        }}
                        disabled={!canView}
                        className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-colors text-left ${
                          isMe ? "bg-[#d13239]/5" : ""
                        } ${canView ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"}`}
                      >
                        <span className="w-8 text-gray-500 font-mono text-xs">
                          #{e.rank || i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 font-extrabold text-sm truncate">
                            {e.username || `Player #${e.userId}`}
                            {isMe && (
                              <span className="ml-1 text-[#d13239]">(you)</span>
                            )}
                          </p>
                          {e.team?.teamName && (
                            <p className="text-[11px] text-gray-500 font-bold truncate">
                              {e.team.teamName}
                            </p>
                          )}
                        </div>
                        {e.winnings > 0 ? (
                          <span className="text-emerald-600 font-black text-sm">
                            +${e.winnings.toLocaleString("en-US")}
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                              e.status === "settled"
                                ? "bg-gray-100 text-gray-500"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {e.status === "settled" ? "—" : "Live"}
                          </span>
                        )}
                        {canView ? (
                          <span className="text-[#d13239]">
                            <Users size={15} strokeWidth={2.5} />
                          </span>
                        ) : !teamsVisible ? (
                          <Lock size={13} className="text-gray-300" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {(contest.prizeBreakdown || []).length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">
                  Winner takes ${contest.totalPrize.toLocaleString("en-US")}.
                </div>
              ) : (
                contest.prizeBreakdown.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0"
                  >
                    <span className="w-16 text-gray-500 font-mono text-xs font-bold">
                      #{p.rankFrom}
                      {p.rankTo !== p.rankFrom ? `–${p.rankTo}` : ""}
                    </span>
                    <span className="flex-1 text-gray-900 font-extrabold text-sm">
                      Rank {p.rankFrom}
                      {p.rankTo !== p.rankFrom ? ` to ${p.rankTo}` : ""}
                    </span>
                    <span className="text-[#d13239] font-black text-base">
                      ${p.prize.toLocaleString("en-US")}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {viewEntry && (
        <EntryTeamModal
          entry={viewEntry}
          teamA={teamA}
          teamB={teamB}
          onClose={() => setViewEntry(null)}
        />
      )}
    </FantasyShell>
  );
}

function EntryTeamModal({
  entry,
  teamA,
  teamB,
  onClose,
}: {
  entry: Entry;
  teamA: CricketFieldTeam | null;
  teamB: CricketFieldTeam | null;
  onClose: () => void;
}) {
  const players = entry.team?.players || [];
  const fieldPlayers: FieldPlayer[] = players.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    role: p.role,
    teamId: p.teamId,
    credit: p.credit,
    isCaptain: p.isCaptain,
    isViceCaptain: p.isViceCaptain,
  }));

  const captain = players.find((p) => p.isCaptain);
  const viceCaptain = players.find((p) => p.isViceCaptain);
  const teamACount = teamA ? players.filter((p) => p.teamId === teamA.id).length : 0;
  const teamBCount = teamB ? players.filter((p) => p.teamId === teamB.id).length : 0;
  const roleCounts: Record<string, number> = {};
  for (const p of players) roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        className="relative w-full md:max-w-lg max-h-[92dvh] bg-gradient-to-b from-[#1a1f3a] via-[#151a32] to-[#0f1428] rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 bg-gradient-to-b from-[#d13239] to-[#b32028] px-4 py-3 flex items-center gap-3 text-white">
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-[10px] font-extrabold uppercase tracking-widest">
              Rank #{entry.rank || "—"} · {entry.username || `Player #${entry.userId}`}
            </p>
            <p className="text-white font-extrabold text-[15px] tracking-tight truncate">
              {entry.team?.teamName || "Team"}
            </p>
          </div>
          {entry.winnings > 0 && (
            <span className="text-emerald-300 font-extrabold text-sm">
              +${entry.winnings.toLocaleString("en-US")}
            </span>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {teamA && teamB && (
            <div className="flex items-center justify-center gap-3 px-4 pt-3 text-[11px] font-extrabold text-white">
              <span className="inline-flex items-center gap-1 bg-white/10 border border-white/15 rounded-full px-3 py-1">
                {teamA.short}
                <span className="text-amber-300">{teamACount}</span>
              </span>
              <span className="inline-flex items-center gap-1 bg-white/10 border border-white/15 rounded-full px-3 py-1">
                {teamB.short}
                <span className="text-amber-300">{teamBCount}</span>
              </span>
            </div>
          )}

          <div className="px-3 pt-3">
            <CricketField
              players={fieldPlayers}
              teamA={teamA || undefined}
              teamB={teamB || undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 px-4 pt-3">
            <div className="bg-[#fff4f4] border border-red-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Crown size={13} className="text-[#d13239]" />
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#d13239]">
                  Captain
                </p>
              </div>
              <p className="text-gray-900 font-extrabold text-sm truncate tracking-tight">
                {captain?.name || "—"}
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Star size={13} className="text-amber-700" />
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-700">
                  Vice Captain
                </p>
              </div>
              <p className="text-gray-900 font-extrabold text-sm truncate tracking-tight">
                {viceCaptain?.name || "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 px-4 py-3">
            <RoleTile label="WK" count={roleCounts.keeper || 0} />
            <RoleTile label="BAT" count={roleCounts.batsman || 0} />
            <RoleTile label="AR" count={roleCounts.allrounder || 0} />
            <RoleTile label="BOWL" count={roleCounts.bowler || 0} />
          </div>

          <div className="bg-white px-4 py-3 mt-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-2">
              Squad ({players.length})
            </p>
            <div className="divide-y divide-gray-100">
              {players.map((p) => {
                const teamShort =
                  p.teamId === teamA?.id ? teamA?.short : teamB?.short;
                return (
                  <div
                    key={p.playerId}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-[10px] font-extrabold">
                      {teamShort || "—"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-gray-900 font-extrabold text-[13px] truncate tracking-tight">
                          {p.name}
                        </p>
                        {p.isCaptain && (
                          <span className="text-[8px] font-extrabold text-[#d13239] bg-red-50 border border-red-200 px-1.5 py-px rounded tracking-wide">
                            C
                          </span>
                        )}
                        {p.isViceCaptain && (
                          <span className="text-[8px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-px rounded tracking-wide">
                            VC
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-[10px] font-bold capitalize">
                        {p.role}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleTile({ label, count }: { label: string; count: number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-center">
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-white/60">
        {label}
      </p>
      <p className="text-white font-extrabold text-lg tracking-tight">{count}</p>
    </div>
  );
}

function Chip({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
      <Icon size={10} /> {text}
    </span>
  );
}
