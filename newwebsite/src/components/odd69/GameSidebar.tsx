'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Home, Mic, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import Icon3D, { type Icon3DName } from './Icon3D';

export type SidebarItem = {
  key: string;
  label: string;
  price?: string;
  icon: Icon3DName;
  tint: string;
  badge?: 'HOT' | 'dot';
  active?: boolean;
  /** when set, the tile navigates here instead of acting as a plain button */
  href?: string;
};

const DEFAULT_ITEMS: SidebarItem[] = [
  { key: 'crash', label: 'CRASH', price: '$ 54.40', icon: 'rocket', tint: 'from-[#1e3a8a] to-[#0c1b34]', active: true },
  { key: 'double', label: 'DOUBLE', price: '$ 17.20', icon: 'dice', tint: 'from-[#7f1d1d] to-[#2a0d0d]' },
  { key: 'jackrun', label: 'JACKRUN', price: '$ 33.14', icon: 'swords', tint: 'from-[#1d4ed8] to-[#0c1b34]' },
  { key: 'rollrun', label: 'ROLLRUN', price: '$ 78.25', icon: 'slot', tint: 'from-[#1e40af] to-[#0c1b34]', badge: 'dot' },
  { key: 'cases', label: 'CASES', icon: 'package', tint: 'from-[#854d0e] to-[#2a1a06]', badge: 'HOT' },
  { key: 'battle', label: 'CASE BATTLE', icon: 'shield', tint: 'from-[#1e293b] to-[#0b1220]' },
];

function Tile({ item, size = 52, delay = 0 }: { item: SidebarItem; size?: number; delay?: number }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${item.tint} shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-10px_18px_rgba(0,0,0,0.35),0_6px_16px_rgba(0,0,0,0.45)]`}
      style={{ width: size, height: size }}
    >
      <Icon3D name={item.icon} size={Math.round(size * 0.64)} float floatDelay={delay} className="transition-transform duration-300 group-hover:scale-110" />
      {item.badge === 'dot' && (
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#0c1726] bg-[#ef4444]" />
      )}
      {item.badge === 'HOT' && (
        <span className="absolute -right-2 -top-1.5 rounded-md bg-[#ef4444] px-1.5 py-[1px] text-[8px] font-extrabold tracking-wide text-white shadow-[0_2px_6px_rgba(239,68,68,0.6)]">
          HOT
        </span>
      )}
    </span>
  );
}

export default function GameSidebar({
  defaultExpanded = true,
  items = DEFAULT_ITEMS,
  onlineCount,
  brand = 'ODD69',
  tagline = 'Play hub',
  homeHref = '/',
}: {
  defaultExpanded?: boolean;
  /** game-mode rail items — real ODD69 Originals when wired from the home */
  items?: SidebarItem[];
  /** live players online; hidden when not provided */
  onlineCount?: number;
  brand?: string;
  tagline?: string;
  homeHref?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <nav
      className="flex shrink-0 flex-col gap-2.5 rounded-[28px] border border-white/[0.05] bg-[#0c1726]/90 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.5)] transition-[width] duration-300 ease-out"
      style={{ width: expanded ? 232 : 92 }}
    >
      {/* Header: brand + collapse toggle */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={homeHref}
          className="odd69-press grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_22px_rgba(37,99,235,0.55)]"
          aria-label="Home"
        >
          <Home className="h-[22px] w-[22px]" strokeWidth={2.2} />
        </Link>
        {expanded && (
          <div className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold leading-none tracking-tight text-white">{brand}</span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f87a3]">{tagline}</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="odd69-press grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-[#9fb2c9] hover:text-white"
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      <span className="mx-auto h-[3px] w-7 rounded-full bg-[#3b82f6]" />

      {/* Game list */}
      <ul className="flex flex-col gap-1.5">
        {items.map((it, i) => {
          const cls = `odd69-press group relative flex w-full items-center rounded-2xl border px-1.5 py-1.5 transition-colors ${
            it.active
              ? 'border-[#3b82f6]/40 bg-[#1d4ed8]/15'
              : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.035]'
          } ${expanded ? 'gap-3' : 'justify-center'}`;
          const inner = (
            <>
              {it.active && expanded && (
                <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[#3b82f6]" />
              )}
              <Tile item={it} size={expanded ? 46 : 52} delay={i * 0.22} />
              {expanded && (
                <span className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="truncate max-w-full text-[12px] font-extrabold uppercase leading-none tracking-[0.02em] text-white/95">
                    {it.label}
                  </span>
                  {it.price && (
                    <span className="font-odd-num mt-1.5 text-[11px] font-semibold leading-none text-[#7e93ad]">
                      {it.price}
                    </span>
                  )}
                </span>
              )}
              {!expanded && <span className="sr-only">{it.label}</span>}
            </>
          );
          return (
            <li key={it.key}>
              {it.href ? (
                <Link href={it.href} className={cls} aria-label={it.label}>
                  {inner}
                </Link>
              ) : (
                <button type="button" className={cls}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-2 pt-1">
        {expanded && onlineCount != null && (
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9fb2c9]">
              <Users className="h-3.5 w-3.5" /> {onlineCount.toLocaleString('en-US')} online
            </span>
          </div>
        )}
        <button
          type="button"
          className={`odd69-press flex items-center rounded-2xl border border-white/[0.06] bg-white/[0.04] text-[#9fb2c9] transition-colors hover:text-white ${
            expanded ? 'gap-3 px-3 py-2.5' : 'h-[52px] w-[52px] justify-center'
          }`}
          aria-label="Voice chat"
        >
          <Mic className="h-[20px] w-[20px] shrink-0" strokeWidth={2} />
          {expanded && <span className="text-[12px] font-bold text-white/90">Voice chat</span>}
        </button>
      </div>
    </nav>
  );
}
