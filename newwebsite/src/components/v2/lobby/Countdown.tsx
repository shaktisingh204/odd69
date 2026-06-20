"use client";

import { useState, useEffect } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

// Hydration-safe ticking countdown. SSR + first client render show the initial
// value (no mismatch); it starts ticking after mount.
export default function Countdown({
  seconds,
  days = false,
  boxed = false,
  className = "",
}: {
  seconds: number;
  days?: boolean;
  boxed?: boolean;
  className?: string;
}) {
  const [s, setS] = useState(seconds);

  useEffect(() => {
    const id = setInterval(() => setS((x) => (x > 1 ? x - 1 : seconds)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = days ? [d, h, m, sec] : [h, m, sec];

  if (boxed) {
    return (
      <div className="flex items-center gap-1.5" suppressHydrationWarning>
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-black/30 font-mono text-lg font-bold text-white">{pad(p)}</span>
            {i < parts.length - 1 && <span className="text-white/40">:</span>}
          </span>
        ))}
      </div>
    );
  }

  return (
    <span className={className} suppressHydrationWarning>
      {parts.map(pad).join(" : ")}
    </span>
  );
}
