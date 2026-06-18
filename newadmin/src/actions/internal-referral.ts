'use server'

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roundCurrency(value: number) {
    return parseFloat((Number(value || 0)).toFixed(2));
}

type PrismaWithNotification = typeof prisma & {
    notification: {
        create(args: {
            data: { userId: number; title: string; body: string };
        }): Promise<unknown>;
    };
};

const prismaWithNotification = prisma as unknown as PrismaWithNotification;

// ─── Referral Reward Config CRUD ──────────────────────────────────────────────

/**
 * List all referral reward configurations.
 */
export async function getReferralRewards() {
    try {
        const rewards = await (prisma as any).referralReward.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, rewards };
    } catch (error) {
        console.error('[getReferralRewards] error:', error);
        return { success: false, rewards: [], error: 'Failed to fetch referral rewards' };
    }
}

/**
 * Create a new referral reward configuration.
 */
export async function createReferralReward(data: {
    name: string;
    description?: string;
    conditionType: 'SIGNUP' | 'DEPOSIT_FIRST' | 'DEPOSIT_RECURRING' | 'BET_VOLUME';
    conditionValue?: number;
    rewardType: 'FIXED' | 'PERCENTAGE';
    rewardAmount: number;
    isActive?: boolean;
}) {
    try {
        if (!data.name || !data.conditionType || !data.rewardType) {
            return { success: false, error: 'Name, condition type, and reward type are required.' };
        }
        if (data.rewardAmount <= 0) {
            return { success: false, error: 'Reward amount must be greater than 0.' };
        }

        const reward = await (prisma as any).referralReward.create({
            data: {
                name: data.name.trim(),
                description: data.description?.trim() || null,
                conditionType: data.conditionType,
                conditionValue: roundCurrency(data.conditionValue || 0),
                rewardType: data.rewardType,
                rewardAmount: roundCurrency(data.rewardAmount),
                isActive: data.isActive ?? true,
            },
        });

        revalidatePath('/dashboard/affiliates');
        return { success: true, reward };
    } catch (error: any) {
        console.error('[createReferralReward] error:', error);
        return { success: false, error: error?.message || 'Failed to create referral reward' };
    }
}

/**
 * Update an existing referral reward configuration.
 */
export async function updateReferralReward(
    id: number,
    data: {
        name?: string;
        description?: string;
        conditionType?: 'SIGNUP' | 'DEPOSIT_FIRST' | 'DEPOSIT_RECURRING' | 'BET_VOLUME';
        conditionValue?: number;
        rewardType?: 'FIXED' | 'PERCENTAGE';
        rewardAmount?: number;
        isActive?: boolean;
    },
) {
    try {
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name.trim();
        if (data.description !== undefined) updateData.description = data.description?.trim() || null;
        if (data.conditionType !== undefined) updateData.conditionType = data.conditionType;
        if (data.conditionValue !== undefined) updateData.conditionValue = roundCurrency(data.conditionValue);
        if (data.rewardType !== undefined) updateData.rewardType = data.rewardType;
        if (data.rewardAmount !== undefined) {
            if (data.rewardAmount <= 0) return { success: false, error: 'Reward amount must be greater than 0.' };
            updateData.rewardAmount = roundCurrency(data.rewardAmount);
        }
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        const reward = await (prisma as any).referralReward.update({
            where: { id },
            data: updateData,
        });

        revalidatePath('/dashboard/affiliates');
        return { success: true, reward };
    } catch (error: any) {
        console.error('[updateReferralReward] error:', error);
        return { success: false, error: error?.message || 'Failed to update referral reward' };
    }
}

/**
 * Toggle active/inactive state for a referral reward configuration.
 */
export async function toggleReferralReward(id: number, isActive: boolean) {
    try {
        await (prisma as any).referralReward.update({
            where: { id },
            data: { isActive },
        });
        revalidatePath('/dashboard/affiliates');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to toggle referral reward' };
    }
}

/**
 * Delete a referral reward configuration.
 * Clears the rewardId FK from any history rows first.
 */
export async function deleteReferralReward(id: number) {
    try {
        await (prisma as any).referralHistory.updateMany({
            where: { rewardId: id },
            data: { rewardId: null },
        });
        await (prisma as any).referralReward.delete({ where: { id } });
        revalidatePath('/dashboard/affiliates');
        return { success: true };
    } catch (error: any) {
        console.error('[deleteReferralReward] error:', error);
        return { success: false, error: error?.message || 'Failed to delete referral reward' };
    }
}

// ─── Referral History ─────────────────────────────────────────────────────────

/**
 * Paginated list of referral history records with filters.
 */
export async function getReferralHistory(
    page = 1,
    limit = 20,
    search = '',
    status = '',
) {
    const skip = (page - 1) * limit;
    try {
        const where: any = {};

        if (search) {
            where.OR = [
                { referrer: { username: { contains: search, mode: 'insensitive' } } },
                { referredUser: { username: { contains: search, mode: 'insensitive' } } },
                { referrer: { email: { contains: search, mode: 'insensitive' } } },
                { referredUser: { email: { contains: search, mode: 'insensitive' } } },
            ];
        }

        if (status && status !== 'ALL') {
            where.status = status;
        }

        const [history, total] = await Promise.all([
            (prisma as any).referralHistory.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    referrer: { select: { id: true, username: true, email: true } },
                    referredUser: { select: { id: true, username: true, email: true } },
                    reward: { select: { id: true, name: true, rewardType: true } },
                },
            }),
            (prisma as any).referralHistory.count({ where }),
        ]);

        return {
            success: true,
            history,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    } catch (error) {
        console.error('[getReferralHistory] error:', error);
        return {
            success: false,
            history: [],
            pagination: { total: 0, page, limit, totalPages: 0 },
            error: 'Failed to fetch referral history',
        };
    }
}

/**
 * Get referral history for a specific referrer (user detail page).
 */
export async function getReferralHistoryByUser(userId: number) {
    try {
        const [given, received] = await Promise.all([
            (prisma as any).referralHistory.findMany({
                where: { referrerId: userId },
                orderBy: { createdAt: 'desc' },
                include: {
                    referredUser: { select: { id: true, username: true, email: true, createdAt: true } },
                    reward: { select: { id: true, name: true, rewardType: true } },
                },
            }),
            (prisma as any).referralHistory.findMany({
                where: { referredUserId: userId },
                orderBy: { createdAt: 'desc' },
                include: {
                    referrer: { select: { id: true, username: true, email: true } },
                    reward: { select: { id: true, name: true, rewardType: true } },
                },
            }),
        ]);
        return { success: true, given, received };
    } catch (error) {
        console.error('[getReferralHistoryByUser] error:', error);
        return { success: false, given: [], received: [], error: 'Failed to fetch referral history for user' };
    }
}

// ─── Manual Referral Reward Disbursement ─────────────────────────────────────

/**
 * Manually disburse a referral bonus to the referrer.
 * Creates a ReferralHistory entry (or marks existing PENDING one as COMPLETED),
 * credits the referrer's balance, and creates a Transaction log + Notification.
 *
 * @param referrerId     - the user who referred
 * @param referredUserId - the newly registered / depositing user
 * @param rewardId       - optional: link to a ReferralReward config
 * @param amount         - reward amount; required if rewardId is omitted or rewardType is FIXED
 * @param adminId        - admin performing the action (for audit log)
 * @param remarks        - optional admin note
 */
export async function disburseReferralReward(
    referrerId: number,
    referredUserId: number,
    rewardId: number | null,
    amount: number,
    adminId = 0,
    remarks = '',
) {
    try {
        if (referrerId <= 0 || referredUserId <= 0) {
            return { success: false, error: 'Invalid user IDs.' };
        }
        const creditAmount = roundCurrency(amount);
        if (creditAmount <= 0) {
            return { success: false, error: 'Reward amount must be greater than 0.' };
        }

        // Verify both users exist
        const [referrer, referredUser] = await Promise.all([
            prisma.user.findUnique({ where: { id: referrerId }, select: { id: true, username: true } }),
            prisma.user.findUnique({ where: { id: referredUserId }, select: { id: true, username: true } }),
        ]);
        if (!referrer) return { success: false, error: 'Referrer user not found.' };
        if (!referredUser) return { success: false, error: 'Referred user not found.' };

        await prisma.$transaction(async (tx) => {
            // Check for an existing PENDING history row to complete instead of creating a duplicate
            const existing = await (tx as any).referralHistory.findFirst({
                where: { referrerId, referredUserId, status: 'PENDING' },
            });

            if (existing) {
                await (tx as any).referralHistory.update({
                    where: { id: existing.id },
                    data: { status: 'COMPLETED', amount: creditAmount, ...(rewardId ? { rewardId } : {}) },
                });
            } else {
                await (tx as any).referralHistory.create({
                    data: {
                        referrerId,
                        referredUserId,
                        rewardId: rewardId || null,
                        amount: creditAmount,
                        status: 'COMPLETED',
                    },
                });
            }

            // Credit referrer balance
            await tx.user.update({
                where: { id: referrerId },
                data: { balance: { increment: creditAmount } },
            });

            // Transaction log
            await tx.transaction.create({
                data: {
                    userId: referrerId,
                    amount: creditAmount,
                    type: 'REFERRAL_BONUS',
                    status: 'APPROVED',
                    remarks: remarks
                        ? remarks
                        : `Referral bonus for inviting user @${referredUser.username || referredUserId}${adminId ? ` (Admin #${adminId})` : ''}`,
                    adminId: adminId || null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });

            // Audit log
            await (tx as any).auditLog.create({
                data: {
                    adminId: adminId || 0,
                    action: 'DISBURSE_REFERRAL_BONUS',
                    details: {
                        referrerId,
                        referredUserId,
                        rewardId,
                        amount: creditAmount,
                        remarks,
                    },
                },
            });
        });

        // In-app notification (non-blocking)
        try {
            const amtStr = new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0,
            }).format(creditAmount);
            await prismaWithNotification.notification.create({
                data: {
                    userId: referrerId,
                    title: '🎉 Referral Bonus Credited',
                    body: `You earned ${amtStr} for referring @${referredUser.username || `User_${referredUserId}`}! Keep referring to earn more.`,
                },
            });
        } catch (notifErr) {
            console.warn('[disburseReferralReward] notification failed:', notifErr);
        }

        revalidatePath('/dashboard/affiliates');
        revalidatePath(`/dashboard/users/${referrerId}`);
        return { success: true, amount: creditAmount };
    } catch (error: any) {
        console.error('[disburseReferralReward] error:', error);
        return { success: false, error: error?.message || 'Failed to disburse referral reward' };
    }
}

/**
 * Mark a PENDING referral history entry as FAILED (e.g., if the referred user
 * was banned or reversed their deposit).
 */
export async function failReferralHistory(historyId: number, adminId = 0, reason = '') {
    try {
        const entry = await (prisma as any).referralHistory.findUnique({ where: { id: historyId } });
        if (!entry) return { success: false, error: 'Referral history entry not found.' };
        if (entry.status !== 'PENDING') {
            return { success: false, error: `Cannot mark a ${entry.status} entry as FAILED.` };
        }

        await (prisma as any).referralHistory.update({
            where: { id: historyId },
            data: { status: 'FAILED' },
        });

        // Audit
        await prisma.auditLog.create({
            data: {
                adminId: adminId || 0,
                action: 'FAIL_REFERRAL_HISTORY',
                details: { historyId, reason },
            },
        });

        revalidatePath('/dashboard/affiliates');
        return { success: true };
    } catch (error: any) {
        console.error('[failReferralHistory] error:', error);
        return { success: false, error: error?.message || 'Failed to update referral history' };
    }
}

// ─── Referral Statistics ──────────────────────────────────────────────────────

/**
 * Aggregate overview stats for the referral dashboard.
 */
export async function getReferralStats() {
    try {
        const [
            totalReferrals,
            completedReferrals,
            pendingReferrals,
            failedReferrals,
            totalPaidOut,
            topReferrers,
            recentHistory,
        ] = await Promise.all([
            (prisma as any).referralHistory.count(),
            (prisma as any).referralHistory.count({ where: { status: 'COMPLETED' } }),
            (prisma as any).referralHistory.count({ where: { status: 'PENDING' } }),
            (prisma as any).referralHistory.count({ where: { status: 'FAILED' } }),
            (prisma as any).referralHistory.aggregate({
                where: { status: 'COMPLETED' },
                _sum: { amount: true },
            }),
            // Top 10 referrers by total earnings
            prisma.$queryRaw`
                SELECT
                    rh."referrerId",
                    u.username,
                    u.email,
                    COUNT(rh.id)::int AS referral_count,
                    COALESCE(SUM(rh.amount) FILTER (WHERE rh.status = 'COMPLETED'), 0) AS total_earned
                FROM "ReferralHistory" rh
                JOIN "User" u ON u.id = rh."referrerId"
                GROUP BY rh."referrerId", u.username, u.email
                ORDER BY total_earned DESC
                LIMIT 10
            ` as Promise<any[]>,
            // 5 most recent payouts
            (prisma as any).referralHistory.findMany({
                where: { status: 'COMPLETED' },
                orderBy: { updatedAt: 'desc' },
                take: 5,
                include: {
                    referrer: { select: { id: true, username: true } },
                    referredUser: { select: { id: true, username: true } },
                },
            }),
        ]);

        return {
            success: true,
            stats: {
                totalReferrals,
                completedReferrals,
                pendingReferrals,
                failedReferrals,
                totalPaidOut: roundCurrency(Number(totalPaidOut._sum.amount || 0)),
            },
            topReferrers: (topReferrers as any[]).map((r) => ({
                referrerId: r.referrerid ?? r.referrerId,
                username: r.username,
                email: r.email,
                referralCount: Number(r.referral_count ?? r.referralcount ?? 0),
                totalEarned: roundCurrency(Number(r.total_earned ?? r.totalearned ?? 0)),
            })),
            recentHistory,
        };
    } catch (error) {
        console.error('[getReferralStats] error:', error);
        return {
            success: false,
            stats: {
                totalReferrals: 0,
                completedReferrals: 0,
                pendingReferrals: 0,
                failedReferrals: 0,
                totalPaidOut: 0,
            },
            topReferrers: [],
            recentHistory: [],
            error: 'Failed to fetch referral stats',
        };
    }
}

// ─── Referral Code Management ─────────────────────────────────────────────────

/**
 * Generate (or regenerate) a referral code for a user.
 * Uses the username prefix + random 6-char suffix for readability.
 */
export async function generateReferralCode(userId: number, adminId = 0) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, referralCode: true },
        });
        if (!user) return { success: false, error: 'User not found.' };

        const prefix = (user.username || 'USER').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
        const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newCode = `${prefix}${suffix}`;

        await prisma.user.update({
            where: { id: userId },
            data: { referralCode: newCode },
        });

        await prisma.auditLog.create({
            data: {
                adminId: adminId || 0,
                action: 'REGENERATE_REFERRAL_CODE',
                details: { userId, oldCode: user.referralCode, newCode },
            },
        });

        revalidatePath(`/dashboard/users/${userId}`);
        return { success: true, referralCode: newCode };
    } catch (error: any) {
        console.error('[generateReferralCode] error:', error);
        return { success: false, error: error?.message || 'Failed to generate referral code' };
    }
}

/**
 * Set a custom referral code for a user (admin override).
 */
export async function setReferralCode(userId: number, code: string, adminId = 0) {
    try {
        const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
        if (!cleanCode || cleanCode.length < 4) {
            return { success: false, error: 'Referral code must be at least 4 characters.' };
        }
        if (cleanCode.length > 20) {
            return { success: false, error: 'Referral code must be at most 20 characters.' };
        }

        // Check uniqueness
        const existing = await prisma.user.findUnique({
            where: { referralCode: cleanCode },
            select: { id: true },
        });
        if (existing && existing.id !== userId) {
            return { success: false, error: 'This referral code is already in use by another user.' };
        }

        await prisma.user.update({
            where: { id: userId },
            data: { referralCode: cleanCode },
        });

        await prisma.auditLog.create({
            data: {
                adminId: adminId || 0,
                action: 'SET_REFERRAL_CODE',
                details: { userId, code: cleanCode },
            },
        });

        revalidatePath(`/dashboard/users/${userId}`);
        return { success: true, referralCode: cleanCode };
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return { success: false, error: 'This referral code is already in use.' };
        }
        console.error('[setReferralCode] error:', error);
        return { success: false, error: error?.message || 'Failed to set referral code' };
    }
}

/**
 * Assign a referrer to a user (admin override / correction).
 * Also creates a PENDING ReferralHistory entry if one doesn't exist.
 */
export async function assignReferrer(
    userId: number,
    referrerId: number | null,
    adminId = 0,
    remarks = '',
) {
    try {
        if (userId === referrerId) {
            return { success: false, error: 'A user cannot refer themselves.' };
        }

        if (referrerId !== null) {
            const referrerExists = await prisma.user.findUnique({
                where: { id: referrerId },
                select: { id: true, username: true },
            });
            if (!referrerExists) return { success: false, error: 'Referrer user not found.' };
        }

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { referrerId },
            });

            // Create a PENDING history entry for referrerId ≠ null assignments
            if (referrerId !== null) {
                const existing = await (tx as any).referralHistory.findFirst({
                    where: { referrerId, referredUserId: userId },
                });
                if (!existing) {
                    await (tx as any).referralHistory.create({
                        data: {
                            referrerId,
                            referredUserId: userId,
                            rewardId: null,
                            amount: 0,
                            status: 'PENDING',
                        },
                    });
                }
            }

            await (tx as any).auditLog.create({
                data: {
                    adminId: adminId || 0,
                    action: 'ASSIGN_REFERRER',
                    details: { userId, referrerId, remarks },
                },
            });
        });

        revalidatePath(`/dashboard/users/${userId}`);
        return { success: true };
    } catch (error: any) {
        console.error('[assignReferrer] error:', error);
        return { success: false, error: error?.message || 'Failed to assign referrer' };
    }
}

// ─── Bulk Operations ──────────────────────────────────────────────────────────

/**
 * Process all PENDING referral history entries for a given reward config.
 * Typically called after a deposit-triggered event is confirmed.
 * Automatically disburses rewards and marks entries as COMPLETED.
 */
export async function processPendingReferrals(rewardId: number, adminId = 0) {
    try {
        const pendingEntries = await (prisma as any).referralHistory.findMany({
            where: { rewardId, status: 'PENDING' },
            include: {
                referrer: { select: { id: true, username: true } },
                referredUser: { select: { id: true, username: true } },
                reward: true,
            },
        });

        if (pendingEntries.length === 0) {
            return { success: true, processed: 0, message: 'No pending referrals found for this reward.' };
        }

        let processed = 0;
        let errors = 0;

        for (const entry of pendingEntries) {
            const rewardConfig = entry.reward;
            const creditAmount = rewardConfig
                ? roundCurrency(rewardConfig.rewardAmount)
                : roundCurrency(Number(entry.amount || 0));

            if (creditAmount <= 0) {
                errors++;
                continue;
            }

            try {
                await prisma.$transaction(async (tx) => {
                    await (tx as any).referralHistory.update({
                        where: { id: entry.id },
                        data: { status: 'COMPLETED', amount: creditAmount },
                    });

                    await tx.user.update({
                        where: { id: entry.referrerId },
                        data: { balance: { increment: creditAmount } },
                    });

                    await tx.transaction.create({
                        data: {
                            userId: entry.referrerId,
                            amount: creditAmount,
                            type: 'REFERRAL_BONUS',
                            status: 'APPROVED',
                            remarks: `Referral bonus for inviting @${entry.referredUser?.username || entry.referredUserId} (Bulk Process Admin #${adminId})`,
                            adminId: adminId || null,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    });

                    await (tx as any).auditLog.create({
                        data: {
                            adminId: adminId || 0,
                            action: 'BULK_PROCESS_REFERRAL',
                            details: { historyId: entry.id, referrerId: entry.referrerId, rewardId, creditAmount },
                        },
                    });
                });

                // Notify referrer
                try {
                    const amtStr = new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        maximumFractionDigits: 0,
                    }).format(creditAmount);
                    await prismaWithNotification.notification.create({
                        data: {
                            userId: entry.referrerId,
                            title: '🎉 Referral Bonus Credited',
                            body: `You earned ${amtStr} for referring @${entry.referredUser?.username || `User_${entry.referredUserId}`}!`,
                        },
                    });
                } catch {
                    // non-blocking
                }

                processed++;
            } catch (e) {
                console.error(`[processPendingReferrals] failed for entry ${entry.id}:`, e);
                errors++;
            }
        }

        revalidatePath('/dashboard/affiliates');

        const message = errors > 0
            ? `Processed ${processed} of ${pendingEntries.length} referrals. ${errors} failed.`
            : `Successfully processed ${processed} referral(s).`;

        return { success: true, processed, total: pendingEntries.length, errors, message };
    } catch (error: any) {
        console.error('[processPendingReferrals] error:', error);
        return { success: false, processed: 0, errors: 0, total: 0, error: error?.message || 'Failed to process pending referrals' };
    }
}

// ─── Admin Referral Users ──────────────────────────────────────────────────────

/**
 * Paginated list of users with their referral data.
 * Replaces ReferralService.getAdminUsers (axios).
 */
export async function getAdminReferralUsers(page = 1, limit = 10, search = '') {
    const skip = (page - 1) * limit;
    try {
        const where: any = search
            ? {
                OR: [
                    { username: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { referralCode: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {};

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    referralCode: true,
                    createdAt: true,
                    referrer: {
                        select: { id: true, username: true, referralCode: true },
                    },
                    _count: { select: { referrals: true } },
                },
            }),
            prisma.user.count({ where }),
        ]);

        const userIds = users.map((u) => u.id);
        const earnings: any[] = userIds.length
            ? await (prisma as any).referralHistory.groupBy({
                by: ['referrerId'],
                where: { referrerId: { in: userIds }, status: 'COMPLETED' },
                _sum: { amount: true },
            })
            : [];
        const earningsMap = new Map(earnings.map((e: any) => [e.referrerId, Number(e._sum.amount || 0)]));

        return {
            users: users.map((u) => ({
                id: u.id,
                username: u.username,
                email: u.email,
                referralCode: u.referralCode,
                createdAt: u.createdAt,
                referrer: u.referrer
                    ? { id: u.referrer.id, username: u.referrer.username, code: u.referrer.referralCode }
                    : null,
                totalInvited: u._count.referrals,
                totalEarned: earningsMap.get(u.id) ?? 0,
            })),
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    } catch (error) {
        console.error('[getAdminReferralUsers] error:', error);
        return { users: [], pagination: { total: 0, page, limit, totalPages: 0 } };
    }
}

