/**
 * Client-side mirror of the backend Keno paytable
 * (newbackend/src/originals/services/keno.service.ts → PAYTABLE).
 *
 * Keyed [risk][picks] = number[] indexed by hit-count.
 *   multiplier = PAYTABLE[risk]?.[picks]?.[hits] ?? 0
 *
 * This is DISPLAY-ONLY: it powers the live odds ladder + profit-on-win readout
 * so the player sees the exact multiplier ladder before committing. The server
 * remains the sole source of truth for the actual payout — these values must
 * stay in sync with the backend constant.
 */
export type KenoRisk = "low" | "classic" | "medium" | "high";

export const KENO_RISKS: KenoRisk[] = ["low", "classic", "medium", "high"];

export const KENO_PAYTABLE: Record<KenoRisk, Record<number, number[]>> = {
  low: {
    1: [0, 3.8],
    2: [0, 1.8, 4.3],
    3: [0, 0.96, 3, 10],
    4: [0, 0.78, 1.7, 4.9, 22],
    5: [0, 0.52, 1.2, 3.4, 12, 34],
    6: [0, 0, 1.2, 2.6, 7.9, 21, 61],
    7: [0, 0, 0.9, 2.2, 3.9, 12, 28, 105],
    8: [0, 0, 0, 2.4, 4, 6.5, 18, 52, 155],
    9: [0, 0, 0, 1.8, 3, 5.2, 8.9, 21, 61, 480],
    10: [0, 0, 0, 1.4, 2.3, 3.6, 6.4, 11, 24, 71, 1430],
  },
  classic: {
    1: [0, 3.8],
    2: [0, 1.5, 6.6],
    3: [0, 0.93, 2.6, 15],
    4: [0, 0.75, 1.7, 4.7, 30],
    5: [0, 0.52, 1.2, 3.3, 12, 49],
    6: [0, 0, 1, 3.1, 8.2, 18, 76],
    7: [0, 0, 0.53, 2.1, 6.3, 15, 53, 210],
    8: [0, 0, 0, 2, 4, 12, 30, 100, 360],
    9: [0, 0, 0, 1.4, 2.9, 7.7, 17, 62, 190, 555],
    10: [0, 0, 0, 1.1, 2.5, 4.1, 9.8, 29, 98, 310, 1230],
  },
  medium: {
    1: [0, 3.8],
    2: [0, 1.3, 8.1],
    3: [0, 0, 3.9, 35],
    4: [0, 0, 2.2, 8.9, 55],
    5: [0, 0, 1.4, 4.5, 18, 115],
    6: [0, 0, 0.76, 3, 11, 27, 185],
    7: [0, 0, 0, 2.7, 7.2, 20, 77, 340],
    8: [0, 0, 0, 1.7, 5, 12, 41, 180, 605],
    9: [0, 0, 0, 1.4, 2.9, 7.1, 21, 88, 345, 785],
    10: [0, 0, 0, 1, 2.2, 5, 14, 50, 175, 625, 1880],
  },
  high: {
    1: [0, 3.8],
    2: [0, 0, 16.47],
    3: [0, 0, 0, 78],
    4: [0, 0, 0, 9.8, 245],
    5: [0, 0, 0, 4.3, 46, 430],
    6: [0, 0, 0, 0, 11, 335, 670],
    7: [0, 0, 0, 0, 6.7, 86, 385, 770],
    8: [0, 0, 0, 0, 4.8, 19, 260, 575, 865],
    9: [0, 0, 0, 0, 3.8, 11, 54, 480, 770, 960],
    10: [0, 0, 0, 0, 3.4, 7.7, 12, 60, 480, 770, 1920],
  },
};

/**
 * The multiplier ladder for a given risk + pick-count, as
 * `[{ hits, multiplier }]` (one entry per possible hit count 0..picks).
 * Returns `[]` when picks is 0.
 */
export function kenoLadder(
  risk: KenoRisk,
  picks: number,
): { hits: number; multiplier: number }[] {
  if (picks < 1) return [];
  const row = KENO_PAYTABLE[risk]?.[picks];
  if (!row) return [];
  return row.map((multiplier, hits) => ({ hits, multiplier }));
}

/** The highest multiplier achievable for the current risk + pick-count. */
export function kenoMaxMultiplier(risk: KenoRisk, picks: number): number {
  const row = KENO_PAYTABLE[risk]?.[picks];
  if (!row) return 0;
  return Math.max(0, ...row);
}
