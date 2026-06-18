type MarketPricingInput = {
    marketType?: string | null;
    marketName?: string | null;
    selectionName?: string | null;
};

type PotentialWinInput = MarketPricingInput & {
    stake: number;
    odds: number;
    rate?: number | null;
    betType?: 'back' | 'lay' | string | null;
};

const DECIMAL_PRICE_MARKET_TYPES = new Set([
    'match',
    'match1',
    'bookmaker',
    'special',
    'bm',
    'oddeven',
    'fancy1',
    'cricketcasino',
]);
const LINE_BASED_MARKET_TYPES = new Set([
    'session',
    'advsession',
    'fancy',
    'fancy1',
    'fancy2',
    'khado',
    'meter',
    'lambi',
    'other fancy',
]);

const DECIMAL_PRICE_MARKET_KEYWORDS =
    /match[_ ]odds|bookmaker|book maker|odd even|oddeven|toss|will win|winner|to win|result|victory/i;
const LINE_BASED_MARKET_KEYWORDS =
    /runs?|session|fancy|meter|lambi|over|ball|wicket|boundar|six|four|digit|number|score/i;

const roundAmount = (value: number) =>
    parseFloat((Number(value || 0)).toFixed(2));

const normalizePositiveNumber = (value: number | null | undefined) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const normalizeMarketType = (marketType?: string | null) =>
    String(marketType || '').trim().toLowerCase();

export const isDecimalPriceMarket = ({
    marketType,
    marketName,
    selectionName,
}: MarketPricingInput = {}) => {
    const normalizedType = normalizeMarketType(marketType);
    if (DECIMAL_PRICE_MARKET_TYPES.has(normalizedType)) {
        return true;
    }

    const haystack = `${marketName || ''} ${selectionName || ''}`;
    return DECIMAL_PRICE_MARKET_KEYWORDS.test(haystack);
};

export const isLineBasedFancyMarket = (input: MarketPricingInput = {}) => {
    if (isDecimalPriceMarket(input)) {
        return false;
    }

    const normalizedType = normalizeMarketType(input.marketType);

    // ── Authoritative marketType check ───────────────────────────────────────
    // If marketType is explicitly provided and is NOT a known line-based type,
    // trust it over keyword scanning. This prevents Sportradar market names like
    // "Over/Under 2.5 Goals", "Both Teams to Score", "Next Goal", etc. from
    // being misidentified as Indian Fancy/Session markets due to incidental
    // keyword matches (e.g. "over", "score", "four").
    if (normalizedType && !LINE_BASED_MARKET_TYPES.has(normalizedType)) {
        return false;
    }
    // ─────────────────────────────────────────────────────────────────────────

    const haystack = `${input.marketName || ''} ${input.selectionName || ''}`;
    return (
        LINE_BASED_MARKET_KEYWORDS.test(haystack) ||
        LINE_BASED_MARKET_TYPES.has(normalizedType)
    );
};

export const getBetPayoutMultiplier = ({
    odds,
    rate,
    marketType,
    marketName,
    selectionName,
}: Omit<PotentialWinInput, 'stake'>) => {
    const normalizedOdds = normalizePositiveNumber(odds) ?? 0;
    const normalizedRate = normalizePositiveNumber(rate);

    if (
        isLineBasedFancyMarket({
            marketType,
            marketName,
            selectionName,
        })
    ) {
        return normalizedRate ?? normalizedOdds;
    }

    return normalizedOdds;
};

export const calculatePotentialWin = ({
    stake,
    odds,
    rate,
    betType,
    marketType,
    marketName,
    selectionName,
}: PotentialWinInput) => {
    const normalizedStake = Number(stake || 0);
    const normalizedOdds = normalizePositiveNumber(odds) ?? 0;
    const normalizedRate = normalizePositiveNumber(rate);
    const isLay = String(betType || 'back').toLowerCase() === 'lay';

    const GT = String(marketType || '').toUpperCase();
    const isLineBased = isLineBasedFancyMarket({ marketType, marketName, selectionName }) ||
        ['MATCH1', 'KHADO', 'FANCY', 'METER', 'LAMBI'].includes(GT);

    // ── Decimal odds markets (Match Odds, Bookmaker, Toss, OddEven, Fancy1) ──
    if (!isLineBased) {
        // BACK: stake × odds (total return includes stake)
        // LAY:  stake × (1 + 100/(odds-1)*1) -- for decimal odds LAY profit = stake, liability = stake*(odds-1)
        //       But for display: total return = stake + stake*(100/((odds-1)*100)) ≈ handled by odds naturally
        return roundAmount(normalizedStake * normalizedOdds);
    }

    // ── Indian Satta line-based markets (Fancy, Session, Khado, Meter) ──
    // `rate` (size) is the raw integer from feed, e.g. 10, 90, 110, 7
    // We use the raw rate directly — no normalizePositiveNumber since size could be < 1
    const size = (rate != null && Number.isFinite(Number(rate)) && Number(rate) > 0)
        ? Number(rate)
        : 100;

    if (isLay) {
        // LAY:  Typed stake = what you WANT TO WIN (profit)
        //       Wallet deducted = stake (same as typed)
        //       Profit = stake × (100 / size)    [e.g. size=10, stake=100 → profit=1000]
        //       Total Return = stake + profit = stake × (1 + 100/size)
        //       Example: size=10, stake=100 → 100 × 11 = 1100 ✓
        //       Example: size=7,  stake=7   → 7 × (1 + 100/7) = 7 × 15.28 = 107 ✓
        const profit = normalizedStake * (100 / size);
        return roundAmount(normalizedStake + profit);
    } else {
        // BACK: Typed stake = what you RISK (wallet deducted = stake)
        //       Profit = stake × (size / 100)    [e.g. size=90: 100 × 0.9 = 90]
        //       Total Return = stake + profit = stake × (1 + size/100)
        //       Example: size=90,  stake=100 → 100 × 1.9 = 190 ✓
        //       Example: size=110, stake=100 → 100 × 2.1 = 210 ✓
        const profit = normalizedStake * (size / 100);
        return roundAmount(normalizedStake + profit);
    }
};

