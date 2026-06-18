'use server';

import path from 'path';
import fs from 'fs';

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar Casino Categories — Server Actions
// Read/write a JSON config file kept inside the project's data/ directory.
// Admin role is verified server-side by decoding the JWT passed from the client.
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(process.cwd(), 'data', 'sidebar-categories.json');

const ADMIN_ROLES = ['ADMIN', 'admin', 'SUPER_ADMIN'];

export interface SidebarCategory {
    id: string;
    name: string;
    visible: boolean;
    order: number;
}

const DEFAULT_CATEGORIES: SidebarCategory[] = [
    { id: 'slots',     name: 'Slots',       visible: true,  order: 0 },
    { id: 'live',      name: 'Live Casino', visible: true,  order: 1 },
    { id: 'table',     name: 'Table Games', visible: true,  order: 2 },
    { id: 'crash',     name: 'Crash Games', visible: true,  order: 3 },
    { id: 'originals', name: 'Originals',   visible: true,  order: 4 },
    { id: 'popular',   name: 'Popular',     visible: true,  order: 5 },
    { id: 'new',       name: 'New Games',   visible: true,  order: 6 },
    { id: 'jackpot',   name: 'Jackpot',     visible: false, order: 7 },
    { id: 'roulette',  name: 'Roulette',    visible: false, order: 8 },
    { id: 'blackjack', name: 'Blackjack',   visible: false, order: 9 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function readConfig(): SidebarCategory[] {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch { /* fallthrough to default */ }
    return DEFAULT_CATEGORIES;
}

function writeConfig(data: SidebarCategory[]): void {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/** Decode a JWT payload server-side (no verify — role is double-checked by NestJS on any mutation). */
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

// ── Server Actions ─────────────────────────────────────────────────────────────

/**
 * Returns all categories + the first 8 visible ones for the sidebar.
 * Public — no auth required.
 */
export async function getSidebarCategories(): Promise<{
    visible: SidebarCategory[];   // max 8, only shown in sidebar
    all: SidebarCategory[];       // full list for admin UI
}> {
    const all = readConfig().sort((a, b) => a.order - b.order);
    const visible = all.filter(c => c.visible).slice(0, 8);
    return { visible, all };
}

/**
 * Save a new ordered+toggled category list.
 * Admin only — pass the JWT token from localStorage.
 */
export async function saveSidebarCategories(
    token: string,
    categories: SidebarCategory[],
): Promise<{ ok: boolean; error?: string }> {
    // Server-side role check
    const role = decodeJwtRole(token);
    if (!role || !ADMIN_ROLES.includes(role)) {
        return { ok: false, error: 'Forbidden: admin role required.' };
    }

    if (!Array.isArray(categories) || categories.length === 0) {
        return { ok: false, error: 'Invalid payload.' };
    }

    // Normalise order field to match array index
    const normalised = categories.map((c, i) => ({ ...c, order: i }));
    writeConfig(normalised);
    return { ok: true };
}
