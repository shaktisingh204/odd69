'use server'

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// --- Home Categories ---

export async function getHomeCategories() {
    try {
        const categories = await prisma.homeCategory.findMany({
            orderBy: { order: 'asc' }
        });
        return { success: true, data: categories };
    } catch (error) {
        console.error('Failed to fetch home categories:', error);
        return { success: false, error: 'Failed to fetch categories' };
    }
}

export async function createHomeCategory(data: any) { // Type check ideally
    try {
        await prisma.homeCategory.create({
            data: {
                title: data.title,
                description: data.description,
                image: data.image,
                link: data.link,
                isLarge: data.isLarge,
                order: data.order,
                isActive: data.isActive
            }
        });
        revalidatePath('/dashboard/cms/categories');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to create category' };
    }
}

export async function updateHomeCategory(id: number, data: any) {
    try {
        await prisma.homeCategory.update({
            where: { id },
            data
        });
        revalidatePath('/dashboard/cms/categories');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update category' };
    }
}

export async function deleteHomeCategory(id: number) {
    try {
        await prisma.homeCategory.delete({ where: { id } });
        revalidatePath('/dashboard/cms/categories');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to delete category' };
    }
}

import connectMongo from '@/lib/mongo';
import { PromoCard } from '@/models/MongoModels';

export async function getPromoCards() {
    try {
        await connectMongo();
        const cards = await PromoCard.find().sort({ order: 1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(cards)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch promo cards' };
    }
}

export async function createPromoCard(data: any) {
    try {
        await connectMongo();
        await PromoCard.create(data);
        revalidatePath('/dashboard/cms/promo-cards');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to create promo card' };
    }
}

export async function updatePromoCard(id: string, data: any) {
    try {
        await connectMongo();
        await PromoCard.findByIdAndUpdate(id, data);
        revalidatePath('/dashboard/cms/promo-cards');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update promo card' };
    }
}

export async function deletePromoCard(id: string) {
    try {
        await connectMongo();
        await PromoCard.findByIdAndDelete(id);
        revalidatePath('/dashboard/cms/promo-cards');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to delete promo card' };
    }
}

// ─── Promotions (Promotions Page Content) ───────────────────────────────────
// Different from PromoCard (homepage sliders). These power the /promotions page.

import { Promotion } from '@/models/MongoModels';

export async function getPromotions() {
    try {
        await connectMongo();
        const items = await Promotion.find().sort({ order: 1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(items)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch promotions' };
    }
}

export async function createPromotion(data: any) {
    try {
        await connectMongo();
        await Promotion.create(data);
        revalidatePath('/dashboard/cms/promotions');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to create promotion' };
    }
}

export async function updatePromotion(id: string, data: any) {
    try {
        await connectMongo();
        await Promotion.findByIdAndUpdate(id, data);
        revalidatePath('/dashboard/cms/promotions');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update promotion' };
    }
}

export async function deletePromotion(id: string) {
    try {
        await connectMongo();
        await Promotion.findByIdAndDelete(id);
        revalidatePath('/dashboard/cms/promotions');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to delete promotion' };
    }
}


// ─── Announcements ──────────────────────────────────────────────────────────

import { Announcement } from '@/models/MongoModels';

export async function getAnnouncements() {
    try {
        await connectMongo();
        const items = await Announcement.find().sort({ isPinned: -1, order: 1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(items)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch announcements' };
    }
}

export async function createAnnouncement(data: any) {
    try {
        await connectMongo();
        await Announcement.create(data);
        revalidatePath('/dashboard/cms/announcements');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to create announcement' };
    }
}

export async function updateAnnouncement(id: string, data: any) {
    try {
        await connectMongo();
        await Announcement.findByIdAndUpdate(id, data);
        revalidatePath('/dashboard/cms/announcements');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update announcement' };
    }
}

export async function deleteAnnouncement(id: string) {
    try {
        await connectMongo();
        await Announcement.findByIdAndDelete(id);
        revalidatePath('/dashboard/cms/announcements');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to delete announcement' };
    }
}

// ─── FAQ ───────────────────────────────────────────────────────────────────

import { Faq } from '@/models/MongoModels';

export async function getFaqs() {
    try {
        await connectMongo();
        const items = await Faq.find().sort({ category: 1, order: 1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(items)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch FAQs' };
    }
}

export async function createFaq(data: any) {
    try {
        await connectMongo();
        await Faq.create(data);
        revalidatePath('/dashboard/cms/faq');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to create FAQ' };
    }
}

export async function updateFaq(id: string, data: any) {
    try {
        await connectMongo();
        await Faq.findByIdAndUpdate(id, data);
        revalidatePath('/dashboard/cms/faq');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update FAQ' };
    }
}

export async function deleteFaq(id: string) {
    try {
        await connectMongo();
        await Faq.findByIdAndDelete(id);
        revalidatePath('/dashboard/cms/faq');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to delete FAQ' };
    }
}
