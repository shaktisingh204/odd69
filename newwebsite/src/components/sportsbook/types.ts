// ─────────────────────────────────────────────────────────────
// Sportsbook – TypeScript types matching The Odds API v4 schema
// https://the-odds-api.com/liveapi/guides/v4/
// ─────────────────────────────────────────────────────────────

/** A single outcome / selection from a bookmaker */
export interface OddsOutcome {
  name: string;
  /** Decimal odds price (e.g. 1.85) */
  price: number;
  /** Handicap/spread point (only present for spreads/totals markets) */
  point?: number;
}

/** One market (h2h / spreads / totals) from a bookmaker */
export interface OddsMarket {
  key: 'h2h' | 'spreads' | 'totals' | 'outrights' | string;
  last_update?: string;
  outcomes: OddsOutcome[];
}

/** A single bookmaker's odds for an event */
export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

/** A single upcoming/live event with odds from multiple bookmakers */
export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string; // ISO 8601
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

/** A sport returned by GET /v4/sports */
export interface SportInfo {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

/** Grouped sports for display in the UI */
export interface SportGroup {
  group: string;
  sports: SportInfo[];
}

/** Computed best odds cell (for UI highlighting) */
export interface BestOdds {
  /** bookmaker key with the best price */
  bookmaker: string;
  price: number;
}

/** Map from outcome name → best bookmaker + price */
export type BestOddsMap = Record<string, BestOdds>;

export type OddsFormat = 'decimal' | 'fractional';
export type OddsRegion = 'eu' | 'uk' | 'us' | 'au';
export type OddsMarketKey = 'h2h' | 'spreads' | 'totals';
