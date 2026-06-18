// GET /api/page-sliders?page=HOME|CASINO|SPORTS
// Public endpoint — fetches slider config from MongoDB for website hero components

import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongo';
import { PageSlider } from '@/models/PageSlider';

export async function GET(req: NextRequest) {
    try {
        const page = req.nextUrl.searchParams.get('page')?.toUpperCase();

        await connectMongo();

        if (page && ['HOME', 'CASINO', 'SPORTS'].includes(page)) {
            const doc = await PageSlider.findOne({ page, isActive: true }).lean();
            if (!doc) return NextResponse.json({ slider: null });
            return NextResponse.json({ slider: doc }, {
                headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
            });
        }

        // Return all active sliders
        const docs = await PageSlider.find({ isActive: true }).lean();
        return NextResponse.json({ sliders: docs }, {
            headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
        });
    } catch (error) {
        console.error('[/api/page-sliders] error:', error);
        return NextResponse.json({ error: 'Failed to fetch sliders' }, { status: 500 });
    }
}
