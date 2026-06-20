"use client";

import Image from "next/image";
import Countdown from "./Countdown";

export default function RakebackBar() {
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

      <Countdown seconds={9 * 86400 + 11 * 3600 + 56 * 60 + 4} days boxed />
    </div>
  );
}
