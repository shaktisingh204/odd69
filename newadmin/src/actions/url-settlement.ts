'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import nodemailer from 'nodemailer';
import {
    EMAIL_TEMPLATE_SETTINGS_KEY,
    mergeEmailTemplateSettings,
    resolveManagedEmailTemplate,
} from '@/lib/email-template-config';

export interface UserSettlementRow {
    userId: number;
    username: string;
    email: string;
    phoneNumber: string | null;
    isBanned: boolean;
    currentBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalBonus: number;
    totalBonusConverts: number;
    netAdjustment: number; // positive = owe user, negative = user owes house
    selected: boolean;
    customAdjustment: number | null;
}

export interface SettlementSummary {
    totalUsers: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalBonus: number;
    totalAdjustment: number;
    usersOwed: number;  // users with positive adjustment
    usersOwing: number; // users with negative adjustment
}

/**
 * Search for users by referral code / agent code / username search.
 * This is used to populate the URL/source selector.
 */
export async function getAvailableReferrers() {
    try {
        // Get all users who have referred at least one other user
        const referrers = await prisma.$queryRawUnsafe(`
            SELECT DISTINCT u.id, u.username, u.email, u.role,
                   COUNT(r.id)::int AS referred_count
            FROM "User" u
            INNER JOIN "User" r ON r."referrerId" = u.id
            GROUP BY u.id, u.username, u.email, u.role
            ORDER BY referred_count DESC
            LIMIT 200
        `) as any[];

        return {
            success: true,
            referrers: referrers.map((r: any) => ({
                id: r.id,
                username: r.username,
                email: r.email,
                role: r.role,
                referredCount: Number(r.referred_count),
            })),
        };
    } catch (error: any) {
        console.error('getAvailableReferrers error:', error);
        return { success: false, referrers: [] };
    }
}

/**
 * Get all users referred by a specific referrer OR search by username/email
 * and compute their settlement position.
 */
export async function getUsersForSettlement(params: {
    mode: 'referrer' | 'search';
    referrerId?: number;
    searchQuery?: string;
    dateFrom?: string;
    dateTo?: string;
}) {
    try {
        const { mode, referrerId, searchQuery, dateFrom, dateTo } = params;

        let userIds: number[] = [];

        if (mode === 'referrer' && referrerId) {
            const rows = await prisma.$queryRawUnsafe(
                `SELECT id FROM "User" WHERE "referrerId" = $1`,
                referrerId,
            ) as any[];
            userIds = rows.map((r: any) => Number(r.id));
        } else if (mode === 'search' && searchQuery) {
            const q = `%${searchQuery}%`;
            const rows = await prisma.$queryRawUnsafe(
                `SELECT id FROM "User" WHERE username ILIKE $1 OR email ILIKE $2 OR "phoneNumber" ILIKE $3 LIMIT 100`,
                q, q, q,
            ) as any[];
            userIds = rows.map((r: any) => Number(r.id));
        }

        if (userIds.length === 0) {
            return { success: true, users: [], summary: emptySummary() };
        }

        // Load all users
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                username: true,
                email: true,
                phoneNumber: true,
                balance: true,
                isBanned: true,
            } as any,
        });

        // Build date filter for transactions
        const dateFilter: any = {};
        if (dateFrom) dateFilter.gte = new Date(dateFrom);
        if (dateTo) {
            const dt = new Date(dateTo);
            dt.setHours(23, 59, 59, 999);
            dateFilter.lte = dt;
        }
        const hasDateFilter = Object.keys(dateFilter).length > 0;

        // Aggregate transactions per user in one query
        const txAgg = await (prisma as any).transaction.groupBy({
            by: ['userId', 'type'],
            where: {
                userId: { in: userIds },
                status: { in: ['APPROVED', 'COMPLETED'] },
                ...(hasDateFilter ? { createdAt: dateFilter } : {}),
            },
            _sum: { amount: true },
            _count: { id: true },
        });

        // Build a map: userId -> { DEPOSIT, WITHDRAWAL, BONUS, BONUS_CONVERT, ... }
        const txMap: Record<number, Record<string, number>> = {};
        for (const row of txAgg as any[]) {
            const uid = Number(row.userId);
            if (!txMap[uid]) txMap[uid] = {};
            txMap[uid][row.type] = Number(row._sum?.amount || 0);
        }

        // Build settlement rows
        const rows: UserSettlementRow[] = (users as any[]).map((u: any) => {
            const tx = txMap[u.id] || {};
            const dep = tx['DEPOSIT'] || 0;
            const wdl = tx['WITHDRAWAL'] || 0;
            const bonus = tx['BONUS'] || 0;
            const bonusConvert = tx['BONUS_CONVERT'] || 0;
            const manualCredit = tx['MANUAL_CREDIT'] || 0;
            const manualDebit = tx['MANUAL_DEBIT'] || 0;

            // Net position: what the user should have vs what they do have
            // Simple model: deposits + bonus + manual_credit - withdrawals - manual_debit
            const expectedBalance = dep + bonus + bonusConvert + manualCredit - wdl - manualDebit;
            const actualBalance = Number(u.balance || 0);
            const netAdjustment = parseFloat((actualBalance - expectedBalance).toFixed(2));

            return {
                userId: u.id,
                username: u.username ?? '',
                email: u.email ?? '',
                phoneNumber: u.phoneNumber,
                isBanned: !!(u as any).isBanned,
                currentBalance: actualBalance,
                totalDeposits: dep,
                totalWithdrawals: wdl,
                totalBonus: bonus,
                totalBonusConverts: bonusConvert,
                netAdjustment,
                selected: false,
                customAdjustment: null,
            };
        });

        const summary = computeSummary(rows);
        return { success: true, users: rows, summary };
    } catch (error: any) {
        console.error('getUsersForSettlement error:', error);
        return { success: false, users: [], summary: emptySummary(), error: error?.message };
    }
}

/**
 * Apply the settlement adjustments for selected users.
 * Each entry: { userId, adjustmentAmount, notes }
 */
export async function applySettlementAdjustments(
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
                // Update wallet balance
                (prisma as any).user.update({
                    where: { id: adj.userId },
                    data: {
                        balance: isCredit
                            ? { increment: absAmount }
                            : { decrement: absAmount },
                    },
                }),
                // Log transaction
                (prisma as any).transaction.create({
                    data: {
                        userId: adj.userId,
                        amount: absAmount,
                        type: isCredit ? 'MANUAL_CREDIT' : 'MANUAL_DEBIT',
                        status: 'APPROVED',
                        paymentMethod: 'MANUAL',
                        remarks: `Settlement Adjustment: ${adj.notes || 'URL-based batch settlement'}`,
                        adminId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                }),
                // Audit log
                (prisma as any).auditLog.create({
                    data: {
                        adminId,
                        action: 'SETTLEMENT_ADJUSTMENT',
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
            console.error(`Settlement adjustment failed for user ${adj.userId}:`, error);
            results.push({ userId: adj.userId, success: false, error: error?.message });
        }
    }

    const successCount = results.filter(r => r.success).length;
    revalidatePath('/dashboard/finance/url-settlement');

    return {
        success: true,
        applied: successCount,
        failed: results.length - successCount,
        results,
    };
}

function emptySummary(): SettlementSummary {
    return {
        totalUsers: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalBonus: 0,
        totalAdjustment: 0,
        usersOwed: 0,
        usersOwing: 0,
    };
}

function computeSummary(rows: UserSettlementRow[]): SettlementSummary {
    return {
        totalUsers: rows.length,
        totalDeposits: rows.reduce((s, r) => s + r.totalDeposits, 0),
        totalWithdrawals: rows.reduce((s, r) => s + r.totalWithdrawals, 0),
        totalBonus: rows.reduce((s, r) => s + r.totalBonus, 0),
        totalAdjustment: rows.reduce((s, r) => s + (r.customAdjustment ?? r.netAdjustment), 0),
        usersOwed: rows.filter(r => (r.customAdjustment ?? r.netAdjustment) > 0).length,
        usersOwing: rows.filter(r => (r.customAdjustment ?? r.netAdjustment) < 0).length,
    };
}

/**
 * Ban or unban a set of users (selected from the referral settlement table).
 * Records an audit log entry for each action.
 */
export async function banReferralUsers(
    userIds: number[],
    ban: boolean,
    adminId = 1,
    reason = 'Referral settlement ban',
) {
    if (!userIds.length) return { success: false, error: 'No users provided' };

    const results: Array<{ userId: number; success: boolean; error?: string }> = [];

    for (const uid of userIds) {
        try {
            await (prisma as any).$transaction([
                (prisma as any).user.update({
                    where: { id: uid },
                    data: { isBanned: ban },
                }),
                (prisma as any).auditLog.create({
                    data: {
                        adminId,
                        action: ban ? 'USER_BAN' : 'USER_UNBAN',
                        details: {
                            userId: uid,
                            reason,
                            timestamp: new Date().toISOString(),
                        },
                    },
                }),
            ]);
            results.push({ userId: uid, success: true });

            // Send suspension email when banning (fire-and-forget)
            if (ban) {
                const user = await prisma.user.findUnique({ where: { id: uid }, select: { email: true, username: true } });
                if (user?.email) {
                    sendSettlementSuspensionEmail(user.email, user.username || user.email, reason).catch(() => {});
                }
            }
        } catch (error: any) {
            console.error(`Ban action failed for user ${uid}:`, error);
            results.push({ userId: uid, success: false, error: error?.message });
        }
    }

    const successCount = results.filter(r => r.success).length;
    revalidatePath('/dashboard/finance/url-settlement');

    return {
        success: true,
        affected: successCount,
        failed: results.length - successCount,
        results,
    };
}

// ─── Suspension email helper for referral settlement bans ────────────────────

async function sendSettlementSuspensionEmail(email: string, username: string, reason: string) {
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

        const esc = (v: string) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const year = new Date().getFullYear();
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta name="color-scheme" content="dark"/><title>${esc(template.title)}</title></head>
<body style="margin:0;padding:0;background:#0f0d12;color:#e1c1b8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,Arial,sans-serif;">
<div style="display:none!important;">${esc(template.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0d12;"><tr><td style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;"><tr>
<td style="padding:2px;border-radius:26px;background:linear-gradient(135deg,rgba(248,113,113,0.35),rgba(239,192,131,0.08) 40%,rgba(126,200,248,0.05));">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:24px;overflow:hidden;background:#1a171e;">
<tr><td style="padding:36px 32px 28px;background:linear-gradient(160deg,rgba(120,30,30,0.4),rgba(60,45,45,0.3) 30%,rgba(26,23,30,1) 70%);">
  <div style="margin-bottom:18px;"><span style="display:inline-block;padding:6px 14px;border-radius:999px;border:1px solid rgba(248,113,113,0.25);background:rgba(248,113,113,0.1);color:#f87171;font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">${esc(template.eyebrow)}</span></div>
  <h1 style="margin:0 0 12px;color:#fff;font-size:28px;font-weight:900;line-height:1.12;">${esc(template.title)}</h1>
  <p style="margin:0;color:#c9bfb6;font-size:14px;line-height:1.7;">${esc(template.lead)}</p>
  <div style="margin-top:24px;padding:22px 24px;border-radius:18px;background:rgba(15,13,18,0.7);border:1px solid rgba(248,113,113,0.1);">
    <div style="color:#8d8a89;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Account status</div>
    <div style="margin-top:8px;color:#fff;font-size:30px;font-weight:900;">Suspended</div>
    <div style="margin-top:8px;color:#b8b0a8;font-size:13px;">${esc(now)}</div>
    <div style="margin-top:14px;"><span style="display:inline-block;padding:7px 16px;border-radius:999px;font-size:12px;font-weight:800;text-transform:uppercase;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.22);color:#f87171;">Suspended</span></div>
  </div>
</td></tr>
<tr><td style="padding:28px 32px 32px;">
  <p style="margin:0 0 16px;color:#c9bfb6;font-size:14px;line-height:1.7;">${esc(template.bodyPrimary)}</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-radius:16px;background:rgba(40,36,44,0.95);border:1px solid rgba(248,113,113,0.1);">
    <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Account</td><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#b8b0a8;font-size:14px;font-weight:700;text-align:right;">${esc(username)}</td></tr>
    <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Status</td><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#f87171;font-size:14px;font-weight:700;text-align:right;">Suspended</td></tr>
    <tr><td style="padding:14px 18px;color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Reason</td><td style="padding:14px 18px;color:#f5c563;font-size:14px;font-weight:700;text-align:right;">${esc(reason)}</td></tr>
  </table>
  ${template.noteBody ? `<div style="margin-top:20px;padding:18px 20px;border-radius:16px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.16);"><div style="color:#b8b0a8;font-size:13px;line-height:1.7;">${esc(template.noteBody)}</div></div>` : ''}
  ${template.ctaLabel ? `<div style="margin:24px 0 16px;text-align:center;"><a href="${esc(siteUrl + '/support')}" style="display:inline-block;min-width:220px;padding:16px 36px;border-radius:14px;background:linear-gradient(135deg,#e37d32,#f5a623,#efc083);color:#0f0d12!important;font-size:15px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;">${esc(template.ctaLabel)}</a></div>` : ''}
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
        console.error(`[Settlement] Suspension email failed for ${email}:`, (e as Error).message);
    }
}
