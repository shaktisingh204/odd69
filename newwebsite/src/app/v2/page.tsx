import type { Metadata } from "next";
import NeonBackground from "@/components/v2/NeonBackground";
import V2TopBar from "@/components/v2/V2TopBar";
import V2Hero from "@/components/v2/V2Hero";
import WinnersMarquee from "@/components/v2/WinnersMarquee";
import OriginalsRail from "@/components/v2/OriginalsRail";
import WorldsBento from "@/components/v2/WorldsBento";
import WelcomeBonus from "@/components/v2/WelcomeBonus";
import V2Footer from "@/components/v2/V2Footer";

export const metadata: Metadata = {
  title: "ODD69 — Play loud. Win louder.",
  description: "Casino, crash games and live sports on one provably-fair wallet.",
};

// ODD69 v2 — Neon Arcade homepage redesign.
// Full-bleed: ClientLayout renders this route without the legacy chrome.
export default function V2Home() {
  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#08060f] text-white antialiased">
      <NeonBackground />
      <V2TopBar />
      <V2Hero />
      <WinnersMarquee />
      <OriginalsRail />
      <WorldsBento />
      <WelcomeBonus />
      <V2Footer />
    </main>
  );
}
