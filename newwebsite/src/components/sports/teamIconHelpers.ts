// ─────────────────────────────────────────────────────────────
// Team icon + country flag helpers for sports match cards
// ─────────────────────────────────────────────────────────────
// Resolution order for a team avatar:
//   1. Uploaded team icon (from admin → `team_icons` collection → backend
//      `GET /sports/team-icons` → `sportsApi.getTeamIcons()` → lowercase
//      team_name keyed map)
//   2. Country flag emoji (by ISO code or country name on the event)
//   3. 2-letter initials
//
// The icon upload lives at /dashboard/sports/team-icons in the admin panel
// and stores Cloudflare delivery URLs keyed by normalised team name.
// ─────────────────────────────────────────────────────────────

/** ISO-3166 alpha-2 → flag emoji */
const ISO_FLAGS: Record<string, string> = {
  IN: '🇮🇳', GB: '🇬🇧', AU: '🇦🇺', ZA: '🇿🇦', NZ: '🇳🇿', PK: '🇵🇰',
  BD: '🇧🇩', LK: '🇱🇰', AF: '🇦🇫', ZW: '🇿🇼', IE: '🇮🇪', NL: '🇳🇱',
  US: '🇺🇸', ES: '🇪🇸', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', BR: '🇧🇷',
  AR: '🇦🇷', JP: '🇯🇵', KR: '🇰🇷', CN: '🇨🇳', MX: '🇲🇽', CA: '🇨🇦',
  PT: '🇵🇹', SE: '🇸🇪', RU: '🇷🇺', TR: '🇹🇷', SA: '🇸🇦', AE: '🇦🇪',
  EG: '🇪🇬', KE: '🇰🇪', NG: '🇳🇬', TH: '🇹🇭', ID: '🇮🇩', MY: '🇲🇾',
  PH: '🇵🇭', VN: '🇻🇳', SG: '🇸🇬', BE: '🇧🇪', CH: '🇨🇭', AT: '🇦🇹',
  DK: '🇩🇰', NO: '🇳🇴', FI: '🇫🇮', IS: '🇮🇸', PL: '🇵🇱', CZ: '🇨🇿',
  GR: '🇬🇷', HR: '🇭🇷', RS: '🇷🇸', UA: '🇺🇦', RO: '🇷🇴', HU: '🇭🇺',
  BG: '🇧🇬', SK: '🇸🇰', SI: '🇸🇮', IL: '🇮🇱', QA: '🇶🇦', KW: '🇰🇼',
  MA: '🇲🇦', DZ: '🇩🇿', TN: '🇹🇳', CL: '🇨🇱', CO: '🇨🇴', PE: '🇵🇪',
  UY: '🇺🇾', VE: '🇻🇪', EC: '🇪🇨', CR: '🇨🇷', PA: '🇵🇦',
};

/** Common country name (English, lowercase) → ISO code */
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  'india': 'IN',
  'england': 'GB', 'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB',
  'australia': 'AU',
  'south africa': 'ZA',
  'new zealand': 'NZ',
  'pakistan': 'PK',
  'bangladesh': 'BD',
  'sri lanka': 'LK',
  'afghanistan': 'AF',
  'zimbabwe': 'ZW',
  'ireland': 'IE',
  'netherlands': 'NL', 'holland': 'NL',
  'usa': 'US', 'united states': 'US', 'united states of america': 'US',
  'spain': 'ES',
  'germany': 'DE',
  'france': 'FR',
  'italy': 'IT',
  'brazil': 'BR',
  'argentina': 'AR',
  'japan': 'JP',
  'korea': 'KR', 'south korea': 'KR',
  'china': 'CN',
  'mexico': 'MX',
  'canada': 'CA',
  'portugal': 'PT',
  'sweden': 'SE',
  'russia': 'RU',
  'turkey': 'TR', 'türkiye': 'TR',
  'saudi arabia': 'SA',
  'uae': 'AE', 'united arab emirates': 'AE',
  'egypt': 'EG',
  'kenya': 'KE',
  'nigeria': 'NG',
  'thailand': 'TH',
  'indonesia': 'ID',
  'malaysia': 'MY',
  'philippines': 'PH',
  'vietnam': 'VN',
  'singapore': 'SG',
  'belgium': 'BE',
  'switzerland': 'CH',
  'austria': 'AT',
  'denmark': 'DK',
  'norway': 'NO',
  'finland': 'FI',
  'iceland': 'IS',
  'poland': 'PL',
  'czech republic': 'CZ', 'czechia': 'CZ',
  'greece': 'GR',
  'croatia': 'HR',
  'serbia': 'RS',
  'ukraine': 'UA',
  'romania': 'RO',
  'hungary': 'HU',
  'bulgaria': 'BG',
  'slovakia': 'SK',
  'slovenia': 'SI',
  'israel': 'IL',
  'qatar': 'QA',
  'kuwait': 'KW',
  'morocco': 'MA',
  'algeria': 'DZ',
  'tunisia': 'TN',
  'chile': 'CL',
  'colombia': 'CO',
  'peru': 'PE',
  'uruguay': 'UY',
  'venezuela': 'VE',
  'ecuador': 'EC',
  'costa rica': 'CR',
  'panama': 'PA',
  'west indies': 'WI', // handled specially below
};

/** Normalise a team/country name for map lookup */
export function normaliseKey(input?: string | null): string {
  return (input ?? '').toLowerCase().trim();
}

/**
 * Look up an uploaded team icon URL for the given team.
 * The map comes from `sportsApi.getTeamIcons()` and is keyed by
 * lowercase-trimmed `team_name`.
 */
export function lookupTeamIcon(
  teamName: string | undefined,
  iconMap: Record<string, string> | undefined,
): string | undefined {
  if (!teamName || !iconMap) return undefined;
  return iconMap[normaliseKey(teamName)];
}

/**
 * Return a flag emoji for a given ISO code or country name.
 * Accepts either `"IN"` or `"India"` (case-insensitive).
 */
export function lookupFlag(country?: string | null): string | undefined {
  if (!country) return undefined;
  const trimmed = country.trim();
  if (!trimmed) return undefined;

  // Special case: West Indies (no ISO code — use palm tree)
  if (/^west\s*indies$/i.test(trimmed)) return '🌴';

  // ISO alpha-2 direct
  if (trimmed.length === 2) {
    return ISO_FLAGS[trimmed.toUpperCase()];
  }

  // Country name
  const iso = COUNTRY_NAME_TO_ISO[trimmed.toLowerCase()];
  return iso ? ISO_FLAGS[iso] : undefined;
}

/**
 * 2-letter initials from a team name (fallback when no icon + no flag).
 */
export function getInitials(name?: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return '??';
  const words = n.split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * One-shot helper: resolve the full avatar for a team in a single call.
 * Returns `{ iconUrl, flag, initials }` — any of the first two may be
 * undefined. `initials` is always present.
 */
export function resolveTeamAvatar(
  teamName: string | undefined,
  iconMap: Record<string, string> | undefined,
  eventCountry?: string | null,
): { iconUrl?: string; flag?: string; initials: string } {
  return {
    iconUrl: lookupTeamIcon(teamName, iconMap),
    flag: lookupFlag(eventCountry),
    initials: getInitials(teamName),
  };
}
