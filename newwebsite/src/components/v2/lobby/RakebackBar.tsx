"use client";

import Image from "next/image";

export default function RakebackBar() {
  const digits = ["09", "11", "56", "04"];
  return (
    <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl p-5 md:flex-row md:justify-between md:p-6"
         style={{ background: "linear-gradient(100deg,#4a2a7a 0%,#2a1a4a 45%,#1b1411 100%)" }}>
      {/* flying coins */}
      <span className="pointer-events-none absolute left-1/2 top-2 h-4 w-4 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%,#ffe08a,#e0922a)" }} />
      <span className="pointer-events-none absolute left-[44%] bottom-3 h-3 w-3 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%,#ffe08a,#e0922a)" }} />

      <div className="flex items-center gap-3">
        <Image src="/odd69/icons-3d/trophy.png" alt="" width={54} height={54} style={{ width: 48, height: 48 }} />
        <p className="max-w-[210px] text-sm font-medium leading-snug text-white/75">
          Earn rewards from every single bet you place.
        </p>
      </div>

      <h3 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">Daily Rakeback</h3>

      <div className="flex items-center gap-1.5">
        {digits.map((d, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-black/30 font-mono text-lg font-bold text-white">{d}</span>
            {i < digits.length - 1 && <span className="text-white/40">:</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
