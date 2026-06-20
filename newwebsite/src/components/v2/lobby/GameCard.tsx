"use client";

import { useState } from "react";
import { Play } from "lucide-react";

// Real casino game card. game = mapped object from casinoService
// ({ id, gameName/name, provider/providerCode/providerSlug, gameCode, banner/image }).
export default function GameCard({ game }: { game: any }) {
  const [failed, setFailed] = useState(false);
  const img = game.banner || game.image;
  const name = game.gameName || game.name || "Game";
  const provider = (game.providerSlug || game.provider || game.providerCode || "").toString();

  const launch = () => {
    const prov = game.provider || game.providerCode || "";
    window.location.href = `/casino/play/${game.id}?provider=${encodeURIComponent(prov)}&name=${encodeURIComponent(name)}`;
  };

  return (
    <button onClick={launch} className="group relative block w-full cursor-pointer text-left">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-white/[0.06] transition-transform duration-300 group-hover:-translate-y-1.5"
           style={{ background: "linear-gradient(160deg,#3a2566,#160c2c)" }}>
        {img && !failed ? (
          <img src={img} alt={name} loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-3xl">🎮</div>
        )}

        {/* orange focus ring on hover */}
        <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: "inset 0 0 0 2px rgba(255,122,26,0.85)" }} />

        {/* label scrim */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <p className="truncate text-sm font-extrabold uppercase leading-tight text-white drop-shadow">{name}</p>
          {provider && <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-white/55">{provider}</p>}
        </div>

        {/* hover play */}
        <div className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full text-white shadow-lg" style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}>
            <Play className="h-5 w-5" fill="currentColor" strokeWidth={0} />
          </span>
        </div>
      </div>
    </button>
  );
}
