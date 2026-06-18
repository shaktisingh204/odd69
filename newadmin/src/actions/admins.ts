'use server'

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import connectMongo from '@/lib/mongo';
import { AdminLoginLog } from '@/models/MongoModels';
import { verifyAdmin, requireRole } from '@/lib/admin-auth';

export interface AdminUser {
    id: number;
    username: string;
    email: string | null;
    role: string;
}

/** Fetch all staff users (TECH_MASTER, SUPER_ADMIN, MANAGER, MASTER, AGENT) */
export async function getAdminStaff(): Promise<{ success: boolean; data: AdminUser[] }> {
    try {
        const users = await prisma.user.findMany({
            where: { role: { in: ['TECH_MASTER', 'SUPER_ADMIN', 'MANAGER', 'MASTER', 'AGENT'] as any } },
            select: { id: true, username: true, email: true, role: true },
            orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        });

        const unique = Array.from(new Map(users.map((u) => [u.id, u])).values());

        return {
            success: true,
            data: unique.map((u) => ({
                ...u,
                username: u.username || `User#${u.id}`,
                email: u.email,
                role: u.role as string,
            })),
        };
    } catch (error) {
        console.error('getAdminStaff error:', error);
        return { success: true, data: [] };
    }
}

/** Update a user's role. Only TECH_MASTER may call this. */
export async function updateUserRole(
    userId: number,
    role: string,
): Promise<{ success: boolean; error?: string }> {
    // SECURITY: verify caller from signed JWT cookie — never trust client-supplied adminId.
    const caller = await requireRole(['TECH_MASTER']);
    if (!caller) {
        return { success: false, error: 'Unauthorized' };
    }
    try {
        const validRoles = ['TECH_MASTER', 'SUPER_ADMIN', 'MANAGER', 'MASTER', 'AGENT', 'USER'];
        if (!validRoles.includes(role)) {
            return { success: false, error: 'Invalid role' };
        }

        // Prevent a TECH_MASTER from demoting themselves (lockout protection).
        if (caller.id === userId && role !== 'TECH_MASTER') {
            return { success: false, error: 'Cannot change your own role' };
        }

        await prisma.user.update({
            where: { id: userId },
            data: { role: role as any },
        });

        await prisma.auditLog.create({
            data: {
                adminId: caller.id,
                action: 'UPDATE_USER_ROLE',
                details: { userId, newRole: role },
            },
        });

        revalidatePath('/dashboard/security/admins');
        return { success: true };
    } catch (error: any) {
        console.error('updateUserRole error:', error);
        return { success: false, error: error?.message || 'Failed to update role' };
    }
}

/**
 * Fetch admin login logs from MongoDB (admin_login_logs collection).
 * Logs are written by auth.ts at login time using the AdminLoginLog Mongoose model.
 */
export async function getAdminLoginLogs(
    limit = 200,
): Promise<{ success: boolean; data: any[] }> {
    try {
        await connectMongo();

        const logs = await AdminLoginLog.find({})
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Enrich with Prisma username data (best-effort — skip if user not found)
        const adminIds = [...new Set(logs.map((l: any) => l.adminId).filter(Boolean))];
        const users = adminIds.length
            ? await prisma.user.findMany({
                where: { id: { in: adminIds as number[] } },
                select: { id: true, username: true, email: true },
            })
            : [];
        const userMap = new Map(users.map((u) => [u.id, u]));

        return {
            success: true,
            data: logs.map((l: any) => ({
                id: l._id.toString(),
                adminId: l.adminId,
                email: l.email,
                ipAddress: l.ipAddress,
                userAgent: l.userAgent,
                createdAt: l.createdAt,
                admin: userMap.get(l.adminId) ?? null,
            })),
        };
    } catch (error) {
        console.error('getAdminLoginLogs error:', error);
        return { success: false, data: [] };
    }
}

/** Get payment methods from Prisma */
export async function getPaymentMethods(): Promise<{ success: boolean; data: any[] }> {
    try {
        const methods = await prisma.paymentMethod.findMany({
            orderBy: { createdAt: 'asc' },
        });
        return { success: true, data: methods };
    } catch (error) {
        console.error('getPaymentMethods error:', error);
        return { success: false, data: [] };
    }
}

/** Create a payment method */
export async function createPaymentMethod(data: {
    name: string;
    type: string;
    minAmount: number;
    maxAmount: number;
    fee?: number;
    feeType?: string;
    isActive?: boolean;
    details?: any;
}): Promise<{ success: boolean; error?: string }> {
    const caller = await requireRole(['TECH_MASTER', 'SUPER_ADMIN']);
    if (!caller) return { success: false, error: 'Unauthorized' };
    try {
        await prisma.paymentMethod.create({
            data: {
                name: data.name,
                type: data.type,
                minAmount: data.minAmount,
                maxAmount: data.maxAmount,
                fee: data.fee ?? 0,
                feeType: data.feeType ?? 'PERCENTAGE',
                isActive: data.isActive !== false,
                details: data.details ?? undefined,
            },
        });
        revalidatePath('/dashboard/finance/gateways');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to create method' };
    }
}

/** Update a payment method */
export async function updatePaymentMethod(
    id: number,
    data: Partial<{
        name: string;
        type: string;
        minAmount: number;
        maxAmount: number;
        fee: number;
        feeType: string;
        isActive: boolean;
        details: any;
    }>,
): Promise<{ success: boolean; error?: string }> {
    const caller = await requireRole(['TECH_MASTER', 'SUPER_ADMIN']);
    if (!caller) return { success: false, error: 'Unauthorized' };
    try {
        await prisma.paymentMethod.update({
            where: { id },
            data,
        });
        revalidatePath('/dashboard/finance/gateways');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to update method' };
    }
}

/** Delete a payment method */
export async function deletePaymentMethod(id: number): Promise<{ success: boolean; error?: string }> {
    const caller = await requireRole(['TECH_MASTER']);
    if (!caller) return { success: false, error: 'Unauthorized' };
    try {
        await prisma.paymentMethod.delete({ where: { id } });
        revalidatePath('/dashboard/finance/gateways');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to delete method' };
    }
}
