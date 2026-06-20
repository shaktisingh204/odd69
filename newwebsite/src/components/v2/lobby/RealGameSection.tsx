"use client";

import { useEffect, useState } from "react";
import { Star, ChevronRight } from "lucide-react";
import { casinoService } from "@/services/casino";
import GameCard from "./GameCard";

// section -> getGames category fallback when the admin-curated section is empty.
const CATEGORY_FALLBACK: Record<string, string | undefined> = {
  popular: undefined,
  new: "new",
  slots: "slots",
  live: "live",
  table: "table",
  crash: "crash",
};

export default function RealGameSection({ title, section, href = "/casino" }: { title: string; section: string; href?: string }) {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let g = await casinoService.getSectionGames(section);
        if (!g || g.length === 0) {
          const res = await casinoService.getGames(undefined, CATEGORY_FALLBACK[section], undefined, 1, 18);
          g = res.games || [];
        }
        if (alive) setGames(g.slice(0, 18));
      } catch {
        if (alive) setGames([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [section]);

  if (!loading && games.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Star className="h-4 w-4 text-[#ff7a1a]" fill="currentColor" strokeWidth={0} />
          {title}
        </h2>
        <a href={href} className="flex items-center gap-1 text-sm font-semibold text-white/55 transition-colors hover:text-white">
          View all <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
        </a>
      </div>
      {/* single horizontal line of games (scrollable); fixed-width tiles */}
      <div className="v2-no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] w-[112px] shrink-0 snap-start rounded-2xl skeleton-block sm:w-[132px] lg:w-[152px]" />
            ))
          : games.map((g, i) => (
              <div key={g.id || g.gameCode || i} className="w-[112px] shrink-0 snap-start sm:w-[132px] lg:w-[152px]">
                <GameCard game={g} />
              </div>
            ))}
      </div>
    </section>
  );
}
