'use server'

import { prisma } from '@/lib/db';
import { uploadToCloudflare } from '@/actions/upload';
import { buildSmtpTestEmailHtml } from '@/lib/email-theme';
import {
    DEFAULT_WEBSITE_URL,
    EMAIL_TEMPLATE_SETTINGS_KEY,
    ManagedEmailTemplateSettingsMap,
    mergeEmailTemplateSettings,
    resolveManagedEmailTemplate,
} from '@/lib/email-template-config';
import { revalidatePath } from 'next/cache';
import nodemailer from 'nodemailer';

// ─── Send Test Email (internal — no backend required) ─────────────────────────

export async function sendTestEmail(to: string) {
    try {
        if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
            return { success: false, message: 'Invalid recipient email address.' };
        }

        // Load SMTP settings from SystemConfig
        const [smtpRecord, platformRecord, templateRecord] = await Promise.all([
            prisma.systemConfig.findUnique({ where: { key: 'SMTP_SETTINGS' } }),
            prisma.systemConfig.findUnique({ where: { key: 'PLATFORM_NAME' } }),
            prisma.systemConfig.findUnique({ where: { key: EMAIL_TEMPLATE_SETTINGS_KEY } }),
        ]);

        if (!smtpRecord?.value) {
            return { success: false, message: 'SMTP settings not configured. Save your SMTP credentials first.' };
        }

        let smtp: Record<string, string>;
        try {
            smtp = JSON.parse(smtpRecord.value);
        } catch {
            return { success: false, message: 'SMTP settings are corrupted. Please re-save them.' };
        }

        const { host, port, user, password, fromName, fromEmail, secure } = smtp;
        const platformName = platformRecord?.value?.trim() || 'Platform';
        const websiteUrl = DEFAULT_WEBSITE_URL.replace(/\/+$/, '');
        const templateSettings = mergeEmailTemplateSettings(templateRecord?.value);
        const smtpTemplate = resolveManagedEmailTemplate('smtp-test', templateSettings, {
            platformName,
            siteUrl: websiteUrl,
            senderEmail: fromEmail || user,
        });
        if (!host || !user || !password) {
            return { success: false, message: 'SMTP host, username, or password is missing.' };
        }

        const transporter = nodemailer.createTransport({
            host,
            port: parseInt(port || '587', 10),
            secure: secure === 'true',
            auth: { user, pass: password },
        });

        await transporter.sendMail({
            from: `"${fromName || 'Admin'}" <${fromEmail || user}>`,
            to,
            subject: smtpTemplate.subject,
            html: buildSmtpTestEmailHtml(platformName, smtpTemplate),
        });

        return { success: true, message: `Test email delivered to ${to} via ${host}.` };
    } catch (err: any) {
        console.error('[sendTestEmail]', err);
        return { success: false, message: err?.message || 'SMTP connection failed. Check host, port, and credentials.' };
    }
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export async function getAuditLogs(limit = 100) {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return { success: true, data: JSON.parse(JSON.stringify(logs)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch audit logs' };
    }
}

// ─── System Config ────────────────────────────────────────────────────────────

export async function getSystemConfig() {
    try {
        const configs = await prisma.systemConfig.findMany();
        const configMap = configs.reduce((acc: any, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        return { success: true, data: configMap };
    } catch (error) {
        return { success: false, error: 'Failed to fetch system config' };
    }
}

export async function getEmailTemplateSettings() {
    try {
        const [templateRecord, platformRecord] = await Promise.all([
            prisma.systemConfig.findUnique({ where: { key: EMAIL_TEMPLATE_SETTINGS_KEY } }),
            prisma.systemConfig.findUnique({ where: { key: 'PLATFORM_NAME' } }),
        ]);

        return {
            success: true,
            data: mergeEmailTemplateSettings(templateRecord?.value),
            platformName: platformRecord?.value?.trim() || 'Platform',
            websiteUrl: DEFAULT_WEBSITE_URL.replace(/\/+$/, ''),
        };
    } catch (error) {
        return { success: false, error: 'Failed to load email template settings' };
    }
}

export async function saveEmailTemplateSettings(settings: ManagedEmailTemplateSettingsMap) {
    try {
        const payload = JSON.stringify(settings);

        await prisma.systemConfig.upsert({
            where: { key: EMAIL_TEMPLATE_SETTINGS_KEY },
            update: { value: payload },
            create: { key: EMAIL_TEMPLATE_SETTINGS_KEY, value: payload },
        });

        revalidatePath('/dashboard/messaging/email/templates');
        revalidatePath('/dashboard/messaging/email/campaigns');
        revalidatePath('/dashboard/settings/config');

        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to save email template settings' };
    }
}

export async function updateSystemConfig(configData: Record<string, string>) {
    try {
        const updates = Object.entries(configData).map(([key, value]) =>
            prisma.systemConfig.upsert({
                where: { key },
                update: { value },
                create: { key, value }
            })
        );
        await prisma.$transaction(updates);
        revalidatePath('/dashboard/settings/config');
        revalidatePath('/dashboard/finance/deposit-settings');
        revalidatePath('/dashboard/finance/gateways');
        revalidatePath('/dashboard/sports/api-setup');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update system config' };
    }
}

const SPORTS_API_TYPE_KEY = 'SPORTS_API_TYPE';

export type SportsApiType = 'TURNKEY' | 'SPORTSRADAR';

export async function getSportsApiType() {
    try {
        const record = await prisma.systemConfig.findUnique({
            where: { key: SPORTS_API_TYPE_KEY }
        });

        const value = record?.value === 'SPORTSRADAR' ? 'SPORTSRADAR' : 'TURNKEY';
        return { success: true, data: value as SportsApiType };
    } catch (error) {
        return { success: false, error: 'Failed to fetch sports API type' };
    }
}

export async function updateSportsApiType(apiType: SportsApiType) {
    try {
        await prisma.systemConfig.upsert({
            where: { key: SPORTS_API_TYPE_KEY },
            update: { value: apiType },
            create: { key: SPORTS_API_TYPE_KEY, value: apiType }
        });

        revalidatePath('/dashboard/sports/api-setup');
        revalidatePath('/dashboard/sports');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update sports API type' };
    }
}

export async function uploadPublicImage(formData: FormData) {
    try {
        const file = formData.get('file') as File | null;
        const folderName = (formData.get('folder') as string) || 'uploads';

        if (!file) {
            return { success: false, error: 'No file provided' };
        }

        const cloudflareForm = new FormData();
        cloudflareForm.append('file', file);
        cloudflareForm.append('folder', folderName);

        const result = await uploadToCloudflare(cloudflareForm);
        if (!result.success || !result.url) {
            return { success: false, error: result.error || 'Cloudflare upload failed' };
        }

        return { success: true, url: result.url };
    } catch (error) {
        return { success: false, error: 'Failed to upload image' };
    }
}

// ─── Contact Settings (stored in SystemConfig table) ─────────────────────────

const CONTACT_KEY = 'CONTACT_SETTINGS';

export async function getContactSettings() {
    try {
        const record = await prisma.systemConfig.findUnique({ where: { key: CONTACT_KEY } });
        const defaults = {
            whatsappNumber: '',
            whatsappLabel: 'Support',
            whatsappDefaultMessage: 'Hi, I need help with my account.',
            telegramHandle: '',
            telegramLink: '',
            emailAddress: '',
            whatsappEnabled: true,
            telegramEnabled: true,
            emailEnabled: true,
        };
        const data = record?.value ? { ...defaults, ...JSON.parse(record.value) } : defaults;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: 'Failed to load contact settings' };
    }
}

export async function saveContactSettings(settings: Record<string, any>) {
    try {
        await prisma.systemConfig.upsert({
            where: { key: CONTACT_KEY },
            update: { value: JSON.stringify(settings) },
            create: { key: CONTACT_KEY, value: JSON.stringify(settings) },
        });
        revalidatePath('/dashboard/settings/contact');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to save contact settings' };
    }
}

// ─── System Health ────────────────────────────────────────────────────────────

export async function getSystemHealth() {
    try {
        const start = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const latency = Date.now() - start;
        return {
            success: true,
            data: {
                database: 'UP',
                redis: 'UP',
                uptime: process.uptime(),
                latency,
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        return {
            success: true,
            data: {
                database: 'DOWN',
                redis: 'UNKNOWN',
                uptime: process.uptime(),
                latency: 0,
                timestamp: new Date().toISOString()
            }
        };
    }
}

// ─── VIP Applications ─────────────────────────────────────────────────────────

export async function getVipApplications(page = 1, limit = 20, status?: string) {
    try {
        const skip = (page - 1) * limit;
        const where: any = {};
        if (status) where.status = status;

        const [applications, total] = await Promise.all([
            prisma.vipApplication.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            phoneNumber: true,
                            balance: true,
                            createdAt: true,
                            kycStatus: true,
                        }
                    }
                }
            }),
            prisma.vipApplication.count({ where })
        ]);

        return {
            success: true,
            data: {
                applications: JSON.parse(JSON.stringify(applications)),
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error('VIP applications error:', error);
        return { success: false, error: 'Failed to fetch VIP applications' };
    }
}

export async function getVipStats() {
    try {
        const [total, pending, underReview, approved, rejected, transfer] = await Promise.all([
            prisma.vipApplication.count(),
            prisma.vipApplication.count({ where: { status: 'PENDING' } }),
            prisma.vipApplication.count({ where: { status: 'UNDER_REVIEW' } }),
            prisma.vipApplication.count({ where: { status: 'APPROVED' } }),
            prisma.vipApplication.count({ where: { status: 'REJECTED' } }),
            prisma.vipApplication.count({ where: { status: 'TRANSFER_REQUESTED' } }),
        ]);
        return { success: true, data: { total, pending, underReview, approved, rejected, transfer } };
    } catch (error) {
        return { success: false, error: 'Failed to fetch VIP stats' };
    }
}

export async function reviewVipApplication(id: number, status: string, reviewNotes?: string, adminId = 1, assignedTier?: string) {
    try {
        const app = await prisma.vipApplication.findUnique({ where: { id } });
        if (!app) return { success: false, error: 'Application not found' };

        const tier = assignedTier || 'SILVER';

        if (status === 'APPROVED') {
            await prisma.$transaction([
                prisma.vipApplication.update({
                    where: { id },
                    data: {
                        status: status as any,
                        reviewNotes,
                        reviewedBy: adminId,
                        reviewedAt: new Date(),
                        assignedTier: tier as any,
                    }
                }),
                prisma.user.update({
                    where: { id: app.userId },
                    data: { vipTier: tier as any },
                }),
                prisma.auditLog.create({
                    data: { adminId, action: 'REVIEW_VIP_APPLICATION', details: { applicationId: id, status, assignedTier: tier, reviewNotes } }
                }),
            ]);
        } else if (status === 'REJECTED') {
            await prisma.$transaction([
                prisma.vipApplication.update({
                    where: { id },
                    data: {
                        status: status as any,
                        reviewNotes,
                        reviewedBy: adminId,
                        reviewedAt: new Date(),
                        assignedTier: null,
                    }
                }),
                prisma.user.update({
                    where: { id: app.userId },
                    data: { vipTier: 'NONE' },
                }),
                prisma.auditLog.create({
                    data: { adminId, action: 'REVIEW_VIP_APPLICATION', details: { applicationId: id, status, reviewNotes } }
                }),
            ]);
        } else {
            await prisma.$transaction([
                prisma.vipApplication.update({
                    where: { id },
                    data: { status: status as any, reviewNotes, reviewedBy: adminId, reviewedAt: new Date() }
                }),
                prisma.auditLog.create({
                    data: { adminId, action: 'REVIEW_VIP_APPLICATION', details: { applicationId: id, status, reviewNotes } }
                }),
            ]);
        }

        revalidatePath('/dashboard/cms/vip-applications');
        revalidatePath('/dashboard/cms/vip-members');
        return { success: true };
    } catch (error) {
        console.error('[reviewVipApplication]', error);
        return { success: false, error: 'Failed to update VIP application' };
    }
}

// ─── VIP Members ─────────────────────────────────────────────────────────────

export async function getVipMembers(page = 1, limit = 20, tier?: string, search?: string) {
    try {
        const skip = (page - 1) * limit;
        const where: any = { vipTier: { not: 'NONE' } };
        if (tier && tier !== 'ALL') where.vipTier = tier;
        if (search) {
            where.OR = [
                { username: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [members, total] = await Promise.all([
            prisma.user.findMany({
                where, skip, take: limit,
                orderBy: { totalDeposited: 'desc' },
                select: {
                    id: true, username: true, email: true, phoneNumber: true,
                    vipTier: true, balance: true, totalDeposited: true, totalWagered: true,
                    kycStatus: true, createdAt: true,
                },
            }),
            prisma.user.count({ where }),
        ]);

        return {
            success: true,
            data: {
                members: JSON.parse(JSON.stringify(members)),
                total, page, pages: Math.ceil(total / limit),
            },
        };
    } catch (error) {
        return { success: false, error: 'Failed to fetch VIP members' };
    }
}

export async function getVipMemberStats() {
    try {
        const [silver, gold, platinum, diamond] = await Promise.all([
            prisma.user.count({ where: { vipTier: 'SILVER' } }),
            prisma.user.count({ where: { vipTier: 'GOLD' } }),
            prisma.user.count({ where: { vipTier: 'PLATINUM' } }),
            prisma.user.count({ where: { vipTier: 'DIAMOND' } }),
        ]);
        return { success: true, data: { silver, gold, platinum, diamond, total: silver + gold + platinum + diamond } };
    } catch (error) {
        return { success: false, error: 'Failed to fetch VIP member stats' };
    }
}

export async function updateUserVipTier(userId: number, tier: string, adminId = 1) {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, vipTier: true } });
        if (!user) return { success: false, error: 'User not found' };

        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { vipTier: tier as any },
            }),
            prisma.auditLog.create({
                data: { adminId, action: 'UPDATE_VIP_TIER', details: { userId, previousTier: user.vipTier, newTier: tier } }
            }),
        ]);

        revalidatePath('/dashboard/cms/vip-members');
        revalidatePath('/dashboard/cms/vip-applications');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update VIP tier' };
    }
}

// ─── VIP Tier Settings ───────────────────────────────────────────────────────

const VIP_TIER_SETTINGS_KEY = 'VIP_TIER_SETTINGS';

const DEFAULT_VIP_TIER_SETTINGS = [
    { key: 'SILVER',   name: 'Silver',   color: '#94A3B8', lossbackPct: 5,  reloadBonusPct: 2,  priorityWithdrawal: false, dedicatedHost: false, freeWithdrawals: false, minDeposit: 50000 },
    { key: 'GOLD',     name: 'Gold',     color: '#F59E0B', lossbackPct: 10, reloadBonusPct: 5,  priorityWithdrawal: true,  dedicatedHost: false, freeWithdrawals: true,  minDeposit: 200000 },
    { key: 'PLATINUM', name: 'Platinum', color: '#8B5CF6', lossbackPct: 15, reloadBonusPct: 8,  priorityWithdrawal: true,  dedicatedHost: true,  freeWithdrawals: true,  minDeposit: 500000 },
    { key: 'DIAMOND',  name: 'Diamond',  color: '#3B82F6', lossbackPct: 20, reloadBonusPct: 12, priorityWithdrawal: true,  dedicatedHost: true,  freeWithdrawals: true,  minDeposit: 1000000 },
];

export async function getVipTierSettings() {
    try {
        const record = await prisma.systemConfig.findUnique({ where: { key: VIP_TIER_SETTINGS_KEY } });
        const data = record?.value ? JSON.parse(record.value) : DEFAULT_VIP_TIER_SETTINGS;
        return { success: true, data };
    } catch (error) {
        return { success: true, data: DEFAULT_VIP_TIER_SETTINGS };
    }
}

export async function saveVipTierSettings(settings: any[]) {
    try {
        await prisma.systemConfig.upsert({
            where: { key: VIP_TIER_SETTINGS_KEY },
            update: { value: JSON.stringify(settings) },
            create: { key: VIP_TIER_SETTINGS_KEY, value: JSON.stringify(settings) },
        });
        revalidatePath('/dashboard/cms/vip-settings');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to save VIP tier settings' };
    }
}

// ─── Bonus Redemptions (Prisma UserBonus table) ───────────────────────────────

// Exclude BACKFILL_ and REPAIR_ bonus codes from all admin bonus queries
const EXCLUDE_BONUS_PREFIXES = ['BACKFILL_', 'REPAIR_'];

function buildBonusCodeExclusionFilter() {
    return {
        NOT: EXCLUDE_BONUS_PREFIXES.map(prefix => ({
            bonusCode: { startsWith: prefix }
        }))
    };
}

export async function getBonusStats() {
    try {
        const exclusion = buildBonusCodeExclusionFilter();
        const [total, active, completed, forfeited] = await Promise.all([
            prisma.userBonus.count({ where: { ...exclusion } }),
            prisma.userBonus.count({ where: { status: 'ACTIVE', ...exclusion } }),
            prisma.userBonus.count({ where: { status: 'COMPLETED', ...exclusion } }),
            prisma.userBonus.count({ where: { status: 'FORFEITED', ...exclusion } }),
        ]);
        const activeSum = await prisma.userBonus.aggregate({
            where: { status: 'ACTIVE', ...exclusion },
            _sum: { bonusAmount: true, wageringDone: true, wageringRequired: true }
        });
        return {
            success: true,
            data: {
                total, active, completed, forfeited,
                totalBonusValue: activeSum._sum.bonusAmount || 0,
                totalWageringDone: activeSum._sum.wageringDone || 0,
                totalWageringRequired: activeSum._sum.wageringRequired || 0,
            }
        };
    } catch {
        return { success: false, error: 'Failed to fetch bonus stats' };
    }
}

export async function getBonusRedemptions(filters: {
    page?: number; limit?: number; status?: string; search?: string;
}) {
    try {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const skip = (page - 1) * limit;
        const exclusion = buildBonusCodeExclusionFilter();
        const where: any = { ...exclusion };
        if (filters.status && filters.status !== 'ALL') where.status = filters.status;
        if (filters.search) {
            where.OR = [
                { bonusCode: { contains: filters.search, mode: 'insensitive' } },
                { bonusTitle: { contains: filters.search, mode: 'insensitive' } },
                { user: { username: { contains: filters.search, mode: 'insensitive' } } },
            ];
        }

        const [redemptions, total] = await Promise.all([
            prisma.userBonus.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, username: true, email: true } }
                }
            }),
            prisma.userBonus.count({ where })
        ]);

        return {
            success: true,
            data: {
                redemptions: JSON.parse(JSON.stringify(redemptions)),
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        };
    } catch {
        return { success: false, error: 'Failed to fetch redemptions' };
    }
}

// ─── Purge BACKFILL / REPAIR Bonuses ─────────────────────────────────────────

export async function purgeBackfillRepairBonuses(adminId = 1) {
    try {
        // Hard-delete all UserBonus rows whose code starts with BACKFILL_ or REPAIR_
        const deleted = await prisma.$transaction(
            EXCLUDE_BONUS_PREFIXES.map(prefix =>
                prisma.userBonus.deleteMany({
                    where: { bonusCode: { startsWith: prefix } }
                })
            )
        );
        const total = deleted.reduce((sum, r) => sum + r.count, 0);
        await prisma.auditLog.create({
            data: {
                adminId,
                action: 'PURGE_BACKFILL_REPAIR_BONUSES',
                details: { deletedCount: total, prefixes: EXCLUDE_BONUS_PREFIXES }
            }
        });
        revalidatePath('/dashboard/marketing/bonuses');
        return { success: true, deletedCount: total };
    } catch (err: any) {
        console.error('[purgeBackfillRepairBonuses]', err);
        return { success: false, error: 'Failed to purge bonuses' };
    }
}

export async function adminForfeitBonus(userBonusId: number, adminId = 1) {
    try {
        const bonus = await prisma.userBonus.findUnique({ where: { id: userBonusId } });
        if (!bonus) return { success: false, error: 'Bonus not found' };

        await prisma.$transaction([
            prisma.userBonus.update({
                where: { id: userBonusId },
                data: { status: 'FORFEITED', forfeitedAt: new Date() }
            }),
            // Zero out both bonus and bonus wallet balance
            prisma.user.update({
                where: { id: bonus.userId },
                data: { casinoBonus: { decrement: bonus.bonusAmount }, wageringRequired: 0, wageringDone: 0 }
            }),
            prisma.auditLog.create({
                data: { adminId, action: 'FORFEIT_BONUS', details: { userBonusId, userId: bonus.userId } }
            })
        ]);
        revalidatePath('/dashboard/marketing/bonuses');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to forfeit bonus' };
    }
}

export async function adminCompleteBonus(userBonusId: number, adminId = 1) {
    try {
        const bonus = await prisma.userBonus.findUnique({ where: { id: userBonusId } });
        if (!bonus) return { success: false, error: 'Bonus not found' };

        await prisma.$transaction([
            prisma.userBonus.update({
                where: { id: userBonusId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    wageringDone: bonus.wageringRequired
                }
            }),
            // Convert bonus → real balance
            prisma.user.update({
                where: { id: bonus.userId },
                data: {
                    balance: { increment: bonus.bonusAmount },
                    casinoBonus: { decrement: bonus.bonusAmount },
                    wageringRequired: 0,
                    wageringDone: 0
                }
            }),
            prisma.auditLog.create({
                data: { adminId, action: 'COMPLETE_BONUS', details: { userBonusId, userId: bonus.userId } }
            })
        ]);
        revalidatePath('/dashboard/marketing/bonuses');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to complete bonus' };
    }
}
