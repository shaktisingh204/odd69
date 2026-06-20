// ODD69 v2 — Neon Arcade redesign content.
// Game slugs map to real /odd69-games/<slug> routes and the real 3D icon
// assets in /public/odd69/icons-3d/<icon>.png.

export const NEON = {
  magenta: "#ff2e9a",
  violet: "#b14dff",
  cyan: "#22d3ee",
  gradient: "linear-gradient(108deg, #ff2e9a 0%, #b14dff 46%, #22d3ee 100%)",
} as const;

export type Original = {
  slug: string;
  name: string;
  icon: string;
  tag: string;
  glow: string;
  players: string;
};

// Order chosen so the brightest, most-played games lead the rail.
export const ORIGINALS: Original[] = [
  { slug: "mines", name: "Mines", icon: "bomb", tag: "97.0% RTP", glow: "#ff2e9a", players: "1,284" },
  { slug: "crash", name: "Crash", icon: "rocket", tag: "live now", glow: "#22d3ee", players: "2,019" },
  { slug: "plinko", name: "Plinko", icon: "star", tag: "1000x top", glow: "#b14dff", players: "742" },
  { slug: "dice", name: "Dice", icon: "dice", tag: "98.0% RTP", glow: "#22d3ee", players: "613" },
  { slug: "wheel", name: "Wheel", icon: "ticket", tag: "spin it", glow: "#fbbf24", players: "488" },
  { slug: "towers", name: "Towers", icon: "package", tag: "climb up", glow: "#34d399", players: "356" },
  { slug: "limbo", name: "Limbo", icon: "fire", tag: "fast play", glow: "#ff5c7a", players: "529" },
  { slug: "coinflip", name: "Coinflip", icon: "banknote", tag: "50 / 50", glow: "#b14dff", players: "271" },
  { slug: "keno", name: "Keno", icon: "slot", tag: "pick ten", glow: "#22d3ee", players: "198" },
  { slug: "jackpot", name: "Jackpot", icon: "moneybag", tag: "big pots", glow: "#fbbf24", players: "163" },
];

// Hero floating art — real 3D icons.
export const HERO_ICONS: { icon: string; x: string; y: string; size: number; rot: number; delay: number }[] = [
  { icon: "rocket", x: "8%", y: "14%", size: 88, rot: -12, delay: 0 },
  { icon: "dice", x: "84%", y: "8%", size: 76, rot: 10, delay: 0.6 },
  { icon: "moneybag", x: "72%", y: "62%", size: 96, rot: -6, delay: 1.1 },
  { icon: "joystick", x: "3%", y: "66%", size: 80, rot: 14, delay: 0.3 },
  { icon: "star", x: "46%", y: "4%", size: 54, rot: 0, delay: 0.9 },
  { icon: "fire", x: "92%", y: "40%", size: 58, rot: -8, delay: 1.4 },
];

export type World = {
  name: string;
  href: string;
  count: string;
  icon: string;
  span: string; // grid placement
  from: string;
  to: string;
};

export const WORLDS: World[] = [
  { name: "Casino", href: "/casino", count: "18,900+ slots", icon: "slot", span: "md:col-span-2 md:row-span-2", from: "#ff2e9a", to: "#7a1d6b" },
  { name: "Live Casino", href: "/live-dealers", count: "240 tables", icon: "spade", span: "md:col-span-2", from: "#22d3ee", to: "#1d4f7a" },
  { name: "Sports", href: "/sports", count: "18 sports live", icon: "soccer", span: "", from: "#34d399", to: "#1d6b52" },
  { name: "Originals", href: "/odd69-games", count: "12 games", icon: "videogame", span: "", from: "#b14dff", to: "#4a1d7a" },
];

// Live-wins ticker. Realistic, varied amounts. Names are locale-mixed.
export const WINS: { name: string; game: string; amount: string }[] = [
  { name: "rohan_92", game: "Mines", amount: "₹48,210" },
  { name: "Priya.K", game: "Crash", amount: "₹1,12,400" },
  { name: "ace_of_spd", game: "Plinko", amount: "₹9,860" },
  { name: "nehaa", game: "Aviator", amount: "₹27,330" },
  { name: "vikram7", game: "Dice", amount: "₹6,142" },
  { name: "stormy", game: "Wheel", amount: "₹73,900" },
  { name: "kabir.dev", game: "Towers", amount: "₹18,450" },
  { name: "meera_s", game: "Jackpot", amount: "₹2,04,000" },
  { name: "the_don", game: "Limbo", amount: "₹14,720" },
  { name: "anaya", game: "Coinflip", amount: "₹5,300" },
];
