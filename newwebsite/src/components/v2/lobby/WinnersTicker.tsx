"use client";

import { WINNERS } from "./data";

export default function WinnersTicker() {
  return (
    <div className="v2-no-scrollbar flex items-center gap-2.5 overflow-x-auto pb-1">
      {WINNERS.map((w) => (
        <div key={w.name} className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-[#1b1611] py-1.5 pl-1.5 pr-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: `linear-gradient(135deg,${w.c},#0e0b08)` }}>
            {w.name.slice(0, 2)}
          </span>
          <div className="leading-tight">
            <p className="text-xs font-semibold text-white/80">{w.name}</p>
            <p className="flex items-center gap-1 text-xs font-bold text-[#ffb43d]">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%,#ffe08a,#e0922a)" }} />
              {w.amount}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
