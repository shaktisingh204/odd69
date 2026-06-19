'use server';

// ─────────────────────────────────────────────────────────────────────────────
// League Images — Server Actions
// Reads/writes league image URLs via the backend API.
// Images are stored in MongoDB (SportLeague collection) on the backend.
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND = (process.env.NEXT_PUBLIC_API_URL ?? 'https://odd69.com/api').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN ?? '';

export interface LeagueImageEntry {
  competitionId: string;
  competitionName: string;
  sportId: string;
  sportName?: string;
  imageUrl: string;
  isVisible: boolean;
  order: number;
}

/** Fetch all league image entries from backend. Public. */
export async function getLeagueImages(): Promise<LeagueImageEntry[]> {
  try {
    const res = await fetch(`${BACKEND}/sports/leagues`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body.data) ? body.data : [];
  } catch {
    return [];
  }
}

/** Returns a quick lookup: competitionId → imageUrl */
export async function getLeagueImageMap(): Promise<Record<string, string>> {
  const list = await getLeagueImages();
  const map: Record<string, string> = {};
  for (const e of list) {
    if (e.imageUrl) map[e.competitionId] = e.imageUrl;
  }
  return map;
}

/** Update the imageUrl for a league. Admin only — pass JWT token. */
export async function updateLeagueImage(
  token: string,
  competitionId: string,
  imageUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BACKEND}/sports/leagues/${encodeURIComponent(competitionId)}/image`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Admin-Token': ADMIN_TOKEN,
      },
      body: JSON.stringify({ imageUrl }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Network error' };
  }
}
