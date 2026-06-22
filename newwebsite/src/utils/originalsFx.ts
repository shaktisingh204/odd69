/**
 * originalsFx — shared client-side FX helpers for ODD69 "Originals" game pages.
 *
 * Provides celebratory confetti bursts (via canvas-confetti) and lightweight
 * synthesized UI sounds (via the Web Audio API — no audio files needed).
 *
 * Everything here is SSR-safe: `canvas-confetti` and the `AudioContext` are
 * imported / created lazily inside the functions, and every browser API access
 * is guarded with `typeof window !== 'undefined'`. Importing this module on the
 * server is therefore a no-op and never throws.
 *
 * Theme accent: #ff9a3d (orange).
 */

// ---------------------------------------------------------------------------
// Confetti
// ---------------------------------------------------------------------------

// canvas-confetti is published with `export =`, so its module value is the
// callable confetti function. Capture that callable type (loaded lazily so SSR
// never actually imports the package).
type ConfettiFn = typeof import('canvas-confetti');

let confettiPromise: Promise<ConfettiFn | null> | null = null;

/** Lazily import canvas-confetti on the client. Returns null on the server. */
function getConfetti(): Promise<ConfettiFn | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!confettiPromise) {
    confettiPromise = import('canvas-confetti')
      // Under esModuleInterop a CJS `export =` module is exposed as `default`.
      .then((mod) => (mod.default ?? mod) as ConfettiFn)
      .catch(() => null);
  }
  return confettiPromise;
}

// Theme accent palette.
const ORANGE = '#ff9a3d';
const WHITE = '#ffffff';
const GOLD = '#ffd24a';
const DEEP_ORANGE = '#ff6a00';

/**
 * Modest orange/white confetti burst. Optionally originate from a screen point
 * (in CSS pixels) — defaults to the centre of the viewport.
 */
export function fireWin(originX?: number, originY?: number): void {
  if (typeof window === 'undefined') return;

  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  const x = typeof originX === 'number' ? originX / w : 0.5;
  const y = typeof originY === 'number' ? originY / h : 0.5;

  void getConfetti().then((confetti) => {
    if (!confetti) return;
    confetti({
      particleCount: 70,
      spread: 65,
      startVelocity: 38,
      gravity: 0.95,
      scalar: 0.9,
      ticks: 160,
      origin: { x, y },
      colors: [ORANGE, WHITE, GOLD],
      disableForReducedMotion: true,
    });
  });
}

/**
 * Large celebratory gold + orange confetti barrage, for big multipliers /
 * jackpots. Fires a couple of wide bursts plus a brief streaming effect.
 */
export function fireBigWin(): void {
  if (typeof window === 'undefined') return;

  void getConfetti().then((confetti) => {
    if (!confetti) return;

    const colors = [GOLD, ORANGE, DEEP_ORANGE, WHITE];

    // Two big symmetrical cannon bursts from the lower corners.
    confetti({
      particleCount: 160,
      angle: 60,
      spread: 75,
      startVelocity: 55,
      gravity: 1,
      scalar: 1.1,
      ticks: 220,
      origin: { x: 0, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 160,
      angle: 120,
      spread: 75,
      startVelocity: 55,
      gravity: 1,
      scalar: 1.1,
      ticks: 220,
      origin: { x: 1, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });

    // A central upward fountain for extra flair.
    confetti({
      particleCount: 120,
      spread: 100,
      startVelocity: 45,
      gravity: 0.9,
      scalar: 1.2,
      ticks: 240,
      origin: { x: 0.5, y: 0.45 },
      colors,
      disableForReducedMotion: true,
    });

    // A short streaming tail of smaller particles.
    const end = Date.now() + 700;
    const frame = () => {
      if (Date.now() > end) return;
      confetti({
        particleCount: 6,
        spread: 60,
        startVelocity: 35,
        scalar: 0.8,
        ticks: 160,
        origin: { x: Math.random(), y: Math.random() * 0.3 + 0.1 },
        colors,
        disableForReducedMotion: true,
      });
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(frame);
      }
    };
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(frame);
    }
  });
}

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------

export type SoundName =
  | 'bet'
  | 'win'
  | 'lose'
  | 'tick'
  | 'cashout'
  | 'reveal'
  | 'crash';

const MUTE_STORAGE_KEY = 'odd69_sound_muted';

let muted = false;
let muteLoaded = false;

/** Read the persisted mute preference once, lazily. */
function loadMute(): void {
  if (muteLoaded || typeof window === 'undefined') return;
  muteLoaded = true;
  try {
    muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    // localStorage may be unavailable (private mode / blocked) — ignore.
  }
}

export function isSoundMuted(): boolean {
  loadMute();
  return muted;
}

export function setSoundMuted(v: boolean): void {
  muted = v;
  muteLoaded = true;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, v ? 'true' : 'false');
  } catch {
    // Ignore persistence failures.
  }
}

// A single shared AudioContext, created lazily on first sound.
type AnyWindow = Window & { webkitAudioContext?: typeof AudioContext };
let audioCtx: AudioContext | null = null;

/** Lazily create / resume the shared AudioContext. Returns null on server. */
function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext || (window as AnyWindow).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  // Autoplay policies may leave the context suspended until a user gesture.
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a single oscillator note with an attack/decay gain envelope.
 * `start` is an offset (seconds) from "now" so notes can be sequenced.
 */
function tone(
  ctx: AudioContext,
  opts: {
    freq: number;
    type?: OscillatorType;
    start?: number;
    duration: number;
    peak?: number;
    endFreq?: number;
  },
): void {
  const now = ctx.currentTime + (opts.start ?? 0);
  const dur = opts.duration;
  const peak = opts.peak ?? 0.15;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, now);
  if (typeof opts.endFreq === 'number') {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, opts.endFreq),
      now + dur,
    );
  }

  // Quick attack, smooth exponential decay to (near) silence.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + Math.min(0.012, dur * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + dur + 0.02);
}

/**
 * Play a short synthesized UI sound. No-ops on the server or when muted.
 * Every sound is < 400ms. The AudioContext is created lazily and reused.
 */
export function playSound(name: SoundName): void {
  if (typeof window === 'undefined') return;
  if (isSoundMuted()) return;

  const ctx = getAudioCtx();
  if (!ctx) return;

  switch (name) {
    // Pleasant rising arpeggio (major triad) for positive outcomes.
    case 'win':
    case 'cashout': {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
      notes.forEach((freq, i) => {
        tone(ctx, {
          freq,
          type: 'triangle',
          start: i * 0.075,
          duration: 0.14,
          peak: 0.16,
        });
      });
      break;
    }

    // Short descending tone for losses / crashes.
    case 'lose':
    case 'crash': {
      tone(ctx, {
        freq: 392, // G4
        endFreq: 130, // C3
        type: 'sawtooth',
        duration: 0.32,
        peak: 0.14,
      });
      break;
    }

    // Soft click for placing a bet.
    case 'bet': {
      tone(ctx, {
        freq: 320,
        endFreq: 180,
        type: 'square',
        duration: 0.06,
        peak: 0.08,
      });
      break;
    }

    // Tiny high blip for incremental ticks.
    case 'tick': {
      tone(ctx, {
        freq: 1320,
        type: 'sine',
        duration: 0.035,
        peak: 0.06,
      });
      break;
    }

    // Short upward pop for reveals.
    case 'reveal': {
      tone(ctx, {
        freq: 440,
        endFreq: 880,
        type: 'triangle',
        duration: 0.16,
        peak: 0.14,
      });
      break;
    }

    default:
      break;
  }
}
