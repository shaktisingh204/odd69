"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { WORLDS } from "./data";

export default function WorldsBento() {
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto max-w-[1240px] px-4 py-14 md:px-6 md:py-20">
      <h2 className="mb-7 max-w-2xl text-3xl font-extrabold tracking-tight text-white md:text-5xl">
        Four ways to <span className="v2-grad-text">break the bank</span>
      </h2>

      <div className="grid auto-rows-[180px] grid-cols-1 gap-4 md:grid-cols-4">
        {WORLDS.map((w, i) => (
          <motion.div
            key={w.name}
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
            className={w.span}
          >
            <Link
              href={w.href}
              className="group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-3xl border border-white/10 p-5 transition-transform duration-300 hover:-translate-y-1"
              style={{ background: `linear-gradient(150deg, ${w.from} 0%, ${w.to} 78%)` }}
            >
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                   style={{ boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.35)" }} />
              <div className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 rounded-full bg-white/15 blur-2xl" />

              <div className="relative flex items-start justify-between">
                <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm">
                  {w.count}
                </span>
                <ArrowUpRight className="h-6 w-6 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.4} />
              </div>

              <div className="relative flex items-end justify-between">
                <h3 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm md:text-4xl">
                  {w.name}
                </h3>
                <Image
                  src={`/odd69/icons-3d/${w.icon}.png`}
                  alt=""
                  width={64}
                  height={64}
                  className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                  style={{ width: 64, height: 64, filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.4))" }}
                />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
