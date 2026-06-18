// GET  /api/sidebar-categories  — public, used by LeftSidebar
// POST /api/sidebar-categories  — admin only (legacy, prefer server action)
//
// POST is kept for backward compat but the settings page now uses the
// server action directly (src/lib/actions/sidebarCategories.ts).

import { NextRequest, NextResponse } from 'next/server';
import { getSidebarCategories, saveSidebarCategories } from '@/lib/actions/sidebarCategories';

export async function GET() {
    const { visible, all } = await getSidebarCategories();
    return NextResponse.json({ categories: visible, all });
}

export async function POST(req: NextRequest) {
    const auth  = req.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    try {
        const body = await req.json();
        const result = await saveSidebarCategories(token, body.categories);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.error?.includes('Forbidden') ? 403 : 400 });
        }
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
}
