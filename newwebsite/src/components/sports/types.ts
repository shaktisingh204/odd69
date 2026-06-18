// ─────────────────────────────────────────────────────────────
// Sports UI shared types
// ─────────────────────────────────────────────────────────────

export interface OddItem {
  label: string;
  value: string;
}

export interface TeamRow {
  name: string;
  /** Live score / overs string e.g. "292/6(89.1)" */
  detail: string;
  /** Score pill value e.g. "292" */
  pill: string;
  /** Uploaded team logo URL (Cloudflare). When present, rendered as an <img>. */
  iconUrl?: string;
  /** Country flag emoji fallback, resolved from the event's country field. */
  flag?: string;
  /** 2-letter initials fallback. Always present on the converter output. */
  initials?: string;
}

export interface LiveEvent {
  /** Unique match ID — used for navigation */
  matchId: string;
  competition: string;
  sport: string;
  isInPlay: boolean;
  isLive: boolean;
  /** e.g. "Live", "Break", "1st Innings" */
  status: string;
  hasTv: boolean;
  teams: TeamRow[];
  odds: OddItem[];
  /** e.g. "+55" extra markets count */
  extra: string;
  /** Admin-set background image URL for the card (legacy single image) */
  thumbnail?: string;
  /** Background image for team 1 (home) side of the "/" split card */
  team1Image?: string;
  /** Background image for team 2 (away) side of the "/" split card */
  team2Image?: string;
  /** Country code from the event, used for flag fallback bg */
  country?: string;
}

export interface MarketOdd {
  label: string;
  value: string;
}

export interface TopSport {
  /** Unique match ID — used for navigation */
  matchId: string;
  competition: string;
  sport: string;
  /** Emoji or image URL for sport icon */
  icon: string;
  marketA: MarketOdd;
  marketB: MarketOdd;
  /** e.g. "+97" extra markets count */
  extra: string;
}

export interface FeaturedLeague {
  title: string;
  badge: string;
  href: string;
  badgeClass: string;
  ringClass: string;
  liveCount?: number;
  upcomingCount?: number;
}
