"use client";

import Image from "next/image";
import { Search } from "lucide-react";
import { NAV_MAIN, NAV_SLOTS } from "./data";

export default function LobbySidebar() {
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-[#15110d]">
      <div className="v2-no-scrollbar flex-1 overflow-y-auto px-3 py-4">
        {/* GIFT / REWARDS */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "GIFT", icon: "gift", grad: "linear-gradient(150deg,#ff8a3d,#b23a00)" },
            { label: "REWARDS", icon: "trophy", grad: "linear-gradient(150deg,#ffb43d,#a85f00)" },
          ].map((c) => (
            <button key={c.label} className="relative flex h-24 flex-col justify-end overflow-hidden rounded-2xl p-2.5 text-left transition-transform hover:-translate-y-0.5" style={{ background: c.grad }}>
              <div className="pointer-events-none absolute -right-2 -top-2 opacity-90">
                <Image src={`/odd69/icons-3d/${c.icon}.png`} alt="" width={56} height={56} style={{ width: 56, height: 56 }} />
              </div>
              <span className="relative text-xs font-extrabold tracking-wide text-white drop-shadow">{c.label}</span>
            </button>
          ))}
        </div>

        {/* search */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0f0c09] px-3 py-2.5">
          <Search className="h-4 w-4 text-white/35" strokeWidth={2.2} />
          <input placeholder="Search for game..." className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none" />
        </div>

        {/* main nav */}
        <nav className="mt-4 space-y-1">
          {NAV_MAIN.map((n) => (
            <button
              key={n.label}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                n.active ? "bg-white/[0.06] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <n.Icon className={`h-[18px] w-[18px] ${n.active ? "text-[#ff7a1a]" : ""}`} strokeWidth={2.2} />
              {n.label}
            </button>
          ))}
        </nav>

        <p className="mt-5 px-3 text-[11px] font-bold uppercase tracking-wider text-white/30">All slots</p>
        <nav className="mt-2 space-y-1">
          {NAV_SLOTS.filter((n) => !n.hidden).map((n) => (
            <button key={n.label} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white">
              <n.Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {n.label}
            </button>
          ))}
        </nav>
      </div>

      {/* bottom actions */}
      <div className="grid grid-cols-2 gap-3 border-t border-white/[0.06] p-3">
        <button className="rounded-xl bg-white/[0.05] py-2.5 text-sm font-bold text-white/80 hover:bg-white/[0.08]">Support</button>
        <button className="rounded-xl bg-white/[0.05] py-2.5 text-sm font-bold text-white/80 hover:bg-white/[0.08]">Call me</button>
      </div>
    </aside>
  );
}
