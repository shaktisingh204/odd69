// ─────────────────────────────────────────────────────────────
// GET /api/odds-events?sport=soccer_epl
// Proxies to NestJS GET /odds/events/:sport which reads from Redis.
// The NestJS OddsApiSyncService keeps Redis fresh every 60s.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://odd69.com/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport') || 'soccer_epl';

  try {
    const res = await fetch(`${BACKEND_URL}/odds/events/${encodeURIComponent(sport)}`, {
      next: { revalidate: 30 }, // 30s edge cache — data is fresh every 60s on backend
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Backend returned ${res.status}`);
    }

    const body = await res.json();
    // body = { source, count, sport_key, data: OddsEvent[] }
    const events = Array.isArray(body) ? body : (body.data ?? []);

    return NextResponse.json(events, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=90' },
    });
  } catch (err) {
    console.error(`[odds-events] backend fetch failed for sport=${sport}:`, err);
    // Return empty array — the frontend handles empty state gracefully
    return NextResponse.json([]);
  }
}
