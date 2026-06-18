import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_PROXY_URL || 'http://localhost:3001';

// ── GET /api/daily-checkin/config ─────────────────────────────────────────────
// Public — returns { enabled: boolean }.
// Proxied to the NestJS backend which reads from MongoDB.
export async function GET(_req: NextRequest) {
    try {
        const res = await fetch(`${API_URL}/api/daily-checkin/config`, {
            cache: 'no-store',
        });
        if (!res.ok) {
            // Fail open: if backend is down, assume enabled so users aren't blocked
            return NextResponse.json({ enabled: true, hidden: false });
        }
        const data = await res.json();
        return NextResponse.json({ enabled: data?.enabled !== false, hidden: data?.hidden === true });
    } catch {
        // Network error — default to enabled and visible
        return NextResponse.json({ enabled: true, hidden: false });
    }
}
