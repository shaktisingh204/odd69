'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

/**
 * Return current aggregate wagering state across all users so the admin
 * can see how much outstanding wagering exists before clearing it.
 */
export async function getWageringSummary() {
    try {
        const [userAgg, usersWithPending, activeBonuses] = await Promise.all([
            prisma.user.aggregate({
                _sum: {
                    wageringRequired: true,
                    wageringDone: true,
                    casinoBonusWageringRequired: true,
                    casinoBonusWageringDone: true,
                    sportsBonusWageringRequired: true,
                    sportsBonusWageringDone: true,
                    depositWageringRequired: true,
                    depositWageringDone: true,
                },
                _count: { _all: true },
            }),
            prisma.user.count({
                where: {
                    OR: [
                        { wageringRequired: { gt: 0 } },
                        { depositWageringRequired: { gt: 0 } },
                        { casinoBonusWageringRequired: { gt: 0 } },
                        { sportsBonusWageringRequired: { gt: 0 } },
                    ],
                },
            }),
            prisma.userBonus.count({ where: { status: 'ACTIVE' } }),
        ]);

        return {
            success: true,
            data: {
                totalUsers: userAgg._count._all,
                usersWithPendingWagering: usersWithPending,
                activeBonuses,
                totals: {
                    wageringRequired: Number(userAgg._sum.wageringRequired || 0),
                    wageringDone: Number(userAgg._sum.wageringDone || 0),
                    casinoBonusWageringRequired: Number(userAgg._sum.casinoBonusWageringRequired || 0),
                    casinoBonusWageringDone: Number(userAgg._sum.casinoBonusWageringDone || 0),
                    sportsBonusWageringRequired: Number(userAgg._sum.sportsBonusWageringRequired || 0),
                    sportsBonusWageringDone: Number(userAgg._sum.sportsBonusWageringDone || 0),
                    depositWageringRequired: Number(userAgg._sum.depositWageringRequired || 0),
                    depositWageringDone: Number(userAgg._sum.depositWageringDone || 0),
                },
            },
        };
    } catch (error) {
        console.error('[getWageringSummary]', error);
        return { success: false, error: 'Failed to load wagering summary' };
    }
}

/**
 * Clear all wagering requirements for every user.
 *
 * This zeroes the aggregate wagering counters on the User row and marks
 * every ACTIVE UserBonus as COMPLETED (so bonus funds become unlocked and
 * stop blocking withdrawals on the website).
 *
 * Caller must be authenticated as an admin — the dashboard layout enforces
 * that; this action trusts it per the existing server-action pattern in
 * this codebase.
 */
export async function clearAllUsersWagering() {
    try {
        const now = new Date();

        const result = await prisma.$transaction(async (tx) => {
            // 1) Reset aggregate wagering counters on every user.
            const userReset = await tx.user.updateMany({
                data: {
                    wageringRequired: 0,
                    wageringDone: 0,
                    casinoBonusWageringRequired: 0,
                    casinoBonusWageringDone: 0,
                    sportsBonusWageringRequired: 0,
                    sportsBonusWageringDone: 0,
                    depositWageringRequired: 0,
                    depositWageringDone: 0,
                },
            });

            // 2) Mark every active bonus as completed so the bonus balance
            //    is unlocked and the wagering-blocked withdrawal gate opens.
            const bonusUpdate = await tx.userBonus.updateMany({
                where: { status: 'ACTIVE' },
                data: {
                    status: 'COMPLETED',
                    completedAt: now,
                },
            });

            return {
                usersAffected: userReset.count,
                bonusesCompleted: bonusUpdate.count,
            };
        });

        revalidatePath('/dashboard/finance/wagering');
        revalidatePath('/dashboard/users');

        return {
            success: true,
            data: result,
        };
    } catch (error) {
        console.error('[clearAllUsersWagering]', error);
        return { success: false, error: 'Failed to clear wagering for users' };
    }
}
