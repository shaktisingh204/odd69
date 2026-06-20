"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useModal } from "@/context/ModalContext";
import { HERO_ICONS } from "./data";

export default function V2Hero() {
  const { openRegister } = useModal();
  const reduce = useReducedMotion();

  const rise = (d: number) => ({
    initial: reduce ? false : { opacity: 0, y: 26 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay: d, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section className="relative mx-auto flex min-h-[92dvh] max-w-[1240px] flex-col justify-center px-4 pb-16 pt-10 md:px-6 md:pt-16">
      {/* floating 3D game art */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {HERO_ICONS.map((it) => (
          <div
            key={it.icon}
            className="v2-float absolute hidden drop-shadow-[0_18px_40px_rgba(177,77,255,0.35)] sm:block"
            style={{ left: it.x, top: it.y, animationDelay: `${it.delay}s`, ["--v2-rot" as string]: `${it.rot}deg` }}
          >
            <Image
              src={`/odd69/icons-3d/${it.icon}.png`}
              alt=""
              width={it.size}
              height={it.size}
              className="select-none"
              style={{ width: it.size, height: it.size }}
            />
          </div>
        ))}
      </div>

      <div className="relative max-w-3xl">
        <motion.div
          {...rise(0)}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-white/70 backdrop-blur-sm"
        >
          <span className="v2-pulse h-2 w-2 rounded-full bg-[#34d399] shadow-[0_0_10px_#34d399]" />
          24,318 playing now
        </motion.div>

        <motion.h1
          {...rise(0.08)}
          className="text-[clamp(3rem,11vw,7rem)] font-extrabold leading-[0.92] tracking-[-0.03em] text-white"
        >
          Play loud.
          <br />
          <span className="v2-grad-text">Win louder.</span>
        </motion.h1>

        <motion.p
          {...rise(0.16)}
          className="mt-6 max-w-xl text-lg leading-relaxed text-white/65"
        >
          Casino, crash games and live sports. One wallet, instant payouts, provably fair.
        </motion.p>

        <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap items-center gap-3">
          <button
            onClick={openRegister}
            className="rounded-full px-7 py-3.5 text-base font-bold text-[#0b0712] shadow-[0_14px_44px_-10px_rgba(255,46,154,0.75)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            style={{ backgroundImage: "linear-gradient(108deg,#ff2e9a,#b14dff 55%,#22d3ee)" }}
          >
            Join free
          </button>
          <Link
            href="/odd69-games"
            className="rounded-full border border-white/15 bg-white/[0.03] px-7 py-3.5 text-base font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/[0.08] active:scale-[0.98]"
          >
            Explore games
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
