// ─────────────────────────────────────────────────────────────
// GET /api/odds-sports
// Proxies to NestJS GET /odds/sports which reads from Redis.
// The NestJS OddsApiSyncService keeps Redis fresh on a schedule.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://zeero.bet/api';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/odds/sports`, {
      next: { revalidate: 60 }, // Allow edge cache for 60s
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Backend returned ${res.status}`);
    }

    const body = await res.json();
    // body = { source, count, data: SportInfo[] }
    const sports = Array.isArray(body) ? body : (body.data ?? []);

    return NextResponse.json(sports, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err) {
    console.error('[odds-sports] backend fetch failed:', err);

    // Hard fallback so the UI always renders something
    const FALLBACK = [
      { key: 'soccer_epl', group: 'Soccer', title: 'EPL', description: 'English Premier League', active: true, has_outrights: false },
      { key: 'cricket_ipl', group: 'Cricket', title: 'IPL', description: 'Indian Premier League', active: true, has_outrights: false },
      { key: 'basketball_nba', group: 'Basketball', title: 'NBA', description: 'US Basketball', active: true, has_outrights: false },
      { key: 'americanfootball_nfl', group: 'American Football', title: 'NFL', description: 'US Football', active: true, has_outrights: false },
      { key: 'tennis_atp_french_open', group: 'Tennis', title: 'ATP French Open', description: "Men's Singles", active: true, has_outrights: false },
      { key: 'icehockey_nhl', group: 'Ice Hockey', title: 'NHL', description: 'US Ice Hockey', active: true, has_outrights: false },
      { key: 'mma_mixed_martial_arts', group: 'Mixed Martial Arts', title: 'MMA', description: 'MMA', active: true, has_outrights: false },
      { key: 'cricket_test_match', group: 'Cricket', title: 'Test Matches', description: 'International Tests', active: true, has_outrights: false },
    ];
    return NextResponse.json(FALLBACK);
  }
}
