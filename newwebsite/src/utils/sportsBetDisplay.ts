import type { Bet } from '@/services/bets';

const roundAmount = (value: number) => parseFloat((Number(value || 0)).toFixed(2));

export const getBetOriginalStake = (bet: Partial<Bet>) =>
    roundAmount(bet.originalStake ?? bet.stake ?? 0);

export const getBetOriginalPotentialWin = (bet: Partial<Bet>) =>
    roundAmount(bet.originalPotentialWin ?? bet.potentialWin ?? 0);

export const getBetPartialCashoutValue = (bet: Partial<Bet>) =>
    roundAmount(bet.partialCashoutValue ?? 0);

export const hasPartialCashout = (bet: Partial<Bet>) =>
    getBetPartialCashoutValue(bet) > 0;

export const getBetSettledReturn = (bet: Partial<Bet>) => {
    const partialCashout = getBetPartialCashoutValue(bet);
    const originalStake = getBetOriginalStake(bet);

    switch (bet.status) {
        case 'WON':
            return roundAmount(partialCashout + (bet.potentialWin ?? 0));
        case 'LOST':
            return partialCashout;
        case 'VOID':
            return roundAmount(partialCashout + (bet.stake ?? originalStake));
        case 'CASHED_OUT':
            return roundAmount(bet.cashoutValue ?? partialCashout);
        default:
            return null;
    }
};

export const getBetNetPnL = (bet: Partial<Bet>) => {
    const settledReturn = getBetSettledReturn(bet);
    if (settledReturn === null) return null;
    return roundAmount(settledReturn - getBetOriginalStake(bet));
};

/**
 * Recalculates the pending max return LIVE using the correct Indian Satta formula.
 * Does NOT use the stored `potentialWin` which may have been saved using old broken logic.
 *
 * BACK: return = stake + stake × (size/100)    e.g. size=90,  stake=100 → 190
 * LAY:  return = stake + stake × (100/size)    e.g. size=10,  stake=100 → 1100
 *
 * Falls back to stored potentialWin for decimal-odds markets (Match Odds) that have no `rate`.
 */
export const getBetPendingMaxReturn = (bet: Partial<Bet>): number => {
    const partialCashout = getBetPartialCashoutValue(bet);
    const stake = Number(bet.stake ?? 0);
    // `rate` holds the size (e.g., 90, 110, 7, 10) for line-based markets
    const size = Number((bet as any).rate ?? (bet as any).size ?? 0);
    const isLay = String((bet as any).betType || 'back').toLowerCase() === 'lay';

    if (size > 0) {
        const profit = isLay
            ? stake * (100 / size)   // LAY:  size=10, stake=100 → profit=1000
            : stake * (size / 100);  // BACK: size=90, stake=100 → profit=90
        return roundAmount(partialCashout + stake + profit);
    }

    // Fallback: Match Odds / Bookmaker / Fancy1 — use stored potentialWin
    return roundAmount(partialCashout + (bet.potentialWin ?? 0));
};
