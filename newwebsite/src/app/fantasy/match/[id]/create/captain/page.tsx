"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Loader2,
  Star,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { fantasyFont } from "@/components/fantasy/fantasyFont";

interface DraftPlayer {
  playerId: number;
  name: string;
  role: string;
  teamId: number;
  teamName: string;
  credit: number;
  image?: string;
  battingStyle?: string;
}

const STEPS = [
  { n: 1, label: "Contest" },
  { n: 2, label: "Team" },
  { n: 3, label: "C & VC" },
  { n: 4, label: "Preview" },
];

export default function CaptainSelectionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const contestId = search.get("contestId") || "";
  const { user, loading: authLoading } = useAuth();
  const [draft, setDraft] = useState<DraftPlayer[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [teamA, setTeamA] = useState<any>(null);
  const [teamB, setTeamB] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!id) return;
    const stored = sessionStorage.getItem(`fantasy:draft:${id}`);
    if (!stored) {
      router.replace(
        contestId
          ? `/fantasy/match/${id}/create?contestId=${contestId}`
          : `/fantasy/match/${id}/create`,
      );
      return;
    }
    try {
      setDraft(JSON.parse(stored));
    } catch {
      router.replace(`/fantasy/match/${id}/create`);
    }
    api
      .get(`/fantasy/matches/${id}/squads`)
      .then((res) => {
        setTeamA(res.data?.teamA);
        setTeamB(res.data?.teamB);
      })
      .catch(() => {});
  }, [id, contestId, router]);

  const teamACount = useMemo(
    () => (teamA ? draft.filter((p) => p.teamId === teamA?.id).length : 0),
    [draft, teamA],
  );
  const teamBCount = useMemo(
    () => (teamB ? draft.filter((p) => p.teamId === teamB?.id).length : 0),
    [draft, teamB],
  );

  const goPreview = () => {
    if (!captainId || !viceCaptainId) return;
    sessionStorage.setItem(
      `fantasy:captains:${id}`,
      JSON.stringify({ captainId, viceCaptainId }),
    );
    const next = contestId
      ? `/fantasy/match/${id}/create/preview?contestId=${contestId}`
      : `/fantasy/match/${id}/create/preview`;
    router.push(next);
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

  return (
    <div
      className={`${fantasyFont.className} min-h-dvh bg-gradient-to-b from-[#1a1f3a] via-[#151a32] to-[#0f1428] pb-[140px] md:pb-[100px]`}
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
              Choose Captain &amp; Vice Captain
            </p>
            <p className="text-white/80 text-[11px] font-semibold">
              {contestId
                ? "Step 3 of 4 · Tap C then VC"
                : "Tap C then VC for your team leaders"}
            </p>
          </div>
        </div>
        {contestId && (
          <div className="max-w-3xl mx-auto px-3 pb-2">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest">
              {STEPS.map((s, i) => {
                const active = s.n === 3;
                const done = s.n < 3;
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
        {/* Selection guidance */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div
            className={`rounded-xl p-3 border-2 transition-all ${
              captainId
                ? "bg-[#fff4f4] border-[#d13239]"
                : "bg-white/5 border-white/15 border-dashed"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Crown
                size={12}
                className={captainId ? "text-[#d13239]" : "text-white/50"}
              />
              <p
                className={`text-[9px] font-extrabold uppercase tracking-widest ${
                  captainId ? "text-[#d13239]" : "text-white/60"
                }`}
              >
                Captain
              </p>
              <span className={`text-[9px] font-extrabold px-1.5 py-[1px] rounded tracking-wide ${
                captainId ? "bg-[#d13239] text-white" : "bg-white/15 text-white/70"
              }`}>
                2x
              </span>
            </div>
            <p
              className={`font-extrabold text-sm mt-0.5 truncate tracking-tight ${
                captainId ? "text-gray-900" : "text-white/80"
              }`}
            >
              {draft.find((p) => p.playerId === captainId)?.name || "Pick one"}
            </p>
          </div>
          <div
            className={`rounded-xl p-3 border-2 transition-all ${
              viceCaptainId
                ? "bg-amber-50 border-amber-500"
                : "bg-white/5 border-white/15 border-dashed"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Star
                size={12}
                className={viceCaptainId ? "text-amber-700" : "text-white/50"}
              />
              <p
                className={`text-[9px] font-extrabold uppercase tracking-widest ${
                  viceCaptainId ? "text-amber-700" : "text-white/60"
                }`}
              >
                Vice Captain
              </p>
              <span className={`text-[9px] font-extrabold px-1.5 py-[1px] rounded tracking-wide ${
                viceCaptainId ? "bg-amber-500 text-white" : "bg-white/15 text-white/70"
              }`}>
                1.5x
              </span>
            </div>
            <p
              className={`font-extrabold text-sm mt-0.5 truncate tracking-tight ${
                viceCaptainId ? "text-gray-900" : "text-white/80"
              }`}
            >
              {draft.find((p) => p.playerId === viceCaptainId)?.name ||
                "Pick one"}
            </p>
          </div>
        </div>

        {/* Team counts */}
        {(teamA || teamB) && (
          <div className="flex items-center gap-2 mb-3">
            {teamA && (
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1 text-[11px] font-extrabold text-white">
                {teamA.short}
                <span className="text-amber-300">{teamACount}</span>
              </span>
            )}
            {teamB && (
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1 text-[11px] font-extrabold text-white">
                {teamB.short}
                <span className="text-amber-300">{teamBCount}</span>
              </span>
            )}
          </div>
        )}

        {/* Player table */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
          <div className="sticky top-0 z-20 bg-gray-50 px-4 py-2.5 flex items-center text-[10px] font-extrabold text-gray-500 uppercase border-b border-gray-200 tracking-widest">
            <span className="flex-1">Players ({draft.length})</span>
            <span className="w-10 text-center leading-tight">C<br/><span className="text-[8px] text-[#d13239]">2x</span></span>
            <span className="w-10 text-center leading-tight">VC<br/><span className="text-[8px] text-amber-600">1.5x</span></span>
          </div>
          <div className="divide-y divide-gray-100">
            {draft.map((p) => {
              const isC = captainId === p.playerId;
              const isVC = viceCaptainId === p.playerId;
              const teamShort =
                p.teamId === teamA?.id ? teamA?.short : teamB?.short;
              return (
                <div
                  key={p.playerId}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    isC ? "bg-red-50/70" : isVC ? "bg-amber-50/70" : ""
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-b from-gray-100 to-gray-200 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Users size={15} className="text-gray-500" />
                      )}
                    </div>
                    {teamShort && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-extrabold text-white bg-[#1a1f3a] px-1.5 py-0.5 rounded tracking-wide">
                        {teamShort}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-extrabold text-[13px] truncate tracking-tight">
                      {p.name}
                    </p>
                    <p className="text-gray-500 text-[10px] font-bold capitalize">
                      {p.role} · {p.teamName || ""}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (isC) setCaptainId(null);
                      else {
                        if (viceCaptainId === p.playerId) setViceCaptainId(null);
                        setCaptainId(p.playerId);
                      }
                    }}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-[13px] font-extrabold transition-all ${
                      isC
                        ? "bg-[#d13239] border-[#d13239] text-white scale-110 shadow-md shadow-[#d13239]/30"
                        : "bg-white border-gray-300 text-gray-400 hover:border-[#d13239] hover:text-[#d13239]"
                    }`}
                  >
                    C
                  </button>
                  <button
                    onClick={() => {
                      if (isVC) setViceCaptainId(null);
                      else {
                        if (captainId === p.playerId) setCaptainId(null);
                        setViceCaptainId(p.playerId);
                      }
                    }}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-[11px] font-extrabold transition-all ${
                      isVC
                        ? "bg-amber-500 border-amber-500 text-white scale-110 shadow-md shadow-amber-500/30"
                        : "bg-white border-gray-300 text-gray-400 hover:border-amber-500 hover:text-amber-600"
                    }`}
                  >
                    VC
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky next button */}
      <div className="fixed bottom-[64px] md:bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <button
            disabled={!captainId || !viceCaptainId}
            onClick={goPreview}
            className="w-full flex items-center justify-center gap-2 bg-[#d13239] hover:bg-[#a31923] disabled:bg-gray-300 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md shadow-[#d13239]/30 transition-all uppercase tracking-wide"
          >
            {!captainId
              ? "Pick a Captain"
              : !viceCaptainId
                ? "Pick a Vice Captain"
                : "Preview Team"}
            {captainId && viceCaptainId && (
              <ChevronRight size={16} strokeWidth={3} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
