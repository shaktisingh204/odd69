"use client";

import Link from "next/link";

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Play",
    links: [
      { label: "Casino", href: "/casino" },
      { label: "Live Casino", href: "/live-dealers" },
      { label: "Sports", href: "/sports" },
      { label: "Originals", href: "/odd69-games" },
    ],
  },
  {
    title: "ODD69",
    links: [
      { label: "VIP Club", href: "/vip" },
      { label: "Promotions", href: "/promotions" },
      { label: "Provably fair", href: "/fairness" },
      { label: "Refer & earn", href: "/referral" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Help center", href: "/support/help-center" },
      { label: "Privacy policy", href: "/legal/privacy-policy" },
      { label: "Terms of service", href: "/legal/terms" },
      { label: "Betting rules", href: "/legal/rules" },
    ],
  },
];

export default function V2Footer() {
  return (
    <footer className="relative mt-10 border-t border-white/[0.08]">
      <div className="mx-auto max-w-[1240px] px-4 py-14 md:px-6">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="text-3xl font-extrabold tracking-tight">
              <span className="v2-grad-text">ODD</span>
              <span className="text-white">69</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/45">
              The loudest place to bet. Casino, crash games and live sports on one provably-fair wallet.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-white/40">{c.title}</p>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm font-medium text-white/65 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/[0.06] pt-6 text-sm text-white/40 sm:flex-row sm:items-center">
          <p>© 2026 ODD69. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-bold text-white/70">18+</span>
            <span>Please play responsibly.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
