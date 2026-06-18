'use server';

import path from 'path';
import fs   from 'fs';
import mongoose from 'mongoose';
import connectMongo from '@/lib/mongo';

// ─────────────────────────────────────────────────────────────────────────────
// Pinned Matches — Server Actions
// Admin-pinned match IDs are stored in data/pinned-matches.json.
// The list is returned to the client where it is merged with user-pinned IDs
// kept in localStorage.
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(process.cwd(), 'data', 'pinned-matches.json');
const ADMIN_ROLES = ['ADMIN', 'admin', 'SUPER_ADMIN'];

export interface PinnedMatchesConfig {
  /** Match IDs pinned by admin — always shown to everyone */
  adminPinnedIds: string[];
  /** ISO timestamp of last update */
  updatedAt: string;
}

function readConfig(): PinnedMatchesConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw    = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.adminPinnedIds)) return parsed;
    }
  } catch { /* fallthrough */ }
  return { adminPinnedIds: [], updatedAt: new Date().toISOString() };
}

function writeConfig(data: PinnedMatchesConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Minimal BetfairEvent model for reading admin-pinned events from Mongo.
// The admin panel writes `isPinned` on documents in the betfair_events collection.
const BetfairEventPinSchema = new mongoose.Schema(
  { eventId: String, isPinned: Boolean },
  { collection: 'betfair_events', strict: false }
);
const BetfairEventPinModel =
  mongoose.models.BetfairEventPin ||
  mongoose.model('BetfairEventPin', BetfairEventPinSchema);

async function readMongoPinnedIds(): Promise<string[]> {
  try {
    await connectMongo();
    if (mongoose.connection.readyState !== 1) return [];
    const docs = await BetfairEventPinModel
      .find({ isPinned: true }, { eventId: 1, _id: 0 })
      .lean();
    return docs.map((d: any) => String(d.eventId)).filter(Boolean);
  } catch {
    return [];
  }
}

function decodeJwtRole(token: string): string | null {
  try {
    const b64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!b64) return null;
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Returns the list of admin-pinned match IDs. Public — no auth required.
 * Merges IDs from the legacy JSON file and the Mongo betfair_events.isPinned field
 * (written by the admin panel toggle).
 */
export async function getAdminPinnedMatchIds(): Promise<string[]> {
  const fromFile  = readConfig().adminPinnedIds;
  const fromMongo = await readMongoPinnedIds();
  return [...new Set([...fromFile, ...fromMongo])];
}

/**
 * Sets the full list of admin-pinned match IDs.
 * Admin only — pass the JWT token from localStorage.
 */
export async function setAdminPinnedMatchIds(
  token: string,
  ids: string[],
): Promise<{ ok: boolean; error?: string }> {
  const role = decodeJwtRole(token);
  if (!role || !ADMIN_ROLES.includes(role)) {
    return { ok: false, error: 'Forbidden: admin role required.' };
  }
  if (!Array.isArray(ids)) {
    return { ok: false, error: 'Invalid payload.' };
  }
  writeConfig({ adminPinnedIds: [...new Set(ids)], updatedAt: new Date().toISOString() });
  return { ok: true };
}

/** Toggle a single match (add/remove from admin list). Admin only. */
export async function toggleAdminPinnedMatch(
  token: string,
  matchId: string,
): Promise<{ ok: boolean; pinned: boolean; error?: string }> {
  const role = decodeJwtRole(token);
  if (!role || !ADMIN_ROLES.includes(role)) {
    return { ok: false, pinned: false, error: 'Forbidden: admin role required.' };
  }
  const cfg = readConfig();
  const set  = new Set(cfg.adminPinnedIds);
  const pinned = !set.has(matchId);
  if (pinned) set.add(matchId); else set.delete(matchId);
  const updated: PinnedMatchesConfig = { adminPinnedIds: [...set], updatedAt: new Date().toISOString() };
  writeConfig(updated);
  return { ok: true, pinned };
}
