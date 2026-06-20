"use client";

import { Play } from "lucide-react";
import type { Game } from "./data";

export default function GameCard({ game }: { game: Game }) {
  return (
    <div className="group relative cursor-pointer">
      <div
        className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-white/[0.06] transition-transform duration-300 group-hover:-translate-y-1.5"
        style={{ background: `linear-gradient(160deg, ${game.from} 0%, ${game.to} 100%)` }}
      >
        {/* soft light + sheen */}
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: "inset 0 0 0 2px rgba(255,122,26,0.8)" }} />

        {/* bottom scrim + labels */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="text-base font-extrabold uppercase leading-[1.05] tracking-tight text-white drop-shadow">{game.name}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/50">{game.provider}</p>
        </div>

        {/* hover play */}
        <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full text-white shadow-lg" style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}>
            <Play className="h-5 w-5" fill="currentColor" strokeWidth={0} />
          </span>
        </div>
      </div>
    </div>
  );
}
