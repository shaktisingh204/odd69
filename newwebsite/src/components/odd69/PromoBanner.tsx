import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Icon3D, { type Icon3DName } from './Icon3D';

export type Promo = {
  title: string;
  accent: string; // highlighted word(s) inside the title
  description: string;
  icon: Icon3DName;
  art: string; // thumbnail gradient
  /** real promo destination — renders the banner as a link when set */
  href?: string;
};

export default function PromoBanner({ promo }: { promo: Promo }) {
  // split the title so the accent word renders in blue (guard against
  // empty / missing accents so the whole title doesn't shatter per-char)
  const hasAccent = !!promo.accent && promo.title.includes(promo.accent);
  const before = hasAccent ? promo.title.slice(0, promo.title.indexOf(promo.accent)) : promo.title;
  const after = hasAccent
    ? promo.title.slice(promo.title.indexOf(promo.accent) + promo.accent.length)
    : '';

  const className =
    'odd69-press group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0e1c2e] p-3 pr-12 text-left shadow-[0_16px_40px_rgba(0,0,0,0.42)]';

  const inner = (
    <>
      <span className="absolute inset-0 -z-10 bg-[radial-gradient(85%_140%_at_2%_50%,rgba(37,99,235,0.22),transparent_58%)]" />

      {/* thumbnail with 3D object */}
      <span className={`relative grid h-16 w-[76px] shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br ${promo.art} shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]`}>
        <span className="absolute inset-0 bg-[radial-gradient(120%_120%_at_30%_10%,rgba(255,255,255,0.3),transparent_60%)]" />
        <Icon3D name={promo.icon} size={44} glow float className="transition-transform duration-300 group-hover:scale-110" />
      </span>

      <span className="min-w-0">
        <span className="block text-[13px] font-extrabold uppercase leading-tight tracking-[0.01em] text-white line-clamp-2">
          {before}
          {hasAccent && <span className="text-[#56a6ff]">{promo.accent}</span>}
          {after}
        </span>
        <span className="mt-1 block text-[11.5px] leading-snug text-[#8ca3bd] line-clamp-2">
          {promo.description}
        </span>
      </span>

      <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-[#9fb2c9] transition-colors group-hover:bg-[#3b82f6] group-hover:text-white">
        <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} />
      </span>
    </>
  );

  if (promo.href) {
    const external = /^https?:\/\//i.test(promo.href);
    return external ? (
      <a href={promo.href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    ) : (
      <Link href={promo.href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={className}>
      {inner}
    </button>
  );
}
