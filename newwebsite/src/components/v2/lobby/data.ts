// ODD69 lobby (VaultBlaze-style clone) content.
import {
  Home, Gem, Star, History, Compass, Sparkles, Crown, RotateCcw,
  Flame, Trophy, Gift,
} from "lucide-react";

export const ORANGE = "#ff7a1a";
export const ORANGE_GRAD = "linear-gradient(135deg,#ff9a3d 0%,#ff6a00 100%)";

export const TOP_TABS = [
  { label: "Casino", icon: "🎰", active: true },
  { label: "Sports", active: false },
  { label: "Live casino", active: false },
];

export const NAV_MAIN = [
  { label: "Lobby", Icon: Home, active: true },
  { label: "Providers", Icon: Gem, active: false },
  { label: "Favourite", Icon: Star, active: false },
  { label: "Recent", Icon: History, active: false },
];

export const NAV_SLOTS = [
  { label: "All", Icon: Compass },
  { label: "Popular", Icon: Star },
  { label: "New games", Icon: Sparkles },
  { label: "VIP", Icon: Crown },
  { label: "Buyback Bonuses", Icon: Gift },
  { label: "High RTP", Icon: Flame },
  { label: "Jackpot", Icon: Trophy },
  { label: "Recent", Icon: RotateCcw, hidden: true },
];

export const WINNERS = [
  { name: "Katemoss", amount: "$10.4K", c: "#7c3aed" },
  { name: "Usetr93", amount: "$3,400", c: "#2563eb" },
  { name: "Turnw939", amount: "$10.9K", c: "#db2777" },
  { name: "Weekend", amount: "$1K", c: "#0891b2" },
  { name: "Bestowf", amount: "$11.5K", c: "#16a34a" },
  { name: "Wolf", amount: "$93.3K", c: "#ea580c" },
  { name: "Admin09", amount: "$5,000", c: "#9333ea" },
  { name: "Worker", amount: "$90K", c: "#0d9488" },
  { name: "Lucky7", amount: "$7.2K", c: "#e11d48" },
  { name: "Maverick", amount: "$22K", c: "#4f46e5" },
];

export type Game = { name: string; provider: string; from: string; to: string };

export const POPULAR_1: Game[] = [
  { name: "Vampy Party", provider: "Pragmatic Play", from: "#b21f4b", to: "#2a1030" },
  { name: "Haunted Reels", provider: "BGaming", from: "#2a4f9e", to: "#0e1f3d" },
  { name: "Piggy Bonanza", provider: "OnlyPlay", from: "#ff7ab0", to: "#7a2f78" },
  { name: "Get the Cheese", provider: "Hacksaw Gaming", from: "#e08a2e", to: "#7a3a18" },
  { name: "Power of Zeus", provider: "Mancala Gaming", from: "#5b8ad6", to: "#1d2f52" },
  { name: "Santa Mummy", provider: "Belatra", from: "#b53a7a", to: "#3a1d52" },
];

export const POPULAR_2: Game[] = [
  { name: "Hot Coins Fortune", provider: "Pragmatic Play", from: "#ffb01a", to: "#b23a0e" },
  { name: "Carnival Bonanza", provider: "Endorphina", from: "#2e7ad6", to: "#7a3a2e" },
  { name: "Explosion Magic", provider: "BGaming", from: "#4f46e5", to: "#1d1f52" },
  { name: "Lucky Bandits", provider: "Hacksaw Gaming", from: "#b5732e", to: "#3a2418" },
  { name: "Panda Strike", provider: "Mancala Gaming", from: "#ff8a3a", to: "#1d5a52" },
  { name: "Wildstock", provider: "Belatra", from: "#7c3aed", to: "#2a1d52" },
];

export const BANNERS = [
  {
    kind: "mines",
    tag: "Mines",
    sub: "Reward weekend",
    title: "Get up to\n50% bonus\nin Mines game",
    cta: "Deposit",
    icon: "bomb",
    grad: "linear-gradient(120deg,#15a594 0%,#0e6f6a 60%,#0b4d52 100%)",
    ctaStyle: "orange",
  },
  {
    kind: "cashback",
    title: "20%\ncashback",
    pill: "on loose",
    foot: "Get 20% on every\nloose and play again",
    icon: "moneybag",
    grad: "linear-gradient(140deg,#3a2566 0%,#241341 70%,#1a0f30 100%)",
  },
  {
    kind: "hunt",
    title: "Hunt\ntreasury",
    sub: "Get 100% rakeback",
    cta: "Hunt now",
    icon: "moneybag",
    grad: "linear-gradient(135deg,#ff9a2e 0%,#ff6a00 60%,#e24a00 100%)",
    ctaStyle: "dark",
  },
];
