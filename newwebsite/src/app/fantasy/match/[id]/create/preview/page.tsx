"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Loader2,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import CricketField, {
  CricketFieldTeam,
  FieldPlayer,
} from "@/components/fantasy/CricketField";
import { fantasyFont } from "@/components/fantasy/fantasyFont";

interface DraftPlayer {
  playerId: number;
  name: string;
  role: string;
  teamId: number;
  teamName: string;
  credit: number;
  image?: string;
}

interface Contest {
  _id: string;
  title: string;
  entryFee: number;
  totalPrize: number;
  maxSpots: number;
  filledSpots: number;
  prizeBreakdown: Array<{ rankFrom: number; rankTo: number; prize: number }>;
}

const STEPS = [
  { n: 1, label: "Contest" },
  { n: 2, label: "Team" },
  { n: 3, label: "C & VC" },
  { n: 4, label: "Preview" },
];

const ROLE_LABEL: Record<string, string> = {
  keeper: "WK",
  batsman: "BAT",
  allrounder: "AR",
  bowler: "BOWL",
};

export default function TeamPreviewCreatePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const contestId = search.get("contestId") || "";
  const { user, loading: authLoading } = useAuth();

  const [draft, setDraft] = useState<DraftPlayer[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [teamA, setTeamA] = useState<CricketFieldTeam | null>(null);
  const [teamB, setTeamB] = useState<CricketFieldTeam | null>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!id) return;
    const rawDraft = sessionStorage.getItem(`fantasy:draft:${id}`);
    const rawCaps = sessionStorage.getItem(`fantasy:captains:${id}`);
    if (!rawDraft || !rawCaps) {
      router.replace(
        contestId
          ? `/fantasy/match/${id}/create?contestId=${contestId}`
          : `/fantasy/match/${id}/create`,
      );
      return;
    }
    try {
      setDraft(JSON.parse(rawDraft));
      const caps = JSON.parse(rawCaps);
      setCaptainId(caps.captainId || null);
      setViceCaptainId(caps.viceCaptainId || null);
    } catch {
      router.replace(`/fantasy/match/${id}/create`);
    }
  }, [id, contestId, router]);

  const fetchExtras = useCallback(async () => {
    if (!id) return;
    try {
      const [squadsRes, contestsRes] = await Promise.all([
        api.get(`/fantasy/matches/${id}/squads`),
        contestId
          ? api.get(`/fantasy/matches/${id}/contests`).catch(() => null)
          : Promise.resolve(null),
      ]);
      setTeamA(squadsRes.data?.teamA || null);
      setTeamB(squadsRes.data?.teamB || null);
      if (contestsRes) {
        const found = (contestsRes.data || []).find(
          (c: Contest) => c._id === contestId,
        );
        if (found) setContest(found);
      }
    } catch {
      /* ignore */
    }
  }, [id, contestId]);

  useEffect(() => {
    if (!authLoading && user) fetchExtras();
  }, [authLoading, user, fetchExtras]);

  const fieldPlayers: FieldPlayer[] = useMemo(
    () =>
      draft.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        role: p.role,
        teamId: p.teamId,
        credit: p.credit,
        image: p.image,
        isCaptain: p.playerId === captainId,
        isViceCaptain: p.playerId === viceCaptainId,
      })),
    [draft, captainId, viceCaptainId],
  );

  const totals = useMemo(() => {
    const teamACount = teamA ? draft.filter((p) => p.teamId === teamA.id).length : 0;
    const teamBCount = teamB ? draft.filter((p) => p.teamId === teamB.id).length : 0;
    const roleCounts: Record<string, number> = {};
    for (const p of draft) roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
    const formation = `${roleCounts.keeper || 0}-${roleCounts.batsman || 0}-${
      roleCounts.allrounder || 0
    }-${roleCounts.bowler || 0}`;
    return { teamACount, teamBCount, roleCounts, formation };
  }, [draft, teamA, teamB]);

  const captain = draft.find((p) => p.playerId === captainId);
  const viceCaptain = draft.find((p) => p.playerId === viceCaptainId);

  const handleConfirm = async () => {
    if (!captainId || !viceCaptainId) return;
    setSubmitting(true);
    setErr("");
    try {
      const players = draft.map((p) => ({
        playerId: Number(p.playerId),
        name: String(p.name),
        role: String(p.role),
        teamId: Number(p.teamId),
        credit: Number(p.credit),
        isCaptain: p.playerId === captainId,
        isViceCaptain: p.playerId === viceCaptainId,
      }));
      const res = await api.post("/fantasy/teams", {
        matchId: Number(id),
        players,
      });
      const newTeamId = res.data?._id;

      if (contestId && newTeamId) {
        try {
          await api.post("/fantasy/join-contest", {
            contestId,
            teamId: newTeamId,
            matchId: Number(id),
          });
        } catch (e: any) {
          setErr(
            e?.response?.data?.message ||
              "Team saved but could not join contest.",
          );
          setSubmitting(false);
          return;
        }
      }

      sessionStorage.removeItem(`fantasy:draft:${id}`);
      sessionStorage.removeItem(`fantasy:captains:${id}`);
      router.replace(`/fantasy/match/${id}`);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to save team");
      setSubmitting(false);
    }
  };

  if (authLoading || !user || draft.length === 0) {
    return (
      <div
        className={`${fantasyFont.className} h-screen flex items-center justify-center bg-[#f5f6f8]`}
      >
        <Loader2 className="w-7 h-7 animate-spin text-[#d13239]" />
      </div>
    );
  }

  const teamAColor = teamA?.color || "#d13239";
  const teamBColor = teamB?.color || "#1a1f3a";
  const maxCount = Math.max(totals.teamACount, totals.teamBCount, 1);

  return (
    <div
      className={`${fantasyFont.className} min-h-dvh bg-gradient-to-b from-[#1a1f3a] via-[#151a32] to-[#0f1428] pb-[120px] md:pb-[100px]`}
    >
      {/* Top bar */}
      <div className="bg-gradient-to-b from-[#d13239] to-[#b32028] shadow-lg shadow-[#d13239]/20 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-extrabold text-[15px] tracking-tight">
              Team Preview
            </p>
            <p className="text-white/80 text-[11px] font-semibold">
              {contestId
                ? "Step 4 of 4 · Review & join contest"
                : "Review and save your team"}
            </p>
          </div>
        </div>
        {contestId && (
          <div className="max-w-3xl mx-auto px-3 pb-2">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest">
              {STEPS.map((s, i) => {
                const active = s.n === 4;
                const done = s.n < 4;
                return (
                  <div key={s.n} className="flex-1 flex items-center">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                          done
                            ? "bg-green-500 text-white"
                            : active
                              ? "bg-white text-[#d13239]"
                              : "bg-white/15 text-white/60"
                        }`}
                      >
                        {done ? <Check size={10} strokeWidth={3} /> : s.n}
                      </span>
                      <span
                        className={
                          active
                            ? "text-white"
                            : done
                              ? "text-white/80"
                              : "text-white/50"
                        }
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="flex-1 h-[2px] mx-1.5 bg-white/15 rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-3 pt-4">
        {/* Team split strip (team A vs team B) */}
        {teamA && teamB && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-3 mb-3">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-white/70 mb-2">
              <span>Team split</span>
              <span className="text-white/50">{draft.length} players</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="w-2 h-8 rounded-full"
                  style={{ background: teamAColor }}
                />
                <div>
                  <p className="text-white font-extrabold text-sm tracking-tight">
                    {teamA.short}
                  </p>
                  <p className="text-white/60 text-[10px] font-bold">
                    {totals.teamACount} players
                  </p>
                </div>
              </div>
              <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden flex">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${(totals.teamACount / 11) * 100}%`,
                    background: teamAColor,
                  }}
                />
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${(totals.teamBCount / 11) * 100}%`,
                    background: teamBColor,
                  }}
                />
              </div>
              <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                <div className="text-right">
                  <p className="text-white font-extrabold text-sm tracking-tight">
                    {teamB.short}
                  </p>
                  <p className="text-white/60 text-[10px] font-bold">
                    {totals.teamBCount} players
                  </p>
                </div>
                <span
                  className="w-2 h-8 rounded-full"
                  style={{ background: teamBColor }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Cricket ground preview */}
        <div className="mb-3">
          <CricketField
            players={fieldPlayers}
            teamA={teamA || undefined}
            teamB={teamB || undefined}
          />
        </div>

        {/* Formation + role breakdown */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          {(["keeper", "batsman", "allrounder", "bowler"] as const).map((r) => (
            <div
              key={r}
              className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-center"
            >
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-white/60">
                {ROLE_LABEL[r]}
              </p>
              <p className="text-white font-extrabold text-lg tracking-tight">
                {totals.roleCounts[r] || 0}
              </p>
            </div>
          ))}
          <div className="bg-amber-500/15 border border-amber-400/30 rounded-xl px-2 py-2 text-center">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-300">
              XI
            </p>
            <p className="text-amber-200 font-extrabold text-lg tracking-tight">
              {totals.formation}
            </p>
          </div>
        </div>

        {/* Captain + Vice captain cards */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gradient-to-br from-[#fff4f4] to-[#ffe8e8] border border-red-200 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Crown size={14} className="text-[#d13239]" />
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#d13239]">
                Captain
              </p>
              <span className="ml-auto text-[9px] font-extrabold bg-[#d13239] text-white px-1.5 py-[1px] rounded tracking-wide">
                2x
              </span>
            </div>
            <p className="text-gray-900 font-extrabold text-sm truncate tracking-tight">
              {captain?.name || "—"}
            </p>
            <p className="text-gray-500 text-[10px] font-bold capitalize mt-0.5">
              {captain?.role} · {captain?.teamName}
            </p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Star size={14} className="text-amber-700" />
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-700">
                Vice Captain
              </p>
              <span className="ml-auto text-[9px] font-extrabold bg-amber-500 text-white px-1.5 py-[1px] rounded tracking-wide">
                1.5x
              </span>
            </div>
            <p className="text-gray-900 font-extrabold text-sm truncate tracking-tight">
              {viceCaptain?.name || "—"}
            </p>
            <p className="text-gray-500 text-[10px] font-bold capitalize mt-0.5">
              {viceCaptain?.role} · {viceCaptain?.teamName}
            </p>
          </div>
        </div>

        {/* Contest summary (if joining) */}
        {contest && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-widest">
                  Joining contest
                </p>
                <p className="text-gray-900 font-extrabold text-sm truncate tracking-tight">
                  {contest.title}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] font-extrabold text-gray-600">
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <Trophy size={10} /> $
                    {contest.totalPrize.toLocaleString("en-US")}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="inline-flex items-center gap-1 text-gray-700">
                    <Users size={10} />
                    {contest.maxSpots - contest.filledSpots} spots left
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-widest">
                  Entry
                </p>
                <p className="text-[#d13239] font-extrabold text-2xl tracking-tight">
                  {contest.entryFee === 0 ? "FREE" : `$${contest.entryFee}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {err && (
          <p className="text-red-300 font-extrabold text-sm mb-2">{err}</p>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-[64px] md:bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0 hidden sm:block">
            <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-widest">
              Squad Size
            </p>
            <p className="text-gray-900 font-extrabold text-sm tracking-tight">
              {draft.length} / 11 · {totals.formation}
            </p>
          </div>
          <button
            disabled={submitting || !captainId || !viceCaptainId}
            onClick={handleConfirm}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#d13239] hover:bg-[#a31923] disabled:bg-gray-300 text-white font-extrabold text-sm py-3.5 px-6 rounded-xl shadow-md shadow-[#d13239]/30 transition-all uppercase tracking-wide"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : contest ? (
              <>
                Join Contest
                {contest.entryFee > 0 ? ` · $${contest.entryFee}` : " · FREE"}
                <ChevronRight size={16} strokeWidth={3} />
              </>
            ) : (
              <>
                Save Team
                <Check size={16} strokeWidth={3} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
