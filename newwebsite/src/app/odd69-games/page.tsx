"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { Bomb, ChevronRight, CircleDot, Coins, Crown, Disc3, Hash, Layers, Lock, Plane, RefreshCcw, Target, Tickets, TrendingUp, Zap, Star } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useOriginalsAccess } from "@/hooks/useOriginalsAccess";

const ORIGINALS_GAMES = [
  {
    id: "mines",
    name: "ODD69 Mines",
    description: "Reveal gems, dodge mines. Cash out before it explodes.",
    icon: <Bomb size={48} />,
    href: "/odd69-games/mines",
    badge: "NEW",
    badgeColor: "bg-green-500",
    gradient: "from-[#1a3a1a] via-[#0d2e1a] to-[#0d1a0d]",
    accentColor: "#4ade80",
    glowColor: "rgba(74,222,128,0.3)",
    available: true,
  },
  {
    id: "crash",
    name: "ODD69 Crash",
    description: "Watch the multiplier soar. Cash out at the right moment.",
    icon: <Zap size={48} />,
    href: "/odd69-games/crash",
    badge: "LIVE",
    badgeColor: "bg-orange-500",
    gradient: "from-[#2a1a00] via-[#1a1000] to-[#0d0a00]",
    accentColor: "#ff7a1a",
    glowColor: "rgba(251,146,60,0.3)",
    available: true,
  },
  {
    id: "dice",
    name: "ODD69 Dice",
    description: "Roll the dice. Beat the threshold. Win big.",
    icon: <Star size={48} />,
    href: "/odd69-games/dice",
    badge: "LIVE",
    badgeColor: "bg-orange-500",
    gradient: "from-[#1a0a2e] via-[#100a22] to-[#0a0614]",
    accentColor: "#ff9a3d",
    glowColor: "rgba(255, 154, 61,0.3)",
    available: true,
  },
  {
    id: "limbo",
    name: "ODD69 Limbo",
    description: "Watch the multiplier soar. Cash out before the plane flies away!",
    icon: <Plane size={48} />,
    href: "/odd69-games/limbo",
    badge: "LIVE",
    badgeColor: "bg-orange-500",
    gradient: "from-[#0d0e2a] via-[#0a0c22] to-[#050714]",
    accentColor: "#818cf8",
    glowColor: "rgba(129,140,248,0.3)",
    available: true,
  },
  {
    id: "plinko",
    name: "ODD69 Plinko",
    description: "Drop the ball and chase riskier multiplier slots.",
    icon: <Target size={48} />,
    href: "/odd69-games/plinko",
    badge: "LIVE",
    badgeColor: "bg-amber-500",
    gradient: "from-[#2b1705] via-[#1b1206] to-[#100904]",
    accentColor: "#ff9a3d",
    glowColor: "rgba(255, 154, 61,0.22)",
    available: true,
  },
  {
    id: "keno",
    name: "ODD69 Keno",
    description: "Pick your lucky numbers and hit the board.",
    icon: <Hash size={48} />,
    href: "/odd69-games/keno",
    badge: "LIVE",
    badgeColor: "bg-rose-500",
    gradient: "from-[#2a0d16] via-[#1a0b11] to-[#10060a]",
    accentColor: "#fb7185",
    glowColor: "rgba(251,113,133,0.22)",
    available: true,
  },
  {
    id: "hilo",
    name: "ODD69 Hi-Lo",
    description: "Guess whether the next card goes higher or lower.",
    icon: <TrendingUp size={48} />,
    href: "/odd69-games/hilo",
    badge: "LIVE",
    badgeColor: "bg-cyan-500",
    gradient: "from-[#082028] via-[#07161d] to-[#040d12]",
    accentColor: "#22d3ee",
    glowColor: "rgba(34,211,238,0.22)",
    available: true,
  },
  {
    id: "roulette",
    name: "ODD69 Roulette",
    description: "Cover your numbers and let the wheel decide.",
    icon: <Disc3 size={48} />,
    href: "/odd69-games/roulette",
    badge: "LIVE",
    badgeColor: "bg-red-500",
    gradient: "from-[#2b0a10] via-[#1c090d] to-[#110507]",
    accentColor: "#f87171",
    glowColor: "rgba(248,113,113,0.22)",
    available: true,
  },
  {
    id: "wheel",
    name: "ODD69 Wheel",
    description: "Spin a fast bonus wheel for instant multipliers.",
    icon: <RefreshCcw size={48} />,
    href: "/odd69-games/wheel",
    badge: "LIVE",
    badgeColor: "bg-sky-500",
    gradient: "from-[#0a1d31] via-[#081521] to-[#050c14]",
    accentColor: "#38bdf8",
    glowColor: "rgba(56,189,248,0.22)",
    available: true,
  },
  {
    id: "coinflip",
    name: "ODD69 Coinflip",
    description: "Call heads or tails and settle each round instantly.",
    icon: <Coins size={48} />,
    href: "/odd69-games/coinflip",
    badge: "LIVE",
    badgeColor: "bg-yellow-500",
    gradient: "from-[#241804] via-[#181004] to-[#0f0902]",
    accentColor: "#ff9a3d",
    glowColor: "rgba(253,224,71,0.22)",
    available: true,
  },
  {
    id: "towers",
    name: "ODD69 Towers",
    description: "Climb one floor at a time and cash out before you fall.",
    icon: <Layers size={48} />,
    href: "/odd69-games/towers",
    badge: "LIVE",
    badgeColor: "bg-stone-400",
    gradient: "from-[#201912] via-[#17120d] to-[#0c0906]",
    accentColor: "#d6d3d1",
    glowColor: "rgba(214,211,209,0.18)",
    available: true,
  },
  {
    id: "color",
    name: "ODD69 Color",
    description: "Pick a color lane and ride short, fast multiplier rounds.",
    icon: <CircleDot size={48} />,
    href: "/odd69-games/color",
    badge: "LIVE",
    badgeColor: "bg-pink-500",
    gradient: "from-[#2a0917] via-[#1a0810] to-[#10040a]",
    accentColor: "#f472b6",
    glowColor: "rgba(244,114,182,0.22)",
    available: true,
  },
  {
    id: "lotto",
    name: "ODD69 Lotto",
    description: "Choose your ticket line and chase oversized payout grids.",
    icon: <Tickets size={48} />,
    href: "/odd69-games/lotto",
    badge: "LIVE",
    badgeColor: "bg-teal-500",
    gradient: "from-[#08201c] via-[#071713] to-[#04100d]",
    accentColor: "#2dd4bf",
    glowColor: "rgba(45,212,191,0.22)",
    available: true,
  },
  {
    id: "jackpot",
    name: "ODD69 Jackpot",
    description: "Snap into boosted prize pots with a high-volatility hit chase.",
    icon: <Crown size={48} />,
    href: "/odd69-games/jackpot",
    badge: "LIVE",
    badgeColor: "bg-orange-500",
    gradient: "from-[#2a1404] via-[#1b0d03] to-[#100702]",
    accentColor: "#ff7a1a",
    glowColor: "rgba(251,146,60,0.22)",
    available: true,
  },
];

export default function ODD69GamesPage() {
  const { token, loading } = useAuth();
  const { canAccessOriginals, loading: accessLoading } = useOriginalsAccess();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !accessLoading && (!token || !canAccessOriginals)) {
      router.replace("/");
    }
  }, [token, loading, accessLoading, canAccessOriginals, router]);

  if (loading || accessLoading || !token || !canAccessOriginals) {
    return <div className="h-screen flex items-center justify-center bg-bg-base"><div className="animate-spin w-8 h-8 border-2 border-white/[0.12] border-t-white rounded-full" /></div>;
  }

  return (
    <div className="h-screen overflow-hidden bg-bg-base flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
        <LeftSidebar />
        <main className="flex-1 min-w-0 bg-bg-base overflow-y-auto overflow-x-hidden border-l border-white/[0.04] border-r border-white/[0.04]">
          <div className="p-4 md:p-8 space-y-10 max-w-5xl mx-auto">

            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#1a1208] via-[#201910] to-[#2a1e14] p-8 md:p-12">
              {/* Background decoration */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl opacity-20 bg-brand-gold" />
                <div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full blur-2xl opacity-10 bg-brand-gold" />
                {/* Grid dot pattern */}
                <div
                  className="absolute inset-0 opacity-5"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, #e37d32 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                  }}
                />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/30 rounded-full px-3 py-1">
                    <div className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
                    <span className="text-brand-gold text-xs font-black tracking-widest uppercase">
                      ODD69 Originals
                    </span>
                  </div>
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-text-primary mb-3 leading-tight">
                  Play <span className="text-gradient-gold">Original Games</span>
                  <br />Built by ODD69
                </h1>
                <p className="text-text-secondary text-sm md:text-base max-w-xl mb-6">
                  Provably fair, in-house games crafted exclusively for ODD69. Every outcome is
                  verifiable. Every bet is transparent.
                </p>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2">
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-[8px] font-black text-white">✓</span>
                    </div>
                    <span className="text-text-secondary text-xs font-bold">Provably Fair</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2">
                    <div className="w-4 h-4 rounded-full bg-brand-gold flex items-center justify-center">
                      <span className="text-[8px] font-black text-black">₿</span>
                    </div>
                    <span className="text-text-secondary text-xs font-bold">Fiat & Crypto</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2">
                    <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                      <span className="text-[8px] font-black text-white">%</span>
                    </div>
                    <span className="text-text-secondary text-xs font-bold">Bonus Compatible</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Games Grid */}
            <div>
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-text-primary font-black text-xl">All Games</h2>
                <span className="text-xs text-text-muted bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
                  {ORIGINALS_GAMES.filter((g) => g.available).length} Live
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ORIGINALS_GAMES.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </div>

            {/* Why Originals */}
            <div className="border-t border-white/[0.06] pt-8">
              <h2 className="text-text-primary font-black text-xl mb-5">Why ODD69 Originals?</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    icon: "🔐",
                    title: "Provably Fair",
                    desc: "Every game uses cryptographic HMAC-SHA256 seeding. Verify any result independently.",
                  },
                  {
                    icon: "⚡",
                    title: "Instant Results",
                    desc: "No waiting, no loading. Pure on-platform speed with zero third-party lag.",
                  },
                  {
                    icon: "🎁",
                    title: "Bonus Compatible",
                    desc: "Use your casino bonus balance. Wagering requirements count toward Originals.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="bg-bg-card rounded-xl border border-white/[0.06] p-5 hover:border-brand-gold/30 transition-all"
                  >
                    <div className="text-3xl mb-3">{item.icon}</div>
                    <h3 className="text-text-primary font-bold text-sm mb-1">{item.title}</h3>
                    <p className="text-text-muted text-xs leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function GameCard({ game }: { game: (typeof ORIGINALS_GAMES)[0] }) {
  const card = (
    <div
      className={`relative group rounded-2xl border overflow-hidden transition-all duration-300 cursor-pointer
      ${game.available
          ? "border-white/[0.06] hover:border-white/30 hover:scale-[1.02]"
          : "border-white/[0.04] opacity-60"
        }
      `}
      style={{
        boxShadow: game.available
          ? `0 0 0 0 ${game.glowColor}`
          : undefined,
      }}
      onMouseEnter={(e) => {
        if (game.available) {
          (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${game.glowColor}`;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${game.gradient}`} />
      <div className="absolute inset-0 bg-bg-card/50" />

      {/* Glow orb */}
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-30 transition-opacity duration-300 group-hover:opacity-50"
        style={{ background: game.accentColor }}
      />

      <div className="relative z-10 p-6">
        {/* Badge */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="p-3 rounded-xl bg-black/30 border border-white/[0.06]"
            style={{ color: game.accentColor }}
          >
            {game.icon}
          </div>
          <span
            className={`text-[10px] font-black px-2.5 py-1 rounded-full text-white tracking-wider ${game.badgeColor}`}
          >
            {game.badge}
          </span>
        </div>

        <h3 className="text-text-primary font-black text-lg mb-1">{game.name}</h3>
        <p className="text-text-muted text-xs mb-5 leading-relaxed">{game.description}</p>

        {/* Play button */}
        <div
          className={`flex items-center gap-2 text-sm font-bold transition-all
          ${game.available
              ? "text-text-primary group-hover:gap-3"
              : "text-text-disabled"
            }`}
          style={game.available ? { color: game.accentColor } : undefined}
        >
          {game.available ? (
            <>
              <span>Play Now</span>
              <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
            </>
          ) : (
            <>
              <Lock size={14} />
              <span>Coming Soon</span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (game.available) {
    return <Link href={game.href}>{card}</Link>;
  }
  return card;
}
