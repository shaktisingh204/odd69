/**
 * Renders a 3D icon PNG from /public/odd69/icons-3d.
 * Assets are Microsoft Fluent Emoji (MIT licensed, free for commercial use).
 */
export type Icon3DName =
  | 'rocket' | 'dice' | 'swords' | 'slot' | 'package' | 'shield' | 'house'
  | 'microphone' | 'chat' | 'party' | 'gift' | 'moneybag' | 'banknote'
  | 'coin' | 'trophy' | 'knife' | 'dagger' | 'gem' | 'fire' | 'bomb'
  | 'star' | 'videogame'
  | 'soccer' | 'basketball' | 'spade' | 'racing-car' | 'flag' | 'ticket'
  | 'crystal-ball' | 'joystick';

export default function Icon3D({
  name,
  size = 28,
  className = '',
  glow = false,
  float = false,
  floatDelay = 0,
}: {
  name: Icon3DName;
  size?: number;
  className?: string;
  glow?: boolean;
  /** perpetual 3D bob */
  float?: boolean;
  /** stagger the float so a group of icons isn't in lockstep (seconds) */
  floatDelay?: number;
}) {
  return (
    <img
      src={`/odd69/icons-3d/${name}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`pointer-events-none select-none object-contain ${float ? 'odd69-float' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        animationDelay: float ? `${floatDelay}s` : undefined,
        filter: glow
          ? 'drop-shadow(0 6px 10px rgba(0,0,0,0.45)) drop-shadow(0 0 18px rgba(59,130,246,0.35))'
          : 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))',
      }}
    />
  );
}
