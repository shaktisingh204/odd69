"use client";

import React from "react";
import { motion } from "framer-motion";
import { kenoLadder, type KenoRisk } from "./paytable";

const ACCENT = "#ff9a3d";

/**
 * Live odds ladder for the chosen risk + pick-count. Renders one card per
 * possible hit-count (0..picks), each showing its multiplier. This is the
 * signature Stake-Keno element shown BEFORE and DURING a bet so the player
 * sees the exact reward for every outcome.
 *
 * `activeHits` (the resolved hit-count, post-draw) lights the achieved cell.
 * `revealedHits` (the running hit-count as balls land) softly ticks the cells
 * the draw has "passed through" while revealing.
 */
export default function KenoLadder({
  risk,
  picks,
  activeHits,
  revealedHits,
}: {
  risk: KenoRisk;
  picks: number;
  /** Resolved hit count once the draw is fully revealed (null while idle/revealing). */
  activeHits: number | null;
  /** Running hit count during the reveal (drives the soft tick-through). */
  revealedHits: number;
}) {
  const ladder = kenoLadder(risk, picks);
  if (ladder.length === 0) {
    return (
      <div className="text-center text-[11px] text-[#6b7280] py-3">
        Select numbers to see the payout ladder
      </div>
    );
  }

  return (
    <div
      className="grid gap-1.5"
      style={{
        gridTemplateColumns: `repeat(${ladder.length}, minmax(0, 1fr))`,
      }}
    >
      {ladder.map(({ hits, multiplier }) => {
        const pays = multiplier > 0;
        const isActive = activeHits === hits;
        const ticked = activeHits === null && hits <= revealedHits && hits > 0;

        return (
          <motion.div
            key={hits}
            animate={
              isActive
                ? { scale: [1, 1.12, 1.04], y: 0 }
                : { scale: 1, y: 0 }
            }
            transition={
              isActive
                ? { duration: 0.45, ease: "easeOut" }
                : { type: "spring", stiffness: 300, damping: 24 }
            }
            className="rounded-lg px-1 py-2 flex flex-col items-center justify-center text-center border transition-colors"
            style={{
              background: isActive
                ? pays
                  ? "rgba(16,185,129,0.18)"
                  : "rgba(255,255,255,0.06)"
                : ticked
                  ? "rgba(255,154,61,0.08)"
                  : "rgba(255,255,255,0.02)",
              borderColor: isActive
                ? pays
                  ? "rgba(16,185,129,0.55)"
                  : "rgba(255,255,255,0.16)"
                : "rgba(255,255,255,0.06)",
              boxShadow:
                isActive && pays
                  ? "0 0 18px rgba(16,185,129,0.4)"
                  : "none",
            }}
          >
            <span
              className="text-[11px] sm:text-xs font-black tabular-nums leading-none"
              style={{
                color: isActive
                  ? pays
                    ? "#34d399"
                    : "#9ca3af"
                  : pays
                    ? ACCENT
                    : "#4b5563",
              }}
            >
              {multiplier === 0 ? "0" : `${multiplier}×`}
            </span>
            <span
              className="mt-1 text-[9px] font-bold uppercase tracking-wide leading-none"
              style={{ color: isActive ? "#e5e7eb" : "#6b7280" }}
            >
              {hits} hit{hits === 1 ? "" : "s"}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
