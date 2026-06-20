"use client";

import LobbyTopBar from "./LobbyTopBar";
import LeftSidebar from "@/components/layout/LeftSidebar";
import RecentWinsTicker from "@/components/home/RecentWinsTicker";
import PromoBanners from "./PromoBanners";
import RealGameSection from "./RealGameSection";
import RakebackBar from "./RakebackBar";

// ODD69 production lobby (/v2). Reuses the real homepage LeftSidebar + the real
// RecentWinsTicker (live game art); game grids pull real casino data.
export default function LobbyPage() {
  return (
    <div className="flex h-full flex-col bg-[#100d0a] text-white antialiased">
      <LobbyTopBar />

      <div className="flex min-h-0 flex-1">
        {/* real homepage sidebar (desktop column + its own mobile drawer) */}
        <LeftSidebar selectedSportId={null} onSelectSport={() => {}} activeTab="live" onTabChange={() => {}} />

        <main className="v2-no-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {/* real winners container from the current homepage */}
          <RecentWinsTicker />

          <div className="space-y-7 px-3 py-4 md:px-5">
            <PromoBanners />
            <RealGameSection title="Popular" section="popular" />
            <RakebackBar />
            <RealGameSection title="New games" section="new" />
            <RealGameSection title="Top Slots" section="slots" />
            <RealGameSection title="Live Casino" section="live" href="/live-dealers" />
            <RealGameSection title="Crash Games" section="crash" />
            <div className="h-8" />
          </div>
        </main>
      </div>
    </div>
  );
}
