import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import Icon3D, { type Icon3DName } from './Icon3D';

/**
 * Centre-stage event hero (the "CYBER TOURNAMENT" panel in the reference).
 * A 3D trophy with a lightning glow, a wordmark on the left, and a static
 * countdown + CTA on the right. The countdown is decorative and rendered
 * statically (no ticking) so the home page carries no motion.
 */
export default function EventHero({
  line1 = 'CYBER',
  line2 = 'TOURNAMENT',
  subtitle = 'Rules for participation in the event',
  ctaHref = '/promotions',
  ctaLabel = 'GO TO THE EVENT',
  icon = 'trophy',
  /** countdown length (ms) — default ≈ 1d 04:17:09 to mirror the reference */
  durationMs = (28 * 3600 + 17 * 60 + 9) * 1000,
}: {
  line1?: string;
  line2?: string;
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
  icon?: Icon3DName;
  durationMs?: number;
}) {
  const totalSec = Math.floor(durationMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="relative isolate overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#0a1628] shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
      {/* layered glow + tech grid + confetti */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_120%_at_50%_-10%,#1d4ed8_0%,#0b1a30_55%,#0a1628_100%)]" />
      <div className="absolute inset-0 -z-10 opacity-[0.10] [background-image:linear-gradient(115deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:46px_46px]" />
      <span className="pointer-events-none absolute left-[18%] top-6 h-2 w-2 rotate-45 rounded-[2px] bg-[#56a6ff]/70" />
      <span className="pointer-events-none absolute right-[26%] top-10 h-2.5 w-2.5 rounded-full bg-[#f472b6]/70" />
      <span className="pointer-events-none absolute left-[42%] bottom-8 h-2 w-2 rounded-full bg-[#34d399]/70" />
      <span className="pointer-events-none absolute right-[34%] bottom-12 h-2 w-2 rotate-45 rounded-[2px] bg-[#fbbf24]/70" />

      <div className="relative z-10 flex flex-col items-center gap-6 p-6 md:flex-row md:items-center md:justify-between md:gap-4 md:p-8">
        {/* wordmark */}
        <div className="shrink-0 text-center md:text-left">
          <span className="block text-3xl font-extrabold italic leading-[0.95] tracking-tight text-transparent md:text-4xl"
            style={{ backgroundImage: 'linear-gradient(135deg,#a78bfa,#7c3aed 55%,#6d28d9)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}
          >
            {line1}
          </span>
          <span className="mt-1 block text-3xl font-extrabold italic uppercase leading-[0.95] tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] md:text-4xl">
            {line2}
          </span>
        </div>

        {/* trophy with lightning halo */}
        <div className="relative grid shrink-0 place-items-center">
          <span className="absolute h-44 w-44 rounded-full bg-[#3b82f6]/25 blur-3xl" />
          <span className="absolute h-28 w-28 rounded-full bg-[#56a6ff]/35 blur-2xl" />
          <Icon3D name={icon} size={172} glow />
        </div>

        {/* countdown + CTA */}
        <div className="flex shrink-0 flex-col items-center gap-3 md:items-end">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8ca3bd]">{subtitle}</span>
          <div className="font-odd-num flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-2 text-[15px] font-extrabold tabular-nums text-white">
            <span className="text-[#56a6ff]">{days} {days === 1 ? 'DAY' : 'DAYS'}</span>
            <span className="text-white/30">|</span>
            <span>{pad(h)}:{pad(m)}:{pad(s)}</span>
          </div>
          <Link
            href={ctaHref}
            className="odd69-press inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] px-5 py-3 text-[13px] font-extrabold uppercase tracking-wide text-white shadow-[0_10px_28px_rgba(37,99,235,0.5)]"
          >
            {ctaLabel} <ChevronRight className="h-4 w-4" strokeWidth={2.6} />
          </Link>
        </div>
      </div>
    </div>
  );
}
