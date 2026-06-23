"use client";

import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundMuted, setSoundMuted } from "@/utils/originalsFx";

interface SoundToggleProps {
  /** Optional extra classes to merge onto the button. */
  className?: string;
}

/**
 * Tiny icon button that toggles the shared Originals sound on/off.
 *
 * Reads / writes the mute preference through the FX util
 * (`isSoundMuted` / `setSoundMuted`), which persists to localStorage. The
 * util's value is the single source of truth; we mirror it into local state
 * only so the icon re-renders on click.
 *
 * SSR-safe: `isSoundMuted()` returns `false` on the server, and React's mount
 * effect reconciles to the persisted value on the client (avoids hydration
 * mismatch).
 */
export default function SoundToggle({ className = "" }: SoundToggleProps) {
  // Start from the SSR-safe default and sync to the persisted value after mount.
  const [muted, setMuted] = React.useState(false);

  React.useEffect(() => {
    setMuted(isSoundMuted());
  }, []);

  const toggle = () => {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
  };

  const label = muted ? "Unmute sound" : "Mute sound";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={muted}
      title={label}
      className={`grid place-items-center w-8 h-8 rounded-lg bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af] hover:text-white hover:border-white/[0.12] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9a3d]/60 ${className}`}
    >
      {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
    </button>
  );
}
