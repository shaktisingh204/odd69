"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Users } from "lucide-react";
import { ORIGINALS } from "./data";

export default function OriginalsRail() {
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto max-w-[1240px] px-4 py-14 md:px-6 md:py-20">
      <div className="mb-7 flex items-end justify-between gap-4">
        <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
          ODD69 <span className="v2-grad-text">Originals</span>
        </h2>
        <Link
          href="/odd69-games"
          className="group inline-flex shrink-0 items-center gap-1 text-sm font-bold text-white/60 transition-colors hover:text-white"
        >
          View all
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.4} />
        </Link>
      </div>

      <div className="v2-no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {ORIGINALS.map((g, i) => (
          <motion.div
            key={g.slug}
            initial={reduce ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: Math.min(i * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
            className="snap-start"
          >
            <Link
              href={`/odd69-games/${g.slug}`}
              className="group relative flex h-[228px] w-[176px] flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/25"
              style={{ ["--glow" as string]: g.glow }}
            >
              {/* glow wash on hover */}
              <div
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `radial-gradient(120% 90% at 50% 0%, ${g.glow}33, transparent 70%)`, boxShadow: `inset 0 0 0 1px ${g.glow}66` }}
              />
              <div className="relative flex items-start justify-between">
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                  style={{ background: `${g.glow}26`, color: g.glow }}
                >
                  {g.tag}
                </span>
              </div>

              <div className="relative flex flex-1 items-center justify-center">
                <Image
                  src={`/odd69/icons-3d/${g.icon}.png`}
                  alt={g.name}
                  width={92}
                  height={92}
                  className="transition-transform duration-300 group-hover:scale-110"
                  style={{ width: 92, height: 92, filter: `drop-shadow(0 10px 24px ${g.glow}55)` }}
                />
              </div>

              <div className="relative">
                <p className="text-lg font-bold text-white">{g.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-white/45">
                  <Users className="h-3 w-3" strokeWidth={2.2} /> {g.players} playing
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
