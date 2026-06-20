"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Zap, ShieldCheck, Headphones } from "lucide-react";
import { useModal } from "@/context/ModalContext";

const TRUST = [
  { icon: Zap, label: "Instant payouts", sub: "Withdrawals in minutes" },
  { icon: ShieldCheck, label: "Provably fair", sub: "Verify every result" },
  { icon: Headphones, label: "24 / 7 support", sub: "Real humans, any hour" },
];

export default function WelcomeBonus() {
  const { openRegister } = useModal();
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto max-w-[1240px] px-4 py-14 md:px-6 md:py-20">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[2rem] border border-white/12 p-7 md:p-12"
        style={{ background: "linear-gradient(120deg, #1a0a2e 0%, #0c0718 55%, #06121f 100%)" }}
      >
        <div className="v2-spin-slow pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-40 blur-3xl"
             style={{ background: "conic-gradient(from 0deg, #ff2e9a, #b14dff, #22d3ee, #ff2e9a)" }} />

        <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-base font-bold uppercase tracking-wider text-[#22d3ee]">Welcome bonus</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-[0.95] tracking-tight text-white md:text-6xl">
              200% up to
              <br />
              <span className="v2-grad-text">₹50,000</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/60">
              New players only. Your first deposit, doubled. Wagering applies, claim it the moment you join.
            </p>
            <button
              onClick={openRegister}
              className="mt-7 rounded-full px-8 py-4 text-base font-bold text-[#0b0712] shadow-[0_16px_50px_-12px_rgba(255,46,154,0.8)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              style={{ backgroundImage: "linear-gradient(108deg,#ff2e9a,#b14dff 55%,#22d3ee)" }}
            >
              Join free
            </button>
          </div>

          <div className="flex justify-center md:justify-end">
            <Image
              src="/odd69/icons-3d/gift.png"
              alt="Welcome gift"
              width={220}
              height={220}
              className="v2-float drop-shadow-[0_24px_60px_rgba(255,46,154,0.45)]"
              style={{ width: 200, height: 200 }}
            />
          </div>
        </div>
      </motion.div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TRUST.map((t) => (
          <div key={t.label} className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[#22d3ee]">
              <t.icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-sm font-bold text-white">{t.label}</p>
              <p className="text-xs text-white/45">{t.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
