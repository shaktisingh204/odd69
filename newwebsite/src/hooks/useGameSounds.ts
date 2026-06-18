"use client";

import { useCallback, useRef, useState, useEffect } from "react";

/* ─── tiny Audio helpers ──────────────────────────────────────────── */

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
}

function makeGain(ctx: AudioContext, value: number) {
  const g = ctx.createGain();
  g.gain.value = value;
  g.connect(ctx.destination);
  return g;
}

/* --- play a simple oscillator tone --- */
function playTone(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  start: number,
  dur: number,
  gainStart: number,
  gainEnd: number,
  output: AudioNode,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gainStart, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(
    Math.max(gainEnd, 0.0001),
    ctx.currentTime + start + dur,
  );
  osc.connect(g);
  g.connect(output);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur);
}

/* --- noise burst (for explosions / dice) --- */
function playNoise(
  ctx: AudioContext,
  dur: number,
  gainPeak: number,
  lpFreq: number,
  output: AudioNode,
) {
  const bufSize = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = lpFreq;

  const g = ctx.createGain();
  g.gain.setValueAtTime(gainPeak, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);

  src.connect(lp);
  lp.connect(g);
  g.connect(output);
  src.start();
  src.stop(ctx.currentTime + dur);
}

/* ─── main hook ───────────────────────────────────────────────────── */
export function useGameSounds() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMutedState] = useState(false);
  const mutedRef = useRef(false);

  // Persist mute pref
  useEffect(() => {
    const saved = localStorage.getItem("zeero_sounds_muted");
    if (saved === "1") { mutedRef.current = true; setMutedState(true); }
  }, []);

  const setMuted = useCallback((v: boolean) => {
    mutedRef.current = v;
    setMutedState(v);
    localStorage.setItem("zeero_sounds_muted", v ? "1" : "0");
  }, []);

  const toggleMute = useCallback(() => setMuted(!mutedRef.current), [setMuted]);

  /** Ensure AudioContext is ready (requires user gesture) */
  const ctx = useCallback((): AudioContext | null => {
    if (mutedRef.current) return null;
    if (!ctxRef.current) ctxRef.current = getCtx();
    if (ctxRef.current?.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  /* ──────────────────────────────────────────────────────────────── */

  /** Short coin click — bet placed */
  const playBet = useCallback(() => {
    const c = ctx(); if (!c) return;
    const out = makeGain(c, 0.8);
    playTone(c, 880, "sine", 0, 0.05, 0.4, 0.001, out);
    playTone(c, 1200, "sine", 0.04, 0.04, 0.2, 0.001, out);
  }, [ctx]);

  /** Rising tick tuned to multiplier — call every tick event for crash/limbo */
  const playTick = useCallback((multiplier: number) => {
    const c = ctx(); if (!c) return;
    // Frequency rises with multiplier (200-1600 Hz range)
    const freq = Math.min(200 + (multiplier - 1) * 80, 1600);
    const out = makeGain(c, 0.25);
    playTone(c, freq, "sine", 0, 0.06, 0.12, 0.001, out);
  }, [ctx]);

  /** Ascending arpeggio — cashout win */
  const playWin = useCallback(() => {
    const c = ctx(); if (!c) return;
    const out = makeGain(c, 1.0);
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => playTone(c, f, "sine", i * 0.09, 0.12, 0.45, 0.001, out));
  }, [ctx]);

  /** Multi-note fanfare — big win */
  const playBigWin = useCallback(() => {
    const c = ctx(); if (!c) return;
    const out = makeGain(c, 1.1);
    const phrases = [523, 659, 784, 1047, 1319, 1047, 1319, 1568];
    phrases.forEach((f, i) => playTone(c, f, "sine", i * 0.1, 0.15, 0.5, 0.001, out));
    playNoise(c, 0.2, 0.08, 3000, out);
  }, [ctx]);

  /** Low rumble + descending wail — crash */
  const playCrash = useCallback(() => {
    const c = ctx(); if (!c) return;
    const out = makeGain(c, 1.2);
    // Descending siren
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(600, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.5);
    g.gain.setValueAtTime(0.5, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5);
    osc.connect(g); g.connect(out);
    osc.start(); osc.stop(c.currentTime + 0.55);
    // Noise burst
    playNoise(c, 0.4, 0.3, 800, out);
  }, [ctx]);

  /** High sparkling chime — gem reveal */
  const playGemReveal = useCallback(() => {
    const c = ctx(); if (!c) return;
    const out = makeGain(c, 0.7);
    playTone(c, 2093, "sine", 0, 0.1, 0.3, 0.001, out);
    playTone(c, 2637, "sine", 0.05, 0.1, 0.2, 0.001, out);
  }, [ctx]);

  /** Low boom — mine explosion */
  const playMineExplosion = useCallback(() => {
    const c = ctx(); if (!c) return;
    const out = makeGain(c, 1.4);
    playNoise(c, 0.6, 0.7, 400, out);
    playTone(c, 80, "sine", 0, 0.3, 0.5, 0.001, out);
  }, [ctx]);

  /** Rapid staccato ticks — dice roll */
  const playDiceRoll = useCallback(() => {
    const c = ctx(); if (!c) return;
    const out = makeGain(c, 0.5);
    for (let i = 0; i < 10; i++) {
      const freq = 300 + Math.random() * 400;
      playNoise(c, 0.03, 0.25, freq, out);
      playTone(c, freq, "square", i * 0.06, 0.03, 0.15, 0.001, out);
    }
  }, [ctx]);

  /** Pitch-tracking rising tone — limbo rising multiplier */
  const playLimboRise = useCallback((mult: number) => {
    const c = ctx(); if (!c) return;
    const freq = Math.min(150 + (mult - 1) * 60, 1200);
    const out = makeGain(c, 0.2);
    playTone(c, freq, "sine", 0, 0.08, 0.1, 0.001, out);
  }, [ctx]);

  return {
    playBet,
    playTick,
    playWin,
    playBigWin,
    playCrash,
    playGemReveal,
    playMineExplosion,
    playDiceRoll,
    playLimboRise,
    muted,
    setMuted,
    toggleMute,
  };
}
