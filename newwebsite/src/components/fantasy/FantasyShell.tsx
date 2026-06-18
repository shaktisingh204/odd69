"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Crown,
  Gift,
  History as HistoryIcon,
  Home as HomeIcon,
  Trophy,
} from "lucide-react";
import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { fantasyFont } from "./fantasyFont";

/* ─── Dream11-inspired theme — red primary (#D13239), Mulish font ──── */

interface FantasyShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  backHref?: string;
  rightSlot?: React.ReactNode;
  hideSubNav?: boolean;
}

export default function FantasyShell({
  children,
  title,
  subtitle,
  backHref,
  rightSlot,
  hideSubNav = false,
}: FantasyShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const subNav = [
    { href: "/fantasy", label: "Home", icon: HomeIcon },
    { href: "/fantasy/history", label: "My Matches", icon: HistoryIcon },
    { href: "/fantasy/leaderboard", label: "Leaderboard", icon: Crown },
    { href: "/fantasy/stats", label: "Stats", icon: Trophy },
    { href: "/fantasy/refer", label: "Refer & Earn", icon: Gift },
  ];

  const isActive = (href: string) => {
    if (href === "/fantasy") return pathname === "/fantasy";
    return pathname?.startsWith(href) ?? false;
  };

  return (
    <div className={`${fantasyFont.className} h-screen overflow-hidden bg-[#f5f6f8] flex flex-col`}>
      <Header />
      <div className="flex flex-1 overflow-hidden pt-[60px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
        <LeftSidebar />
        <main className="flex-1 min-w-0 bg-[#f5f6f8] overflow-y-auto overflow-x-hidden">
          {/* Dream11-style red header band */}
          {(title || backHref !== undefined || rightSlot) && (
            <div className="bg-gradient-to-b from-[#d13239] to-[#b32028] text-white">
              <div className="px-3 md:px-6 py-3 md:py-4 max-w-5xl mx-auto w-full">
                <div className="flex items-center gap-3">
                  {backHref !== undefined && (
                    backHref ? (
                      <Link
                        prefetch
                        href={backHref}
                        className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors shrink-0"
                        aria-label="Back"
                      >
                        <ArrowLeft size={18} strokeWidth={2.5} />
                      </Link>
                    ) : (
                      <button
                        onClick={() => router.back()}
                        className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors shrink-0"
                        aria-label="Back"
                      >
                        <ArrowLeft size={18} strokeWidth={2.5} />
                      </button>
                    )
                  )}
                  <div className="flex-1 min-w-0">
                    {title && (
                      <h1 className="text-white font-extrabold text-[17px] md:text-xl truncate tracking-tight">
                        {title}
                      </h1>
                    )}
                    {subtitle && (
                      <p className="text-white/80 text-[11px] md:text-xs font-medium truncate mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  {rightSlot && <div className="shrink-0">{rightSlot}</div>}
                </div>
              </div>
            </div>
          )}

          <div className="px-3 md:px-6 py-4 md:py-5 max-w-5xl mx-auto w-full">
            {/* Sub-nav pills */}
            {!hideSubNav && (
              <div className="-mx-3 md:mx-0 mb-4 md:mb-5 overflow-x-auto scrollbar-none">
                <div className="inline-flex md:flex items-center gap-2 px-3 md:px-0 min-w-full">
                  {subNav.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] md:text-xs font-extrabold whitespace-nowrap transition-all tracking-wide ${
                          active
                            ? "bg-[#d13239] text-white shadow-md shadow-[#d13239]/25"
                            : "bg-white text-gray-700 border border-gray-200 hover:border-[#d13239]/40 hover:text-[#d13239]"
                        }`}
                      >
                        <Icon size={14} strokeWidth={2.5} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content */}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

