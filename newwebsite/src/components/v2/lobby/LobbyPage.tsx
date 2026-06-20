"use client";

import { useState } from "react";
import { X } from "lucide-react";
import LobbyTopBar from "./LobbyTopBar";
import LobbySidebar from "./LobbySidebar";
import WinnersTicker from "./WinnersTicker";
import PromoBanners from "./PromoBanners";
import GameSection from "./GameSection";
import RakebackBar from "./RakebackBar";
import { POPULAR_1, POPULAR_2 } from "./data";

export default function LobbyPage() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-[#100d0a] text-white antialiased">
      <LobbyTopBar onMenu={() => setNavOpen(true)} />

      <div className="flex min-h-0 flex-1">
        {/* desktop sidebar */}
        <div className="hidden lg:block">
          <LobbySidebar />
        </div>

        {/* mobile drawer */}
        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setNavOpen(false)} />
            <div className="absolute left-0 top-0 h-full">
              <button onClick={() => setNavOpen(false)} className="absolute -right-11 top-3 grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white">
                <X className="h-5 w-5" strokeWidth={2.4} />
              </button>
              <LobbySidebar />
            </div>
          </div>
        )}

        {/* main */}
        <main className="v2-no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5">
          <WinnersTicker />
          <div className="mt-4">
            <PromoBanners />
          </div>
          <div className="mt-7">
            <GameSection title="Popular" games={POPULAR_1} count="3 400" />
          </div>
          <div className="mt-5">
            <RakebackBar />
          </div>
          <div className="mt-7">
            <GameSection title="Popular" games={POPULAR_2} count="3 400" />
          </div>
          <div className="h-8" />
        </main>
      </div>
    </div>
  );
}
