'use server';

import connectMongo from '@/lib/mongo';
import { TeamIcon } from '@/models/MongoModels';
import { revalidatePath } from 'next/cache';

// ─── Cloudflare config ─────────────────────────────────────────────────────
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || 'ae6aabd73c9a3ddfb2f49419c0fbb69a';
const CF_API_TOKEN  = process.env.CF_IMAGES_TOKEN || process.env.IMAGES_TOKEN || 'QOCM2u9NAgrdxVgaeCIQUYDnLKnuQoeKqjh5oMlU';
const CF_BASE_URL   = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`;
const CF_DELIVERY   = 'https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ScrapedIcon {
    teamName: string;
    imageUrl: string;
    source: string;
    sport?: string;
}

export interface ScrapeResult {
    name: string;
    status: 'ok' | 'exists' | 'not_found' | 'error';
    source?: string;
    detail?: string;
}

// ─── Helper: upload image URL to Cloudflare and save to MongoDB ────────────

async function downloadAndStore(
    teamName: string,
    imageUrl: string,
    source: string,
    sportId?: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        const normalised = teamName.trim().toLowerCase();

        // Check existing
        await connectMongo();
        const existing = await TeamIcon.findOne({ team_name: normalised }).lean();
        if (existing) return { success: true, url: (existing as any).icon_url };

        // Download image
        const imgRes = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TeamIconBot/1.0)' },
        });
        if (!imgRes.ok) return { success: false, error: `Download failed (${imgRes.status})` };

        const contentType = imgRes.headers.get('content-type') || 'image/png';
        const imgBuffer = await imgRes.arrayBuffer();

        // Skip tiny/broken images (< 500 bytes is likely a placeholder)
        if (imgBuffer.byteLength < 500) {
            return { success: false, error: 'Image too small (likely placeholder)' };
        }

        // Upload to Cloudflare
        const cleanName = teamName.trim().replace(/[^a-zA-Z0-9\s\-_.]/g, '').replace(/\s+/g, '_');
        const timestamp = Date.now();
        const cfImageId = `team-icons/${cleanName}_${timestamp}`;
        const ext = contentType.includes('svg') ? 'svg' : contentType.includes('webp') ? 'webp' : 'png';

        const cfForm = new FormData();
        cfForm.append('file', new Blob([imgBuffer], { type: contentType }), `${cleanName}.${ext}`);
        cfForm.append('id', cfImageId);

        const cfRes = await fetch(CF_BASE_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
            body: cfForm,
        });
        const cfJson = await cfRes.json() as any;

        if (!cfJson.success && cfJson.errors?.[0]?.code !== 9409) {
            return { success: false, error: cfJson.errors?.[0]?.message || 'Cloudflare upload failed' };
        }

        const deliveryUrl = `${CF_DELIVERY}/team-icons%2F${encodeURIComponent(`${cleanName}_${timestamp}`)}/public`;

        // Save to MongoDB
        await TeamIcon.findOneAndUpdate(
            { team_name: normalised },
            {
                team_name: normalised,
                display_name: teamName.trim(),
                icon_url: deliveryUrl,
                sport_id: sportId || '',
            },
            { upsert: true, returnDocument: 'after' },
        );

        return { success: true, url: deliveryUrl };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 1: TheSportsDB (free, 30 req/min, wide coverage)
// ═══════════════════════════════════════════════════════════════════════════

const TSDB = 'https://www.thesportsdb.com/api/v1/json/3';

async function searchTheSportsDB(teamName: string): Promise<ScrapedIcon | null> {
    try {
        const res = await fetch(`${TSDB}/searchteams.php?t=${encodeURIComponent(teamName)}`);
        if (!res.ok) return null;
        const data = await res.json() as any;
        if (!data.teams?.length) return null;

        const normalised = teamName.toLowerCase();
        const exact = data.teams.find((t: any) => t.strTeam?.toLowerCase() === normalised && t.strTeamBadge);
        const withBadge = data.teams.find((t: any) => t.strTeamBadge);
        const team = exact || withBadge;

        if (!team?.strTeamBadge) return null;
        return { teamName, imageUrl: team.strTeamBadge, source: 'thesportsdb', sport: team.strSport };
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 2: ESPN CDN (free, no API key, US/EU sports + soccer)
// ═══════════════════════════════════════════════════════════════════════════

// ESPN public teams API — returns team logos in the response
const ESPN_LEAGUES: { sport: string; league: string; label: string }[] = [
    { sport: 'soccer', league: 'eng.1', label: 'Premier League' },
    { sport: 'soccer', league: 'esp.1', label: 'La Liga' },
    { sport: 'soccer', league: 'ger.1', label: 'Bundesliga' },
    { sport: 'soccer', league: 'ita.1', label: 'Serie A' },
    { sport: 'soccer', league: 'fra.1', label: 'Ligue 1' },
    { sport: 'soccer', league: 'ned.1', label: 'Eredivisie' },
    { sport: 'soccer', league: 'por.1', label: 'Primeira Liga' },
    { sport: 'soccer', league: 'tur.1', label: 'Super Lig' },
    { sport: 'soccer', league: 'sco.1', label: 'Scottish Premiership' },
    { sport: 'soccer', league: 'bel.1', label: 'Belgian Pro League' },
    { sport: 'soccer', league: 'usa.1', label: 'MLS' },
    { sport: 'soccer', league: 'mex.1', label: 'Liga MX' },
    { sport: 'soccer', league: 'bra.1', label: 'Brasileirao' },
    { sport: 'soccer', league: 'arg.1', label: 'Liga Profesional' },
    { sport: 'soccer', league: 'aus.1', label: 'A-League' },
    { sport: 'soccer', league: 'jpn.1', label: 'J1 League' },
    { sport: 'soccer', league: 'chn.1', label: 'Chinese Super League' },
    { sport: 'soccer', league: 'ind.1', label: 'ISL' },
    { sport: 'soccer', league: 'sau.1', label: 'Saudi Pro League' },
    { sport: 'soccer', league: 'uefa.champions', label: 'UEFA Champions League' },
    { sport: 'soccer', league: 'uefa.europa', label: 'Europa League' },
    { sport: 'soccer', league: 'eng.2', label: 'Championship' },
    { sport: 'soccer', league: 'eng.league_cup', label: 'League Cup' },
    { sport: 'soccer', league: 'eng.fa', label: 'FA Cup' },
    { sport: 'basketball', league: 'nba', label: 'NBA' },
    { sport: 'football', league: 'nfl', label: 'NFL' },
    { sport: 'baseball', league: 'mlb', label: 'MLB' },
    { sport: 'hockey', league: 'nhl', label: 'NHL' },
    { sport: 'cricket', league: 'icc-cricket-world-cup', label: 'Cricket WC' },
    { sport: 'rugby', league: 'super-rugby', label: 'Super Rugby' },
];

interface ESPNTeamCache {
    name: string;
    displayName: string;
    logo: string;
    sport: string;
}

let _espnCache: ESPNTeamCache[] | null = null;

async function loadESPNTeams(): Promise<ESPNTeamCache[]> {
    if (_espnCache) return _espnCache;

    const allTeams: ESPNTeamCache[] = [];

    for (const league of ESPN_LEAGUES) {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/${league.sport}/${league.league}/teams?limit=100`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TeamIconBot/1.0)' },
            });
            if (!res.ok) continue;
            const data = await res.json() as any;

            const teams = data.sports?.[0]?.leagues?.[0]?.teams || data.teams || [];
            for (const entry of teams) {
                const team = entry.team || entry;
                const logo = team.logos?.[0]?.href;
                if (logo && team.displayName) {
                    allTeams.push({
                        name: (team.name || team.displayName).toLowerCase(),
                        displayName: team.displayName,
                        logo,
                        sport: league.sport,
                    });
                    // Also index by shortDisplayName and abbreviation
                    if (team.shortDisplayName && team.shortDisplayName !== team.displayName) {
                        allTeams.push({
                            name: team.shortDisplayName.toLowerCase(),
                            displayName: team.displayName,
                            logo,
                            sport: league.sport,
                        });
                    }
                }
            }

            // Small delay between ESPN requests
            await new Promise(r => setTimeout(r, 200));
        } catch {
            // Skip failed league
        }
    }

    _espnCache = allTeams;
    return allTeams;
}

async function searchESPN(teamName: string): Promise<ScrapedIcon | null> {
    try {
        const teams = await loadESPNTeams();
        const normalised = teamName.toLowerCase().trim();

        // Exact match first
        const exact = teams.find(t => t.name === normalised || t.displayName.toLowerCase() === normalised);
        if (exact) {
            return { teamName, imageUrl: exact.logo, source: 'espn', sport: exact.sport };
        }

        // Partial / fuzzy match — check if query is contained in team name or vice versa
        const partial = teams.find(t =>
            t.name.includes(normalised) ||
            normalised.includes(t.name) ||
            t.displayName.toLowerCase().includes(normalised) ||
            normalised.includes(t.displayName.toLowerCase())
        );
        if (partial) {
            return { teamName, imageUrl: partial.logo, source: 'espn', sport: partial.sport };
        }

        // Word overlap: at least 2 common words
        const queryWords = new Set(normalised.split(/\s+/).filter(w => w.length > 2));
        if (queryWords.size >= 1) {
            let bestMatch: ESPNTeamCache | null = null;
            let bestOverlap = 0;
            for (const t of teams) {
                const teamWords = new Set(t.displayName.toLowerCase().split(/\s+/).filter(w => w.length > 2));
                let overlap = 0;
                for (const w of queryWords) {
                    if (teamWords.has(w)) overlap++;
                }
                if (overlap > bestOverlap && overlap >= Math.min(2, queryWords.size)) {
                    bestOverlap = overlap;
                    bestMatch = t;
                }
            }
            if (bestMatch) {
                return { teamName, imageUrl: bestMatch.logo, source: 'espn', sport: bestMatch.sport };
            }
        }

        return null;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 3: Sofascore (large coverage, team images via API)
// ═══════════════════════════════════════════════════════════════════════════

async function searchSofascore(teamName: string): Promise<ScrapedIcon | null> {
    try {
        // Sofascore has a search endpoint
        const url = `https://api.sofascore.com/api/v1/search/teams?q=${encodeURIComponent(teamName)}&page=0`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        const teams = data.teams || data.results || [];
        if (!teams.length) return null;

        // Find best match
        const normalised = teamName.toLowerCase().trim();
        const match = teams.find((t: any) =>
            t.name?.toLowerCase() === normalised ||
            t.shortName?.toLowerCase() === normalised
        ) || teams[0];

        if (!match?.id) return null;

        // Sofascore team image URL
        const imageUrl = `https://api.sofascore.app/api/v1/team/${match.id}/image`;
        return { teamName, imageUrl, source: 'sofascore', sport: match.sport?.name };
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 4: Flashscore / Livesport CDN (wide coverage)
// ═══════════════════════════════════════════════════════════════════════════

async function searchFlashscore(teamName: string): Promise<ScrapedIcon | null> {
    try {
        const url = `https://s.livesport.services/api/v2/search/?q=${encodeURIComponent(teamName)}&lang=en&sport-id=1&type-ids=1,2`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'x-fsign': 'SW9D1eZo',
            },
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        const results = data.results || [];
        if (!results.length) return null;

        const match = results[0];
        if (!match?.id) return null;

        // Flashscore team logo CDN
        const imageUrl = `https://www.flashscore.com/res/image/data/${match.id.substring(0, 2)}/${match.id}.png`;
        return { teamName, imageUrl, source: 'flashscore' };
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 5: Wikipedia / Wikimedia Commons (fallback, almost every team)
// ═══════════════════════════════════════════════════════════════════════════

async function searchWikipedia(teamName: string): Promise<ScrapedIcon | null> {
    try {
        // Use Wikipedia API to find team page and extract main image
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(teamName + ' football cricket team')}&format=json&srlimit=3`;
        const searchRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'TeamIconBot/1.0 (sports betting platform)' },
        });
        if (!searchRes.ok) return null;
        const searchData = await searchRes.json() as any;
        const pages = searchData.query?.search;
        if (!pages?.length) return null;

        // Get page images for each result
        for (const page of pages.slice(0, 2)) {
            const title = page.title;
            const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=300&pilicense=any`;
            const imgRes = await fetch(imgUrl, {
                headers: { 'User-Agent': 'TeamIconBot/1.0 (sports betting platform)' },
            });
            if (!imgRes.ok) continue;
            const imgData = await imgRes.json() as any;
            const pageObj = Object.values(imgData.query?.pages || {})[0] as any;
            const thumbnail = pageObj?.thumbnail?.source;

            if (thumbnail) {
                return { teamName, imageUrl: thumbnail, source: 'wikipedia' };
            }
        }

        return null;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 6: TheSportsDB league-based bulk fetch (get all teams in a league)
// ═══════════════════════════════════════════════════════════════════════════

const TSDB_LEAGUES: { id: string; name: string; sport: string }[] = [
    // Cricket
    { id: '4669',  name: 'Indian Premier League', sport: 'cricket' },
    { id: '4812',  name: 'Big Bash League', sport: 'cricket' },
    { id: '4811',  name: 'Caribbean Premier League', sport: 'cricket' },
    { id: '4813',  name: 'Pakistan Super League', sport: 'cricket' },
    { id: '4827',  name: 'The Hundred', sport: 'cricket' },
    { id: '4912',  name: 'SA20', sport: 'cricket' },
    { id: '4346',  name: 'ICC Cricket World Cup', sport: 'cricket' },
    // Soccer
    { id: '4328',  name: 'English Premier League', sport: 'soccer' },
    { id: '4332',  name: 'Italian Serie A', sport: 'soccer' },
    { id: '4335',  name: 'Spanish La Liga', sport: 'soccer' },
    { id: '4331',  name: 'German Bundesliga', sport: 'soccer' },
    { id: '4334',  name: 'French Ligue 1', sport: 'soccer' },
    { id: '4337',  name: 'Dutch Eredivisie', sport: 'soccer' },
    { id: '4344',  name: 'Portuguese Primeira Liga', sport: 'soccer' },
    { id: '4359',  name: 'Chinese Super League', sport: 'soccer' },
    { id: '4350',  name: 'Mexican Primera League', sport: 'soccer' },
    { id: '4351',  name: 'Brazilian Serie A', sport: 'soccer' },
    { id: '4406',  name: 'Saudi Professional League', sport: 'soccer' },
    { id: '4346',  name: 'Indian Super League', sport: 'soccer' },
    { id: '4480',  name: 'MLS', sport: 'soccer' },
    { id: '4329',  name: 'English League Championship', sport: 'soccer' },
    { id: '4339',  name: 'Turkish Super Lig', sport: 'soccer' },
    { id: '4355',  name: 'Russian Premier League', sport: 'soccer' },
    { id: '4336',  name: 'Greek Superleague', sport: 'soccer' },
    { id: '4338',  name: 'Belgian Pro League', sport: 'soccer' },
    { id: '4354',  name: 'Ukrainian Premier League', sport: 'soccer' },
    { id: '4482',  name: 'J1 League', sport: 'soccer' },
    // Basketball
    { id: '4387',  name: 'NBA', sport: 'basketball' },
    { id: '4431',  name: 'EuroLeague', sport: 'basketball' },
    // Ice Hockey
    { id: '4380',  name: 'NHL', sport: 'ice hockey' },
    // American Football
    { id: '4391',  name: 'NFL', sport: 'american football' },
    // Baseball
    { id: '4424',  name: 'MLB', sport: 'baseball' },
    // Rugby
    { id: '4414',  name: 'Super Rugby', sport: 'rugby' },
    { id: '4413',  name: 'English Premiership Rugby', sport: 'rugby' },
    // Aussie Rules
    { id: '4404',  name: 'AFL', sport: 'australian football' },
];

async function fetchLeagueTeamsFromTSDB(leagueId: string): Promise<ScrapedIcon[]> {
    try {
        const url = `${TSDB}/lookup_all_teams.php?id=${leagueId}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json() as any;
        if (!data.teams?.length) return [];

        return data.teams
            .filter((t: any) => t.strTeamBadge)
            .map((t: any) => ({
                teamName: t.strTeam,
                imageUrl: t.strTeamBadge,
                source: 'thesportsdb',
                sport: t.strSport,
            }));
    } catch {
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE: IPLT20.com (IPL teams — high quality official logos)
// ═══════════════════════════════════════════════════════════════════════════

const IPL_TEAM_SLUGS: Record<string, string> = {
    'chennai super kings': 'chennai-super-kings',
    'csk': 'chennai-super-kings',
    'mumbai indians': 'mumbai-indians',
    'mi': 'mumbai-indians',
    'royal challengers bengaluru': 'royal-challengers-bengaluru',
    'royal challengers bangalore': 'royal-challengers-bengaluru',
    'rcb': 'royal-challengers-bengaluru',
    'kolkata knight riders': 'kolkata-knight-riders',
    'kkr': 'kolkata-knight-riders',
    'delhi capitals': 'delhi-capitals',
    'dc': 'delhi-capitals',
    'rajasthan royals': 'rajasthan-royals',
    'rr': 'rajasthan-royals',
    'sunrisers hyderabad': 'sunrisers-hyderabad',
    'srh': 'sunrisers-hyderabad',
    'punjab kings': 'punjab-kings',
    'pbks': 'punjab-kings',
    'gujarat titans': 'gujarat-titans',
    'gt': 'gujarat-titans',
    'lucknow super giants': 'lucknow-super-giants',
    'lsg': 'lucknow-super-giants',
};

async function searchIPLT20(teamName: string): Promise<ScrapedIcon | null> {
    try {
        const slug = IPL_TEAM_SLUGS[teamName.toLowerCase().trim()];
        if (!slug) return null;

        // Fetch the team page and extract the logo from og:image or team logo
        const url = `https://www.iplt20.com/teams/${slug}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZeeroBot/1.0)' },
        });
        if (!res.ok) return null;
        const html = await res.text();

        // Try og:image meta tag first
        const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
                      || html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
        if (ogMatch?.[1]) {
            return { teamName, imageUrl: ogMatch[1], source: 'iplt20' };
        }

        // Try team logo image patterns
        const logoMatch = html.match(/class="[^"]*team-logo[^"]*"[^>]*>\s*<img[^>]+src="([^"]+)"/i)
                       || html.match(/<img[^>]+class="[^"]*logo[^"]*"[^>]+src="([^"]+)"/i)
                       || html.match(/team-header[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
        if (logoMatch?.[1]) {
            const imgUrl = logoMatch[1].startsWith('http') ? logoMatch[1] : `https://www.iplt20.com${logoMatch[1]}`;
            return { teamName, imageUrl: imgUrl, source: 'iplt20' };
        }

        return null;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE: 1000Logos.net (broad logo coverage for teams, leagues, brands)
// ═══════════════════════════════════════════════════════════════════════════

async function search1000Logos(teamName: string): Promise<ScrapedIcon | null> {
    try {
        // Build slug: "Kolkata Knight Riders" → "kolkata-knight-riders"
        const slug = teamName.toLowerCase().trim()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-');

        const url = `https://1000logos.net/${slug}-logo/`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZeeroBot/1.0)' },
            redirect: 'follow',
        });
        if (!res.ok) return null;
        const html = await res.text();

        // Look for the main logo image — usually in .entry-content or .wp-post-image
        const match = html.match(/<img[^>]+class="[^"]*wp-post-image[^"]*"[^>]+src="([^"]+)"/i)
                   || html.match(/entry-content[\s\S]*?<img[^>]+src="([^"]+\.(?:png|jpg|svg|webp))"/i)
                   || html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
                   || html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);

        if (match?.[1]) {
            const imgUrl = match[1].startsWith('http') ? match[1] : `https://1000logos.net${match[1]}`;
            return { teamName, imageUrl: imgUrl, source: '1000logos' };
        }

        return null;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN: Multi-source scrape for a single team
// ═══════════════════════════════════════════════════════════════════════════

export async function scrapeTeamIcon(teamName: string, sportId?: string): Promise<{
    success: boolean;
    source?: string;
    url?: string;
    error?: string;
    alreadyExists?: boolean;
}> {
    if (!teamName?.trim()) return { success: false, error: 'Team name is required' };

    const normalised = teamName.trim().toLowerCase();

    // Check existing
    await connectMongo();
    const existing = await TeamIcon.findOne({ team_name: normalised }).lean();
    if (existing) return { success: true, alreadyExists: true, url: (existing as any).icon_url };

    // Try sources in priority order — IPL-specific first, then generic logo sites, then broad scrapers
    const sources: { name: string; fn: () => Promise<ScrapedIcon | null> }[] = [
        { name: 'IPLT20',      fn: () => searchIPLT20(teamName) },
        { name: '1000Logos',   fn: () => search1000Logos(teamName) },
        { name: 'TheSportsDB', fn: () => searchTheSportsDB(teamName) },
        { name: 'ESPN',        fn: () => searchESPN(teamName) },
    ];

    for (const source of sources) {
        try {
            const result = await source.fn();
            if (result?.imageUrl) {
                const stored = await downloadAndStore(teamName, result.imageUrl, result.source, sportId);
                if (stored.success) {
                    return { success: true, source: source.name, url: stored.url };
                }
                // If storage failed, try next source
            }
        } catch {
            // Continue to next source
        }
        // Small delay between sources
        await new Promise(r => setTimeout(r, 300));
    }

    return { success: false, error: `Not found on any source for "${teamName}"` };
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK: Scrape all teams without icons using multi-source
// ═══════════════════════════════════════════════════════════════════════════

export async function bulkScrapeTeamIcons(teamNames: string[]): Promise<{
    success: boolean;
    results: ScrapeResult[];
    stats: { fetched: number; existing: number; notFound: number; total: number };
}> {
    const results: ScrapeResult[] = [];
    let fetched = 0;
    let existing = 0;
    let notFound = 0;

    for (const name of teamNames) {
        // Rate limiting: ~1.5 req/sec across all sources
        if (fetched > 0 && fetched % 3 === 0) {
            await new Promise(r => setTimeout(r, 2000));
        }

        const res = await scrapeTeamIcon(name);
        if (res.success && res.alreadyExists) {
            results.push({ name, status: 'exists' });
            existing++;
        } else if (res.success) {
            results.push({ name, status: 'ok', source: res.source, detail: `via ${res.source}` });
            fetched++;
        } else {
            results.push({ name, status: 'not_found', detail: res.error });
            notFound++;
        }
    }

    revalidatePath('/dashboard/sports/team-icons');
    return { success: true, results, stats: { fetched, existing, notFound, total: teamNames.length } };
}

// ═══════════════════════════════════════════════════════════════════════════
// LEAGUE BULK: Fetch all teams from known leagues on TheSportsDB
// ═══════════════════════════════════════════════════════════════════════════

export async function scrapeAllLeagues(selectedLeagueIds?: string[]): Promise<{
    success: boolean;
    results: ScrapeResult[];
    stats: { fetched: number; existing: number; failed: number; total: number };
}> {
    const leagues = selectedLeagueIds?.length
        ? TSDB_LEAGUES.filter(l => selectedLeagueIds.includes(l.id))
        : TSDB_LEAGUES;

    const results: ScrapeResult[] = [];
    let fetched = 0;
    let existing = 0;
    let failed = 0;

    for (const league of leagues) {
        // Rate limit for TheSportsDB (30 req/min)
        await new Promise(r => setTimeout(r, 2200));

        const teams = await fetchLeagueTeamsFromTSDB(league.id);

        for (const team of teams) {
            await connectMongo();
            const normalised = team.teamName.trim().toLowerCase();
            const exists = await TeamIcon.findOne({ team_name: normalised }).lean();

            if (exists) {
                results.push({ name: team.teamName, status: 'exists' });
                existing++;
                continue;
            }

            // Small delay between uploads
            await new Promise(r => setTimeout(r, 500));

            const stored = await downloadAndStore(team.teamName, team.imageUrl, 'thesportsdb');
            if (stored.success) {
                results.push({ name: team.teamName, status: 'ok', source: 'thesportsdb', detail: league.name });
                fetched++;
            } else {
                results.push({ name: team.teamName, status: 'error', detail: stored.error });
                failed++;
            }
        }
    }

    revalidatePath('/dashboard/sports/team-icons');
    return {
        success: true,
        results,
        stats: { fetched, existing, failed, total: results.length },
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Get available leagues list for the UI
// ═══════════════════════════════════════════════════════════════════════════

export async function getAvailableLeagues() {
    return TSDB_LEAGUES.map(l => ({ id: l.id, name: l.name, sport: l.sport }));
}

// ═══════════════════════════════════════════════════════════════════════════
// LEAGUE LOGO SCRAPING
// ═══════════════════════════════════════════════════════════════════════════

import { SportLeague } from '@/models/MongoModels';

interface LeagueScrapeResult {
    competitionId: string;
    competitionName: string;
    status: 'ok' | 'exists' | 'not_found' | 'error';
    source?: string;
    detail?: string;
}

// ─── Source 1: TheSportsDB league badges ────────────────────────────────────

async function searchLeagueTheSportsDB(leagueName: string): Promise<string | null> {
    try {
        // Search leagues by name
        const url = `${TSDB}/searchleagues.php?l=${encodeURIComponent(leagueName)}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json() as any;
        if (!data.leagues?.length) return null;

        const normalised = leagueName.toLowerCase();
        const exact = data.leagues.find((l: any) =>
            l.strLeague?.toLowerCase() === normalised && (l.strBadge || l.strLogo)
        );
        const withBadge = data.leagues.find((l: any) => l.strBadge || l.strLogo);
        const league = exact || withBadge;

        return league?.strBadge || league?.strLogo || league?.strBanner || null;
    } catch {
        return null;
    }
}

// Also try by TheSportsDB league ID (for leagues in our TSDB_LEAGUES list)
async function fetchLeagueBadgeByTSDBId(tsdbLeagueId: string): Promise<string | null> {
    try {
        const url = `${TSDB}/lookupleague.php?id=${tsdbLeagueId}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json() as any;
        const league = data.leagues?.[0];
        return league?.strBadge || league?.strLogo || league?.strBanner || null;
    } catch {
        return null;
    }
}

// ─── Source 2: ESPN league logos ─────────────────────────────────────────────

// ESPN league endpoints return league logos in the response
const ESPN_LEAGUE_MAP: Record<string, { sport: string; league: string }> = {
    'premier league': { sport: 'soccer', league: 'eng.1' },
    'english premier league': { sport: 'soccer', league: 'eng.1' },
    'epl': { sport: 'soccer', league: 'eng.1' },
    'la liga': { sport: 'soccer', league: 'esp.1' },
    'spanish la liga': { sport: 'soccer', league: 'esp.1' },
    'bundesliga': { sport: 'soccer', league: 'ger.1' },
    'german bundesliga': { sport: 'soccer', league: 'ger.1' },
    'serie a': { sport: 'soccer', league: 'ita.1' },
    'italian serie a': { sport: 'soccer', league: 'ita.1' },
    'ligue 1': { sport: 'soccer', league: 'fra.1' },
    'french ligue 1': { sport: 'soccer', league: 'fra.1' },
    'eredivisie': { sport: 'soccer', league: 'ned.1' },
    'dutch eredivisie': { sport: 'soccer', league: 'ned.1' },
    'primeira liga': { sport: 'soccer', league: 'por.1' },
    'portuguese primeira liga': { sport: 'soccer', league: 'por.1' },
    'super lig': { sport: 'soccer', league: 'tur.1' },
    'turkish super lig': { sport: 'soccer', league: 'tur.1' },
    'mls': { sport: 'soccer', league: 'usa.1' },
    'major league soccer': { sport: 'soccer', league: 'usa.1' },
    'liga mx': { sport: 'soccer', league: 'mex.1' },
    'mexican primera league': { sport: 'soccer', league: 'mex.1' },
    'brasileirao': { sport: 'soccer', league: 'bra.1' },
    'brazilian serie a': { sport: 'soccer', league: 'bra.1' },
    'saudi professional league': { sport: 'soccer', league: 'sau.1' },
    'indian super league': { sport: 'soccer', league: 'ind.1' },
    'isl': { sport: 'soccer', league: 'ind.1' },
    'a-league': { sport: 'soccer', league: 'aus.1' },
    'j1 league': { sport: 'soccer', league: 'jpn.1' },
    'chinese super league': { sport: 'soccer', league: 'chn.1' },
    'championship': { sport: 'soccer', league: 'eng.2' },
    'english league championship': { sport: 'soccer', league: 'eng.2' },
    'uefa champions league': { sport: 'soccer', league: 'uefa.champions' },
    'champions league': { sport: 'soccer', league: 'uefa.champions' },
    'europa league': { sport: 'soccer', league: 'uefa.europa' },
    'uefa europa league': { sport: 'soccer', league: 'uefa.europa' },
    'conference league': { sport: 'soccer', league: 'uefa.europa.conf' },
    'fa cup': { sport: 'soccer', league: 'eng.fa' },
    'league cup': { sport: 'soccer', league: 'eng.league_cup' },
    'copa del rey': { sport: 'soccer', league: 'esp.copa_del_rey' },
    'dfb pokal': { sport: 'soccer', league: 'ger.dfb_pokal' },
    'scottish premiership': { sport: 'soccer', league: 'sco.1' },
    'belgian pro league': { sport: 'soccer', league: 'bel.1' },
    'russian premier league': { sport: 'soccer', league: 'rus.1' },
    'liga profesional': { sport: 'soccer', league: 'arg.1' },
    'nba': { sport: 'basketball', league: 'nba' },
    'national basketball association': { sport: 'basketball', league: 'nba' },
    'nfl': { sport: 'football', league: 'nfl' },
    'national football league': { sport: 'football', league: 'nfl' },
    'mlb': { sport: 'baseball', league: 'mlb' },
    'major league baseball': { sport: 'baseball', league: 'mlb' },
    'nhl': { sport: 'hockey', league: 'nhl' },
    'national hockey league': { sport: 'hockey', league: 'nhl' },
    'super rugby': { sport: 'rugby', league: 'super-rugby' },
};

async function searchLeagueESPN(leagueName: string): Promise<string | null> {
    try {
        const normalised = leagueName.toLowerCase().trim();

        // Direct mapping lookup
        const mapping = ESPN_LEAGUE_MAP[normalised];
        if (!mapping) {
            // Fuzzy: check if any key is contained in the name or vice versa
            const key = Object.keys(ESPN_LEAGUE_MAP).find(k =>
                normalised.includes(k) || k.includes(normalised)
            );
            if (!key) return null;
            const m = ESPN_LEAGUE_MAP[key];
            if (!m) return null;
            return fetchESPNLeagueLogo(m.sport, m.league);
        }

        return fetchESPNLeagueLogo(mapping.sport, mapping.league);
    } catch {
        return null;
    }
}

async function fetchESPNLeagueLogo(sport: string, league: string): Promise<string | null> {
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TeamIconBot/1.0)' },
        });
        if (!res.ok) return null;
        const data = await res.json() as any;

        // League logos are in the leagues array
        const logos = data.leagues?.[0]?.logos;
        if (logos?.length) {
            // Prefer light-themed logo, then any
            const light = logos.find((l: any) => l.href && !l.href.includes('dark'));
            return (light?.href || logos[0]?.href) || null;
        }

        return null;
    } catch {
        return null;
    }
}

// ─── Source 3: Sofascore tournament images ───────────────────────────────────

async function searchLeagueSofascore(leagueName: string): Promise<string | null> {
    try {
        const url = `https://api.sofascore.com/api/v1/search/unique-tournaments?q=${encodeURIComponent(leagueName)}&page=0`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        const tournaments = data.uniqueTournaments || data.results || [];
        if (!tournaments.length) return null;

        const normalised = leagueName.toLowerCase().trim();
        const match = tournaments.find((t: any) =>
            t.name?.toLowerCase() === normalised ||
            t.slug?.toLowerCase().replace(/-/g, ' ') === normalised
        ) || tournaments[0];

        if (!match?.id) return null;
        return `https://api.sofascore.app/api/v1/unique-tournament/${match.id}/image`;
    } catch {
        return null;
    }
}

// ─── Source 4: Wikipedia league logos ────────────────────────────────────────

async function searchLeagueWikipedia(leagueName: string): Promise<string | null> {
    try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(leagueName + ' league')}&format=json&srlimit=3`;
        const searchRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'TeamIconBot/1.0 (sports betting platform)' },
        });
        if (!searchRes.ok) return null;
        const searchData = await searchRes.json() as any;
        const pages = searchData.query?.search;
        if (!pages?.length) return null;

        for (const page of pages.slice(0, 2)) {
            const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(page.title)}&prop=pageimages&format=json&pithumbsize=300&pilicense=any`;
            const imgRes = await fetch(imgUrl, {
                headers: { 'User-Agent': 'TeamIconBot/1.0 (sports betting platform)' },
            });
            if (!imgRes.ok) continue;
            const imgData = await imgRes.json() as any;
            const pageObj = Object.values(imgData.query?.pages || {})[0] as any;
            if (pageObj?.thumbnail?.source) return pageObj.thumbnail.source;
        }
        return null;
    } catch {
        return null;
    }
}

// ─── Map Sportradar competitionIds to TheSportsDB league IDs ────────────────

// This helps us do direct lookups instead of name searches
const COMPETITION_TO_TSDB: Record<string, string> = {
    // Cricket
    'sr:competition:22561': '4669',   // IPL
    'sr:competition:21832': '4812',   // Big Bash League
    'sr:competition:21841': '4811',   // Caribbean Premier League
    'sr:competition:24221': '4813',   // Pakistan Super League
    'sr:competition:36637': '4827',   // The Hundred
    'sr:competition:45454': '4912',   // SA20
    // Soccer
    'sr:competition:17':    '4328',   // Premier League
    'sr:competition:23':    '4332',   // Serie A
    'sr:competition:8':     '4335',   // La Liga
    'sr:competition:35':    '4331',   // Bundesliga
    'sr:competition:34':    '4334',   // Ligue 1
    'sr:competition:37':    '4337',   // Eredivisie
    'sr:competition:44':    '4344',   // Portuguese Primeira Liga
    'sr:competition:390':   '4480',   // MLS
    'sr:competition:155':   '4350',   // Liga MX
    'sr:competition:325':   '4351',   // Brasileirao
    'sr:competition:955':   '4406',   // Saudi Pro League
    'sr:competition:340':   '4482',   // J1 League
    'sr:competition:18':    '4329',   // Championship
    'sr:competition:52':    '4339',   // Turkish Super Lig
    'sr:competition:203':   '4355',   // Russian Premier League
    'sr:competition:185':   '4336',   // Greek Superleague
    'sr:competition:38':    '4338',   // Belgian Pro League
    'sr:competition:218':   '4354',   // Ukrainian Premier League
    // Basketball
    'sr:competition:132':   '4387',   // NBA
    'sr:competition:138':   '4431',   // EuroLeague
    // Ice Hockey
    'sr:competition:234':   '4380',   // NHL
    // American Football
    'sr:competition:22':    '4391',   // NFL
    // Baseball
    'sr:competition:109':   '4424',   // MLB
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN: Multi-source scrape for a single league
// ═══════════════════════════════════════════════════════════════════════════

async function downloadLeagueImageAndStore(
    competitionId: string,
    competitionName: string,
    imageUrl: string,
    source: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        // Download image
        const imgRes = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TeamIconBot/1.0)' },
        });
        if (!imgRes.ok) return { success: false, error: `Download failed (${imgRes.status})` };

        const contentType = imgRes.headers.get('content-type') || 'image/png';
        const imgBuffer = await imgRes.arrayBuffer();

        if (imgBuffer.byteLength < 500) {
            return { success: false, error: 'Image too small (likely placeholder)' };
        }

        // Upload to Cloudflare
        const cleanName = competitionName.trim().replace(/[^a-zA-Z0-9\s\-_.]/g, '').replace(/\s+/g, '_');
        const timestamp = Date.now();
        const cfImageId = `league-icons/${cleanName}_${timestamp}`;
        const ext = contentType.includes('svg') ? 'svg' : contentType.includes('webp') ? 'webp' : 'png';

        const cfForm = new FormData();
        cfForm.append('file', new Blob([imgBuffer], { type: contentType }), `${cleanName}.${ext}`);
        cfForm.append('id', cfImageId);

        const cfRes = await fetch(CF_BASE_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
            body: cfForm,
        });
        const cfJson = await cfRes.json() as any;

        if (!cfJson.success && cfJson.errors?.[0]?.code !== 9409) {
            return { success: false, error: cfJson.errors?.[0]?.message || 'Cloudflare upload failed' };
        }

        const deliveryUrl = `${CF_DELIVERY}/league-icons%2F${encodeURIComponent(`${cleanName}_${timestamp}`)}/public`;

        // Update the league record in MongoDB
        await connectMongo();
        await SportLeague.findOneAndUpdate(
            { competitionId },
            { $set: { imageUrl: deliveryUrl } },
        );

        return { success: true, url: deliveryUrl };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function scrapeLeagueIcon(competitionId: string, competitionName: string): Promise<{
    success: boolean;
    source?: string;
    url?: string;
    error?: string;
    alreadyExists?: boolean;
}> {
    if (!competitionName?.trim()) return { success: false, error: 'League name is required' };

    // Check if already has image
    await connectMongo();
    const existing = await SportLeague.findOne({ competitionId }).lean() as any;
    if (existing?.imageUrl) return { success: true, alreadyExists: true, url: existing.imageUrl };

    // Sources in priority order
    const leagueSources: { name: string; fn: () => Promise<string | null> }[] = [
        // 1. 1000Logos — broad logo coverage
        { name: '1000Logos', fn: async () => {
            const r = await search1000Logos(competitionName);
            return r?.imageUrl ?? null;
        }},
        // 2. TheSportsDB by direct ID mapping
        { name: 'TheSportsDB', fn: async () => {
            const tsdbId = COMPETITION_TO_TSDB[competitionId];
            if (tsdbId) {
                const badge = await fetchLeagueBadgeByTSDBId(tsdbId);
                if (badge) return badge;
            }
            return searchLeagueTheSportsDB(competitionName);
        }},
        // 3. ESPN
        { name: 'ESPN', fn: () => searchLeagueESPN(competitionName) },
    ];

    for (const source of leagueSources) {
        try {
            const logoUrl = await source.fn();
            if (logoUrl) {
                const stored = await downloadLeagueImageAndStore(competitionId, competitionName, logoUrl, source.name.toLowerCase());
                if (stored.success) return { success: true, source: source.name, url: stored.url };
            }
        } catch {}
        await new Promise(r => setTimeout(r, 300));
    }

    return { success: false, error: `Not found on any source for "${competitionName}"` };
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK: Scrape all leagues without images
// ═══════════════════════════════════════════════════════════════════════════

export async function bulkScrapeLeagueIcons(): Promise<{
    success: boolean;
    results: LeagueScrapeResult[];
    stats: { fetched: number; existing: number; notFound: number; total: number };
}> {
    await connectMongo();
    const allLeagues = await SportLeague.find().sort({ order: 1, eventCount: -1 }).lean() as any[];

    const results: LeagueScrapeResult[] = [];
    let fetched = 0;
    let existing = 0;
    let notFound = 0;

    for (const league of allLeagues) {
        if (league.imageUrl) {
            results.push({
                competitionId: league.competitionId,
                competitionName: league.competitionName,
                status: 'exists',
            });
            existing++;
            continue;
        }

        // Rate limit between scrapes
        if (fetched > 0 && fetched % 2 === 0) {
            await new Promise(r => setTimeout(r, 2200));
        }

        const res = await scrapeLeagueIcon(league.competitionId, league.competitionName);
        if (res.success && !res.alreadyExists) {
            results.push({
                competitionId: league.competitionId,
                competitionName: league.competitionName,
                status: 'ok',
                source: res.source,
            });
            fetched++;
        } else if (res.success && res.alreadyExists) {
            results.push({
                competitionId: league.competitionId,
                competitionName: league.competitionName,
                status: 'exists',
            });
            existing++;
        } else {
            results.push({
                competitionId: league.competitionId,
                competitionName: league.competitionName,
                status: 'not_found',
                detail: res.error,
            });
            notFound++;
        }
    }

    revalidatePath('/dashboard/sports/leagues');
    return { success: true, results, stats: { fetched, existing, notFound, total: allLeagues.length } };
}
