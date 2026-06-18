'use server'

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const SEGMENT_DAYS = {
    NEW: 7,       // registered in last 7 days
    ACTIVE: 30,   // had a transaction / deposit in last 30 days
    DORMANT: 30,  // no activity in last 30 days
    VIP: 100000,  // totalDeposited >= 100,000
    CHURNED: 60,  // no deposit/bet in last 60 days, but had some
} as const;

export interface CrmSegments {
    vip: number;
    new: number;
    active: number;
    churned: number;
    dormant: number;
}

/** Count users in each CRM segment */
export async function getCrmSegments(): Promise<{ success: boolean; data: CrmSegments }> {
    try {
        const now = new Date();
        const days7   = new Date(now.getTime() - SEGMENT_DAYS.NEW * 86400_000);
        const days30  = new Date(now.getTime() - SEGMENT_DAYS.ACTIVE * 86400_000);
        const days60  = new Date(now.getTime() - SEGMENT_DAYS.CHURNED * 86400_000);

        const [vip, newUsers, active, churned] = await Promise.all([
            prisma.user.count({ where: { totalDeposited: { gte: SEGMENT_DAYS.VIP }, role: 'USER' } }),
            prisma.user.count({ where: { createdAt: { gte: days7 }, role: 'USER' } }),
            prisma.user.count({ where: {
                role: 'USER',
                transactions: { some: { createdAt: { gte: days30 }, type: 'DEPOSIT', status: { in: ['APPROVED', 'COMPLETED'] } } },
            }}),
            prisma.user.count({ where: {
                role: 'USER',
                createdAt: { lt: days60 },
                transactions: {
                    none: { createdAt: { gte: days60 }, type: 'DEPOSIT', status: { in: ['APPROVED', 'COMPLETED'] } },
                },
                totalDeposited: { gt: 0 },
            }}),
        ]);

        const dormant = await prisma.user.count({ where: {
            role: 'USER',
            transactions: {
                none: { createdAt: { gte: days30 } },
            },
        }});

        return { success: true, data: { vip, new: newUsers, active, churned, dormant } };
    } catch (error) {
        console.error('getCrmSegments error:', error);
        return { success: true, data: { vip: 0, new: 0, active: 0, churned: 0, dormant: 0 } };
    }
}

/** Fetch users belonging to a segment (paginated) */
export async function getCrmSegmentUsers(
    segment: string,
    page = 1,
    limit = 20,
): Promise<{ success: boolean; data: any[]; total: number }> {
    try {
        const now = new Date();
        const days7  = new Date(now.getTime() - 7 * 86400_000);
        const days30 = new Date(now.getTime() - 30 * 86400_000);
        const days60 = new Date(now.getTime() - 60 * 86400_000);
        const skip = (page - 1) * limit;

        let where: any = { role: 'USER' };

        switch (segment.toUpperCase()) {
            case 'VIP':
                where = { ...where, totalDeposited: { gte: 100000 } };
                break;
            case 'NEW':
                where = { ...where, createdAt: { gte: days7 } };
                break;
            case 'ACTIVE':
                where = { ...where, transactions: { some: { createdAt: { gte: days30 }, type: 'DEPOSIT', status: { in: ['APPROVED', 'COMPLETED'] } } } };
                break;
            case 'CHURNED':
                where = {
                    ...where,
                    createdAt: { lt: days60 },
                    transactions: { none: { createdAt: { gte: days60 }, type: 'DEPOSIT', status: { in: ['APPROVED', 'COMPLETED'] } } },
                    totalDeposited: { gt: 0 },
                };
                break;
            case 'DORMANT':
                where = { ...where, transactions: { none: { createdAt: { gte: days30 } } } };
                break;
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: { id: true, username: true, email: true, balance: true, totalDeposited: true, createdAt: true },
                orderBy: { totalDeposited: 'desc' },
                skip,
                take: limit,
            }),
            prisma.user.count({ where }),
        ]);

        return { success: true, data: users, total };
    } catch (error) {
        console.error('getCrmSegmentUsers error:', error);
        return { success: false, data: [], total: 0 };
    }
}

/** Send an in-app notification to all users in a segment */
export async function sendCrmCampaign(
    segment: string,
    title: string,
    message: string,
    adminId?: number,
): Promise<{ success: boolean; sentCount?: number; error?: string }> {
    try {
        // Fetch all user ids in the segment (no pagination — we notify all)
        const { data: users } = await getCrmSegmentUsers(segment, 1, 10000);
        if (!users.length) return { success: true, sentCount: 0 };

        await prisma.notification.createMany({
            data: users.map((u) => ({
                userId: u.id,
                title: title || 'Admin Announcement',
                body: message,
            })),
        });

        // Audit log
        if (adminId) {
            await prisma.auditLog.create({
                data: {
                    adminId,
                    action: 'CRM_CAMPAIGN',
                    details: { segment, title, message, sentCount: users.length },
                },
            });
        }

        revalidatePath('/dashboard/crm');
        return { success: true, sentCount: users.length };
    } catch (error: any) {
        console.error('sendCrmCampaign error:', error);
        return { success: false, error: error?.message || 'Failed to send campaign' };
    }
}
