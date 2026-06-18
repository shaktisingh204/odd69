'use server';

import connectMongo from '@/lib/mongo';
import { TeamIcon, FantasyPlayerImage, IPLScrapeJob } from '@/models/MongoModels';
import { revalidatePath } from 'next/cache';
import sharp from 'sharp';

// ─── Logging ───────────────────────────────────────────────────────────────
// Prefixed + timestamped so entries are easy to grep in PM2 logs.
const LOG_PREFIX = '[IPL-SCRAPE]';
const log  = (...args: unknown[]) => console.log (LOG_PREFIX, new Date().toISOString(), ...args);
const warn = (...args: unknown[]) => console.warn(LOG_PREFIX, new Date().toISOString(), ...args);
const errLog = (...args: unknown[]) => console.error(LOG_PREFIX, new Date().toISOString(), ...args);

// ─── Cloudflare Images config ──────────────────────────────────────────────
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || 'ae6aabd73c9a3ddfb2f49419c0fbb69a';
const CF_API_TOKEN  = process.env.CF_IMAGES_TOKEN || process.env.IMAGES_TOKEN || 'QOCM2u9NAgrdxVgaeCIQUYDnLKnuQoeKqjh5oMlU';
const CF_BASE_URL   = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`;
const CF_DELIVERY   = 'https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ';

// iplt20.com blocks bot-looking UAs with 403. Use a realistic Chrome
// fingerprint (matching UA + Accept + Sec-* headers) so Cloudflare lets us
// through. These are the minimum headers that return 200 in testing.
const BROWSER_HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
};

// ─── IPL teams ──────────────────────────────────────────────────────────────
// code = short IPL code used in iplt20.com asset paths
// slug = URL slug on iplt20.com
const IPL_TEAMS: { code: string; slug: string; name: string }[] = [
    { code: 'CSK',  slug: 'chennai-super-kings',         name: 'Chennai Super Kings' },
    { code: 'DC',   slug: 'delhi-capitals',              name: 'Delhi Capitals' },
    { code: 'GT',   slug: 'gujarat-titans',              name: 'Gujarat Titans' },
    { code: 'KKR',  slug: 'kolkata-knight-riders',       name: 'Kolkata Knight Riders' },
    { code: 'LSG',  slug: 'lucknow-super-giants',        name: 'Lucknow Super Giants' },
    { code: 'MI',   slug: 'mumbai-indians',              name: 'Mumbai Indians' },
    { code: 'PBKS', slug: 'punjab-kings',                name: 'Punjab Kings' },
    { code: 'RR',   slug: 'rajasthan-royals',            name: 'Rajasthan Royals' },
    { code: 'RCB',  slug: 'royal-challengers-bengaluru', name: 'Royal Challengers Bengaluru' },
    { code: 'SRH',  slug: 'sunrisers-hyderabad',         name: 'Sunrisers Hyderabad' },
];

// ─── Name normalisation ─────────────────────────────────────────────────────
// Strip punctuation, collapse whitespace, lowercase.
// Expand "Mohd" variants so EntitySport names ("Mohammed Siraj") match IPL
// names ("Mohd. Siraj") and vice versa.
function normalizeName(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/[.'`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildAliases(raw: string): string[] {
    const base = normalizeName(raw);
    const aliases = new Set<string>([base]);

    // Mohd ↔ Mohammed ↔ Md
    if (/\bmohd\b/.test(base))     { aliases.add(base.replace(/\bmohd\b/g, 'mohammed')); aliases.add(base.replace(/\bmohd\b/g, 'md')); }
    if (/\bmohammed\b/.test(base)) { aliases.add(base.replace(/\bmohammed\b/g, 'mohd')); aliases.add(base.replace(/\bmohammed\b/g, 'md')); }
    if (/\bmd\b/.test(base))       { aliases.add(base.replace(/\bmd\b/g, 'mohd'));       aliases.add(base.replace(/\bmd\b/g, 'mohammed')); }

    return Array.from(aliases);
}

// ─── Cloudflare upload helper ──────────────────────────────────────────────
async function uploadToCloudflare(
    imgBuffer: ArrayBuffer,
    contentType: string,
    cfImageId: string,
    filename: string,
): Promise<{ success: boolean; error?: string }> {
    const form = new FormData();
    form.append('file', new Blob([imgBuffer], { type: contentType }), filename);
    form.append('id', cfImageId);

    const res = await fetch(CF_BASE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
        body: form,
    });
    const json = await res.json() as any;

    // 9409 = image with that id already exists — treat as success
    if (!json.success && json.errors?.[0]?.code !== 9409) {
        return { success: false, error: json.errors?.[0]?.message || 'Cloudflare upload failed' };
    }
    return { success: true };
}

// Cloudflare Images only accepts jpeg/png/webp/gif/svg. iplt20.com's CDN
// sometimes serves AVIF (or other formats) even when the URL ends in .png
// because of content-negotiation. Convert anything else to PNG via sharp
// before uploading.
const CF_ALLOWED_CONTENT_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
]);

async function normaliseForCloudflare(
    buffer: ArrayBuffer,
    contentType: string,
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
    const ct = contentType.split(';')[0]!.trim().toLowerCase();
    if (CF_ALLOWED_CONTENT_TYPES.has(ct)) return { buffer, contentType: ct };

    // Convert via sharp. sharp auto-detects AVIF, HEIC, TIFF, etc. from the
    // buffer magic bytes, so we don't need to trust the Content-Type header.
    const converted = await sharp(Buffer.from(buffer))
        .png({ compressionLevel: 9 })
        .toBuffer();
    log(`converted ${ct || 'unknown'} (${buffer.byteLength}B) → image/png (${converted.byteLength}B)`);
    return {
        buffer: converted.buffer.slice(converted.byteOffset, converted.byteOffset + converted.byteLength) as ArrayBuffer,
        contentType: 'image/png',
    };
}

async function downloadImage(url: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
    // Don't advertise AVIF/WebP preference — we want a format CF Images accepts
    // directly. iplt20.com's CDN can still ignore this and serve AVIF, which
    // we handle via normaliseForCloudflare below.
    const res = await fetch(url, {
        headers: {
            ...BROWSER_HEADERS,
            Accept: 'image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5',
        },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 500) return null; // placeholder

    try {
        return await normaliseForCloudflare(buffer, contentType);
    } catch (err: any) {
        errLog(`sharp conversion failed for ${url}:`, err?.message || err);
        return null;
    }
}

// ─── HTML parsing ───────────────────────────────────────────────────────────
// Team page has blocks like:
//   <img src="https://documents.iplt20.com/ipl/IPLHeadshot2026/62.png" ...>
//   ...<p>Shubman Gill</p>...
// We extract (imageId, name) pairs by scanning headshot <img> tags and the
// nearest following bold/strong/p text.

interface ParsedPlayer {
    name: string;
    iplImageId: string;
    sourceUrl: string;
}

function parsePlayersFromHtml(html: string): ParsedPlayer[] {
    const players: ParsedPlayer[] = [];
    const re = /https:\/\/documents\.iplt20\.com\/ipl\/IPLHeadshot2026\/(\d+)\.png/g;

    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
        const iplImageId = m[1]!;
        const sourceUrl = m[0]!;

        // Look forward ~2KB for the first player name.
        // Names appear as bold text in the player card, e.g.
        //   <b>Shubman Gill</b> or <h2>Shubman Gill</h2>
        const window = html.slice(m.index, m.index + 2000);
        const nameMatch =
            window.match(/<(?:b|strong|h2|h3|h4|p)[^>]*>\s*([A-Z][A-Za-z'.\s-]{1,40})\s*<\//)
            || window.match(/alt="([^"]{2,40})"/);

        if (!nameMatch?.[1]) continue;
        const name = nameMatch[1].trim();

        // Guard against garbage captures
        if (!/^[A-Z]/.test(name)) continue;
        if (name.length < 3) continue;

        // Dedupe — same image ID shouldn't appear twice
        if (players.some(p => p.iplImageId === iplImageId)) continue;
        players.push({ name, iplImageId, sourceUrl });
    }

    return players;
}

function parseTeamLogoFromHtml(html: string, code: string): string | null {
    // The main team hero uses the outline logo: .../ipl/<CODE>/Logos/Logooutline/<CODE>outline.png
    // Casing varies (CSK uses lowercase 'logos'; DC uses 'LogoOutline'). Match case-insensitively.
    const re = new RegExp(
        `https:\\/\\/documents\\.iplt20\\.com\\/ipl\\/${code}\\/[A-Za-z]+\\/[A-Za-z]+\\/${code}[A-Za-z]*\\.png`,
        'i'
    );
    const m = html.match(re);
    return m?.[0] ?? null;
}

// ─── Single team scrape ─────────────────────────────────────────────────────

export interface TeamScrapeResult {
    code: string;
    name: string;
    status: 'ok' | 'error';
    logoUrl?: string;         // Cloudflare delivery URL
    logoExisting?: boolean;   // already uploaded previously
    players: Array<{
        name: string;
        iplImageId: string;
        status: 'ok' | 'exists' | 'error';
        cfUrl?: string;
        error?: string;
    }>;
    error?: string;
}

async function scrapeAndUploadTeam(
    team: typeof IPL_TEAMS[number],
): Promise<TeamScrapeResult> {
    const teamStart = Date.now();
    log(`team[${team.code}] start — fetching ${team.slug}`);

    const result: TeamScrapeResult = {
        code: team.code,
        name: team.name,
        status: 'ok',
        players: [],
    };

    // 1. Fetch team HTML
    let html: string;
    try {
        const res = await fetch(`https://www.iplt20.com/teams/${team.slug}`, {
            headers: { ...BROWSER_HEADERS, Referer: 'https://www.iplt20.com/teams' },
        });
        if (!res.ok) {
            result.status = 'error';
            result.error = `HTTP ${res.status} fetching team page`;
            errLog(`team[${team.code}] fetch HTTP ${res.status}`);
            return result;
        }
        html = await res.text();
        log(`team[${team.code}] fetched HTML (${html.length} bytes)`);
    } catch (err: any) {
        result.status = 'error';
        result.error = `Fetch failed: ${err.message}`;
        errLog(`team[${team.code}] fetch failed:`, err?.message);
        return result;
    }

    // 2. Upload team logo
    const logoUrl = parseTeamLogoFromHtml(html, team.code);
    if (logoUrl) {
        await connectMongo();
        const normalised = team.name.toLowerCase().trim();
        const existing = await TeamIcon.findOne({ team_name: normalised }).lean() as any;

        if (existing?.icon_url) {
            result.logoUrl = existing.icon_url;
            result.logoExisting = true;
            log(`team[${team.code}] logo already in Cloudflare — skipping`);
        } else {
            log(`team[${team.code}] downloading logo ${logoUrl}`);
            const img = await downloadImage(logoUrl);
            if (img) {
                const ts = Date.now();
                const cfImageId = `team-icons/ipl_${team.code}_${ts}`;
                const up = await uploadToCloudflare(img.buffer, img.contentType, cfImageId, `${team.code}.png`);
                if (up.success) {
                    const deliveryUrl = `${CF_DELIVERY}/${encodeURIComponent(cfImageId)}/public`;
                    await TeamIcon.findOneAndUpdate(
                        { team_name: normalised },
                        { team_name: normalised, display_name: team.name, icon_url: deliveryUrl, sport_id: 'cricket' },
                        { upsert: true },
                    );
                    result.logoUrl = deliveryUrl;
                    log(`team[${team.code}] logo uploaded → ${cfImageId}`);
                } else {
                    warn(`team[${team.code}] logo upload failed: ${up.error}`);
                }
            } else {
                warn(`team[${team.code}] logo download failed`);
            }
        }
    } else {
        warn(`team[${team.code}] no logo URL found in HTML`);
    }

    // 3. Parse + upload players
    const players = parsePlayersFromHtml(html);
    log(`team[${team.code}] parsed ${players.length} players`);

    let uploaded = 0, existing = 0, failed = 0;
    for (const p of players) {
        const normalised = normalizeName(p.name);
        const aliases = buildAliases(p.name);

        try {
            const existingImg = await FantasyPlayerImage.findOne({ normalizedName: normalised }).lean() as any;
            if (existingImg?.cfUrl) {
                result.players.push({ name: p.name, iplImageId: p.iplImageId, status: 'exists', cfUrl: existingImg.cfUrl });
                existing++;
                continue;
            }

            const img = await downloadImage(p.sourceUrl);
            if (!img) {
                result.players.push({ name: p.name, iplImageId: p.iplImageId, status: 'error', error: 'download failed' });
                failed++;
                warn(`team[${team.code}] player[${p.name}] download failed ${p.sourceUrl}`);
                continue;
            }

            const cleanName = p.name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
            const ts = Date.now();
            const cfImageId = `player-icons/ipl_${team.code}_${cleanName}_${ts}`;
            const up = await uploadToCloudflare(img.buffer, img.contentType, cfImageId, `${cleanName}.png`);
            if (!up.success) {
                result.players.push({ name: p.name, iplImageId: p.iplImageId, status: 'error', error: up.error });
                failed++;
                warn(`team[${team.code}] player[${p.name}] upload failed: ${up.error}`);
                continue;
            }

            const cfUrl = `${CF_DELIVERY}/${encodeURIComponent(cfImageId)}/public`;
            await FantasyPlayerImage.findOneAndUpdate(
                { normalizedName: normalised },
                {
                    normalizedName: normalised,
                    aliases,
                    displayName: p.name,
                    teamCode: team.code,
                    teamName: team.name,
                    iplImageId: p.iplImageId,
                    sourceUrl: p.sourceUrl,
                    cfImageId,
                    cfUrl,
                },
                { upsert: true },
            );
            result.players.push({ name: p.name, iplImageId: p.iplImageId, status: 'ok', cfUrl });
            uploaded++;
            log(`team[${team.code}] player[${p.name}] uploaded → ${cfImageId}`);
        } catch (err: any) {
            result.players.push({ name: p.name, iplImageId: p.iplImageId, status: 'error', error: err.message });
            failed++;
            errLog(`team[${team.code}] player[${p.name}] error:`, err?.message);
        }

        // gentle throttle between uploads
        await new Promise(r => setTimeout(r, 150));
    }

    const elapsed = ((Date.now() - teamStart) / 1000).toFixed(1);
    log(`team[${team.code}] done in ${elapsed}s — uploaded=${uploaded} existing=${existing} failed=${failed}`);
    return result;
}

// ─── Public entry points ────────────────────────────────────────────────────

// Fire-and-forget background worker. The admin is a PM2-managed long-lived
// Node process so this keeps running after the Server Action has returned.
async function runBulkScrapeJob(jobId: string): Promise<void> {
    const jobStart = Date.now();
    log(`job[${jobId}] started — ${IPL_TEAMS.length} teams queued`);
    try {
        await IPLScrapeJob.findByIdAndUpdate(jobId, { status: 'running' });

        for (const team of IPL_TEAMS) {
            // Cooperative cancellation: if the job doc has been flipped away
            // from `running` (e.g. cancelled via cancelIPLScrapeJob), bail
            // before starting the next team.
            const current = await IPLScrapeJob.findById(jobId).select('status').lean() as any;
            if (!current || current.status !== 'running') {
                log(`job[${jobId}] cancelled — stopping before team[${team.code}]`);
                return;
            }

            await IPLScrapeJob.findByIdAndUpdate(jobId, { currentTeam: team.code });

            const r = await scrapeAndUploadTeam(team);

            const inc: Record<string, number> = { completedTeams: 1 };
            if (r.logoUrl && r.logoExisting) inc['stats.teamsLogoExisting'] = 1;
            else if (r.logoUrl)              inc['stats.teamsLogoUploaded'] = 1;
            for (const p of r.players) {
                if (p.status === 'ok')          inc['stats.playersUploaded'] = (inc['stats.playersUploaded'] || 0) + 1;
                else if (p.status === 'exists') inc['stats.playersExisting'] = (inc['stats.playersExisting'] || 0) + 1;
                else                            inc['stats.playersFailed']   = (inc['stats.playersFailed']   || 0) + 1;
            }

            await IPLScrapeJob.findByIdAndUpdate(jobId, { $inc: inc, $push: { teams: r } });

            // throttle between teams so we don't hammer iplt20.com
            await new Promise(r => setTimeout(r, 500));
        }

        await IPLScrapeJob.findByIdAndUpdate(jobId, {
            status: 'completed',
            currentTeam: null,
            completedAt: new Date(),
        });
        const elapsed = ((Date.now() - jobStart) / 1000).toFixed(1);
        log(`job[${jobId}] completed in ${elapsed}s`);
    } catch (err: any) {
        await IPLScrapeJob.findByIdAndUpdate(jobId, {
            status: 'failed',
            error: err?.message || String(err),
            completedAt: new Date(),
        });
        errLog(`job[${jobId}] failed:`, err?.message || err);
    }
}

export async function scrapeAllIPLAssets(): Promise<{
    success: boolean;
    jobId?: string;
    error?: string;
}> {
    await connectMongo();

    // Refuse to start a second job while one is already active. A stale
    // "running" job older than 30 min is treated as crashed and ignored.
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const active = await IPLScrapeJob.findOne({
        status: { $in: ['pending', 'running'] },
        startedAt: { $gt: cutoff },
    }).sort({ startedAt: -1 }).lean() as any;
    if (active) {
        log(`reusing active job[${active._id}] (${active.status})`);
        return { success: true, jobId: String(active._id) };
    }

    const job = await IPLScrapeJob.create({
        status: 'pending',
        totalTeams: IPL_TEAMS.length,
        completedTeams: 0,
        teams: [],
        stats: { teamsLogoUploaded: 0, teamsLogoExisting: 0, playersUploaded: 0, playersExisting: 0, playersFailed: 0 },
        startedAt: new Date(),
    });
    const jobId = String(job._id);
    log(`created job[${jobId}] — kicking off background scrape`);

    void runBulkScrapeJob(jobId);

    return { success: true, jobId };
}

export interface IPLScrapeJobStatus {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    totalTeams: number;
    completedTeams: number;
    currentTeam?: string;
    teams: TeamScrapeResult[];
    stats: {
        teamsLogoUploaded: number;
        teamsLogoExisting: number;
        playersUploaded: number;
        playersExisting: number;
        playersFailed: number;
    };
    error?: string;
    startedAt: string;
    completedAt?: string;
}

export async function getIPLScrapeJobStatus(jobId: string): Promise<{
    success: boolean;
    job?: IPLScrapeJobStatus;
    error?: string;
}> {
    await connectMongo();
    const job = await IPLScrapeJob.findById(jobId).lean() as any;
    if (!job) return { success: false, error: 'Job not found' };

    if (job.status === 'completed' || job.status === 'failed') {
        revalidatePath('/dashboard/fantasy/ipl-assets');
    }

    return {
        success: true,
        job: {
            id: String(job._id),
            status: job.status,
            totalTeams: job.totalTeams,
            completedTeams: job.completedTeams,
            currentTeam: job.currentTeam || undefined,
            teams: job.teams || [],
            stats: job.stats,
            error: job.error,
            startedAt: new Date(job.startedAt).toISOString(),
            completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : undefined,
        },
    };
}

export async function cancelIPLScrapeJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    await connectMongo();
    const res = await IPLScrapeJob.findOneAndUpdate(
        { _id: jobId, status: { $in: ['pending', 'running'] } },
        { status: 'failed', error: 'Cancelled by user', completedAt: new Date() },
        { new: true },
    ).lean() as any;
    if (!res) return { success: false, error: 'Job not running or not found' };
    log(`job[${jobId}] cancelled by user`);
    revalidatePath('/dashboard/fantasy/ipl-assets');
    return { success: true };
}

export async function listIPLScrapeJobs(limit = 10): Promise<{
    jobs: Array<{
        id: string;
        status: 'pending' | 'running' | 'completed' | 'failed';
        completedTeams: number;
        totalTeams: number;
        stats: IPLScrapeJobStatus['stats'];
        error?: string;
        startedAt: string;
        completedAt?: string;
    }>;
}> {
    await connectMongo();
    const rows = await IPLScrapeJob.find({})
        .sort({ startedAt: -1 })
        .limit(limit)
        .select('-teams')
        .lean() as any[];
    return {
        jobs: rows.map(j => ({
            id: String(j._id),
            status: j.status,
            completedTeams: j.completedTeams,
            totalTeams: j.totalTeams,
            stats: j.stats,
            error: j.error,
            startedAt: new Date(j.startedAt).toISOString(),
            completedAt: j.completedAt ? new Date(j.completedAt).toISOString() : undefined,
        })),
    };
}

// Delete a single finished job, or clear every non-running job when no id is
// given. Running jobs must be cancelled first.
export async function deleteIPLScrapeJob(jobId?: string): Promise<{ success: boolean; deleted: number; error?: string }> {
    await connectMongo();
    if (jobId) {
        const job = await IPLScrapeJob.findById(jobId).select('status').lean() as any;
        if (!job) return { success: false, deleted: 0, error: 'Job not found' };
        if (job.status === 'pending' || job.status === 'running') {
            return { success: false, deleted: 0, error: 'Cancel the job before deleting it' };
        }
        await IPLScrapeJob.deleteOne({ _id: jobId });
        log(`job[${jobId}] deleted`);
        revalidatePath('/dashboard/fantasy/ipl-assets');
        return { success: true, deleted: 1 };
    }
    const res = await IPLScrapeJob.deleteMany({ status: { $in: ['completed', 'failed'] } });
    log(`cleared ${res.deletedCount ?? 0} finished jobs`);
    revalidatePath('/dashboard/fantasy/ipl-assets');
    return { success: true, deleted: res.deletedCount ?? 0 };
}

export async function scrapeSingleIPLTeam(code: string): Promise<{ success: boolean; team?: TeamScrapeResult; error?: string }> {
    const team = IPL_TEAMS.find(t => t.code === code.toUpperCase());
    if (!team) {
        warn(`scrapeSingleIPLTeam unknown code: ${code}`);
        return { success: false, error: `Unknown IPL team code: ${code}` };
    }

    log(`single team scrape requested: ${team.code}`);
    await connectMongo();
    const result = await scrapeAndUploadTeam(team);
    revalidatePath('/dashboard/fantasy/ipl-assets');
    return { success: true, team: result };
}

export async function listIPLAssets(): Promise<{
    teams: Array<{ code: string; name: string; slug: string; logoUrl?: string }>;
    playersByTeam: Record<string, Array<{ name: string; cfUrl: string; iplImageId: string }>>;
    totalPlayers: number;
}> {
    await connectMongo();

    const allPlayers = await FantasyPlayerImage.find({}).lean() as any[];
    const icons = await TeamIcon.find({ sport_id: 'cricket' }).lean() as any[];
    const iconByName = new Map(icons.map(i => [i.team_name, i.icon_url]));

    const playersByTeam: Record<string, any[]> = {};
    for (const p of allPlayers) {
        (playersByTeam[p.teamCode] ||= []).push({ name: p.displayName, cfUrl: p.cfUrl, iplImageId: p.iplImageId });
    }

    return {
        teams: IPL_TEAMS.map(t => ({
            code: t.code,
            name: t.name,
            slug: t.slug,
            logoUrl: iconByName.get(t.name.toLowerCase()),
        })),
        playersByTeam,
        totalPlayers: allPlayers.length,
    };
}
