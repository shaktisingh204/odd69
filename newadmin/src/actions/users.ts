'use server'

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { Role, KycStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import connectMongo from '@/lib/mongo';
import { Bet, UserTrafficEvent } from '@/models/MongoModels';
import nodemailer from 'nodemailer';
import {
    EMAIL_TEMPLATE_SETTINGS_KEY,
    mergeEmailTemplateSettings,
    resolveManagedEmailTemplate,
    replaceEmailTemplateTokens,
} from '@/lib/email-template-config';

// ─── Suspension email helper (called from all ban paths) ─────────────────────

async function sendSuspensionEmailDirect(email: string, username: string, reason = 'Policy violation') {
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

        const template = resolveManagedEmailTemplate('account-suspended', templateSettings, {
            platformName, username, reason, suspendedAt: now, siteUrl,
        });

        if (!template.enabled) return;

        // Build a simple but complete suspension email using inline styles
        const html = buildSuspensionEmailHtml(platformName, template, username, reason, now, siteUrl);

        const transporter = nodemailer.createTransport({
            host, port: parseInt(port || '587', 10),
            secure: secure === 'true',
            auth: { user, pass: password },
        });

        await transporter.sendMail({
            from: `"${fromName || platformName}" <${fromEmail || user}>`,
            to: email,
            subject: template.subject,
            html,
        });
    } catch (e) {
        console.error(`[Admin] Suspension email failed for ${email}:`, (e as Error).message);
    }
}

function esc(v: string) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSuspensionEmailHtml(
    platformName: string, template: any, username: string, reason: string, timestamp: string, siteUrl: string,
) {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta name="color-scheme" content="dark"/><title>${esc(template.title)} | ${esc(platformName)}</title></head>
<body style="margin:0;padding:0;background:#0f0d12;color:#e1c1b8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,Arial,sans-serif;line-height:1.6;">
<div style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${esc(template.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0d12;"><tr><td style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;"><tr>
<td style="padding:2px;border-radius:26px;background:linear-gradient(135deg,rgba(248,113,113,0.35) 0%,rgba(239,192,131,0.08) 40%,rgba(126,200,248,0.05) 100%);">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:24px;overflow:hidden;background:#1a171e;box-shadow:0 32px 80px rgba(0,0,0,0.5);">
<tr><td style="padding:36px 32px 28px;background:linear-gradient(160deg,rgba(120,30,30,0.4) 0%,rgba(60,45,45,0.3) 30%,rgba(26,23,30,1) 70%);">
  <div style="margin-bottom:18px;"><span style="display:inline-block;padding:6px 14px;border-radius:999px;border:1px solid rgba(248,113,113,0.25);background:rgba(248,113,113,0.1);color:#f87171;font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">${esc(template.eyebrow)}</span></div>
  <div style="color:#fff;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;opacity:0.5;margin-bottom:8px;">${esc(platformName)}</div>
  <h1 style="margin:0 0 12px;color:#fff;font-size:28px;font-weight:900;line-height:1.12;letter-spacing:-0.04em;">${esc(template.title)}</h1>
  <p style="margin:0;color:#c9bfb6;font-size:14px;line-height:1.7;">${esc(template.lead)}</p>
  <div style="margin-top:24px;padding:22px 24px;border-radius:18px;background:linear-gradient(135deg,rgba(15,13,18,0.7),rgba(20,18,23,0.6));border:1px solid rgba(248,113,113,0.1);">
    <div style="color:#8d8a89;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Account status</div>
    <div style="margin-top:8px;color:#fff;font-size:30px;font-weight:900;letter-spacing:-0.04em;">Suspended</div>
    <div style="margin-top:8px;color:#b8b0a8;font-size:13px;">${esc(timestamp)}</div>
    <div style="margin-top:14px;"><span style="display:inline-block;padding:7px 16px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.22);color:#f87171;">Suspended</span></div>
  </div>
</td></tr>
<tr><td style="height:1px;background:linear-gradient(90deg,transparent,rgba(248,113,113,0.15),transparent);"></td></tr>
<tr><td style="padding:28px 32px 32px;">
  <p style="margin:0 0 16px;color:#c9bfb6;font-size:14px;line-height:1.7;">${esc(template.bodyPrimary)}</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-radius:16px;background:linear-gradient(135deg,rgba(40,36,44,0.95),rgba(30,27,34,0.95));border:1px solid rgba(248,113,113,0.1);">
    <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Account</td><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#b8b0a8;font-size:14px;font-weight:700;text-align:right;">${esc(username)}</td></tr>
    <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Status</td><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#f87171;font-size:14px;font-weight:700;text-align:right;">Suspended</td></tr>
    <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Reason</td><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#f5c563;font-size:14px;font-weight:700;text-align:right;">${esc(reason)}</td></tr>
    <tr><td style="padding:14px 18px;color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Effective</td><td style="padding:14px 18px;color:#b8b0a8;font-size:14px;font-weight:700;text-align:right;">${esc(timestamp)}</td></tr>
  </table>
  <p style="margin:20px 0 0;color:#9e9793;font-size:13px;line-height:1.7;">${esc(template.bodySecondary)}</p>
  <div style="margin-top:20px;padding:18px 20px;border-radius:16px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.16);">
    ${template.noteTitle ? `<div style="margin:0 0 8px;color:#f87171;font-size:14px;font-weight:800;">\uD83D\uDEA8 ${esc(template.noteTitle)}</div>` : ''}
    <div style="color:#b8b0a8;font-size:13px;line-height:1.7;">${esc(template.noteBody)}</div>
  </div>
  ${template.ctaLabel ? `<div style="margin:24px 0 16px;text-align:center;"><a href="${esc(siteUrl + '/support')}" style="display:inline-block;min-width:220px;padding:16px 36px;border-radius:14px;background:linear-gradient(135deg,#e37d32,#f5a623,#efc083);color:#0f0d12!important;font-size:15px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;">${esc(template.ctaLabel)}</a></div>` : ''}
</td></tr>
<tr><td style="height:1px;background:linear-gradient(90deg,transparent,rgba(239,192,131,0.1),transparent);"></td></tr>
<tr><td style="padding:24px 32px 28px;background:linear-gradient(180deg,rgba(26,23,30,1),rgba(20,17,24,1));">
  <div style="margin:0 0 10px;color:#fff;font-size:15px;font-weight:800;">${esc(platformName)}</div>
  <div style="margin:0 0 6px;color:#6b6870;font-size:12px;line-height:1.6;">${esc(template.footerNote)}</div>
  <div style="color:#4a474e;font-size:11px;">&copy; ${year} ${esc(platformName)}. All rights reserved.</div>
</td></tr>
</table></td></tr></table></td></tr></table></body></html>`;
}

// ─── Rich user profile used by the detail page ────────────────────────────────

const completedDepositStatuses = ['APPROVED', 'COMPLETED'];
const completedWithdrawalStatuses = ['APPROVED', 'COMPLETED', 'PROCESSED'];

export async function getUserProfile(identifier: string | number) {
    try {
        let numericId: number | null = null;
        let strIdentifier = String(identifier).trim();
        
        if (!isNaN(Number(strIdentifier)) && Number(strIdentifier).toString() === strIdentifier) {
            numericId = Number(strIdentifier);
        }

        const orConditions: any[] = [
            { username: { equals: strIdentifier, mode: 'insensitive' } },
            { email: { equals: strIdentifier, mode: 'insensitive' } }
        ];
        if (numericId !== null) {
            orConditions.push({ id: numericId });
        }

        const user = await prisma.user.findFirst({
            where: { OR: orConditions },
            include: {
                manager: { select: { id: true, username: true } },
                referrer: { select: { id: true, username: true } },
                kycDocuments: { orderBy: { createdAt: 'desc' } },
                transactions: {
                    where: { type: { not: 'BONUS_CONVERT_REVERSED' } },
                    take: 20,
                    orderBy: { createdAt: 'desc' },
                },
                casinoTransactions: { take: 20, orderBy: { timestamp: 'desc' } },
                userBonuses: { orderBy: { createdAt: 'desc' } },
            }
        });

        if (!user) return { success: true, user: null };

        const id = user.id;

        // ─── Casino & Sports profit aggregates ────────────────────────────────
        // Casino = Huidu CasinoTransaction net + originals (Mines/Aviator/Limbo/Dice/Plinko)
        //          — profit is (wins + cashouts + refunds) − (bet placements − void debits)
        // Sports = Transaction BET_* rows whose paymentDetails.source is not an originals
        //          game (i.e. real sportsbook bets).
        const CASINO_SOURCES = new Set(['MINES', 'AVIATOR', 'LIMBO', 'DICE', 'PLINKO']);
        const betRowsPromise = prisma.transaction.findMany({
            where: {
                userId: id,
                status: 'COMPLETED',
                type: {
                    in: [
                        'BET_PLACE',
                        'BET_WIN',
                        'BET_CASHOUT',
                        'BET_REFUND',
                        'BET_VOID_DEBIT',
                        'BET_SETTLEMENT_REVERT_DEBIT',
                    ],
                },
            },
            select: { amount: true, type: true, paymentDetails: true },
        });
        const huiduAggPromise = prisma.casinoTransaction.groupBy({
            by: ['type'],
            where: { user_id: id },
            _sum: { amount: true },
        });

        // Crypto payment methods include NOWPAYMENTS, CRYPTO_WALLET, CRYPTO, and any CRYPTO_* prefix (CRYPTO_USDTBSC, CRYPTO_BTC, etc.)
        const cryptoMethodFilter = {
            OR: [
                { paymentMethod: { in: ['NOWPAYMENTS', 'CRYPTO_WALLET', 'CRYPTO'] } },
                { paymentMethod: { startsWith: 'CRYPTO_' } },
            ],
        };
        const fiatMethodFilter = {
            NOT: cryptoMethodFilter,
        };

        const [fiatDepositTotals, cryptoDepositTotals, fiatWithdrawalTotals, cryptoWithdrawalTotals, betRows, huiduAgg] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    userId: id,
                    type: 'DEPOSIT',
                    status: { in: completedDepositStatuses },
                    ...fiatMethodFilter,
                },
                _sum: { amount: true },
            }),
            prisma.transaction.aggregate({
                where: {
                    userId: id,
                    type: 'DEPOSIT',
                    status: { in: completedDepositStatuses },
                    ...cryptoMethodFilter,
                },
                _sum: { amount: true },
            }),
            prisma.transaction.aggregate({
                where: {
                    userId: id,
                    type: 'WITHDRAWAL',
                    status: { in: completedWithdrawalStatuses },
                    ...fiatMethodFilter,
                },
                _sum: { amount: true },
            }),
            prisma.transaction.aggregate({
                where: {
                    userId: id,
                    type: 'WITHDRAWAL',
                    status: { in: completedWithdrawalStatuses },
                    ...cryptoMethodFilter,
                },
                _sum: { amount: true },
            }),
            betRowsPromise,
            huiduAggPromise,
        ]);

        // Partition BET_* rows into casino (originals) vs sports by paymentDetails.source
        let sportsStake = 0;
        let sportsReturns = 0;
        let casinoOriginalsStake = 0;
        let casinoOriginalsReturns = 0;
        for (const r of betRows) {
            const pd: any = r.paymentDetails || {};
            const src = String(pd.source || '').trim().toUpperCase();
            const isCasino = CASINO_SOURCES.has(src);
            const amt = Number(r.amount || 0);
            const stakeBucket = isCasino ? 'casinoStake' : 'sportsStake';
            const returnBucket = isCasino ? 'casinoReturns' : 'sportsReturns';
            if (r.type === 'BET_PLACE') {
                if (stakeBucket === 'casinoStake') casinoOriginalsStake += amt;
                else sportsStake += amt;
            } else if (r.type === 'BET_VOID_DEBIT' || r.type === 'BET_SETTLEMENT_REVERT_DEBIT') {
                // Both remove a previously-credited amount (void refund, or match settlement that
                // was later reverted). They reduce the user's returns.
                if (returnBucket === 'casinoReturns') casinoOriginalsReturns -= amt;
                else sportsReturns -= amt;
            } else {
                // BET_WIN / BET_CASHOUT / BET_REFUND
                if (returnBucket === 'casinoReturns') casinoOriginalsReturns += amt;
                else sportsReturns += amt;
            }
        }

        // Huidu casino totals (wallet-type-agnostic — summed across fiat+crypto)
        let huiduBet = 0;
        let huiduWin = 0;
        for (const row of huiduAgg) {
            const t = String(row.type || '').toUpperCase();
            const s = Number(row._sum.amount || 0);
            if (t === 'BET' || t === 'DEBIT') huiduBet += s;
            else if (t === 'WIN' || t === 'CREDIT' || t === 'REFUND') huiduWin += s;
            // UPDATE rows → ignored (amount ≈ 0)
        }

        // Profit figures (positive = user is ahead, negative = user has lost)
        const casinoProfit = Number(
            (huiduWin - huiduBet) + (casinoOriginalsReturns - casinoOriginalsStake),
        );
        const sportsProfit = Number(sportsReturns - sportsStake);
        const casinoTotalBet = Number(huiduBet + casinoOriginalsStake);
        const casinoTotalWin = Number(huiduWin + casinoOriginalsReturns);
        const sportsTotalBet = Number(sportsStake);
        const sportsTotalWin = Number(sportsReturns);

        // ─── Crypto exposure from pending bets ──────────────────────────────
        let cryptoExposure = 0;
        let fiatExposure = 0;
        try {
            await connectMongo();
            const exposureAgg = await Bet.aggregate([
                { $match: { userId: id, status: 'PENDING' } },
                { $group: { _id: '$walletType', totalStake: { $sum: '$stake' } } },
            ]);
            for (const row of exposureAgg) {
                if (row._id === 'crypto') cryptoExposure = row.totalStake;
                else fiatExposure = row.totalStake;
            }
        } catch (err) {
            // Fallback to single exposure field
            fiatExposure = user.exposure ?? 0;
        }

        let signupIp: string | null = null;
        let sharedIpUsers: { id: number; username: string }[] = [];

        try {
            const trafficEvent = await UserTrafficEvent.findOne({ userId: id }).sort({ createdAt: 1 }).lean();
            if (trafficEvent && trafficEvent.ip) {
                signupIp = trafficEvent.ip;
                const sharedEvents = await UserTrafficEvent.find({
                    ip: signupIp,
                    userId: { $ne: id }
                }).distinct('userId');

                if (sharedEvents && sharedEvents.length > 0) {
                    const relatedUsers = await prisma.user.findMany({
                        where: { id: { in: sharedEvents as number[] } },
                        select: { id: true, username: true }
                    });
                    sharedIpUsers = relatedUsers.map(u => ({
                        id: u.id,
                        username: u.username || `User #${u.id}`
                    }));
                }
            }
        } catch (err) {
            console.error('Failed to fetch IP data from MongoDB:', err);
        }

        return {
            success: true,
            user: {
                ...user,
                totalDeposited: Number(fiatDepositTotals._sum.amount || user.totalDeposited || 0),
                totalFiatDeposited: Number(fiatDepositTotals._sum.amount || user.totalDeposited || 0),
                totalCryptoDeposited: Number(cryptoDepositTotals._sum.amount || 0),
                totalWithdrawn: Number(fiatWithdrawalTotals._sum.amount || 0),
                totalFiatWithdrawn: Number(fiatWithdrawalTotals._sum.amount || 0),
                totalCryptoWithdrawn: Number(cryptoWithdrawalTotals._sum.amount || 0),
                casinoProfit,
                casinoTotalBet,
                casinoTotalWin,
                sportsProfit,
                sportsTotalBet,
                sportsTotalWin,
                signupIp,
                sharedIpUsers,
                fiatExposure,
                cryptoExposure,
            },
        };
    } catch (error) {
        return { success: false, user: null };
    }
}

export async function getUsersBySharedIp(ip: string) {
    if (!ip) return [];
    try {
        await connectMongo();
        const sharedEvents = await UserTrafficEvent.find({ ip }).distinct('userId');
        if (!sharedEvents || sharedEvents.length === 0) return [];
        
        const relatedUsers = await prisma.user.findMany({
            where: { id: { in: sharedEvents as number[] } },
            select: { id: true, username: true, email: true, createdAt: true, isBanned: true }
        });
        
        return relatedUsers;
    } catch (err) {
        console.error('Failed to fetch shared IP users:', err);
        return [];
    }
}

export async function getUserTransactionsDirect(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    try {
        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where: {
                    userId,
                    type: { not: 'BONUS_CONVERT_REVERSED' },
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.transaction.count({
                where: {
                    userId,
                    type: { not: 'BONUS_CONVERT_REVERSED' },
                },
            }),
        ]);
        return { success: true, transactions, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    } catch (error) {
        return { success: false, transactions: [], pagination: { total: 0, page, limit, totalPages: 0 } };
    }
}

export async function deleteUserTransactionLog(
    userId: number,
    transactionId: number,
    adminId = 1,
) {
    try {
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            select: {
                id: true,
                userId: true,
                amount: true,
                type: true,
                status: true,
                paymentMethod: true,
                remarks: true,
                createdAt: true,
            },
        });

        if (!transaction || transaction.userId !== userId) {
            return { success: false, error: 'Transaction log not found' };
        }

        await prisma.$transaction([
            prisma.transaction.delete({
                where: { id: transactionId },
            }),
            prisma.auditLog.create({
                data: {
                    adminId,
                    action: 'DELETE_TRANSACTION_LOG',
                    details: {
                        userId,
                        transactionId,
                        type: transaction.type,
                        amount: transaction.amount,
                        status: transaction.status,
                        paymentMethod: transaction.paymentMethod,
                        remarks: transaction.remarks,
                        createdAt: transaction.createdAt,
                    },
                },
            }),
        ]);

        revalidatePath(`/dashboard/users/${userId}`);
        revalidatePath('/dashboard/finance/transactions');
        return { success: true };
    } catch (error: any) {
        console.error('deleteUserTransactionLog error:', error);
        return { success: false, error: error?.message || 'Failed to delete transaction log' };
    }
}

export async function getUserCasinoTransactions(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    try {
        const [transactions, total] = await Promise.all([
            prisma.casinoTransaction.findMany({
                where: { user_id: userId },
                skip,
                take: limit,
                orderBy: { timestamp: 'desc' },
            }),
            prisma.casinoTransaction.count({ where: { user_id: userId } }),
        ]);
        return { success: true, transactions, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    } catch (error) {
        return { success: false, transactions: [], pagination: { total: 0, page, limit, totalPages: 0 } };
    }
}

export async function getUserSportsBets(userId: number, limit = 50) {
    try {
        const id = Number(userId);
        if (isNaN(id)) return { success: false, bets: [] };

        await connectMongo();
        const bets = await Bet.find({ userId: id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return { success: true, bets: JSON.parse(JSON.stringify(bets)) };
    } catch (error) {
        console.error('getUserSportsBets error:', error);
        return { success: false, bets: [] };
    }
}

/**
 * Admin: edit the potentialWin of a sports bet.
 * - Always updates existing BET_WIN / SPORTS_WIN_EDIT transaction logs for this bet.
 * - Optionally credit/debit the wallet difference and create a new transaction log.
 */
export async function updateSportsBetWinningAmount(
    betId: string,
    userId: number,
    newPotentialWin: number,
    createTransaction: boolean,
    remarks: string,
    adminId = 1,
) {
    try {
        if (!betId || isNaN(Number(userId)) || isNaN(newPotentialWin) || newPotentialWin < 0) {
            return { success: false, error: 'Invalid parameters.' };
        }

        await connectMongo();

        // Fetch the bet from MongoDB
        const bet = await Bet.findById(betId).lean() as any;
        if (!bet) return { success: false, error: 'Bet not found.' };
        if (Number(bet.userId) !== Number(userId)) {
            return { success: false, error: 'Bet does not belong to this user.' };
        }

        const oldPotentialWin = Number(bet.potentialWin ?? 0);
        const diff = parseFloat((newPotentialWin - oldPotentialWin).toFixed(2));

        // ── 1. Update potentialWin on the MongoDB bet document ──────────────────
        await Bet.findByIdAndUpdate(betId, { $set: { potentialWin: newPotentialWin } });

        // ── 2. Always update existing related transaction logs ──────────────────
        // Finds any BET_WIN or SPORTS_WIN_EDIT transaction that references this betId
        // in paymentDetails.betId (set by the settlement service and by us).
        const relatedTxUpdate = async (tx: any) => {
            // Find transactions that belong to this bet via paymentDetails.betId
            const existingTxns = await tx.transaction.findMany({
                where: {
                    userId,
                    type: { in: ['BET_WIN', 'SPORTS_WIN_EDIT'] },
                    paymentDetails: {
                        path: ['betId'],
                        equals: betId,
                    },
                },
                select: { id: true, amount: true, type: true },
            });

            const updatedTxIds: number[] = [];

            for (const txn of existingTxns) {
                await tx.transaction.update({
                    where: { id: txn.id },
                    data: {
                        amount: newPotentialWin,
                        remarks: `[Win edited by admin] ${remarks || `Previous: ₹${Number(txn.amount).toFixed(2)} → ₹${newPotentialWin.toFixed(2)}`}`,
                        paymentDetails: {
                            betId,
                            source: txn.type === 'BET_WIN' ? 'SETTLEMENT' : 'SPORTS_WIN_EDIT',
                            editedBy: 'ADMIN',
                            previousAmount: Number(txn.amount),
                            newAmount: newPotentialWin,
                            editedAt: new Date().toISOString(),
                        },
                        updatedAt: new Date(),
                    },
                });
                updatedTxIds.push(txn.id);
            }

            return updatedTxIds;
        };

        // ── 3. Wallet adjustment + optional new transaction log ─────────────────
        let updatedTxIds: number[] = [];

        if (createTransaction && diff !== 0) {
            const type = diff > 0 ? 'DEPOSIT' : 'WITHDRAWAL';
            const absDiff = Math.abs(diff);

            await prisma.$transaction(async (tx: any) => {
                // Update existing logs first
                updatedTxIds = await relatedTxUpdate(tx);

                // Adjust wallet balance
                const userRecord = await tx.user.findUnique({
                    where: { id: userId },
                    select: { balance: true },
                });
                if (!userRecord) throw new Error('User not found');

                if (type === 'WITHDRAWAL' && Number(userRecord.balance) < absDiff - 0.001) {
                    throw new Error('Insufficient balance to debit.');
                }

                await tx.user.update({
                    where: { id: userId },
                    data: {
                        balance: type === 'DEPOSIT' ? { increment: absDiff } : { decrement: absDiff },
                    },
                });

                // Create new adjustment transaction log
                await tx.transaction.create({
                    data: {
                        userId,
                        amount: absDiff,
                        type: type as any,
                        status: 'APPROVED',
                        paymentMethod: 'SPORTS_WIN_EDIT',
                        paymentDetails: {
                            betId,
                            source: 'ADMIN_WIN_EDIT',
                            oldPotentialWin,
                            newPotentialWin,
                            diff,
                        },
                        remarks: remarks || `Admin edited sports bet win amount (Bet ID: ${betId}). ${diff > 0 ? 'Credited' : 'Debited'} difference ₹${absDiff.toFixed(2)}.`,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                });
            });
        } else {
            // Even without wallet change, still update transaction logs
            await prisma.$transaction(async (tx: any) => {
                updatedTxIds = await relatedTxUpdate(tx);
            });
        }

        // ── 4. Audit log ────────────────────────────────────────────────────────
        try {
            await prisma.auditLog.create({
                data: {
                    adminId,
                    action: 'EDIT_SPORTS_BET_WIN',
                    details: {
                        betId,
                        userId,
                        oldPotentialWin,
                        newPotentialWin,
                        diff,
                        createTransaction,
                        updatedTransactionIds: updatedTxIds,
                        remarks: remarks || null,
                    },
                },
            });
        } catch { /* AuditLog table may not exist — skip */ }

        revalidatePath(`/dashboard/users/${userId}`);
        revalidatePath('/dashboard/finance/transactions');
        return {
            success: true,
            oldPotentialWin,
            newPotentialWin,
            diff,
            updatedTransactionLogs: updatedTxIds.length,
        };
    } catch (error: any) {
        console.error('updateSportsBetWinningAmount error:', error);
        return { success: false, error: error?.message || 'Failed to update bet.' };
    }
}


export async function updateUserProfile(userId: number, data: {
    email?: string;
    phoneNumber?: string;
    role?: string;
    currency?: string;
    country?: string;
}) {
    try {
        const updateData: any = {};
        if (data.email) updateData.email = data.email.toLowerCase();
        if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber || null;
        if (data.role) updateData.role = data.role as Role;
        if (data.currency) updateData.currency = data.currency;
        if (data.country !== undefined) updateData.country = data.country || null;

        await prisma.user.update({ where: { id: userId }, data: updateData });
        revalidatePath(`/dashboard/users/${userId}`);
        return { success: true };
    } catch (error: any) {
        if (error.code === 'P2002') return { success: false, error: 'Email or phone number already in use.' };
        return { success: false, error: 'Failed to update profile.' };
    }
}

export async function resetUserPassword(userId: number, newPassword: string) {
    try {
        if (newPassword.length < 8) return { success: false, error: 'Password must be at least 8 characters.' };
        const hashed = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to reset password.' };
    }
}

export async function setRGLimitsAction(userId: number, limits: {
    depositLimit?: number | null;
    lossLimit?: number | null;
    selfExclusionUntil?: string | null;
}) {
    try {
        const data: any = {};
        if (limits.depositLimit !== undefined) data.depositLimit = limits.depositLimit;
        if (limits.lossLimit !== undefined) data.lossLimit = limits.lossLimit;
        if (limits.selfExclusionUntil !== undefined) {
            data.selfExclusionUntil = limits.selfExclusionUntil ? new Date(limits.selfExclusionUntil) : null;
        }
        await prisma.user.update({ where: { id: userId }, data });
        revalidatePath(`/dashboard/users/${userId}`);
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to update limits.' };
    }
}

export async function getManagersList() {
    try {
        const managers = await prisma.user.findMany({
            where: { role: { in: ['MANAGER', 'SUPER_ADMIN', 'MASTER', 'AGENT'] as Role[] } },
            select: { id: true, username: true, role: true },
            orderBy: { username: 'asc' },
        });
        return managers;
    } catch {
        return [];
    }
}

export async function createUser(data: {
    username: string;
    email: string;
    phoneNumber?: string;
    password: string;
    role: string;
}) {
    try {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const user = await prisma.user.create({
            data: {
                username: data.username,
                email: data.email.toLowerCase(),
                phoneNumber: data.phoneNumber || null,
                password: hashedPassword,
                role: data.role as Role,
            }
        });
        revalidatePath('/dashboard/users');
        return { success: true, user };
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { success: false, error: 'Username or email already exists.' };
        }
        return { success: false, error: 'Failed to create user.' };
    }
}

export async function getUsers(
    page = 1,
    limit = 10,
    search = '',
    role = '',
    status = '',
    sortBy = 'joined',
    sortDir = 'desc',
) {
    const skip = (page - 1) * limit;

    try {
        const params: any[] = [];
        const countParams: any[] = [];
        const conditions: string[] = [];
        const sortColumnMap: Record<string, string> = {
            user: 'LOWER(username)',
            role: 'role::text',
            balance: 'balance',
            exposure: 'exposure',
            status: '"isBanned"',
            country: 'LOWER(COALESCE(country, \'\'))',
            currency: 'LOWER(COALESCE(currency, \'\'))',
            joined: '"createdAt"',
            actions: '"createdAt"',
        };
        const orderBy = sortColumnMap[sortBy] || sortColumnMap.joined;
        const orderDirection = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        const secondaryOrderBy = orderBy === '"createdAt"' ? '"id" DESC' : '"createdAt" DESC';

        // Search — pass the same value 3 times for 3 different $N placeholders
        if (search) {
            const s = `%${search}%`;
            const n = params.length;
            params.push(s, s, s);        // $1 $2 $3 (or offset)
            countParams.push(s, s, s);
            conditions.push(`(username ILIKE $${n + 1} OR email ILIKE $${n + 2} OR "phoneNumber" ILIKE $${n + 3})`);
        }

        // Role filter — cast the string to the Role enum
        if (role && role !== 'ALL') {
            const n = params.length;
            params.push(role);
            countParams.push(role);
            conditions.push(`role::text = $${n + 1}`);
        }

        // Status filter — no extra params needed (boolean literals)
        if (status === 'BANNED') {
            conditions.push(`"isBanned" = true`);
        } else if (status === 'ACTIVE') {
            conditions.push(`"isBanned" = false`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        // LIMIT / OFFSET come after search/role params
        const li = params.length + 1;
        const oi = params.length + 2;
        params.push(limit, skip);

        const [rows, countResult] = await Promise.all([
            prisma.$queryRawUnsafe(`
                SELECT * FROM "User"
                ${where}
                ORDER BY ${orderBy} ${orderDirection}, ${secondaryOrderBy}
                LIMIT $${li} OFFSET $${oi}
            `, ...params) as any,
            prisma.$queryRawUnsafe(`
                SELECT COUNT(*)::int AS total FROM "User" ${where}
            `, ...countParams) as any,
        ]);

        // Extract user IDs to query traffic events
        const userIds = (rows as any[]).map((u: any) => u.id);
        
        // signupIp    = first traffic event (sorted ascending by createdAt)
        // lastLoginIp = most recent login event (utm_source === 'login')
        // loginCount  = number of login events
        // uniqueIpCount = distinct IPs the user has used for login
        let signupIpMap: Record<number, string> = {};
        let lastLoginIpMap: Record<number, string> = {};
        let loginCountMap: Record<number, number> = {};
        let uniqueIpCountMap: Record<number, number> = {};
        let sharedIpCountMap: Record<string, number> = {};
        let depositSumMap: Record<number, number> = {};

        try {
            await connectMongo();

            const [signupEvents, loginAgg, uniqueIpAgg, depositsAgg] = await Promise.all([
                // Earliest event per user → signup IP
                UserTrafficEvent.aggregate([
                    { $match: { userId: { $in: userIds } } },
                    { $sort: { createdAt: 1 } },
                    { $group: { _id: '$userId', ip: { $first: '$ip' } } },
                ]),
                // Login events: count + latest IP per user
                UserTrafficEvent.aggregate([
                    { $match: { userId: { $in: userIds }, utm_source: 'login', ip: { $ne: null } } },
                    { $sort: { createdAt: -1 } },
                    {
                        $group: {
                            _id: '$userId',
                            lastLoginIp: { $first: '$ip' },
                            loginCount: { $sum: 1 },
                        }
                    },
                ]),
                // Unique IPs per user (across ALL events)
                UserTrafficEvent.aggregate([
                    { $match: { userId: { $in: userIds }, ip: { $ne: null } } },
                    { $group: { _id: '$userId', ips: { $addToSet: '$ip' } } },
                    { $project: { uniqueIpCount: { $size: '$ips' }, ips: 1 } },
                ]),
                // True deposit sum per user
                prisma.transaction.groupBy({
                    by: ['userId'],
                    where: { userId: { in: userIds }, type: 'DEPOSIT', status: { in: ['APPROVED', 'COMPLETED'] } },
                    _sum: { amount: true },
                }),
            ]);

            signupEvents.forEach((ev: any) => {
                if (ev.ip) signupIpMap[ev._id] = ev.ip;
            });
            loginAgg.forEach((ev: any) => {
                lastLoginIpMap[ev._id] = ev.lastLoginIp;
                loginCountMap[ev._id] = ev.loginCount;
            });
            uniqueIpAgg.forEach((ev: any) => {
                uniqueIpCountMap[ev._id] = ev.uniqueIpCount;
            });
            depositsAgg.forEach((ev: any) => {
                depositSumMap[ev.userId] = Number(ev._sum.amount || 0);
            });

            // Count how many OTHER users share each signup IP (fraud detection)
            const uniqueSignupIps = Array.from(new Set(Object.values(signupIpMap)));
            if (uniqueSignupIps.length > 0) {
                const ipGroups = await UserTrafficEvent.aggregate([
                    { $match: { ip: { $in: uniqueSignupIps } } },
                    { $group: { _id: '$ip', userIds: { $addToSet: '$userId' } } },
                ]);
                ipGroups.forEach((group: any) => {
                    sharedIpCountMap[group._id] = group.userIds.length;
                });
            }
        } catch (err) {
            console.error('Failed to augment user IPs:', err);
        }

        // Pick only the fields we need so the shape is predictable
        const users = (rows as any[]).map((u: any) => ({
            id: u.id,
            username: u.username,
            email: u.email,
            phoneNumber: u.phoneNumber,
            role: u.role,
            isBanned: u.isBanned ?? false,
            balance: u.balance ?? 0,
            bonus: u.bonus ?? 0,
            currency: u.currency ?? 'INR',
            kycStatus: u.kycStatus ?? 'NONE',
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            managerId: u.managerId ?? null,
            referrerId: u.referrerId ?? null,
            signupIp: signupIpMap[u.id] || null,
            lastLoginIp: lastLoginIpMap[u.id] || null,
            loginCount: loginCountMap[u.id] || 0,
            uniqueIpCount: uniqueIpCountMap[u.id] || 0,
            sharedIpCount: signupIpMap[u.id] ? (sharedIpCountMap[signupIpMap[u.id]] || 1) : 0,
            totalDeposited: depositSumMap[u.id] || 0,
        }));

        const total = Number(countResult[0]?.total ?? 0);

        return {
            users: users as any[],
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    } catch (error) {
        console.error('Failed to fetch users:', error);
        throw new Error('Failed to fetch users');
    }
}

export async function getUserById(id: number) {
    try {
        const [user, depositTotals, withdrawalTotals] = await Promise.all([
            prisma.user.findUnique({
                where: { id },
                include: {
                    manager: { select: { id: true, username: true } },
                    referrer: { select: { id: true, username: true } },
                    kycDocuments: true,
                    transactions: {
                        where: { type: { not: 'BONUS_CONVERT_REVERSED' } },
                        take: 5,
                        orderBy: { createdAt: 'desc' },
                    },
                    casinoTransactions: { take: 5, orderBy: { timestamp: 'desc' } },
                }
            }),
            prisma.transaction.aggregate({
                where: {
                    userId: id,
                    type: 'DEPOSIT',
                    status: { in: completedDepositStatuses },
                },
                _sum: { amount: true },
            }),
            prisma.transaction.aggregate({
                where: {
                    userId: id,
                    type: 'WITHDRAWAL',
                    status: { in: completedWithdrawalStatuses },
                },
                _sum: { amount: true },
            }),
        ]);

        if (!user) return null;

        return {
            ...user,
            totalDeposited: Number(depositTotals._sum.amount || user.totalDeposited || 0),
            totalWithdrawn: Number(withdrawalTotals._sum.amount || 0),
        };
    } catch (error) {
        throw new Error('User not found');
    }
}

export async function updateUserStatus(userId: number, isBanned: boolean, banReason?: string) {
    try {
        const user = await prisma.user.update({
            where: { id: userId },
            data: { isBanned },
            select: { email: true, username: true },
        });

        // Send suspension email (fire-and-forget)
        if (isBanned && user.email) {
            sendSuspensionEmailDirect(user.email, user.username || user.email, banReason || 'Policy violation').catch(() => {});
        }

        // Log the ban/unban action with optional reason
        try {
            await (prisma as any).auditLog.create({
                data: {
                    adminId: 1,
                    action: isBanned ? 'USER_BANNED' : 'USER_UNBANNED',
                    details: {
                        userId,
                        reason: banReason || null,
                        timestamp: new Date().toISOString(),
                    },
                },
            });
        } catch {
            // AuditLog table may not exist — skip silently
        }

        revalidatePath('/dashboard/users');
        revalidatePath(`/dashboard/users/${userId}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update status' };
    }
}

export async function updateUserRole(userId: number, role: string) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { role: role as Role }
        });
        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update role' };
    }
}

export async function verifyKyc(userId: number, status: KycStatus) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { kycStatus: status }
        });
        revalidatePath(`/dashboard/users/${userId}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to verify KYC' };
    }
}

export async function assignManager(userId: number, managerId: number | null) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { managerId }
        });
        revalidatePath(`/dashboard/users/${userId}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to assign manager' };
    }
}

/** Deletes all dependent records then hard-deletes the user using raw SQL. */
async function deleteUserAndRelations(p: any, userId: number) {
    // Nullify self-referential FKs (this user being manager/agent/master/referrer of others)
    await p.$executeRawUnsafe(`UPDATE "User" SET "managerId" = NULL WHERE "managerId" = ${userId}`);
    await p.$executeRawUnsafe(`UPDATE "User" SET "agentId" = NULL WHERE "agentId" = ${userId}`);
    await p.$executeRawUnsafe(`UPDATE "User" SET "masterId" = NULL WHERE "masterId" = ${userId}`);
    await p.$executeRawUnsafe(`UPDATE "User" SET "referrerId" = NULL WHERE "referrerId" = ${userId}`);

    // Delete leaf tables first (deepest FK dependencies first)
    await p.$executeRawUnsafe(`DELETE FROM "OriginalsEngagementEvent" WHERE "userId" = ${userId}`);
    await p.$executeRawUnsafe(`DELETE FROM "OriginalsSession" WHERE "userId" = ${userId}`);
    await p.$executeRawUnsafe(`DELETE FROM "MinesGame" WHERE "userId" = ${userId}`);
    await p.$executeRawUnsafe(`DELETE FROM "PasswordResetToken" WHERE "userId" = ${userId}`);
    await p.$executeRawUnsafe(`DELETE FROM "VipApplication" WHERE "userId" = ${userId}`);
    await p.$executeRawUnsafe(`DELETE FROM "UserBonus" WHERE "userId" = ${userId}`);
    await p.$executeRawUnsafe(`DELETE FROM "Notification" WHERE "userId" = ${userId}`);
    await p.$executeRawUnsafe(`DELETE FROM "KycDocument" WHERE "userId" = ${userId}`);
    await p.$executeRawUnsafe(`DELETE FROM "CasinoTransaction" WHERE "user_id" = ${userId}`);
    await p.$executeRawUnsafe(`DELETE FROM "Transaction" WHERE "userId" = ${userId}`);
    await p.$executeRawUnsafe(`DELETE FROM "ReferralHistory" WHERE "referrerId" = ${userId} OR "referredUserId" = ${userId}`);

    // Support messages → tickets (two-level delete)
    await p.$executeRawUnsafe(`
        DELETE FROM "SupportMessage"
        WHERE "ticketId" IN (SELECT id FROM "SupportTicket" WHERE "userId" = ${userId})
    `);
    await p.$executeRawUnsafe(`DELETE FROM "SupportTicket" WHERE "userId" = ${userId}`);

    // Finally delete the user
    await p.$executeRawUnsafe(`DELETE FROM "User" WHERE "id" = ${userId}`);
}


export async function deleteUser(userId: number) {
    try {
        await deleteUserAndRelations(prisma, userId);
        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to delete user:', error);
        return { success: false, error: 'Failed to permanently delete user.' };
    }
}

export async function exportUsers(search = '', role = '', status = '') {
    try {
        const params: any[] = [];
        const conditions: string[] = [];

        if (search) {
            const s = `%${search}%`;
            params.push(s, s, s);
            conditions.push(`(username ILIKE $1 OR email ILIKE $2 OR "phoneNumber" ILIKE $3)`);
        }

        if (role && role !== 'ALL') {
            const n = params.length;
            params.push(role);
            conditions.push(`role::text = $${n + 1}`);
        }

        if (status === 'BANNED') {
            conditions.push(`"isBanned" = true`);
        } else if (status === 'ACTIVE') {
            conditions.push(`"isBanned" = false`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const rows = await prisma.$queryRawUnsafe(`
            SELECT username, email, "phoneNumber" FROM "User"
            ${where}
            ORDER BY "createdAt" DESC
        `, ...params) as any[];

        const users = rows.map((u: any) => ({
            username: u.username ?? '',
            email: u.email ?? '',
            phoneNumber: u.phoneNumber ?? '',
        }));

        return { success: true, users };
    } catch (error) {
        console.error('Failed to export users:', error);
        return { success: false, users: [] };
    }
}

export async function performBulkAction(userIds: number[], action: 'BAN' | 'VERIFY' | 'BONUS' | 'DELETE', data?: any) {
    try {
        if (action === 'BAN') {
            await prisma.user.updateMany({
                where: { id: { in: userIds } },
                data: { isBanned: true }
            });

            // Send suspension emails (fire-and-forget)
            const bannedUsers = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { email: true, username: true },
            });
            const reason = data?.reason || 'Policy violation';
            for (const u of bannedUsers) {
                if (u.email) {
                    sendSuspensionEmailDirect(u.email, u.username || u.email, reason).catch(() => {});
                }
            }
        } else if (action === 'VERIFY') {
            await prisma.user.updateMany({
                where: { id: { in: userIds } },
                data: { kycStatus: 'VERIFIED' }
            });
        } else if (action === 'BONUS') {
            const amount = parseFloat(data?.amount || '0');
            if (amount > 0) {
                const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
                for (const uid of userIds) {
                    try {
                        await (prisma as any).$transaction([
                            // Credit the casino bonus wallet
                            (prisma as any).user.update({
                                where: { id: uid },
                                data: { casinoBonus: { increment: amount } },
                            }),
                            // Create a UserBonus record so the bonus shows in My Bonuses
                            (prisma as any).userBonus.create({
                                data: {
                                    userId: uid,
                                    bonusId: 'admin_bulk',
                                    bonusCode: 'ADMIN_BULK',
                                    bonusTitle: 'Admin Bonus Credit',
                                    bonusCurrency: 'INR',
                                    applicableTo: 'CASINO',
                                    depositAmount: 0,
                                    bonusAmount: amount,
                                    wageringRequired: 0,
                                    wageringDone: 0,
                                    status: 'ACTIVE',
                                    expiresAt,
                                },
                            }),
                            // Transaction log entry
                            (prisma as any).transaction.create({
                                data: {
                                    userId: uid,
                                    amount,
                                    type: 'BONUS',
                                    status: 'APPROVED',
                                    remarks: 'Bulk Casino Bonus Credit (Admin)',
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                },
                            }),
                        ]);
                    } catch (e) {
                        console.error(`Failed to give bonus to user ${uid}`, e);
                    }
                }
            }
        } else if (action === 'DELETE') {
            for (const uid of userIds) {
                await deleteUserAndRelations(prisma, uid);
            }
        }

        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Bulk action failed' };
    }
}

/**
 * Convert a user's active bonus between casino ↔ sports.
 * - Moves the wallet balance (casinoBonus ↔ sportsBonus)
 * - Moves per-type wagering counters
 * - Updates all active UserBonus records' applicableTo field
 * - Logs an audit transaction
 */
export async function convertBonusType(
    userId: number,
    from: 'CASINO' | 'SPORTS',
    adminId = 1,
) {
    try {
        const to = from === 'CASINO' ? 'SPORTS' : 'CASINO';

        const user = await (prisma as any).user.findUnique({
            where: { id: userId },
            select: {
                casinoBonus: true,
                fiatBonus: true,
                sportsBonus: true,
                casinoBonusWageringRequired: true,
                casinoBonusWageringDone: true,
                sportsBonusWageringRequired: true,
                sportsBonusWageringDone: true,
            },
        });
        if (!user) return { success: false, error: 'User not found' };

        const fromWallet = from === 'CASINO' ? 'casinoBonus' : 'sportsBonus';
        const toWallet = to === 'CASINO' ? 'casinoBonus' : 'sportsBonus';

        // Find active UserBonus records for the source type FIRST — these are the source of truth
        const fromApplicableTo = from === 'CASINO' ? ['CASINO', 'BOTH'] : ['SPORTS'];
        const activeBonuses = await (prisma as any).userBonus.findMany({
            where: { userId, status: 'ACTIVE', applicableTo: { in: fromApplicableTo } },
        });

        // Amount to move: trust tracked split wallet first, then active UserBonus records.
        // Do not recover from raw historical BONUS logs here; that can over-count legacy noise.
        const walletAmount = from === 'CASINO'
            ? parseFloat(((user.casinoBonus || 0) + (user.fiatBonus || 0)).toString())
            : parseFloat((user[fromWallet] || 0).toString());
        const ubAmount = activeBonuses.reduce((s: number, ub: any) => s + parseFloat((ub.bonusAmount || 0).toString()), 0);
        const ubWageringReq = activeBonuses.reduce((s: number, ub: any) => s + parseFloat((ub.wageringRequired || 0).toString()), 0);
        const ubWageringDone = activeBonuses.reduce((s: number, ub: any) => s + parseFloat((ub.wageringDone || 0).toString()), 0);

        const amount = Math.max(walletAmount, ubAmount);

        if (amount <= 0) return { success: false, error: `No ${from.toLowerCase()} bonus balance to convert` };


        const fromWageringReq = from === 'CASINO' ? 'casinoBonusWageringRequired' : 'sportsBonusWageringRequired';
        const fromWageringDone = from === 'CASINO' ? 'casinoBonusWageringDone' : 'sportsBonusWageringDone';
        const toWageringReq = to === 'CASINO' ? 'casinoBonusWageringRequired' : 'sportsBonusWageringRequired';
        const toWageringDone = to === 'CASINO' ? 'casinoBonusWageringDone' : 'sportsBonusWageringDone';
        const sourceWageringReq = parseFloat((user[fromWageringReq] || 0).toString());
        const sourceWageringDone = parseFloat((user[fromWageringDone] || 0).toString());
        const wageringReq = Math.max(sourceWageringReq, ubWageringReq);
        const wageringDone = Math.min(wageringReq, Math.max(sourceWageringDone, ubWageringDone));

        await (prisma as any).$transaction(async (tx: any) => {
            // 1. Move wallet balance + wagering counters
            const userUpdate: Record<string, any> = {
                [toWallet]: { increment: amount },
                [toWageringReq]: { increment: wageringReq },
                [toWageringDone]: { increment: wageringDone },
            };

            if (from === 'CASINO' && (user.fiatBonus || 0) > 0) {
                userUpdate.fiatBonus = 0;
            }

            const sourceSplitWalletAmount = parseFloat((user[fromWallet] || 0).toString());
            if (sourceSplitWalletAmount > 0) {
                userUpdate[fromWallet] = { decrement: Math.min(sourceSplitWalletAmount, amount) };
            }
            if (sourceWageringReq > 0) {
                userUpdate[fromWageringReq] = { decrement: Math.min(sourceWageringReq, wageringReq) };
            }
            if (sourceWageringDone > 0) {
                userUpdate[fromWageringDone] = { decrement: Math.min(sourceWageringDone, wageringDone) };
            }

            await tx.user.update({
                where: { id: userId },
                data: userUpdate,
            });

            // 2. Flip each UserBonus record
            if (activeBonuses.length > 0) {
                for (const ub of activeBonuses) {
                    await tx.userBonus.update({
                        where: { id: ub.id },
                        data: { applicableTo: to },
                    });
                }
            }

            // 3. Transaction log
            await tx.transaction.create({
                data: {
                    userId,
                    amount,
                    type: 'BONUS_TYPE_SWITCH',
                    status: 'APPROVED',
                    remarks: `Admin switched bonus type: ${from} → ${to} (₹${amount.toFixed(2)}) by admin #${adminId}`,
                    adminId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });

            // 4. Audit log
            await tx.auditLog.create({
                data: {
                    adminId,
                    action: 'BONUS_TYPE_CONVERT',
                    details: { userId, from, to, amount, wageringReq, wageringDone },
                },
            });
        });

        revalidatePath(`/dashboard/users/${userId}`);
        return { success: true, amount, from, to };
    } catch (error: any) {
        console.error('convertBonusType error:', error);
        return { success: false, error: error?.message || 'Failed to convert bonus type' };
    }
}

function roundTo2(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
