'use server'

import connectMongo from '@/lib/mongo';
import { Bonus } from '@/models/MongoModels';
import { revalidatePath } from 'next/cache';
import {
    getBonusStats as _getBonusStats,
    getBonusRedemptions as _getBonusRedemptions,
    adminForfeitBonus as _adminForfeitBonus,
    adminCompleteBonus as _adminCompleteBonus,
    purgeBackfillRepairBonuses as _purgeBackfillRepairBonuses,
} from '@/actions/settings';

const toNumber = (value: unknown) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

const normalizeBonusPayload = (data: Record<string, unknown>) => {
    const currency = data.currency === 'CRYPTO' || data.currency === 'BOTH' ? data.currency : 'INR';
    const legacyMinDeposit = toNumber(data.minDeposit);
    const minDepositFiat = data.minDepositFiat == null
        ? (currency === 'CRYPTO' ? 0 : legacyMinDeposit)
        : toNumber(data.minDepositFiat);
    const minDepositCrypto = data.minDepositCrypto == null
        ? (currency === 'INR' ? 0 : legacyMinDeposit)
        : toNumber(data.minDepositCrypto);

    return {
        ...data,
        code: typeof data.code === 'string' ? data.code.toUpperCase() : data.code,
        currency,
        minDeposit: currency === 'CRYPTO' ? minDepositCrypto : minDepositFiat,
        minDepositFiat,
        minDepositCrypto,
        validFrom: data.validFrom || undefined,
        validUntil: data.validUntil || undefined,
    };
};

// Wrapper async functions — required because "use server" files only allow async function exports
export async function getBonusStats() { return _getBonusStats(); }
export async function getBonusRedemptions(filters: { page?: number; limit?: number; status?: string; search?: string; }) { return _getBonusRedemptions(filters); }
export async function adminForfeitBonus(userBonusId: number, adminId?: number) { return _adminForfeitBonus(userBonusId, adminId); }
export async function adminCompleteBonus(userBonusId: number, adminId?: number) { return _adminCompleteBonus(userBonusId, adminId); }
export async function purgeBackfillRepairBonuses(adminId?: number) { return _purgeBackfillRepairBonuses(adminId); }

export async function adminGiveBonus(payload: {
    userId: number;
    bonusCode?: string;
    customAmount?: number;
    bonusType?: 'FIAT_BONUS' | 'CASINO_BONUS' | 'SPORTS_BONUS' | 'CRYPTO_BONUS';
    amount?: number;
    title?: string;
    wageringRequirement?: number;
}): Promise<{ success: boolean; bonusAmount?: number; walletLabel?: string; error?: string }> {
    try {
        const { prisma } = await import('@/lib/db');
        const { userId, bonusType, amount, customAmount, title, wageringRequirement } = payload;
        const creditAmount = Number(customAmount ?? amount ?? 0);

        if (!userId || creditAmount <= 0) {
            return { success: false, error: 'Invalid userId or amount' };
        }

        // Determine which wallet field to credit
        const walletField =
            bonusType === 'CASINO_BONUS'  ? 'casinoBonus'  :
            bonusType === 'SPORTS_BONUS'  ? 'sportsBonus'  :
            bonusType === 'CRYPTO_BONUS'  ? 'cryptoBonus'  :
            'fiatBonus';

        const walletLabel =
            bonusType === 'CASINO_BONUS'  ? 'Casino Bonus'  :
            bonusType === 'SPORTS_BONUS'  ? 'Sports Bonus'  :
            bonusType === 'CRYPTO_BONUS'  ? 'Crypto Bonus'  :
            'Fiat Bonus';

        const wagReq = Number(wageringRequirement ?? creditAmount);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: {
                    [walletField]: { increment: creditAmount },
                    wageringRequired: { increment: wagReq },
                } as any,
            }),
            prisma.transaction.create({
                data: {
                    userId,
                    amount: creditAmount,
                    type: 'BONUS_CREDIT',
                    status: 'COMPLETED',
                    paymentMethod: 'BONUS_WALLET',
                    remarks: title || `Admin bonus: ${walletLabel}`,
                    transactionId: `BONUS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                },
            }),
        ]);

        return { success: true, bonusAmount: creditAmount, walletLabel };
    } catch (error: any) {
        console.error('adminGiveBonus error:', error);
        return { success: false, error: error?.message || 'Failed to give bonus' };
    }
}

export async function getBonuses() {
    try {
        await connectMongo();
        const bonuses = await Bonus.find().sort({ createdAt: -1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(bonuses)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch bonuses' };
    }
}

export async function createBonus(data: any) {
    try {
        await connectMongo();
        const bonus = await Bonus.create(normalizeBonusPayload(data));
        revalidatePath('/dashboard/marketing/bonuses');
        return { success: true, data: JSON.parse(JSON.stringify(bonus)) };
    } catch (error: any) {
        console.error('[createBonus] error:', error?.message);
        return { success: false, error: error?.message || 'Failed to create bonus' };
    }
}

export async function updateBonus(id: string, data: any) {
    try {
        await connectMongo();
        const bonus = await Bonus.findByIdAndUpdate(id, normalizeBonusPayload(data), { returnDocument: 'after' }).lean();
        revalidatePath('/dashboard/marketing/bonuses');
        return { success: true, data: JSON.parse(JSON.stringify(bonus)) };
    } catch (error) {
        return { success: false, error: 'Failed to update bonus' };
    }
}

export async function deleteBonus(id: string) {
    try {
        await connectMongo();
        await Bonus.findByIdAndDelete(id);
        revalidatePath('/dashboard/marketing/bonuses');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to delete bonus' };
    }
}

export async function toggleBonus(id: string) {
    try {
        await connectMongo();
        const bonus = await Bonus.findById(id);
        if (bonus) {
            bonus.isActive = !bonus.isActive;
            await bonus.save();
            revalidatePath('/dashboard/marketing/bonuses');
            return { success: true };
        }
        return { success: false, error: 'Bonus not found' };
    } catch (error) {
        return { success: false, error: 'Failed to toggle bonus' };
    }
}
