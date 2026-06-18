"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";
import MaintenanceState from "@/components/maintenance/MaintenanceState";
import SportsMainContent from "@/components/sports/SportsMainContent";
import { useSectionMaintenance } from "@/hooks/useSectionMaintenance";
import type { SportsLobbyInitialData } from "@/lib/sportsLobbyData";

interface SportsPageClientProps {
  initialData: SportsLobbyInitialData;
  initialSelectedSport?: string | null;
}

function SportsPageContent({ initialData, initialSelectedSport = null }: SportsPageClientProps) {
  const searchParams = useSearchParams();
  const urlSportId = searchParams.get("sport_id");
  const [selectedSport, setSelectedSport] = useState<string | null>(urlSportId || initialSelectedSport || null);
  const { blocked, loading, message } = useSectionMaintenance(
    "sports",
    "Sports is currently under maintenance. Betting, match markets, and settlement are temporarily paused.",
  );

  useEffect(() => {
    setSelectedSport(urlSportId || initialSelectedSport || null);
  }, [initialSelectedSport, urlSportId]);

  const shell = (content: ReactNode) => (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-base font-[family-name:var(--font-poppins)]">
      <Header />
      <div className="flex flex-1 overflow-hidden pt-[60px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
        <LeftSidebar
          selectedSportId={selectedSport}
          onSelectSport={setSelectedSport}
        />
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-bg-base">
          {content}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex min-h-screen items-center justify-center bg-bg-base">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/[0.06] border-t-brand-gold" />
      </div>
    );
  }

  if (blocked) {
    return shell(
      <div className="min-h-full bg-bg-base pt-6">
        <MaintenanceState
          title="Sports Maintenance In Progress"
          message={message}
          backHref="/"
          backLabel="Back to Home"
        />
      </div>
    );
  }

  return shell(<SportsMainContent initialData={initialData} />);
}

export default function SportsPageClient(props: SportsPageClientProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-base">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/[0.06] border-t-brand-gold" />
        </div>
      }
    >
      <SportsPageContent {...props} />
    </Suspense>
  );
}
