"use client";

import { useMemo } from "react";
import { Crown, Star, Users } from "lucide-react";

export interface FieldPlayer {
  playerId: number;
  name: string;
  role: string;
  teamId: number;
  credit?: number;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  image?: string;
  teamShort?: string;
  isPlaying11?: boolean;
}

export interface CricketFieldTeam {
  id: number;
  short: string;
  name?: string;
  logo?: string;
  thumb?: string;
  color?: string;
}

interface CricketFieldProps {
  players: FieldPlayer[];
  teamA?: CricketFieldTeam;
  teamB?: CricketFieldTeam;
  showCredits?: boolean;
  interactive?: boolean;
  onPlayerClick?: (p: FieldPlayer) => void;
}

const ROLE_ORDER: Array<{ key: string; label: string }> = [
  { key: "keeper", label: "Wicket-Keeper" },
  { key: "batsman", label: "Batters" },
  { key: "allrounder", label: "All-Rounders" },
  { key: "bowler", label: "Bowlers" },
];

/**
 * Stadium-style cricket ground with role rows.
 * Top → bottom: WK, BAT, AR, BOWL. Oval boundary, 30-yard inner circle,
 * central pitch with stumps, subtle stripe texture.
 */
export default function CricketField({
  players,
  teamA,
  teamB,
  showCredits = false,
  interactive = false,
  onPlayerClick,
}: CricketFieldProps) {
  const byRole = useMemo(
    () => ({
      keeper: players.filter((p) => p.role === "keeper"),
      batsman: players.filter((p) => p.role === "batsman"),
      allrounder: players.filter((p) => p.role === "allrounder"),
      bowler: players.filter((p) => p.role === "bowler"),
    }),
    [players],
  );

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[4/5] select-none">
      {/* Stadium backdrop */}
      <div className="absolute inset-0 rounded-[46%] bg-gradient-to-b from-[#3aa14c] via-[#2e8c3e] to-[#1f6b2c] overflow-hidden shadow-2xl shadow-black/40">
        {/* Outer ring */}
        <div className="absolute inset-[2%] rounded-[46%] border-[3px] border-white/40" />
        {/* Inner 30-yard circle */}
        <div className="absolute inset-[24%] rounded-[50%] border-2 border-white/35" />
        {/* Mow-stripe texture */}
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent 0 22px, rgba(255,255,255,0.85) 22px 23px)",
          }}
        />
        {/* Corner shading */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(0,0,0,0.35)_100%)]" />
        {/* Central pitch */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[13%] h-[44%] bg-[#e4cc93] rounded-[2px] shadow-inner">
          <div className="absolute inset-0 bg-gradient-to-b from-[#f2dda8] via-[#e4cc93] to-[#c4a868]" />
          {/* Creases */}
          <div className="absolute top-[14%] left-0 right-0 h-[2px] bg-black/70" />
          <div className="absolute bottom-[14%] left-0 right-0 h-[2px] bg-black/70" />
          {/* Stumps top */}
          <div className="absolute top-[6%] left-1/2 -translate-x-1/2 flex gap-[1px]">
            <span className="w-[2px] h-[6px] bg-white rounded-sm" />
            <span className="w-[2px] h-[6px] bg-white rounded-sm" />
            <span className="w-[2px] h-[6px] bg-white rounded-sm" />
          </div>
          {/* Stumps bottom */}
          <div className="absolute bottom-[6%] left-1/2 -translate-x-1/2 flex gap-[1px]">
            <span className="w-[2px] h-[6px] bg-white rounded-sm" />
            <span className="w-[2px] h-[6px] bg-white rounded-sm" />
            <span className="w-[2px] h-[6px] bg-white rounded-sm" />
          </div>
        </div>
        {/* Floodlight glow */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-40 h-20 bg-white/10 blur-2xl rounded-full" />
      </div>

      {/* Role rows overlaid */}
      <div className="absolute inset-0 flex flex-col justify-between px-[5%] py-[9%]">
        {ROLE_ORDER.map((r) => (
          <RoleRow
            key={r.key}
            label={r.label}
            players={byRole[r.key as keyof typeof byRole] || []}
            teamA={teamA}
            teamB={teamB}
            showCredits={showCredits}
            onPlayerClick={interactive ? onPlayerClick : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function RoleRow({
  label,
  players,
  teamA,
  teamB,
  showCredits,
  onPlayerClick,
}: {
  label: string;
  players: FieldPlayer[];
  teamA?: CricketFieldTeam;
  teamB?: CricketFieldTeam;
  showCredits?: boolean;
  onPlayerClick?: (p: FieldPlayer) => void;
}) {
  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 min-h-[58px] justify-center">
        <span className="text-[8px] font-extrabold uppercase tracking-widest text-white/45">
          {label}
        </span>
        <span className="text-[9px] font-bold text-white/40">—</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[8px] md:text-[9px] font-extrabold uppercase tracking-widest text-white/80 drop-shadow">
        {label}
      </span>
      <div className="flex items-start justify-center gap-1.5 md:gap-2.5 flex-wrap w-full">
        {players.map((p) => {
          const teamShort =
            p.teamShort ||
            (p.teamId === teamA?.id ? teamA?.short : teamB?.short) ||
            "";
          const teamColor =
            p.teamId === teamA?.id
              ? teamA?.color || "#d13239"
              : teamB?.color || "#1a1f3a";
          return (
            <PlayerChip
              key={p.playerId}
              player={p}
              teamShort={teamShort}
              teamColor={teamColor}
              showCredits={showCredits}
              onClick={onPlayerClick ? () => onPlayerClick(p) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlayerChip({
  player,
  teamShort,
  teamColor,
  showCredits,
  onClick,
}: {
  player: FieldPlayer;
  teamShort: string;
  teamColor: string;
  showCredits?: boolean;
  onClick?: () => void;
}) {
  const parts = player.name.trim().split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");
  const displayName = lastName ? `${firstName.charAt(0)}. ${lastName}` : firstName;

  const isC = !!player.isCaptain;
  const isVC = !!player.isViceCaptain;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex flex-col items-center gap-0.5 max-w-[64px] md:max-w-[72px] group"
    >
      <div className="relative">
        {/* Jersey-style avatar with team color ring */}
        <div
          className="w-11 h-11 md:w-[52px] md:h-[52px] rounded-full bg-white shadow-[0_4px_10px_rgba(0,0,0,0.35)] overflow-hidden ring-[3px] flex items-center justify-center"
          style={{ boxShadow: `0 0 0 3px ${teamColor}, 0 4px 10px rgba(0,0,0,0.35)` }}
        >
          {player.image ? (
            <img
              src={player.image}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-gray-100 to-gray-300 flex items-center justify-center">
              <Users size={16} className="text-gray-500" />
            </div>
          )}
        </div>

        {/* Team short badge */}
        {teamShort && (
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-extrabold text-white px-1.5 py-[1px] rounded-sm tracking-wide shadow"
            style={{ background: teamColor }}
          >
            {teamShort}
          </span>
        )}

        {/* Captain / Vice-Captain crown with points multiplier */}
        {isC && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center gap-0.5 bg-[#d13239] text-white text-[9px] font-extrabold rounded-md px-1 py-[1px] border-2 border-white shadow-md">
            <Crown size={8} strokeWidth={3} /> C · 2x
          </span>
        )}
        {isVC && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center gap-0.5 bg-amber-500 text-white text-[9px] font-extrabold rounded-md px-1 py-[1px] border-2 border-white shadow-md">
            <Star size={8} strokeWidth={3} /> VC · 1.5x
          </span>
        )}
      </div>

      {/* Name plate */}
      <div
        className={`mt-2 rounded px-1.5 py-[2px] min-w-[52px] text-center shadow ${
          isC
            ? "bg-[#d13239]"
            : isVC
              ? "bg-amber-500"
              : "bg-gray-900/90 backdrop-blur-sm"
        }`}
      >
        <p className="text-white text-[9px] md:text-[10px] font-extrabold truncate leading-tight tracking-tight">
          {displayName}
        </p>
      </div>

      {/* Credit pill */}
      {showCredits && player.credit != null && (
        <span className="mt-0.5 bg-white/95 text-gray-900 text-[8px] font-extrabold px-1.5 py-[1px] rounded-full shadow-sm">
          {player.credit.toFixed(1)} Cr
        </span>
      )}
    </button>
  );
}
