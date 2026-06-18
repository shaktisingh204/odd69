'use server'

import { revalidatePath } from 'next/cache';
import connectMongo from '@/lib/mongo';
import { MatchCashbackPromotion } from '@/models/MongoModels';

const REVALIDATE_PATH = '/dashboard/sports/promo-teams';

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizePromotion(doc: any) {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
        _id: String(obj._id),
        id: String(obj._id),
        eventId: obj.matchId || '',
        matchId: obj.matchId || '',
        eventName: obj.eventName || '',
        matchDate: obj.matchDate || '',
        sportId: obj.sportId || '',
        teams: Array.isArray(obj.teams) ? obj.teams : [],
        promotionType: obj.promotionType || 'MATCH_LOSS_CASHBACK',
        benefitType: obj.benefitType || 'REFUND',
        refundPercentage: Number(obj.refundPercentage || 0),
        walletType: obj.walletType || obj.walletTarget || 'main_wallet',
        walletTarget: obj.walletType || obj.walletTarget || 'main_wallet',
        maxRefundAmount: obj.maxRefundAmount ?? null,
        isActive: obj.isActive !== false,
        showOnPromotionsPage: obj.showOnPromotionsPage !== false,
        cardTitle: obj.cardTitle || '',
        cardDescription: obj.cardDescription || '',
        cardGradient: obj.cardGradient || '',
        cardBgImage: obj.cardBgImage || '',
        cardBadge: obj.cardBadge || '',
        order: Number(obj.order || 0),
        triggerConfig: obj.triggerConfig
            ? {
                eventType: obj.triggerConfig.eventType || 'ANY_TEAM_HIT_SIX',
                triggerMode: obj.triggerConfig.triggerMode || null,
                oversWindow: Number(obj.triggerConfig.oversWindow || 1),
                leadThreshold: obj.triggerConfig.leadThreshold ? Number(obj.triggerConfig.leadThreshold) : null,
                minuteThreshold: obj.triggerConfig.minuteThreshold ? Number(obj.triggerConfig.minuteThreshold) : null,
                periodLabel: obj.triggerConfig.periodLabel || '',
                qualifyingSelections: Array.isArray(obj.triggerConfig.qualifyingSelections)
                    ? obj.triggerConfig.qualifyingSelections
                    : [],
                scoreSnapshot: obj.triggerConfig.scoreSnapshot || '',
                triggerNote: obj.triggerConfig.triggerNote || '',
                isTriggered: obj.triggerConfig.isTriggered === true,
                triggeredAt: obj.triggerConfig.triggeredAt || null,
            }
            : null,
        conditionSummary: obj.conditionSummary || '',
        refundedBetCount: Number(obj.refundedBetCount || 0),
        totalRefundAmount: Number(obj.totalRefundAmount || 0),
        createdAt: obj.createdAt || null,
        updatedAt: obj.updatedAt || null,
        lastSettledAt: obj.lastSettledAt || null,
    };
}

// ─── Payload builder ──────────────────────────────────────────────────────────

const BENEFIT_TYPE_MAP: Record<string, string> = {
    MATCH_LOSS_CASHBACK: 'REFUND',
    FIRST_OVER_SIX_CASHBACK: 'REFUND',
    LEAD_MARGIN_PAYOUT: 'PAYOUT_AS_WIN',
    LATE_LEAD_REFUND: 'REFUND',
    PERIOD_LEAD_PAYOUT: 'PAYOUT_AS_WIN',
};

function buildPayload(data: any) {
    const promotionType = data?.promotionType || 'MATCH_LOSS_CASHBACK';
    const matchId = String(data?.eventId || data?.matchId || '').trim();
    const oversWindow = Number(data?.triggerOversWindow ?? data?.triggerConfig?.oversWindow ?? 1);
    const leadThreshold = Number(data?.triggerLeadThreshold ?? data?.triggerConfig?.leadThreshold ?? 2);
    const minuteThreshold = Number(data?.triggerMinuteThreshold ?? data?.triggerConfig?.minuteThreshold ?? 80);
    const periodLabel = String(data?.triggerPeriodLabel ?? data?.triggerConfig?.periodLabel ?? 'HALF_TIME').trim();
    const qualifyingSelections = Array.isArray(data?.triggerQualifyingSelections)
        ? data.triggerQualifyingSelections.filter(Boolean)
        : Array.isArray(data?.triggerConfig?.qualifyingSelections)
            ? data.triggerConfig.qualifyingSelections.filter(Boolean)
            : [];
    const maxRefundAmount =
        data?.maxRefundAmount === '' || data?.maxRefundAmount === null || typeof data?.maxRefundAmount === 'undefined'
            ? undefined
            : Number(data.maxRefundAmount);

    return {
        matchId,
        eventName: data?.eventName || undefined,
        matchDate: data?.matchDate || undefined,
        sportId: data?.sportId || undefined,
        teams: Array.isArray(data?.teams) ? data.teams.filter(Boolean) : [],
        promotionType,
        benefitType: BENEFIT_TYPE_MAP[promotionType] || 'REFUND',
        refundPercentage: Number(data?.refundPercentage || 0),
        walletType: data?.walletType || data?.walletTarget || 'main_wallet',
        maxRefundAmount,
        isActive: data?.isActive !== false,
        showOnPromotionsPage: data?.showOnPromotionsPage !== false,
        cardTitle: data?.cardTitle?.trim() || undefined,
        cardDescription: data?.cardDescription?.trim() || undefined,
        cardGradient: data?.cardGradient?.trim() || undefined,
        cardBgImage: data?.cardBgImage?.trim() || undefined,
        cardBadge: data?.cardBadge?.trim() || undefined,
        order: Number(data?.order || 0),
        triggerConfig:
            promotionType === 'MATCH_LOSS_CASHBACK'
                ? undefined
                : {
                    eventType: data?.triggerConfig?.eventType || undefined,
                    oversWindow,
                    leadThreshold,
                    minuteThreshold,
                    periodLabel,
                    qualifyingSelections,
                    scoreSnapshot: data?.triggerScoreSnapshot?.trim() || data?.triggerConfig?.scoreSnapshot || undefined,
                    triggerNote: data?.triggerNote?.trim() || data?.triggerConfig?.triggerNote || undefined,
                    isTriggered: data?.triggerIsTriggered === true || data?.triggerConfig?.isTriggered === true,
                },
    };
}

// ─── CRUD Operations ──────────────────────────────────────────────────────────

export async function getPromoTeams() {
    try {
        await connectMongo();
        const docs = await MatchCashbackPromotion.find().sort({ order: 1, createdAt: -1 }).lean();
        return {
            success: true,
            data: (docs as any[]).map(normalizePromotion),
        };
    } catch (error: any) {
        console.error('Failed to fetch cashback promotions:', error);
        return { success: false, error: error.message || 'Failed to fetch cashback promotions' };
    }
}

export async function createPromoTeam(data: any) {
    try {
        await connectMongo();
        const doc = await MatchCashbackPromotion.create(buildPayload(data));
        revalidatePath(REVALIDATE_PATH);
        return { success: true, data: normalizePromotion(doc) };
    } catch (error: any) {
        console.error('Failed to create cashback promotion:', error);
        return { success: false, error: error.message || 'Failed to create cashback promotion' };
    }
}

export async function updatePromoTeam(id: string, data: any) {
    try {
        await connectMongo();
        const doc = await MatchCashbackPromotion.findByIdAndUpdate(id, buildPayload(data), { returnDocument: 'after' });
        if (!doc) throw new Error('Promotion not found');
        revalidatePath(REVALIDATE_PATH);
        return { success: true, data: normalizePromotion(doc) };
    } catch (error: any) {
        console.error('Failed to update cashback promotion:', error);
        return { success: false, error: error.message || 'Failed to update cashback promotion' };
    }
}

export async function deletePromoTeam(id: string) {
    try {
        await connectMongo();
        await MatchCashbackPromotion.findByIdAndDelete(id);
        revalidatePath(REVALIDATE_PATH);
        return { success: true };
    } catch (error: any) {
        console.error('Failed to delete cashback promotion:', error);
        return { success: false, error: error.message || 'Failed to delete cashback promotion' };
    }
}

export async function togglePromoTeamStatus(id: string, isActive: boolean) {
    try {
        await connectMongo();
        const doc = await MatchCashbackPromotion.findByIdAndUpdate(id, { isActive }, { returnDocument: 'after' });
        if (!doc) throw new Error('Promotion not found');
        revalidatePath(REVALIDATE_PATH);
        return { success: true, data: normalizePromotion(doc) };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to toggle status' };
    }
}

export async function setPromoTeamTrigger(
    id: string,
    payload: {
        isTriggered: boolean;
        oversWindow?: number;
        leadThreshold?: number;
        minuteThreshold?: number;
        periodLabel?: string;
        qualifyingSelections?: string[];
        scoreSnapshot?: string;
        triggerNote?: string;
    },
) {
    try {
        await connectMongo();
        const existing = await MatchCashbackPromotion.findById(id);
        if (!existing) throw new Error('Promotion not found');

        const currentConfig = existing.triggerConfig || {};
        const updatedConfig = {
            ...currentConfig,
            isTriggered: payload.isTriggered,
            ...(typeof payload.oversWindow === 'number' ? { oversWindow: payload.oversWindow } : {}),
            ...(typeof payload.leadThreshold === 'number' ? { leadThreshold: payload.leadThreshold } : {}),
            ...(typeof payload.minuteThreshold === 'number' ? { minuteThreshold: payload.minuteThreshold } : {}),
            ...(payload.periodLabel ? { periodLabel: payload.periodLabel } : {}),
            ...(Array.isArray(payload.qualifyingSelections) ? { qualifyingSelections: payload.qualifyingSelections } : {}),
            ...(payload.scoreSnapshot ? { scoreSnapshot: payload.scoreSnapshot } : {}),
            ...(payload.triggerNote ? { triggerNote: payload.triggerNote } : {}),
            ...(payload.isTriggered ? { triggeredAt: new Date() } : {}),
        };

        const doc = await MatchCashbackPromotion.findByIdAndUpdate(
            id,
            { triggerConfig: updatedConfig },
            { returnDocument: 'after' },
        );

        revalidatePath(REVALIDATE_PATH);
        return { success: true, data: normalizePromotion(doc) };
    } catch (error: any) {
        console.error('Failed to update trigger condition:', error);
        return { success: false, error: error.message || 'Failed to update trigger condition' };
    }
}
