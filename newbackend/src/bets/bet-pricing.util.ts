type MarketPricingInput = {
  marketType?: string | null;
  marketName?: string | null;
  selectionName?: string | null;
};

type PotentialWinInput = MarketPricingInput & {
  stake: number;
  odds: number;
  rate?: number | null;
  betType?: string | null;
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
  'khado',   // Khado shows a run target (e.g. 175), not a decimal multiplier → uses dynamic rate
  'meter',
  'lambi',
  'other fancy',
]);

const DECIMAL_PRICE_MARKET_KEYWORDS =
  /match[_ ]odds|bookmaker|book maker|odd even|oddeven|toss|will win|winner|to win|result|victory/i;
const LINE_BASED_MARKET_KEYWORDS =
  /runs?|session|fancy|meter|lambi|over|ball|wicket|boundar|six|four|digit|number|score/i;

const normalizePositiveNumber = (value: number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const roundCurrencyAmount = (value: number) =>
  parseFloat(Number(value || 0).toFixed(2));

export const normalizeMarketType = (marketType?: string | null) =>
  String(marketType || '')
    .trim()
    .toLowerCase();

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
  // ─────────────────────────────────────────────────────────────────────

  const haystack = `${input.marketName || ''} ${input.selectionName || ''}`;
  return (
    LINE_BASED_MARKET_KEYWORDS.test(haystack) ||
    LINE_BASED_MARKET_TYPES.has(normalizedType)
  );
};

export const getRateFromSize = (size?: number | null) => {
  const parsedSize = Number(size);
  if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
    return null;
  }

  return roundCurrencyAmount(parsedSize > 0 ? 1 + 100 / parsedSize : 1);
};

/**
 * For line-based markets (session / fancy / khado), we use the dynamic rate
 * if available, but default to 2 if not present.
 */
export const getLineBasedFixedRate = (input: MarketPricingInput = {}): number | null =>
  isLineBasedFancyMarket(input) ? 2 : null;

export const calculatePotentialWinAmount = ({
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
  const isLineBased =
    isLineBasedFancyMarket({ marketType, marketName, selectionName }) ||
    ['MATCH1', 'KHADO', 'FANCY', 'METER', 'LAMBI'].includes(GT);

  // ── Decimal odds markets (Match Odds, Bookmaker, Fancy1, OddEven) ──
  if (!isLineBased) {
    return roundCurrencyAmount(normalizedStake * normalizedOdds);
  }

  // ── Indian Satta line-based markets ──
  // Use raw rate directly — size can be any positive number (e.g. 7, 10, 90, 110)
  const rawSize = (rate != null && Number.isFinite(Number(rate)) && Number(rate) > 0)
    ? Number(rate)
    : 100;

  if (isLay) {
    // LAY: stake typed = profit goal. Wallet deducted = stake.
    // Profit = stake × (100/size)   e.g. size=100, stake=100 → 100 profit (1:1)
    // ⚠️  SECURITY: Floor size at 10 to cap LAY profit at max 10× stake.
    //     Prevents exploitation via markets with abnormally small ls1 values
    //     (e.g. OBO market ls1=2 would otherwise create a 50× payout).
    const size = Math.max(rawSize, 10);
    return roundCurrencyAmount(normalizedStake + normalizedStake * (100 / size));
  } else {
    // BACK: stake typed = risk. Wallet deducted = stake.
    // Profit = stake × (size/100)   e.g. size=90,  stake=100 → 90 profit
    // Total Return = stake + profit  e.g. 100 + 90 = 190
    const size = rawSize;
    return roundCurrencyAmount(normalizedStake + normalizedStake * (size / 100));
  }
};
