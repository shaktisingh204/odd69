import GameSidebar from '@/components/odd69/GameSidebar';
import RevealOnMount from '@/components/odd69/RevealOnMount';
import ChatPanel from '@/components/odd69/ChatPanel';
import { type GameMode } from '@/components/odd69/GameModeCard';
import GameModesSection from '@/components/odd69/GameModesSection';
import PromoBanner, { type Promo } from '@/components/odd69/PromoBanner';
import SkinCard, { type Skin } from '@/components/odd69/SkinCard';
import BalanceBar from '@/components/odd69/BalanceBar';

export const metadata = {
  title: 'ODD69 — UI Kit',
};

const MODES: GameMode[] = [
  { title: 'Crash', price: '$ 54.40', players: 142, icon: 'rocket', kind: 'crash', art: 'from-[#1e3a8a] via-[#1d4ed8] to-[#0b1a30]' },
  { title: 'Double', price: '$ 17.20', players: 37, icon: 'dice', kind: 'double', art: 'from-[#155e75] via-[#0e7490] to-[#0b1a30]' },
  { title: 'Jackrun', price: '$ 33.14', players: 68, icon: 'swords', kind: 'jackrun', art: 'from-[#3730a3] via-[#1d4ed8] to-[#0b1a30]' },
];

const PROMOS: Promo[] = [
  {
    title: 'TAKE PART IN OUR GIVEAWAYS!',
    accent: 'GIVEAWAYS',
    description: 'Every day, week and month we hold generous skin giveaways.',
    icon: 'knife',
    art: 'from-[#38bdf8] to-[#1d4ed8]',
  },
  {
    title: 'PARTICIPATE IN OUR BONUS SYSTEM!',
    accent: 'BONUS SYSTEM',
    description: 'Daily bonuses, promo codes, bonuses for replenishments are waiting for you.',
    icon: 'gift',
    art: 'from-[#2dd4bf] to-[#0d9488]',
  },
];

const SKINS: Skin[] = [
  { name: 'Exposure', weapon: 'UMP-45', price: '7.42$', wear: 'BS', icon: 'gem', art: 'from-[#a855f7] to-[#6d28d9]', floatDelay: 0 },
  { name: 'Rocket Pop', weapon: 'Galil AR', price: '2.25$', icon: 'gem', art: 'from-[#22c55e] to-[#0d9488]', floatDelay: 0.3 },
  { name: 'ZX Spectron', weapon: 'USP-S', price: '81.27$', wear: 'FN', icon: 'gem', art: 'from-[#ec4899] to-[#7c3aed]', floatDelay: 0.6 },
  { name: 'Cortex', weapon: 'M9 Bayonet', price: '81.27$', icon: 'knife', art: 'from-[#ef4444] to-[#7f1d1d]', floatDelay: 0.9 },
  { name: 'Souvenir', weapon: 'FAMAS', price: '81.27$', wear: 'FN', icon: 'gem', art: 'from-[#f59e0b] to-[#b45309]', floatDelay: 1.2 },
  { name: 'Dual Berettas', weapon: 'FAMAS', price: '1.49$', icon: 'dagger', art: 'from-[#38bdf8] to-[#1d4ed8]', floatDelay: 1.5 },
];

export default function Odd69UiKitPage() {
  return (
    <div className="min-h-[100dvh] w-full bg-[#0a1422] bg-[radial-gradient(120%_90%_at_50%_-10%,#24405f_0%,#0e1c2e_45%,#0a1422_100%)] px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Components</h1>
          <p className="mt-1 text-sm text-[#8ca3bd]">Skins-arena UI kit, reference blue theme. Artwork shown as placeholders.</p>
        </header>

        <RevealOnMount className="flex flex-wrap items-start gap-5 lg:flex-nowrap">
          {/* Expandable sidebar (collapse to icon rail with the toggle) */}
          <GameSidebar />

          {/* Chat */}
          <ChatPanel />

          {/* Game-mode cards — click a card to open the live game UI */}
          <GameModesSection modes={MODES} />

          {/* Promos + skins + balance */}
          <div className="flex w-full min-w-[300px] flex-1 flex-col gap-4">
            {PROMOS.map((p) => (
              <PromoBanner key={p.accent} promo={p} />
            ))}

            <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SKINS.map((s) => (
                <SkinCard key={`${s.name}-${s.weapon}`} skin={s} />
              ))}
            </div>

            <div className="mt-2">
              <BalanceBar />
            </div>
          </div>
        </RevealOnMount>
      </div>
    </div>
  );
}
