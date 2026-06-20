"use client";

import Image from "next/image";
import { Bomb } from "lucide-react";
import { useModal } from "@/context/ModalContext";
import { BANNERS } from "./data";

export default function PromoBanners() {
  const { openDeposit } = useModal();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr_1fr]">
      {/* 1 — Mines */}
      <div className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-3xl p-6" style={{ background: BANNERS[0].grad }}>
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2">
          <div className="absolute right-6 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-white/15 blur-2xl" />
          <Image src="/odd69/icons-3d/bomb.png" alt="Mines" width={200} height={200} className="v2-float absolute right-4 top-1/2 -translate-y-1/2 drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]" style={{ width: 190, height: 190 }} />
        </div>
        <div className="relative">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ff4d6d] text-white"><Bomb className="h-4 w-4" strokeWidth={2.4} /></span>
            <div className="leading-tight">
              <p className="text-sm font-extrabold text-white">Mines</p>
              <p className="text-xs text-white/70">Reward weekend</p>
            </div>
          </div>
          <h3 className="max-w-[58%] text-3xl font-extrabold leading-[1.05] tracking-tight text-white md:text-[2.2rem]">
            Get up to<br />50% bonus<br />in Mines game
          </h3>
        </div>
        <button onClick={openDeposit} className="relative w-fit rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-8px_rgba(255,106,0,0.8)] active:scale-[0.97]" style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}>
          Deposit
        </button>
      </div>

      {/* 2 — cashback */}
      <div className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-3xl p-6 text-center" style={{ background: BANNERS[1].grad }}>
        <div>
          <h3 className="text-4xl font-extrabold leading-[0.95] tracking-tight text-white">20%<br />cashback</h3>
          <span className="mt-3 inline-block rounded-full bg-[#ff5ca0] px-4 py-1 text-sm font-bold text-white">on loose</span>
        </div>
        <div className="pointer-events-none mx-auto -my-2">
          <Image src="/odd69/icons-3d/moneybag.png" alt="" width={120} height={120} className="v2-float" style={{ width: 110, height: 110 }} />
        </div>
        <p className="whitespace-pre-line text-sm font-medium leading-snug text-white/70">{BANNERS[1].foot}</p>
      </div>

      {/* 3 — Hunt treasury */}
      <div className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-3xl p-6 text-center" style={{ background: BANNERS[2].grad }}>
        <div>
          <h3 className="text-3xl font-extrabold leading-tight tracking-tight text-white">Hunt<br />treasury</h3>
          <p className="mt-1 text-sm font-semibold text-white/85">Get 100% rakeback</p>
        </div>
        <div className="pointer-events-none mx-auto">
          <Image src="/odd69/icons-3d/moneybag.png" alt="" width={130} height={130} className="v2-float" style={{ width: 120, height: 120, filter: "hue-rotate(-12deg) saturate(1.3)" }} />
        </div>
        <button className="mx-auto w-fit rounded-xl bg-black/35 px-6 py-2.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-black/45 active:scale-[0.97]">
          Hunt now
        </button>
      </div>
    </div>
  );
}
