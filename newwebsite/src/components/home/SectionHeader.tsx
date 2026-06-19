'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Icon3D, { type Icon3DName } from '@/components/odd69/Icon3D';

export default function SectionHeader({
  icon,
  title,
  count,
  href,
  live = false,
  className = '',
}: {
  icon: Icon3DName;
  title: string;
  count?: number;
  href?: string;
  live?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between mb-3 md:mb-4 ${className}`}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Icon3D name={icon} size={24} float />
        </span>
        <h2 className="text-lg md:text-xl font-extrabold tracking-[-0.02em] text-white">{title}</h2>
        {live && (
          <span className="flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-[9px] font-bold text-red-400">LIVE</span>
          </span>
        )}
        {count != null && count > 0 && (
          <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-white/30">
            {count}
          </span>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="odd69-press flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-semibold text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/85"
        >
          All <ArrowRight size={10} />
        </Link>
      )}
    </div>
  );
}
