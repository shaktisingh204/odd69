"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Crown, Loader2, Star, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import CricketField, { FieldPlayer } from "@/components/fantasy/CricketField";
import { fantasyFont } from "@/components/fantasy/fantasyFont";

export default function TeamPreviewPage() {
  const router = useRouter();
  const { id, teamId } = useParams<{ id: string; teamId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [team, setTeam] = useState<any>(null);
  const [teamA, setTeamA] = useState<any>(null);
  const [teamB, setTeamB] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!id || !teamId) return;
    (async () => {
      try {
        const [teamsRes, squadsRes] = await Promise.all([
          api.get(`/fantasy/my-teams/${id}`),
          api.get(`/fantasy/matches/${id}/squads`),
        ]);
        const found = (teamsRes.data || []).find((t: any) => t._id === teamId);
        setTeam(found || null);
        setTeamA(squadsRes.data?.teamA);
        setTeamB(squadsRes.data?.teamB);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [id, teamId]);

  if (authLoading || loading) {
    return (
      <div className={`${fantasyFont.className} h-screen flex items-center justify-center bg-[#f5f6f8]`}>
        <Loader2 className="w-7 h-7 animate-spin text-[#d13239]" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className={`${fantasyFont.className} min-h-screen bg-[#f5f6f8] flex items-center justify-center p-6`}>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-900 font-extrabold mb-2 tracking-tight">Team not found</p>
          <button
            onClick={() => router.back()}
            className="text-[#d13239] font-extrabold text-sm"
          >
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  const fieldPlayers: FieldPlayer[] = (team.players || []).map((p: any) => ({
    playerId: p.playerId,
    name: p.name,
    role: p.role,
    teamId: p.teamId,
    credit: p.credit,
    isCaptain: p.isCaptain,
    isViceCaptain: p.isViceCaptain,
  }));

  const roleCounts: Record<string, number> = {};
  for (const p of team.players || []) roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;

  const captain = team.players?.find((p: any) => p.isCaptain);
  const viceCaptain = team.players?.find((p: any) => p.isViceCaptain);

  return (
    <div className={`${fantasyFont.className} min-h-screen bg-gradient-to-b from-[#1a1f3a] via-[#151a32] to-[#0f1428]`}>
      {/* Top bar — Dream11 red */}
      <div className="bg-gradient-to-b from-[#d13239] to-[#b32028] shadow-lg shadow-[#d13239]/20 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-extrabold text-[15px] tracking-tight">{team.teamName}</p>
            <p className="text-white/80 text-[11px] font-semibold">
              {team.players?.length || 0} players · formation {roleCounts.keeper || 0}-{roleCounts.batsman || 0}-{roleCounts.allrounder || 0}-{roleCounts.bowler || 0}
            </p>
          </div>
          <Link
            prefetch
            href={`/fantasy/match/${id}/create`}
            className="text-white font-extrabold text-[11px] px-4 py-2 rounded-md bg-white/15 hover:bg-white/25 uppercase tracking-wide"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Role count strip */}
      <div className="bg-black/25 backdrop-blur-sm py-2.5 border-b border-white/10">
        <div className="max-w-3xl mx-auto px-3 flex items-center justify-around text-white">
          <RoleStat label="WK" count={roleCounts.keeper || 0} />
          <RoleStat label="BAT" count={roleCounts.batsman || 0} />
          <RoleStat label="AR" count={roleCounts.allrounder || 0} />
          <RoleStat label="BOWL" count={roleCounts.bowler || 0} />
        </div>
      </div>

      {/* Cricket field */}
      <div className="px-3 pt-4 pb-6">
        <CricketField
          players={fieldPlayers}
          teamA={teamA}
          teamB={teamB}
          showCredits
        />
      </div>

      {/* Bottom info cards */}
      <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] min-h-[40vh] pb-10">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <div className="bg-gradient-to-br from-[#fff4f4] to-[#ffe8e8] border border-red-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Crown size={13} className="text-[#d13239]" />
                <p className="text-[9px] font-extrabold uppercase text-[#d13239] tracking-widest">Captain</p>
                <span className="ml-auto text-[9px] font-extrabold bg-[#d13239] text-white px-1.5 py-[1px] rounded tracking-wide">
                  2x
                </span>
              </div>
              <p className="text-gray-900 font-extrabold text-sm truncate tracking-tight">{captain?.name || "—"}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Star size={13} className="text-amber-700" />
                <p className="text-[9px] font-extrabold uppercase text-amber-700 tracking-widest">Vice Captain</p>
                <span className="ml-auto text-[9px] font-extrabold bg-amber-500 text-white px-1.5 py-[1px] rounded tracking-wide">
                  1.5x
                </span>
              </div>
              <p className="text-gray-900 font-extrabold text-sm truncate tracking-tight">{viceCaptain?.name || "—"}</p>
            </div>
          </div>

          {/* Player list */}
          <h3 className="text-gray-900 font-extrabold text-base mb-2 tracking-tight">Squad Details</h3>
          <div className="divide-y divide-gray-100">
            {(team.players || []).map((p: any) => {
              const teamShort =
                p.teamId === teamA?.id ? teamA?.short : teamB?.short;
              return (
                <div key={p.playerId} className="flex items-center gap-3 py-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-b from-gray-100 to-gray-200 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                    <Users size={15} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-gray-900 font-extrabold text-[13px] truncate tracking-tight">{p.name}</p>
                      {p.isCaptain && (
                        <span className="text-[8px] font-extrabold text-white bg-[#d13239] px-1.5 py-px rounded tracking-wide">
                          C · 2x
                        </span>
                      )}
                      {p.isViceCaptain && (
                        <span className="text-[8px] font-extrabold text-white bg-amber-500 px-1.5 py-px rounded tracking-wide">
                          VC · 1.5x
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-[10px] font-bold capitalize mt-0.5">
                      {p.role} · {teamShort || "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleStat({ label, count }: { label: string; count: number | string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-extrabold text-white/60 uppercase tracking-widest">{label}</span>
      <span className="text-sm font-extrabold text-white tracking-tight">{count}</span>
    </div>
  );
}
