"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, Home, Gem, Star, History, Compass, Sparkles, Crown, Gift, Flame, Trophy, X,
} from "lucide-react";
import { useLayout } from "@/context/LayoutContext";

const MAIN = [
  { label: "Lobby", Icon: Home, href: "/v2", active: true },
  { label: "Providers", Icon: Gem, href: "/casino/providers" },
  { label: "Favourite", Icon: Star, href: "/casino?category=favourite" },
  { label: "Recent", Icon: History, href: "/casino?category=recent" },
];

const SLOTS = [
  { label: "All", Icon: Compass, href: "/casino" },
  { label: "Popular", Icon: Star, href: "/casino?category=popular" },
  { label: "New games", Icon: Sparkles, href: "/casino?category=new" },
  { label: "VIP", Icon: Crown, href: "/vip" },
  { label: "Buyback Bonuses", Icon: Gift, href: "/promotions" },
  { label: "High RTP", Icon: Flame, href: "/casino?category=high-rtp" },
  { label: "Jackpot", Icon: Trophy, href: "/casino?category=jackpot" },
];

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) { router.push(`/casino?search=${encodeURIComponent(q.trim())}`); onNavigate?.(); }
  };

  return (
    <div className="flex h-full w-[248px] flex-col bg-[#15110d]">
      <div className="v2-no-scrollbar flex-1 overflow-y-auto px-3 py-4">
        {/* GIFT / REWARDS */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "GIFT", icon: "gift", href: "/promotions", grad: "linear-gradient(150deg,#ff8a3d,#b23a00)" },
            { label: "REWARDS", icon: "trophy", href: "/vip", grad: "linear-gradient(150deg,#ffb43d,#a85f00)" },
          ].map((c) => (
            <Link key={c.label} href={c.href} onClick={onNavigate}
                  className="relative flex h-24 flex-col justify-end overflow-hidden rounded-2xl p-2.5 transition-transform hover:-translate-y-0.5"
                  style={{ background: c.grad }}>
              <div className="pointer-events-none absolute -right-2 -top-2 opacity-95">
                <Image src={`/odd69/icons-3d/${c.icon}.png`} alt="" aria-hidden="true" width={56} height={56} style={{ width: 56, height: 56 }} />
              </div>
              <span className="relative text-xs font-extrabold tracking-wide text-white drop-shadow">{c.label}</span>
            </Link>
          ))}
        </div>

        {/* search */}
        <form onSubmit={submit} className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0f0c09] px-3 py-2.5 focus-within:border-[#ff7a1a]/50">
          <Search className="h-4 w-4 text-white/35" strokeWidth={2.2} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for game..."
                 className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none" />
        </form>

        {/* main nav */}
        <nav className="mt-4 space-y-1">
          {MAIN.map((n) => (
            <Link key={n.label} href={n.href} onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    n.active
                      ? "bg-gradient-to-r from-[#ff7a1a]/20 to-transparent text-white"
                      : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                  }`}>
              <n.Icon className={`h-[18px] w-[18px] ${n.active ? "text-[#ff7a1a]" : ""}`} strokeWidth={2.2} />
              {n.label}
            </Link>
          ))}
        </nav>

        <p className="mt-5 px-3 text-[11px] font-bold uppercase tracking-wider text-white/30">All slots</p>
        <nav className="mt-2 space-y-1">
          {SLOTS.map((n) => (
            <Link key={n.label} href={n.href} onClick={onNavigate}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white">
              <n.Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {n.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* bottom actions */}
      <div className="grid grid-cols-2 gap-3 border-t border-white/[0.06] p-3">
        <Link href="/support" onClick={onNavigate} className="rounded-xl bg-white/[0.05] py-2.5 text-center text-sm font-bold text-white/80 hover:bg-white/[0.08]">Support</Link>
        <Link href="/support" onClick={onNavigate} className="rounded-xl bg-white/[0.05] py-2.5 text-center text-sm font-bold text-white/80 hover:bg-white/[0.08]">Call me</Link>
      </div>
    </div>
  );
}

export default function LobbySidebar() {
  const { isMobileSidebarOpen, closeMobileSidebar } = useLayout();

  return (
    <>
      {/* desktop column (in-flow) */}
      <aside className="hidden shrink-0 border-r border-white/[0.06] lg:block">
        <SidebarInner />
      </aside>

      {/* mobile / tablet drawer */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMobileSidebar} />
          <aside className="absolute left-0 top-0 h-full border-r border-white/[0.06] shadow-2xl">
            <button onClick={closeMobileSidebar} aria-label="Close menu" className="absolute -right-11 top-3 grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white">
              <X className="h-5 w-5" strokeWidth={2.4} />
            </button>
            <SidebarInner onNavigate={closeMobileSidebar} />
          </aside>
        </div>
      )}
    </>
  );
}
