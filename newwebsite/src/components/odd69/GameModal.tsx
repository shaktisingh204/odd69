'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Minus, Plus, Users } from 'lucide-react';
import Icon3D, { type Icon3DName } from './Icon3D';

export type GameModalData = {
  title: string;
  price: string;
  players: number;
  icon: Icon3DName;
  kind: 'crash' | 'double' | 'jackrun';
  accent: string; // tailwind gradient e.g. 'from-[#1d4ed8] to-[#0b1a30]'
};

const RECENT = ['1.24x', '3.07x', '1.00x', '8.42x', '2.15x', '1.63x', '12.4x', '1.91x'];

const LIVE_BETS = [
  { name: 'Aleksandr', tint: 'from-[#f97316] to-[#b45309]', bet: '120.00', mult: '2.41x', win: true },
  { name: 'Runner', tint: 'from-[#ef4444] to-[#7f1d1d]', bet: '54.40', mult: '—', win: null },
  { name: 'TechnoBomg', tint: 'from-[#22c55e] to-[#15803d]', bet: '500.00', mult: '1.98x', win: true },
  { name: 'MinskLover', tint: 'from-[#a855f7] to-[#6b21a8]', bet: '17.20', mult: '—', win: null },
  { name: 'Godmaster', tint: 'from-[#eab308] to-[#854d0e]', bet: '33.14', mult: '4.10x', win: true },
  { name: 'Korneleus', tint: 'from-[#06b6d4] to-[#0e7490]', bet: '9.90', mult: '—', win: null },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

/** Live crash multiplier that climbs, "crashes", then restarts. */
function useCrashTicker(active: boolean) {
  const [mult, setMult] = useState(1);
  const [crashed, setCrashed] = useState(false);
  const reduced = useReducedMotion();
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const ceiling = useRef(2 + Math.sin(0) * 0); // replaced per round below

  useEffect(() => {
    if (!active || reduced) {
      setMult(2.45);
      return;
    }
    let cancelled = false;
    let roundCeiling = 1.5;
    const newRound = (t: number) => {
      start.current = t;
      // varied crash points without Math.random in a hot path: derive from time
      roundCeiling = 1.4 + ((Math.floor(t) % 9) + (t % 1)) * 1.05;
      ceiling.current = roundCeiling;
      setCrashed(false);
    };
    const tick = (t: number) => {
      if (cancelled) return;
      if (!start.current) newRound(t);
      const elapsed = (t - start.current) / 1000;
      const value = 1 + elapsed * 0.9 * (1 + elapsed * 0.18);
      if (value >= roundCeiling) {
        setMult(roundCeiling);
        setCrashed(true);
        // pause briefly, then restart
        window.setTimeout(() => {
          if (!cancelled) {
            start.current = 0;
            raf.current = requestAnimationFrame(tick);
          }
        }, 1400);
        return;
      }
      setMult(value);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [active, reduced]);

  return { mult, crashed };
}

function CrashStage({ active }: { active: boolean }) {
  const { mult, crashed } = useCrashTicker(active);
  // curve progress 0..1 mapped from multiplier (cap visual at ~10x)
  const p = Math.min(1, (mult - 1) / 9);
  const x = 8 + p * 84; // %
  const y = 92 - p * 78; // % (invert)
  return (
    <div className="relative h-[230px] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a1628]">
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_10%_100%,rgba(37,99,235,0.18),transparent_55%)]" />
      {/* grid */}
      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:38px_38px]" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="crashFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={crashed ? '#ef4444' : '#3b82f6'} stopOpacity="0.5" />
            <stop offset="100%" stopColor={crashed ? '#ef4444' : '#3b82f6'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M8,92 Q${8 + (x - 8) * 0.5},${92 - (92 - y) * 0.25} ${x},${y} L${x},92 Z`}
          fill="url(#crashFill)"
        />
        <path
          d={`M8,92 Q${8 + (x - 8) * 0.5},${92 - (92 - y) * 0.25} ${x},${y}`}
          fill="none"
          stroke={crashed ? '#ef4444' : '#56a6ff'}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      {/* rocket at the tip */}
      <div
        className="absolute transition-[left,top] duration-100 ease-out"
        style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}
      >
        <Icon3D name="rocket" size={40} glow />
      </div>
      {/* multiplier readout */}
      <div className="absolute inset-x-0 top-7 flex flex-col items-center">
        <span
          className={`font-odd-num text-5xl font-extrabold tabular-nums tracking-tight ${
            crashed ? 'text-[#ef4444]' : 'text-white'
          }`}
          style={{ textShadow: '0 4px 24px rgba(59,130,246,0.45)' }}
        >
          {mult.toFixed(2)}x
        </span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8ca3bd]">
          {crashed ? 'Crashed' : 'In flight'}
        </span>
      </div>
    </div>
  );
}

function ReelStage({ icon }: { icon: Icon3DName }) {
  const tiles = ['#1d4ed8', '#ef4444', '#22c55e', '#1d4ed8', '#ef4444', '#1d4ed8', '#22c55e', '#ef4444'];
  return (
    <div className="relative flex h-[230px] w-full flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a1628]">
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(37,99,235,0.2),transparent_55%)]" />
      <Icon3D name={icon} size={64} glow />
      <div className="flex items-center gap-2">
        {tiles.map((c, i) => (
          <span
            key={i}
            className="h-12 w-12 rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
            style={{ background: c, opacity: i === 3 ? 1 : 0.55, transform: i === 3 ? 'scale(1.12)' : 'none' }}
          />
        ))}
      </div>
      <span className="absolute top-1.5 h-3 w-3 rotate-45 bg-white" />
    </div>
  );
}

export default function GameModal({
  data,
  onClose,
  onPlay,
}: {
  data: GameModalData;
  onClose: () => void;
  /** when provided, the primary CTA launches the real game instead of the mock bet */
  onPlay?: () => void;
}) {
  const [stake, setStake] = useState(54.4);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const adjust = (f: number) => setStake((s) => Math.max(0.1, +(s * f).toFixed(2)));

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${data.title} game`}
    >
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{ opacity: mounted ? 1 : 0, transition: 'opacity 200ms var(--ease-out)' }}
      />

      {/* panel */}
      <div
        className="relative z-10 w-full max-w-[860px] overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#0c1726] shadow-[0_40px_120px_rgba(0,0,0,0.7)]"
        style={{
          transformOrigin: 'center',
          transform: mounted ? 'scale(1)' : 'scale(0.95)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 220ms var(--ease-out), opacity 220ms var(--ease-out)',
        }}
      >
        {/* header */}
        <div className="relative flex items-center justify-between px-5 py-4">
          <div className={`absolute inset-0 -z-10 bg-gradient-to-r ${data.accent} opacity-90`} />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_140%_at_85%_0%,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="flex items-center gap-3">
            <Icon3D name={data.icon} size={44} glow />
            <div>
              <h2 className="text-2xl font-extrabold leading-none tracking-tight text-white">{data.title}</h2>
              <span className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
                <Users className="h-3.5 w-3.5" /> {data.players} playing
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="odd69-press grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-black/25 text-white hover:bg-black/40"
            aria-label="Close game"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-[1fr_280px]">
          {/* main stage + bet controls */}
          <div className="flex flex-col gap-4">
            {data.kind === 'crash' ? <CrashStage active={mounted} /> : <ReelStage icon={data.icon} />}

            {/* recent results */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {RECENT.map((r, i) => (
                <span
                  key={i}
                  className={`font-odd-num shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                    r === '1.00x'
                      ? 'bg-[#ef4444]/15 text-[#ff7a7a]'
                      : parseFloat(r) >= 5
                        ? 'bg-[#22c55e]/15 text-[#6ee7a8]'
                        : 'bg-white/[0.05] text-[#9fb2c9]'
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>

            {/* bet panel */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#101f33] p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center rounded-xl border border-white/[0.07] bg-[#0a1628] px-2">
                  <button type="button" onClick={() => adjust(0.5)} className="odd69-press grid h-9 w-9 place-items-center rounded-lg text-[#9fb2c9] hover:text-white" aria-label="Halve stake">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-odd-num flex-1 text-center text-[15px] font-bold tabular-nums text-white">
                    $ {stake.toFixed(2)}
                  </span>
                  <button type="button" onClick={() => adjust(2)} className="odd69-press grid h-9 w-9 place-items-center rounded-lg text-[#9fb2c9] hover:text-white" aria-label="Double stake">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {['½', '2×', 'Max'].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => (q === '½' ? adjust(0.5) : q === '2×' ? adjust(2) : setStake(999.0))}
                    className="odd69-press rounded-xl border border-white/[0.07] bg-[#0a1628] px-3 py-2 text-[12px] font-bold text-[#9fb2c9] hover:text-white"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onPlay}
                className="odd69-press mt-3 flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] py-3.5 text-[15px] font-extrabold uppercase tracking-wide text-white shadow-[0_10px_28px_rgba(37,99,235,0.5)]"
              >
                {onPlay ? `Play ${data.title}` : `Place bet · $ ${stake.toFixed(2)}`}
              </button>
            </div>
          </div>

          {/* live bets */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#101f33] p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[12px] font-bold text-white">Live bets</span>
              <span className="text-[11px] font-semibold text-[#7e93ad]">{data.players}</span>
            </div>
            <ul className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto">
              {LIVE_BETS.map((b) => (
                <li key={b.name} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2 py-1.5">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br ${b.tint} text-[11px] font-bold text-white`}>
                    {b.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white/90">{b.name}</span>
                  <span className="font-odd-num text-[11.5px] font-bold tabular-nums text-[#9fb2c9]">$ {b.bet}</span>
                  <span
                    className={`font-odd-num w-12 text-right text-[11.5px] font-bold tabular-nums ${
                      b.win ? 'text-[#6ee7a8]' : 'text-[#5d728d]'
                    }`}
                  >
                    {b.mult}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
