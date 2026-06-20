"use client";

import { Menu, Trophy, Dribbble, Radio, Gift, MessageCircle, Bell, ChevronDown, Flame, Plus } from "lucide-react";
import { useModal } from "@/context/ModalContext";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { useLayout } from "@/context/LayoutContext";

function fmt(n: number) {
  return (n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function LobbyTopBar() {
  const { openDeposit, openWithdraw, openLogin, openRegister } = useModal();
  const { user, isAuthenticated } = useAuth();
  const { activeBalance, activeSymbol } = useWallet();
  const { toggleMobileSidebar } = useLayout();

  const name: string =
    user?.username || user?.name || user?.fullName || user?.firstName || user?.email?.split("@")[0] || "Player";
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <header className="z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#100d0a] px-3 md:px-4">
      {/* menu + logo */}
      <button onClick={toggleMobileSidebar} className="grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/[0.06]">
        <Menu className="h-5 w-5" strokeWidth={2.2} />
      </button>
      <div className="flex items-center gap-2 pr-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}>
          <Flame className="h-5 w-5" strokeWidth={2.4} fill="currentColor" />
        </span>
        <span className="text-xl font-extrabold tracking-tight">
          <span className="text-white">ODD</span><span className="text-[#ff7a1a]">69</span>
        </span>
      </div>

      {/* tabs */}
      <nav className="hidden items-center gap-1 lg:flex">
        {[
          { label: "Casino", Icon: Trophy, href: "/casino", active: true },
          { label: "Sports", Icon: Dribbble, href: "/sports", active: false },
          { label: "Live casino", Icon: Radio, href: "/live-dealers", active: false },
        ].map((t) => (
          <a key={t.label} href={t.href}
             className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${t.active ? "text-white" : "text-white/45 hover:text-white/80"}`}
             style={t.active ? { background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" } : undefined}>
            <t.Icon className="h-4 w-4" strokeWidth={2.2} />{t.label}
          </a>
        ))}
      </nav>

      {/* claim bonus */}
      <div className="mx-auto hidden items-center gap-2.5 md:flex">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04]"><Gift className="h-5 w-5 text-[#ff7a1a]" strokeWidth={2.2} /></span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">Claim Bonus</p>
          <p className="font-mono text-xs tracking-widest text-[#ff7a1a]">00 : 34 : 09</p>
        </div>
      </div>

      {/* right */}
      <div className="ml-auto flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <div className="hidden items-center gap-2 rounded-xl bg-white/[0.05] py-1.5 pl-3 pr-1.5 sm:flex">
              <span className="text-sm font-bold text-white">{activeSymbol}{fmt(activeBalance)}</span>
              <button onClick={openDeposit} className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}>
                <Plus className="h-4 w-4" strokeWidth={2.6} />
              </button>
            </div>
            <button onClick={openWithdraw} className="hidden rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-bold text-white hover:bg-white/[0.1] md:block">Withdraw</button>
            <button onClick={openDeposit} className="rounded-xl px-4 py-2 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,106,0,0.7)] active:scale-[0.97]" style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}>Deposit</button>
            <button className="ml-1 hidden items-center gap-2 rounded-xl bg-white/[0.04] py-1.5 pl-1.5 pr-2.5 md:flex">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#e8650e] to-[#6d28d9] text-xs font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]">{initials}</span>
              <span className="max-w-[120px] truncate text-sm font-bold text-white">{name}</span>
              <ChevronDown className="h-4 w-4 text-white/50" strokeWidth={2.4} />
            </button>
          </>
        ) : (
          <>
            <button onClick={openLogin} className="rounded-xl px-4 py-2 text-sm font-bold text-white/80 hover:text-white">Sign in</button>
            <button onClick={openRegister} className="rounded-xl px-5 py-2 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,106,0,0.7)] active:scale-[0.97]" style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}>Join free</button>
          </>
        )}
        <button className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.04] text-white/65 hover:text-white"><MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.2} /></button>
        <button className="hidden h-9 w-9 place-items-center rounded-xl bg-white/[0.04] text-white/65 hover:text-white sm:grid"><Bell className="h-[18px] w-[18px]" strokeWidth={2.2} /></button>
      </div>
    </header>
  );
}
