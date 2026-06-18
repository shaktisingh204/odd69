'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export interface UserSettlementRow {
    userId: number;
    username: string;
    email: string;
    phoneNumber: string | null;
    currentBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalBonus: number;
    totalBonusConverts: number;
    totalManualCredits: number;
    totalManualDebits: number;
    netPosition: number;       // what ledger says user should have
    netAdjustment: number;     // currentBalance - netPosition (> 0 means balance EXCEEDS ledger, admin may debit; < 0 means user is owed)
}

/**
 * Search users by username / email / phone for the picker.
 */
export async function searchUsersForPicker(query: string, limit = 30) {
    if (!query.trim()) return { success: true, users: [] };
    try {
        const q = `%${query.trim()}%`;
        const rows = await prisma.$queryRawUnsafe(`
            SELECT id, username, email, "phoneNumber", balance, role
            FROM "User"
            WHERE username ILIKE $1 OR email ILIKE $2 OR "phoneNumber" ILIKE $3
            ORDER BY "createdAt" DESC
            LIMIT $4
        `, q, q, q, limit) as any[];

        return {
            success: true,
            users: rows.map((u: any) => ({
                id: Number(u.id),
                username: u.username ?? '',
                email: u.email ?? '',
                phoneNumber: u.phoneNumber ?? null,
                balance: Number(u.balance ?? 0),
                role: u.role ?? 'USER',
            })),
        };
    } catch (error: any) {
        console.error('searchUsersForPicker error:', error);
        return { success: false, users: [] };
    }
}

/**
 * Compute settlement rows for an explicit list of user IDs.
 */
export async function computeSettlementForUsers(params: {
    userIds: number[];
    dateFrom?: string;
    dateTo?: string;
}) {
    const { userIds, dateFrom, dateTo } = params;
    if (!userIds.length) return { success: true, rows: [] };

    try {
        // Fetch base user data
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, email: true, phoneNumber: true, balance: true },
        });

        // Build date filter
        const createdAt: any = {};
        if (dateFrom) createdAt.gte = new Date(dateFrom);
        if (dateTo) {
            const dt = new Date(dateTo);
            dt.setHours(23, 59, 59, 999);
            createdAt.lte = dt;
        }
        const hasDate = Object.keys(createdAt).length > 0;

        // Aggregate transactions per user per type
        const txAgg = await (prisma as any).transaction.groupBy({
            by: ['userId', 'type'],
            where: {
                userId: { in: userIds },
                status: { in: ['APPROVED', 'COMPLETED'] },
                ...(hasDate ? { createdAt } : {}),
            },
            _sum: { amount: true },
        });

        const txMap: Record<number, Record<string, number>> = {};
        for (const row of txAgg as any[]) {
            const uid = Number(row.userId);
            if (!txMap[uid]) txMap[uid] = {};
            txMap[uid][row.type] = Number(row._sum?.amount ?? 0);
        }

        const rows: UserSettlementRow[] = users.map(u => {
            const tx = txMap[u.id] ?? {};
            const dep = tx['DEPOSIT'] ?? 0;
            const wdl = tx['WITHDRAWAL'] ?? 0;
            const bonus = tx['BONUS'] ?? 0;
            const bonusConvert = tx['BONUS_CONVERT'] ?? 0;
            const manualCredit = tx['MANUAL_CREDIT'] ?? 0;
            const manualDebit = tx['MANUAL_DEBIT'] ?? 0;

            const netPosition = parseFloat(
                (dep + bonus + bonusConvert + manualCredit - wdl - manualDebit).toFixed(2),
            );
            const currentBalance = Number(u.balance ?? 0);
            const netAdjustment = parseFloat((currentBalance - netPosition).toFixed(2));

            return {
                userId: u.id,
                username: u.username ?? '',
                email: u.email ?? '',
                phoneNumber: u.phoneNumber ?? null,
                currentBalance,
                totalDeposits: dep,
                totalWithdrawals: wdl,
                totalBonus: bonus,
                totalBonusConverts: bonusConvert,
                totalManualCredits: manualCredit,
                totalManualDebits: manualDebit,
                netPosition,
                netAdjustment,
            };
        });

        return { success: true, rows };
    } catch (error: any) {
        console.error('computeSettlementForUsers error:', error);
        return { success: false, rows: [], error: error?.message };
    }
}

/**
 * Apply approved adjustments — same pattern as URL settlement.
 */
export async function applyUserSettlement(
    adjustments: Array<{ userId: number; adjustmentAmount: number; notes: string }>,
    adminId = 1,
) {
    if (!adjustments.length) return { success: false, error: 'No adjustments provided' };

    const results: Array<{ userId: number; success: boolean; error?: string }> = [];

    for (const adj of adjustments) {
        if (adj.adjustmentAmount === 0) {
            results.push({ userId: adj.userId, success: true });
            continue;
        }
        try {
            const absAmount = Math.abs(adj.adjustmentAmount);
            const isCredit = adj.adjustmentAmount > 0;

            await (prisma as any).$transaction([
                (prisma as any).user.update({
                    where: { id: adj.userId },
                    data: { balance: isCredit ? { increment: absAmount } : { decrement: absAmount } },
                }),
                (prisma as any).transaction.create({
                    data: {
                        userId: adj.userId,
                        amount: absAmount,
                        type: isCredit ? 'MANUAL_CREDIT' : 'MANUAL_DEBIT',
                        status: 'APPROVED',
                        paymentMethod: 'MANUAL',
                        remarks: adj.notes || 'Manual batch settlement',
                        adminId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                }),
                (prisma as any).auditLog.create({
                    data: {
                        adminId,
                        action: 'MANUAL_SETTLEMENT',
                        details: {
                            userId: adj.userId,
                            adjustmentAmount: adj.adjustmentAmount,
                            notes: adj.notes,
                            timestamp: new Date().toISOString(),
                        },
                    },
                }),
            ]);
            results.push({ userId: adj.userId, success: true });
        } catch (error: any) {
            console.error(`Settlement failed for user ${adj.userId}:`, error);
            results.push({ userId: adj.userId, success: false, error: error?.message });
        }
    }

    const successCount = results.filter(r => r.success).length;
    revalidatePath('/dashboard/finance/manual-settlement');
    return {
        success: true,
        applied: successCount,
        failed: results.length - successCount,
        results,
    };
}
