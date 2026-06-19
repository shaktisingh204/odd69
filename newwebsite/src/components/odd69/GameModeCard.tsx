import { Users } from 'lucide-react';
import Icon3D, { type Icon3DName } from './Icon3D';

export type GameMode = {
  title: string;
  price: string;
  players: number;
  icon: Icon3DName;
  kind: 'crash' | 'double' | 'jackrun';
  /** background gradient for the placeholder artwork */
  art: string;
  /** real game route — used by the modal's "Play" CTA when wired from the home */
  href?: string;
};

export default function GameModeCard({ mode, onClick }: { mode: GameMode; onClick?: () => void }) {
  return (
    <div className="aspect-[16/10] w-full">
      <button
        type="button"
        onClick={onClick}
        className="odd69-press relative isolate block h-full w-full overflow-hidden rounded-[22px] border border-white/[0.08] text-left shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        {/* Card surface: gradient + glossy highlight + stripes */}
        <div className={`absolute inset-0 bg-gradient-to-br ${mode.art}`} />
        <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_78%_22%,rgba(140,190,255,0.32),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:repeating-linear-gradient(115deg,#fff_0,#fff_2px,transparent_2px,transparent_24px)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />

        {/* Hero image — large, bleeds toward the right edge */}
        <div className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2">
          <Icon3D name={mode.icon} size={156} glow />
        </div>

        {/* Player count */}
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/45 px-2.5 py-1 text-[12px] font-bold text-white backdrop-blur-sm">
          <Users className="h-3.5 w-3.5" /> {mode.players}
        </span>

        {/* Title + price */}
        <span className="absolute bottom-3.5 left-4">
          <span className="block text-[26px] font-extrabold leading-none tracking-[-0.02em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
            {mode.title}
          </span>
          <span className="font-odd-num mt-2 block text-[13px] font-bold text-white/90">{mode.price}</span>
        </span>

        {/* inner edge highlight */}
        <div className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]" />
      </button>
    </div>
  );
}
