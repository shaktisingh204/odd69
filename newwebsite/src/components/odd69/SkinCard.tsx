import Icon3D, { type Icon3DName } from './Icon3D';

export type Skin = {
  name: string;
  weapon: string;
  price?: string; // hidden when absent (e.g. casino games have no item price)
  wear?: string; // BS / FN / MW ... or a category tag (NEW / SLOTS …)
  icon: Icon3DName; // 3D render stand-in (real skin art is licensed)
  art: string; // gradient accent for the placeholder render
  floatDelay?: number;
  /** real game thumbnail — renders in place of the 3D icon when present */
  image?: string;
  /** click handler — navigate to / launch the real game when wired */
  onClick?: () => void;
};

export default function SkinCard({ skin }: { skin: Skin }) {
  return (
    <button
      type="button"
      onClick={skin.onClick}
      className="odd69-press relative flex h-[82px] w-full items-center overflow-hidden rounded-2xl border border-white/[0.06] bg-[#15243a] px-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.4)]"
    >
      {/* rarity accent glow along the bottom */}
      <span className={`absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t ${skin.art} opacity-45`} />
      <span className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_120%,rgba(255,255,255,0.08),transparent_55%)]" />

      <span className="relative min-w-0 flex-1 pr-2">
        {skin.price && (
          <span className="font-odd-num block text-[13px] font-extrabold text-white">{skin.price}</span>
        )}
        <span className="mt-1 block truncate text-[12px] font-bold text-white/95">{skin.name}</span>
        <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.03em] text-[#8ca3bd]">
          {skin.weapon}
        </span>
      </span>

      {skin.image ? (
        /* real game thumbnail */
        <span className="relative ml-auto h-[58px] w-[46px] shrink-0 overflow-hidden rounded-lg border border-white/[0.08] shadow-[0_6px_14px_rgba(0,0,0,0.45)]">
          <img
            src={skin.image}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </span>
      ) : (
        /* 3D render */
        <span className="relative ml-auto grid h-14 w-14 shrink-0 -rotate-12 place-items-center">
          <Icon3D name={skin.icon} size={46} glow />
        </span>
      )}

      {skin.wear && (
        <span className="absolute right-2 top-1.5 rounded bg-black/45 px-1.5 py-[1px] text-[9px] font-bold tracking-[0.08em] text-[#9fb2c9]">
          {skin.wear}
        </span>
      )}
    </button>
  );
}
