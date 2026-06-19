'use server'

import { revalidatePath } from 'next/cache';
import connectMongo from '@/lib/mongo';
import { prisma } from '@/lib/db';
import { Bet, MatchCashbackPromotion } from '@/models/MongoModels';
import nodemailer from 'nodemailer';
import {
    EMAIL_TEMPLATE_SETTINGS_KEY,
    mergeEmailTemplateSettings,
    resolveManagedEmailTemplate,
} from '@/lib/email-template-config';


// ─── Benefit-type lookup (matches backend constants) ─────────────────────────

const BENEFIT_TYPE_MAP: Record<string, string> = {
    MATCH_LOSS_CASHBACK: 'REFUND',
    FIRST_OVER_SIX_CASHBACK: 'REFUND',
    LEAD_MARGIN_PAYOUT: 'PAYOUT_AS_WIN',
    LATE_LEAD_REFUND: 'REFUND',
    PERIOD_LEAD_PAYOUT: 'PAYOUT_AS_WIN',
};

function resolveBenefitType(promotionType: string): string {
    return BENEFIT_TYPE_MAP[promotionType] || 'REFUND';
}

// ─── Normalizer (ensures consistent shape for the client) ────────────────────

function normalize(doc: any) {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
        ...obj,
        _id: String(obj._id),
        id: String(obj._id),
        eventId: obj.matchId || '',
        matchId: obj.matchId || '',
    };
}

// ─── Payload builder (converts form data → DB document shape) ────────────────

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
        data?.maxRefundAmount === '' ||
        data?.maxRefundAmount === null ||
        typeof data?.maxRefundAmount === 'undefined'
            ? undefined
            : Number(data.maxRefundAmount);

    const triggerConfig = promotionType === 'MATCH_LOSS_CASHBACK'
        ? null
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
        };

    return {
        matchId,
        promotionType,
        benefitType: resolveBenefitType(promotionType),
        eventName: data?.eventName || undefined,
        matchDate: data?.matchDate || undefined,
        sportId: data?.sportId || undefined,
        teams: Array.isArray(data?.teams) ? data.teams.filter(Boolean) : [],
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
        triggerConfig,
    };
}

const REVALIDATE_PATH = '/dashboard/sports/promo-teams';

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeValue(value: unknown) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isMatchOddsMarket(bet: any): boolean {
    const marketName = String(bet.marketName || bet.computedMarketName || '').toLowerCase();
    const gtype = String(bet.gtype || bet.marketType || bet.market_type || '').toLowerCase();
    const mname = String(bet.mname || '').toLowerCase();

    if (['session', 'fancy', 'fancy2', 'khado', 'meter', 'oddeven', 'other fancy'].includes(gtype)) {
        return false;
    }

    if (mname.includes('bookmaker') || mname.includes('fancy')) {
        return false;
    }

    if (
        marketName.includes('innings') || 
        marketName.includes('total') || 
        marketName.includes('dismissal') || 
        marketName.includes('over ') || 
        marketName.includes('score') ||
        marketName.includes('player of the match') ||
        marketName.includes('coin toss') ||
        marketName.includes('method')
    ) {
        return false;
    }

    return (
        marketName.includes('match odds') || 
        mname.includes('match odds') || 
        marketName.includes('match_odds') || 
        marketName === 'winner' ||
        marketName === 'winner (incl. super over)' ||
        gtype === 'match' || 
        gtype === 'match_odds'
    );
}

function isPreMatchBet(bet: any, promotion: any) {
    const betTime = bet?.createdAt ? new Date(bet.createdAt) : null;
    if (!betTime || Number.isNaN(betTime.getTime())) {
        return false;
    }

    // Rely accurately on the exact openDate embedded in the bet document if it exists
    if (bet?.openDate) {
        const betOpenDate = new Date(Number(bet.openDate));
        if (!Number.isNaN(betOpenDate.getTime())) {
            return betTime.getTime() < betOpenDate.getTime();
        }
    }

    // Fallback to the promotion-level matchDate configuration
    const matchDate = promotion?.matchDate ? new Date(promotion.matchDate) : null;
    if (matchDate && !Number.isNaN(matchDate.getTime())) {
        return betTime.getTime() < matchDate.getTime();
    }

    return false;
}

function isPlacedBeforeTrigger(bet: any, promotion: any) {
    const triggerTime = promotion?.triggerConfig?.triggeredAt ? new Date(promotion.triggerConfig.triggeredAt) : null;
    const betTime = bet?.createdAt ? new Date(bet.createdAt) : null;

    if (!triggerTime || Number.isNaN(triggerTime.getTime())) {
        return true;
    }

    if (!betTime || Number.isNaN(betTime.getTime())) {
        return false;
    }

    return betTime.getTime() < triggerTime.getTime();
}

function isMainWalletBet(bet: any): boolean {
    const betSource = String(bet.betSource || 'balance').toLowerCase();
    // Exclude any bet that was fully or partially funded from sports/casino bonus
    return !betSource.includes('sportsbonus') && !betSource.includes('casinobonus') && !betSource.includes('bonus');
}

function isEligibleEarlySixBet(bet: any, promotion: any) {
    if (promotion?.promotionType !== 'FIRST_OVER_SIX_CASHBACK') {
        return false;
    }

    const qualifyingSelections = Array.isArray(promotion?.triggerConfig?.qualifyingSelections)
        ? promotion.triggerConfig.qualifyingSelections.map(normalizeValue)
        : [];
    const selectedTeam = normalizeValue(
        bet.selectedTeam || bet.selectionName || bet.selectionId || '',
    );

    if (!qualifyingSelections.length || !selectedTeam || !qualifyingSelections.includes(selectedTeam)) {
        return false;
    }

    if (String(bet.betType || 'back').toLowerCase() === 'lay') {
        return false;
    }

    // Only main wallet bets qualify — bonus-funded bets are excluded
    if (!isMainWalletBet(bet)) {
        return false;
    }

    if (!isMatchOddsMarket(bet) || !isPreMatchBet(bet, promotion) || !isPlacedBeforeTrigger(bet, promotion)) {
        return false;
    }

    return true;
}

function getEarlySixReason(bet: any, promotion: any) {
    const qualifyingSelections = Array.isArray(promotion?.triggerConfig?.qualifyingSelections)
        ? promotion.triggerConfig.qualifyingSelections.map(normalizeValue)
        : [];
    const selectedTeam = normalizeValue(
        bet.selectedTeam || bet.selectionName || bet.selectionId || '',
    );

    if (String(bet.betType || 'back').toLowerCase() === 'lay') {
        return 'Lay bet';
    }

    if (!isMatchOddsMarket(bet)) {
        return 'Not Match Odds';
    }

    if (!isPreMatchBet(bet, promotion)) {
        return 'In-play bet';
    }

    if (!isPlacedBeforeTrigger(bet, promotion)) {
        return 'Placed after trigger';
    }

    if (!isMainWalletBet(bet)) {
        return 'Bonus wallet bet';
    }

    if (!qualifyingSelections.length) {
        return 'Qualified team not set';
    }

    if (!selectedTeam || !qualifyingSelections.includes(selectedTeam)) {
        return 'Wrong team';
    }

    return 'Qualifies';
}

function calculateRefundAmount(bet: any, promotion: any) {
    const rawAmount = Number((((Number(bet?.stake || 0) * Number(promotion?.refundPercentage || 0)) / 100)).toFixed(2));
    const maxRefundAmount = typeof promotion?.maxRefundAmount === 'number' ? Number(promotion.maxRefundAmount) : null;
    return maxRefundAmount !== null ? Number(Math.min(rawAmount, maxRefundAmount).toFixed(2)) : rawAmount;
}

async function loadPromotionAndEligibleEarlySixBets(promotionId: string) {
    await connectMongo();

    const promotion = await MatchCashbackPromotion.findById(promotionId).lean();
    if (!promotion) {
        throw new Error('Promotion not found');
    }

    if (promotion.promotionType !== 'FIRST_OVER_SIX_CASHBACK') {
        throw new Error('This action is only available for Early Six cashback promotions');
    }

    const orConditions: any[] = [
        { eventId: promotion.matchId },
        { matchId: promotion.matchId },
    ];

    if (promotion.eventName) {
        orConditions.push({
            eventName: { $regex: new RegExp(`^${escapeRegex(String(promotion.eventName).trim())}$`, 'i') }
        });
    }

    let bets = await Bet.find({
        $or: orConditions,
    }).sort({ createdAt: 1 }).lean();

    const firstEligibleBetByUser = new Map<number, any>();
    const classifiedBets = bets.map((bet) => {
        const qualifies = isEligibleEarlySixBet(bet, promotion);
        return {
            ...bet,
            earlySixQualifies: qualifies,
            earlySixReason: getEarlySixReason(bet, promotion),
        };
    });
    const matchOddsBets = classifiedBets.filter((bet) => isMatchOddsMarket(bet));

    for (const bet of matchOddsBets) {
        if (!bet.earlySixQualifies) {
            continue;
        }

        const userId = Number(bet.userId);
        if (!Number.isFinite(userId) || firstEligibleBetByUser.has(userId)) {
            continue;
        }

        firstEligibleBetByUser.set(userId, bet);
    }

    return {
        promotion,
        allBets: matchOddsBets,
        eligibleBets: Array.from(firstEligibleBetByUser.values()).sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    };
}

// Wallet balances are updated within the Prisma transaction above.
// The legacy backend emit-wallet-update / wallet-sync call has been removed.


// ─── CRUD Operations ─────────────────────────────────────────────────────────

export async function getSportsPromotions() {
    try {
        await connectMongo();
        const docs = await MatchCashbackPromotion.find().sort({ order: 1, createdAt: -1 }).lean();
        return {
            success: true,
            data: docs.map((d: any) => ({
                ...JSON.parse(JSON.stringify(d)),
                _id: String(d._id),
                id: String(d._id),
                eventId: d.matchId || '',
                matchId: d.matchId || '',
            })),
        };
    } catch (error: any) {
        console.error('Failed to fetch sports promotions:', error);
        return { success: false, error: error.message || 'Failed to fetch sports promotions' };
    }
}

export async function createSportsPromotion(data: any) {
    try {
        await connectMongo();
        const doc = await MatchCashbackPromotion.create(buildPayload(data));
        revalidatePath(REVALIDATE_PATH);
        return { success: true, data: normalize(doc) };
    } catch (error: any) {
        console.error('Failed to create sports promotion:', error);
        return { success: false, error: error.message || 'Failed to create sports promotion' };
    }
}

export async function updateSportsPromotion(id: string, data: any) {
    try {
        await connectMongo();
        const doc = await MatchCashbackPromotion.findByIdAndUpdate(id, buildPayload(data), { returnDocument: 'after' });
        if (!doc) throw new Error('Promotion not found');
        revalidatePath(REVALIDATE_PATH);
        return { success: true, data: normalize(doc) };
    } catch (error: any) {
        console.error('Failed to update sports promotion:', error);
        return { success: false, error: error.message || 'Failed to update sports promotion' };
    }
}

export async function deleteSportsPromotion(id: string) {
    try {
        await connectMongo();
        await MatchCashbackPromotion.findByIdAndDelete(id);
        revalidatePath(REVALIDATE_PATH);
        return { success: true };
    } catch (error: any) {
        console.error('Failed to delete sports promotion:', error);
        return { success: false, error: error.message || 'Failed to delete sports promotion' };
    }
}

export async function toggleSportsPromotionStatus(id: string, isActive: boolean) {
    try {
        await connectMongo();
        const doc = await MatchCashbackPromotion.findByIdAndUpdate(id, { isActive }, { returnDocument: 'after' });
        if (!doc) throw new Error('Promotion not found');
        revalidatePath(REVALIDATE_PATH);
        return { success: true, data: normalize(doc) };
    } catch (error: any) {
        console.error('Failed to toggle sports promotion status:', error);
        return { success: false, error: error.message || 'Failed to toggle status' };
    }
}

export async function setSportsPromotionTrigger(id: string, payload: {
    isTriggered: boolean;
    oversWindow?: number;
    leadThreshold?: number;
    minuteThreshold?: number;
    periodLabel?: string;
    qualifyingSelections?: string[];
    scoreSnapshot?: string;
    triggerNote?: string;
}) {
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
        return { success: true, data: normalize(doc) };
    } catch (error: any) {
        console.error('Failed to update trigger condition:', error);
        return { success: false, error: error.message || 'Failed to update trigger condition' };
    }
}

export async function getEarlySixBetList(promotionId: string) {
    try {
        const { promotion, allBets, eligibleBets } = await loadPromotionAndEligibleEarlySixBets(promotionId);
        const userIds = [...new Set(allBets.map((bet: any) => Number(bet.userId)).filter(Boolean))];
        const users = userIds.length
            ? await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, username: true, email: true },
            })
            : [];
        const userMap = new Map(users.map((user) => [user.id, user]));

        const transactionIds = eligibleBets.map((bet: any) => `PROMO-EARLY6-${promotionId}-${String(bet._id)}`);
        const existingRefunds = transactionIds.length
            ? await prisma.transaction.findMany({
                where: { transactionId: { in: transactionIds } },
                select: { transactionId: true },
            })
            : [];
        const refundedSet = new Set(existingRefunds.map((txn) => txn.transactionId));
        const countedBetIds = new Set(eligibleBets.map((bet: any) => String(bet._id)));

        return {
            success: true,
            data: allBets
                .slice()
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((bet: any) => {
                const rawRefundAmount = calculateRefundAmount(bet, promotion);
                const betId = String(bet._id);
                const countedForEarlySix = countedBetIds.has(betId);
                const refunded = refundedSet.has(`PROMO-EARLY6-${promotionId}-${betId}`);
                const user = userMap.get(Number(bet.userId));
                const outcome = String(bet.status || 'PENDING').toUpperCase();
                const refundAmount = bet.earlySixQualifies ? rawRefundAmount : 0;
                const refundable = countedForEarlySix && outcome === 'LOST' && refundAmount > 0 && !refunded;

                let eligibilityLabel = bet.earlySixReason || 'Not eligible';
                if (countedForEarlySix) {
                    eligibilityLabel = refunded
                        ? 'Refunded'
                        : refundable
                            ? 'Refundable'
                            : outcome === 'WON'
                                ? 'Won bet'
                                : outcome === 'VOID'
                                    ? 'Void bet'
                                    : outcome === 'PENDING'
                                        ? 'Waiting result'
                                        : 'First qualifying bet';
                } else if (bet.earlySixQualifies) {
                    eligibilityLabel = 'Duplicate bet';
                }

                return {
                    id: betId,
                    userId: Number(bet.userId),
                    username: user?.username || `User #${bet.userId}`,
                    email: user?.email || '',
                    selectionName: bet.selectionName || bet.selectedTeam || bet.selectionId || 'Unknown',
                    marketName: bet.marketName || bet.computedMarketName || '',
                    stake: Number(bet.stake || 0),
                    odds: Number(bet.odds || 0),
                    status: outcome,
                    createdAt: bet.createdAt,
                    refundAmount,
                    countedForEarlySix,
                    refunded,
                    refundable,
                    eligibilityLabel,
                };
            }),
        };
    } catch (error: any) {
        console.error('Failed to fetch Early Six bet list:', error);
        return { success: false, error: error.message || 'Failed to fetch Early Six bet list', data: [] };
    }
}

// ─── Bet-refund email helper ────────────────────────────────────────────────

async function sendBetRefundEmail(
    email: string,
    username: string,
    amountLabel: string,
    eventName: string,
    marketName: string,
) {
    try {
        const [smtpRecord, platformRecord, templateRecord] = await Promise.all([
            prisma.systemConfig.findUnique({ where: { key: 'SMTP_SETTINGS' } }),
            prisma.systemConfig.findUnique({ where: { key: 'PLATFORM_NAME' } }),
            prisma.systemConfig.findUnique({ where: { key: EMAIL_TEMPLATE_SETTINGS_KEY } }),
        ]);
        if (!smtpRecord?.value) return;
        let smtp: Record<string, string>;
        try { smtp = JSON.parse(smtpRecord.value); } catch { return; }
        const { host, port, user, password, fromName, fromEmail, secure } = smtp;
        if (!host || !user || !password) return;

        const platformName = platformRecord?.value?.trim() || 'Platform';
        const siteUrl = (process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://odd69.com').replace(/\/+$/, '');
        const templateSettings = mergeEmailTemplateSettings(templateRecord?.value);
        const now = new Intl.DateTimeFormat('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
        }).format(new Date()) + ' IST';

        const template = resolveManagedEmailTemplate('bet-refund', templateSettings, {
            platformName, username, amountLabel, eventName, marketName, refundedAt: now, siteUrl,
        });
        if (!template.enabled) return;

        const esc = (v: string) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const year = new Date().getFullYear();
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta name="color-scheme" content="dark"/><title>${esc(template.title)}</title></head>
<body style="margin:0;padding:0;background:#0f0d12;color:#e1c1b8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,Arial,sans-serif;">
<div style="display:none!important;">${esc(template.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0d12;"><tr><td style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;"><tr>
<td style="padding:2px;border-radius:26px;background:linear-gradient(135deg,rgba(126,200,248,0.35),rgba(239,192,131,0.08) 40%,rgba(126,200,248,0.05));">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:24px;overflow:hidden;background:#1a171e;">
<tr><td style="padding:36px 32px 28px;background:linear-gradient(160deg,rgba(30,80,120,0.4),rgba(45,55,65,0.3) 30%,rgba(26,23,30,1) 70%);">
  <div style="margin-bottom:18px;"><span style="display:inline-block;padding:6px 14px;border-radius:999px;border:1px solid rgba(126,200,248,0.25);background:rgba(126,200,248,0.1);color:#7ec8f8;font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">${esc(template.eyebrow)}</span></div>
  <h1 style="margin:0 0 12px;color:#fff;font-size:28px;font-weight:900;line-height:1.12;">${esc(template.title)}</h1>
  <p style="margin:0;color:#c9bfb6;font-size:14px;line-height:1.7;">${esc(template.lead)}</p>
  <div style="margin-top:24px;padding:22px 24px;border-radius:18px;background:rgba(15,13,18,0.7);border:1px solid rgba(126,200,248,0.1);">
    <div style="color:#8d8a89;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">${esc(template.heroLabel)}</div>
    <div style="margin-top:8px;color:#fff;font-size:30px;font-weight:900;">${esc(template.heroValue)}</div>
    <div style="margin-top:8px;color:#b8b0a8;font-size:13px;">${esc(now)}</div>
    <div style="margin-top:14px;"><span style="display:inline-block;padding:7px 16px;border-radius:999px;font-size:12px;font-weight:800;text-transform:uppercase;background:rgba(126,200,248,0.1);border:1px solid rgba(126,200,248,0.22);color:#7ec8f8;">${esc(template.heroStatus)}</span></div>
  </div>
</td></tr>
<tr><td style="padding:28px 32px 32px;">
  ${template.bodyPrimary ? `<p style="margin:0 0 16px;color:#c9bfb6;font-size:14px;line-height:1.7;">${esc(template.bodyPrimary)}</p>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-radius:16px;background:rgba(40,36,44,0.95);border:1px solid rgba(126,200,248,0.1);">
    <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Refund amount</td><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#6ee7a0;font-size:14px;font-weight:700;text-align:right;">${esc(amountLabel)}</td></tr>
    <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Event</td><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#b8b0a8;font-size:14px;font-weight:700;text-align:right;">${esc(eventName)}</td></tr>
    <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Market</td><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#b8b0a8;font-size:14px;font-weight:700;text-align:right;">${esc(marketName)}</td></tr>
    <tr><td style="padding:14px 18px;color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Status</td><td style="padding:14px 18px;color:#7ec8f8;font-size:14px;font-weight:700;text-align:right;">Refunded</td></tr>
  </table>
  ${template.bodySecondary ? `<p style="margin:20px 0 0;color:#9e9793;font-size:13px;line-height:1.7;">${esc(template.bodySecondary)}</p>` : ''}
  ${template.noteBody ? `<div style="margin-top:20px;padding:18px 20px;border-radius:16px;background:rgba(126,200,248,0.06);border:1px solid rgba(126,200,248,0.16);"><div style="font-size:12px;font-weight:700;color:#7ec8f8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">${esc(template.noteTitle)}</div><div style="color:#b8b0a8;font-size:13px;line-height:1.7;">${esc(template.noteBody)}</div></div>` : ''}
  ${template.ctaLabel ? `<div style="margin:24px 0 16px;text-align:center;"><a href="${esc(siteUrl)}" style="display:inline-block;min-width:220px;padding:16px 36px;border-radius:14px;background:linear-gradient(135deg,#e37d32,#f5a623,#efc083);color:#0f0d12!important;font-size:15px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;">${esc(template.ctaLabel)}</a></div>` : ''}
</td></tr>
<tr><td style="padding:24px 32px 28px;background:linear-gradient(180deg,rgba(26,23,30,1),rgba(20,17,24,1));">
  <div style="color:#fff;font-size:15px;font-weight:800;">${esc(platformName)}</div>
  <div style="margin-top:6px;color:#6b6870;font-size:12px;">${esc(template.footerNote)}</div>
  <div style="margin-top:4px;color:#4a474e;font-size:11px;">&copy; ${year} ${esc(platformName)}. All rights reserved.</div>
</td></tr>
</table></td></tr></table></td></tr></table></body></html>`;

        const transporter = nodemailer.createTransport({
            host, port: parseInt(port || '587', 10),
            secure: secure === 'true',
            auth: { user, pass: password },
        });

        await transporter.sendMail({
            from: `"${fromName || platformName}" <${fromEmail || user}>`,
            to: email, subject: template.subject, html,
        });
    } catch (e) {
        console.error(`[EarlySixRefund] Refund email failed for ${email}:`, (e as Error).message);
    }
}

export async function refundEarlySixPromotion(promotionId: string, adminId: number) {
    try {
        const { promotion, eligibleBets } = await loadPromotionAndEligibleEarlySixBets(promotionId);
        const refundableBets = eligibleBets.filter((bet: any) => String(bet.status || '').toUpperCase() === 'LOST');

        let refundedBetCount = 0;
        let totalRefundAmount = 0;
        const refundedUserIds: number[] = [];

        for (const bet of refundableBets) {
            const refundAmount = calculateRefundAmount(bet, promotion);
            if (refundAmount <= 0) continue;

            const transactionId = `PROMO-EARLY6-${promotionId}-${String(bet._id)}`;
            
            // Check if the bet was placed using bonus funds
            const isBonusBet = String(bet.betSource || '').toLowerCase().includes('bonus') || Number(bet.bonusStakeAmount || 0) > 0;
            const targetWalletType = isBonusBet ? 'bonus_wallet' : promotion.walletType;

            const walletField = targetWalletType === 'bonus_wallet' ? 'sportsBonus' : 'balance';
            const paymentMethod = targetWalletType === 'bonus_wallet' ? 'BONUS_WALLET' : 'MAIN_WALLET';
            const amountLabel = targetWalletType === 'bonus_wallet'
                ? `₹${refundAmount.toFixed(2)} bonus`
                : `₹${refundAmount.toFixed(2)}`;

            try {
                await prisma.$transaction(async (tx) => {
                    const updatedUser = await tx.user.update({
                        where: { id: Number(bet.userId) },
                        data: {
                            [walletField]: { increment: refundAmount },
                        },
                        select: {
                            id: true,
                            email: true,
                            username: true,
                            balance: true,
                            sportsBonus: true,
                        },
                    });

                    await tx.transaction.create({
                        data: {
                            userId: Number(bet.userId),
                            amount: refundAmount,
                            type: 'REFUND',
                            status: 'COMPLETED',
                            paymentMethod,
                            paymentDetails: {
                                source: 'FIRST_OVER_SIX_CASHBACK',
                                tag: 'EARLY_SIX_REFUND',
                                title: 'Early Six Refund',
                                promotionId,
                                matchId: promotion.matchId,
                                walletType: promotion.walletType,
                                referenceId: String(bet._id),
                                qualifyingSelections: promotion.triggerConfig?.qualifyingSelections || [],
                            },
                            remarks: `Early Six Refund for ${promotion.eventName || 'match'}`,
                            transactionId,
                            adminId,
                        },
                    });

                    await tx.notification.create({
                        data: {
                            userId: Number(bet.userId),
                            title: 'Early Six Refund',
                            body: `Your ${amountLabel} Early Six refund has been credited to your account.`,
                        },
                    });

                    await tx.auditLog.create({
                        data: {
                            adminId,
                            action: 'EARLY_SIX_REFUND',
                            details: {
                                promotionId,
                                userId: Number(bet.userId),
                                betId: String(bet._id),
                                amount: refundAmount,
                            },
                        },
                    });

                    const creditedWalletBalance = walletField === 'sportsBonus'
                        ? Number(updatedUser.sportsBonus || 0)
                        : Number(updatedUser.balance || 0);

                    console.info(
                        `[EarlySixRefund] Credited user ${bet.userId} ${refundAmount} to ${targetWalletType} (visible balance: ${creditedWalletBalance})`,
                    );
                });

                refundedBetCount += 1;
                totalRefundAmount += refundAmount;
                refundedUserIds.push(Number(bet.userId));

                // Send bet-refund email (fire-and-forget)
                const refundedUser = await prisma.user.findUnique({
                    where: { id: Number(bet.userId) },
                    select: { email: true, username: true },
                });
                if (refundedUser?.email) {
                    sendBetRefundEmail(
                        refundedUser.email,
                        refundedUser.username || 'Player',
                        amountLabel,
                        promotion.eventName || 'Match',
                        String(bet.marketName || bet.market || 'Match Odds'),
                    ).catch(() => {});
                }
            } catch (error: any) {
                if (!String(error?.message || '').includes('Unique constraint')) {
                    throw error;
                }
            }
        }

        const allRefundTransactionIds = eligibleBets.map((bet: any) => `PROMO-EARLY6-${promotionId}-${String(bet._id)}`);
        const existingRefundTransactions = allRefundTransactionIds.length
            ? await prisma.transaction.findMany({
                where: {
                    transactionId: { in: allRefundTransactionIds },
                },
                select: {
                    amount: true,
                },
            })
            : [];

        const totalRefundedBetCount = existingRefundTransactions.length;
        const totalRefundedAmount = existingRefundTransactions.reduce((sum, txn) => sum + Number(txn.amount || 0), 0);

        await connectMongo();
        await MatchCashbackPromotion.findByIdAndUpdate(promotionId, {
            refundedBetCount: totalRefundedBetCount,
            totalRefundAmount: totalRefundedAmount,
            lastSettledAt: new Date(),
        });

        revalidatePath(REVALIDATE_PATH);

        revalidatePath('/profile/transactions');

        return {
            success: true,
            refundedBetCount,
            totalRefundAmount,
        };
    } catch (error: any) {
        console.error('Failed to refund Early Six promotion:', error);
        return { success: false, error: error.message || 'Failed to refund Early Six promotion' };
    }
}
