'use server'

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { verifyAdmin } from '@/lib/admin-auth';

export interface DownlineUser {
    id: number;
    username: string;
    role: string;
    balance: number;
    exposure: number;
    referrals?: DownlineUser[];
}

export interface AgentStats {
    totalUsers: number;
    totalPlayerBalance: number;
    totalMarketLiability: number;
}

/** Recursively fetch managed users (downline tree) up to 3 levels */
async function fetchDownline(managerId: number, depth = 0): Promise<DownlineUser[]> {
    if (depth >= 3) return [];

    const users = await prisma.user.findMany({
        where: { managerId },
        select: {
            id: true,
            username: true,
            role: true,
            balance: true,
            exposure: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    const result: DownlineUser[] = [];
    for (const u of users) {
        const children = await fetchDownline(u.id, depth + 1);
        result.push({
            ...u,
            username: u.username || `User#${u.id}`,
            referrals: children.length > 0 ? children : undefined,
        });
    }
    return result;
}

/** Get the full downline tree under the given admin/agent user's managed users */
export async function getAgentDownline(managerId?: number) {
    // SECURITY: lower-tier agents may only view their own downline; the
    // requested managerId is overridden by the caller's verified identity
    // unless the caller is a top-level admin.
    const caller = await verifyAdmin();
    if (!caller) return { success: false, data: [] };

    let effectiveManagerId: number | null;
    if (caller.role === 'TECH_MASTER' || caller.role === 'SUPER_ADMIN') {
        effectiveManagerId = managerId ?? null;
    } else {
        // MANAGER / MASTER / AGENT — force to own subtree, ignore client param.
        effectiveManagerId = caller.id;
    }

    try {
        const rootUsers = await prisma.user.findMany({
            where: {
                role: { in: ['MASTER', 'AGENT'] },
                managerId: effectiveManagerId,
            },
            select: {
                id: true,
                username: true,
                role: true,
                balance: true,
                exposure: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const result: DownlineUser[] = [];
        for (const u of rootUsers) {
            const children = await fetchDownline(u.id, 1);
            result.push({
                ...u,
                username: u.username || `User#${u.id}`,
                referrals: children.length > 0 ? children : undefined,
            });
        }

        return { success: true, data: result };
    } catch (error) {
        console.error('getAgentDownline error:', error);
        return { success: true, data: [] };
    }
}

/** Aggregate stats: total agents+users, total balance, total exposure */
export async function getAgentStats(): Promise<{ success: boolean; data: AgentStats }> {
    try {
        const [userCount, agg] = await Promise.all([
            prisma.user.count({
                where: { role: { in: ['MASTER', 'AGENT', 'USER'] } },
            }),
            prisma.user.aggregate({
                where: { role: { in: ['MASTER', 'AGENT', 'USER'] } },
                _sum: { balance: true, exposure: true },
            }),
        ]);

        return {
            success: true,
            data: {
                totalUsers: userCount,
                totalPlayerBalance: Number(agg._sum.balance ?? 0),
                totalMarketLiability: Number(agg._sum.exposure ?? 0),
            },
        };
    } catch (error) {
        console.error('getAgentStats error:', error);
        return {
            success: true,
            data: { totalUsers: 0, totalPlayerBalance: 0, totalMarketLiability: 0 },
        };
    }
}

/** Create a new agent (MASTER or AGENT role) */
export async function createAgent(data: {
    username: string;
    password: string;
    email?: string;
    phoneNumber?: string;
    role: 'MASTER' | 'AGENT';
    managerId?: number;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { username, password, email, phoneNumber, role, managerId } = data;

        if (!username || !password) {
            return { success: false, error: 'Username and password are required' };
        }

        const hashed = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: {
                username,
                password: hashed,
                email: email || null,
                phoneNumber: phoneNumber || null,
                role: role as any,
                managerId: managerId || null,
            },
        });

        revalidatePath('/dashboard/agents');
        return { success: true };
    } catch (error: any) {
        const msg = error?.message || '';
        if (msg.includes('Unique constraint')) {
            return { success: false, error: 'Username, email or phone number already exists' };
        }
        console.error('createAgent error:', error);
        return { success: false, error: 'Failed to create agent' };
    }
}
