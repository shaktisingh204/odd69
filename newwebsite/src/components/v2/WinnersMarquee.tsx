"use client";

import { Trophy } from "lucide-react";
import { WINS } from "./data";

export default function WinnersMarquee() {
  const row = [...WINS, ...WINS];
  return (
    <section className="border-y border-white/[0.07] bg-white/[0.015] py-5">
      <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-4 md:px-6">
        <div className="hidden shrink-0 items-center gap-2 text-sm font-bold text-white/80 sm:flex">
          <Trophy className="h-4 w-4 text-[#fbbf24]" strokeWidth={2.4} />
          Live wins
        </div>
        <div className="v2-marquee-mask relative flex-1 overflow-hidden">
          <div className="v2-marquee-track flex w-max gap-3">
            {row.map((w, i) => (
              <div
                key={i}
                className="flex shrink-0 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-[#0b0712]"
                  style={{ backgroundImage: "linear-gradient(135deg,#ff2e9a,#22d3ee)" }}
                >
                  {w.name[0].toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-white/70">{w.name}</span>
                <span className="text-xs text-white/35">{w.game}</span>
                <span className="text-sm font-extrabold v2-grad-text">{w.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
