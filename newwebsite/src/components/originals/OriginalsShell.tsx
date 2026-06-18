"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useAuth } from "@/context/AuthContext";
import { useOriginalsAccess } from "@/hooks/useOriginalsAccess";

interface OriginalsShellProps {
  /** Game key — used in the bottom-bar #tag fallback */
  gameKey: string;
  /** Game display name shown bottom-left ("Mines", "Hi-Lo", …) */
  title: string;
  /** Hashtag chips shown bottom-right (defaults to title + originals + provably fair) */
  tags?: string[];
  /** Left control panel content (manual tabs, amount, action button, etc.) */
  controls: React.ReactNode;
  /** Game-area content (board, wheel, etc.) — fills the rest */
  children: React.ReactNode;
}

/**
 * Shared chrome for every Zeero Originals game page. Mirrors the
 * `mines/page.tsx` layout exactly so all the new in-house games (keno, hilo,
 * roulette, wheel, coinflip, towers, color, lotto, jackpot) feel like one app.
 *
 * Layout:
 *   <Header />
 *   ┌────────────┬─────────────────────────────────────────┐
 *   │            │  ┌────────────┬──────────────────────┐  │
 *   │            │  │  controls  │                      │  │
 *   │ LeftSide   │  │   panel    │      game area       │  │
 *   │   bar      │  │            │      (children)      │  │
 *   │            │  │            │                      │  │
 *   │            │  ├────────────┴──────────────────────┤  │
 *   │            │  │            bottom bar             │  │
 *   │            │  └────────────────────────────────────┘  │
 *   └────────────┴─────────────────────────────────────────┘
 */
export default function OriginalsShell({
  gameKey,
  title,
  tags,
  controls,
  children,
}: OriginalsShellProps) {
  const { token, loading: authLoading } = useAuth();
  const { canAccessOriginals, loading: accessLoading } = useOriginalsAccess();
  const router = useRouter();
  const hasSession = !!token;

  React.useEffect(() => {
    if (!authLoading && !accessLoading && (!hasSession || !canAccessOriginals)) {
      router.replace("/");
    }
  }, [authLoading, accessLoading, hasSession, canAccessOriginals, router]);

  if (authLoading || accessLoading || !hasSession || !canAccessOriginals) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-base">
        <div className="animate-spin w-8 h-8 border-2 border-white/[0.12] border-t-white rounded-full" />
      </div>
    );
  }

  const finalTags = tags ?? [
    `# ${title}`,
    "# Zeero Originals",
    "# Provably Fair",
  ];

  return (
    <div className="min-h-screen md:h-screen overflow-y-auto md:overflow-hidden bg-bg-zeero flex flex-col">
      <Header />

      <div className="flex flex-1 md:overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
        <LeftSidebar />

        <main className="flex-1 min-w-0 flex flex-col md:overflow-hidden border-l border-white/[0.04]">
          <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">
            {/* ── LEFT CONTROLS PANEL (mobile: order 2 / desktop: order 1) */}
            <div className="w-full md:w-72 xl:w-80 flex-shrink-0 bg-bg-modal-2 border-t md:border-t-0 md:border-r border-white/[0.04] flex flex-col overflow-y-auto order-2 md:order-1">
              {controls}
            </div>

            {/* ── GAME AREA (mobile: order 1 / desktop: order 2) */}
            <div className="flex-1 min-w-0 md:overflow-y-auto order-1 md:order-2 relative">
              {children}
            </div>
          </div>

          {/* Bottom info bar */}
          <div className="flex-shrink-0 px-5 py-3 bg-bg-deep-3 border-t border-white/[0.04] flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-white text-sm font-black">{title}</span>
              <span className="text-[#6b7280] text-xs ml-2">by Zeero Originals</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {finalTags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2.5 py-1 bg-bg-modal-2 border border-white/[0.06] rounded-full text-[#9ca3af]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
