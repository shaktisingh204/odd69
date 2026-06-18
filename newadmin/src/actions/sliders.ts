'use server'

import connectMongo from '@/lib/mongo';
import { PageSlider } from '@/models/MongoModels';
import { revalidatePath } from 'next/cache';

export interface SlideData {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    badge: string;
    tag: string;
    imageUrl: string;
    mobileImageUrl: string;
    charImage: string;
    gradient: string;
    overlayOpacity: number;
    overlayGradient: string;
    textColor: string;
    textAlign: 'left' | 'center' | 'right';
    ctaText: string;
    ctaLink: string;
    ctaStyle: string;
    gameCode: string;
    gameProvider: string;
    ctaSecondaryText: string;
    ctaSecondaryLink: string;
    isActive: boolean;
    order: number;
}

export interface SliderConfig {
    page: 'HOME' | 'CASINO' | 'SPORTS';
    isActive: boolean;
    heightDesktop: number;
    heightMobile: number;
    autoplay: boolean;
    autoplayInterval: number;
    transitionEffect: 'fade' | 'slide';
    borderRadius: number;
    slides: SlideData[];
}

// ─── Get slider config for a page ─────────────────────────────────────────────
export async function getPageSlider(page: 'HOME' | 'CASINO' | 'SPORTS') {
    try {
        await connectMongo();
        const doc = await PageSlider.findOne({ page }).lean() as any;
        if (!doc) return { success: true, data: null };
        return { success: true, data: JSON.parse(JSON.stringify(doc)) };
    } catch (error) {
        console.error('[getPageSlider] error:', error);
        return { success: false, data: null, error: 'Failed to fetch slider' };
    }
}

// ─── Get all 3 sliders ─────────────────────────────────────────────────────────
export async function getAllPageSliders() {
    try {
        await connectMongo();
        const docs = await PageSlider.find({}).lean() as any[];
        return { success: true, data: JSON.parse(JSON.stringify(docs)) };
    } catch (error) {
        console.error('[getAllPageSliders] error:', error);
        return { success: false, data: [], error: 'Failed to fetch sliders' };
    }
}

// ─── Upsert slider config ──────────────────────────────────────────────────────
export async function upsertPageSlider(config: SliderConfig) {
    try {
        await connectMongo();

        const { page, slides, ...rest } = config;

        const result = await PageSlider.findOneAndUpdate(
            { page },
            {
                ...rest,
                page,
                slides: slides.map((s, i) => ({ ...s, order: s.order ?? i })),
                updatedAt: new Date(),
            },
            { upsert: true, returnDocument: 'after', runValidators: true },
        );

        revalidatePath('/dashboard/cms/sliders');
        return { success: true, data: JSON.parse(JSON.stringify(result)) };
    } catch (error: any) {
        console.error('[upsertPageSlider] error:', error);
        return { success: false, error: error?.message || 'Failed to save slider' };
    }
}

// ─── Toggle slider active state ────────────────────────────────────────────────
export async function toggleSliderActive(page: 'HOME' | 'CASINO' | 'SPORTS', isActive: boolean) {
    try {
        await connectMongo();
        await PageSlider.findOneAndUpdate(
            { page },
            { isActive, updatedAt: new Date() },
            { upsert: true },
        );
        revalidatePath('/dashboard/cms/sliders');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to toggle slider' };
    }
}

// ─── Toggle individual slide ───────────────────────────────────────────────────
export async function toggleSlide(page: 'HOME' | 'CASINO' | 'SPORTS', slideId: string, isActive: boolean) {
    try {
        await connectMongo();
        await PageSlider.updateOne(
            { page, 'slides.id': slideId },
            { $set: { 'slides.$.isActive': isActive, updatedAt: new Date() } },
        );
        revalidatePath('/dashboard/cms/sliders');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to toggle slide' };
    }
}

// ─── Delete a slide ────────────────────────────────────────────────────────────
export async function deleteSlide(page: 'HOME' | 'CASINO' | 'SPORTS', slideId: string) {
    try {
        await connectMongo();
        await PageSlider.updateOne(
            { page },
            { $pull: { slides: { id: slideId } }, $set: { updatedAt: new Date() } },
        );
        revalidatePath('/dashboard/cms/sliders');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to delete slide' };
    }
}

// ─── Reorder slides ────────────────────────────────────────────────────────────
export async function reorderSlides(page: 'HOME' | 'CASINO' | 'SPORTS', orderedIds: string[]) {
    try {
        await connectMongo();
        const doc = await PageSlider.findOne({ page });
        if (!doc) return { success: false, error: 'Slider not found' };

        const slideMap = new Map<string, any>(
            (doc.slides as any[]).map((s: any) => [s.id, s]),
        );
        doc.slides = orderedIds
            .filter((id) => slideMap.has(id))
            .map((id, i) => ({ ...slideMap.get(id).toObject(), order: i }));
        doc.updatedAt = new Date();
        await doc.save();

        revalidatePath('/dashboard/cms/sliders');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to reorder slides' };
    }
}
