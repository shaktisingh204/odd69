'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import Icon3D, { type Icon3DName } from './Icon3D';

/**
 * Portrait game tile — the standard "big gambling site" card used in the
 * horizontal category rows (Originals, Slots, Live Casino, …). Shows a real
 * cover image when available, otherwise a 3D icon fallback, with a play
 * button revealed on hover.
 */
export type GameTileData = {
  name: string;
  provider?: string;
  image?: string;
  tag?: string; // NEW / HOT …
  icon?: Icon3DName; // fallback when there is no cover image
  art?: string; // gradient for the icon fallback
  onClick?: () => void;
};

export default function GameTile({ game }: { game: GameTileData }) {
  const [failed, setFailed] = useState(false);
  const hasImg = !!game.image && !failed;

  return (
    <button
      type="button"
      onClick={game.onClick}
      className="odd69-press group relative aspect-[3/4] w-[132px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#15243a] shadow-[0_10px_24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1 hover:border-[#3b82f6]/40 md:w-[150px]"
    >
      {hasImg ? (
        <img
          src={game.image}
          alt={game.name}
          onError={() => setFailed(true)}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <span className={`absolute inset-0 grid place-items-center bg-gradient-to-br ${game.art ?? 'from-[#1d4ed8]/40 to-[#0b1a30]'}`}>
          <span className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_15%,rgba(86,166,255,0.22),transparent_60%)]" />
          <Icon3D name={game.icon ?? 'joystick'} size={60} glow float />
        </span>
      )}

      {/* tag badge */}
      {game.tag && (
        <span className="absolute left-2 top-2 z-10 rounded-md bg-[#ef4444] px-1.5 py-[1px] text-[8px] font-extrabold uppercase tracking-wide text-white shadow-[0_2px_6px_rgba(239,68,68,0.6)]">
          {game.tag}
        </span>
      )}

      {/* name + provider */}
      <span className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-2.5 text-left">
        <span className="block truncate text-[12px] font-bold leading-tight text-white">{game.name}</span>
        {game.provider && (
          <span className="block truncate text-[9.5px] font-semibold uppercase tracking-[0.03em] text-[#9fb2c9]">
            {game.provider}
          </span>
        )}
      </span>

      {/* play on hover */}
      <span className="absolute inset-0 z-20 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] shadow-[0_6px_18px_rgba(37,99,235,0.6)] transition-transform duration-300 group-hover:scale-110">
          <Play className="ml-0.5 h-5 w-5 text-white" fill="white" />
        </span>
      </span>
    </button>
  );
}
