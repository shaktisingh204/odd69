import type { Metadata } from "next";
import LobbyPage from "@/components/v2/lobby/LobbyPage";

export const metadata: Metadata = {
  title: "ODD69 — Casino Lobby",
  description: "Play casino, sports and live games on ODD69.",
};

// ODD69 lobby redesign (VaultBlaze-style). Full-bleed: ClientLayout renders
// /v2 without the legacy chrome.
export default function V2Home() {
  return <LobbyPage />;
}
