"use client";

import { Star } from "lucide-react";
import GameCard from "./GameCard";
import type { Game } from "./data";

export default function GameSection({ title, games, count }: { title: string; games: Game[]; count: string }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Star className="h-4 w-4 text-[#ff7a1a]" fill="currentColor" strokeWidth={0} />
          {title}
        </h2>
        <button className="flex items-center gap-2 text-sm font-semibold text-white/55 hover:text-white">
          View all
          <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}>{count}</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {games.map((g) => <GameCard key={g.name} game={g} />)}
      </div>
    </section>
  );
}
