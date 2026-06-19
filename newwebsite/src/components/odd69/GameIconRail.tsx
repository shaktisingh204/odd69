import Link from 'next/link';
import { Home, Mic } from 'lucide-react';
import Icon3D from './Icon3D';
import { type SidebarItem } from './GameSidebar';

const DEFAULT_ITEMS: SidebarItem[] = [
  { key: 'crash', label: 'CRASH', price: '$ 54.40', icon: 'rocket', tint: 'from-[#1e3a8a] to-[#0c1b34]' },
  { key: 'double', label: 'DOUBLE', price: '$ 17.20', icon: 'dice', tint: 'from-[#7f1d1d] to-[#2a0d0d]' },
  { key: 'jackrun', label: 'JACKRUN', price: '$ 33.14', icon: 'swords', tint: 'from-[#1d4ed8] to-[#0c1b34]' },
  { key: 'rollrun', label: 'ROLLRUN', price: '$ 78.25', icon: 'slot', tint: 'from-[#1e40af] to-[#0c1b34]', badge: 'dot' },
  { key: 'cases', label: 'CASES', icon: 'package', tint: 'from-[#854d0e] to-[#2a1a06]', badge: 'HOT' },
  { key: 'battle', label: 'CASE BATTLE', icon: 'shield', tint: 'from-[#1e293b] to-[#0b1220]' },
];

export default function GameIconRail({
  items = DEFAULT_ITEMS,
  homeHref = '/',
}: {
  items?: SidebarItem[];
  homeHref?: string;
}) {
  return (
    <nav className="flex w-[92px] shrink-0 flex-col items-center gap-2.5 rounded-[28px] border border-white/[0.05] bg-[#0c1726]/90 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
      {/* Home / brand */}
      <Link
        href={homeHref}
        className="odd69-press grid h-[52px] w-[52px] place-items-center rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_22px_rgba(37,99,235,0.55)]"
        aria-label="Home"
      >
        <Home className="h-[22px] w-[22px]" strokeWidth={2.2} />
      </Link>
      <span className="h-[3px] w-7 rounded-full bg-[#3b82f6]" />

      <ul className="flex w-full flex-col items-center gap-1.5">
        {items.map((it) => {
          const cls =
            'odd69-press group relative flex w-full flex-col items-center gap-1 rounded-2xl border border-transparent px-1 py-2 transition-colors hover:border-white/[0.08] hover:bg-white/[0.035]';
          const inner = (
            <>
              <span
                className={`relative grid h-[52px] w-[52px] place-items-center rounded-2xl bg-gradient-to-br ${it.tint} shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-10px_18px_rgba(0,0,0,0.35),0_6px_16px_rgba(0,0,0,0.45)]`}
              >
                <Icon3D name={it.icon} size={34} float className="transition-transform duration-300 group-hover:scale-110" />
                {it.badge === 'dot' && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#0c1726] bg-[#ef4444]" />
                )}
                {it.badge === 'HOT' && (
                  <span className="absolute -right-2 -top-1.5 rounded-md bg-[#ef4444] px-1.5 py-[1px] text-[8px] font-extrabold tracking-wide text-white shadow-[0_2px_6px_rgba(239,68,68,0.6)]">
                    HOT
                  </span>
                )}
              </span>
              <span className="max-w-full truncate text-[9px] font-extrabold uppercase leading-none tracking-[0.02em] text-white/90">
                {it.label}
              </span>
              {it.price && (
                <span className="font-odd-num text-[8.5px] font-semibold leading-none text-[#7e93ad]">
                  {it.price}
                </span>
              )}
            </>
          );
          return (
            <li key={it.key} className="w-full">
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

      <button
        type="button"
        className="odd69-press mt-0.5 grid h-[52px] w-[52px] place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.04] text-[#9fb2c9] transition-colors hover:text-white"
        aria-label="Voice chat"
      >
        <Mic className="h-[22px] w-[22px]" strokeWidth={2} />
      </button>
    </nav>
  );
}
