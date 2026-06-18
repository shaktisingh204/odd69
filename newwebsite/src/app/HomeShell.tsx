"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PremiumHomeContent from "@/components/home/PremiumHomeContent";
import LeftSidebar from "@/components/layout/LeftSidebar";
import type { SliderConfig } from "@/lib/siteConfig";

/**
 * Client shell for the homepage.
 *
 * Page.tsx is an async server component that fetches the hero slider
 * config during SSR and hands it to this wrapper. That lets
 * DynamicHeroSlider render the first slide in the initial HTML payload
 * (via React SSR of the "use client" subtree) instead of showing a
 * loading spinner until client hydration.
 *
 * The only truly client-side state this page needs is the selected
 * sport id (driven by the URL query param ?sport_id=...) and the
 * live/line tab toggle — everything else is inherited from context
 * providers in ClientLayout.
 */
interface HomeShellProps {
  initialSliderConfig: SliderConfig | null;
  initialSportId: string | null;
}

export default function HomeShell({
  initialSliderConfig,
  initialSportId,
}: HomeShellProps) {
  const [selectedSportId, setSelectedSportId] = useState<string | null>(
    initialSportId,
  );
  const [activeTab, setActiveTab] = useState<"live" | "line">("live");

  // Keep state in sync if the user navigates client-side to a different
  // ?sport_id without a full page reload. We intentionally read from
  // window.location rather than useSearchParams so we don't force the
  // entire subtree to re-suspend on every render.
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const sport = params.get("sport_id");
      setSelectedSportId((prev) => (prev === sport ? prev : sport));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-bg-base flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden pt-[60px] md:pt-[64px] pb-[80px] md:pb-0 w-full">
        <LeftSidebar
          selectedSportId={selectedSportId}
          onSelectSport={setSelectedSportId}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <main className="flex-1 min-w-0 bg-bg-base overflow-y-auto overflow-x-hidden">
          <PremiumHomeContent
            selectedSportId={selectedSportId}
            initialSliderConfig={initialSliderConfig}
          />
          <Footer />
        </main>
      </div>
    </div>
  );
}
