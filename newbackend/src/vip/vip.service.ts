import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateVipApplicationDto, ReviewVipApplicationDto, UpdateVipTierDto } from './dto/vip.dto';

@Injectable()
export class VipService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── USER: Submit VIP application ───────────────────────────────────────
    async applyForVip(
        userId: number,
        dto: CreateVipApplicationDto,
        meta: { ipAddress?: string; userAgent?: string },
    ) {
        const existing = await this.prisma.vipApplication.findUnique({
            where: { userId },
        });

        if (existing) {
            if (['PENDING', 'UNDER_REVIEW'].includes(existing.status)) {
                throw new ConflictException(
                    'You already have a pending VIP application. Our team will contact you soon.',
                );
            }
            if (existing.status === 'APPROVED') {
                throw new ConflictException('You are already a VIP member.');
            }
            // REJECTED — allow re-apply
            return this.prisma.vipApplication.update({
                where: { userId },
                data: {
                    status: 'PENDING',
                    message: dto.message ?? null,
                    currentPlatform: dto.currentPlatform ?? null,
                    platformUsername: dto.platformUsername ?? null,
                    monthlyVolume: dto.monthlyVolume ?? null,
                    reviewedBy: null,
                    reviewNotes: null,
                    reviewedAt: null,
                    assignedTier: null,
                    ipAddress: meta.ipAddress ?? null,
                    userAgent: meta.userAgent ?? null,
                },
                select: { id: true, status: true, createdAt: true },
            });
        }

        return this.prisma.vipApplication.create({
            data: {
                userId,
                message: dto.message ?? null,
                currentPlatform: dto.currentPlatform ?? null,
                platformUsername: dto.platformUsername ?? null,
                monthlyVolume: dto.monthlyVolume ?? null,
                ipAddress: meta.ipAddress ?? null,
                userAgent: meta.userAgent ?? null,
            },
            select: { id: true, status: true, createdAt: true },
        });
    }

    // ─── USER: Get own application status ───────────────────────────────────
    async getMyApplication(userId: number) {
        const app = await this.prisma.vipApplication.findUnique({
            where: { userId },
            select: {
                id: true,
                status: true,
                message: true,
                currentPlatform: true,
                monthlyVolume: true,
                reviewNotes: true,
                reviewedAt: true,
                assignedTier: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return app ?? null;
    }

    // ─── USER: Get VIP status (tier + benefits) ─────────────────────────────
    async getMyVipStatus(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                vipTier: true,
                totalDeposited: true,
                totalWagered: true,
                createdAt: true,
            },
        });
        if (!user) throw new NotFoundException('User not found');

        // Load tier settings from SystemConfig
        const tierSettings = await this.getVipTierSettings();
        const currentTierConfig = tierSettings.find(t => t.key === user.vipTier) || null;

        // Find next tier
        const tierOrder = ['NONE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
        const currentIdx = tierOrder.indexOf(user.vipTier);
        const nextTierKey = currentIdx < tierOrder.length - 1 ? tierOrder[currentIdx + 1] : null;
        const nextTierConfig = nextTierKey ? tierSettings.find(t => t.key === nextTierKey) || null : null;

        return {
            tier: user.vipTier,
            tierConfig: currentTierConfig,
            nextTier: nextTierConfig,
            totalDeposited: user.totalDeposited,
            totalWagered: user.totalWagered,
            memberSince: user.createdAt,
        };
    }

    // ─── ADMIN: List all applications ───────────────────────────────────────
    async listApplications(status?: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = status ? { status: status as any } : {};

        const [applications, total] = await this.prisma.$transaction([
            this.prisma.vipApplication.findMany({
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
                            createdAt: true,
                            balance: true,
                            totalDeposited: true,
                            totalWagered: true,
                            vipTier: true,
                            kycStatus: true,
                        },
                    },
                },
            }),
            this.prisma.vipApplication.count({ where }),
        ]);

        return { applications, total, page, limit, pages: Math.ceil(total / limit) };
    }

    // ─── ADMIN: Get single application ──────────────────────────────────────
    async getApplication(id: number) {
        const app = await this.prisma.vipApplication.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phoneNumber: true,
                        balance: true,
                        totalDeposited: true,
                        totalWagered: true,
                        vipTier: true,
                        createdAt: true,
                        kycStatus: true,
                    },
                },
            },
        });
        if (!app) throw new NotFoundException('VIP application not found');
        return app;
    }

    // ─── ADMIN: Review (approve/reject/under-review) ─────────────────────────
    async reviewApplication(id: number, adminId: number, dto: ReviewVipApplicationDto) {
        const app = await this.prisma.vipApplication.findUnique({ where: { id } });
        if (!app) throw new NotFoundException('VIP application not found');

        if (app.status === 'APPROVED' && dto.status === 'APPROVED') {
            throw new BadRequestException('Application is already approved.');
        }

        const tier = dto.assignedTier || 'SILVER';

        // If approving, also update the user's vipTier
        if (dto.status === 'APPROVED') {
            await this.prisma.$transaction([
                this.prisma.vipApplication.update({
                    where: { id },
                    data: {
                        status: 'APPROVED',
                        reviewedBy: adminId,
                        reviewNotes: dto.reviewNotes ?? null,
                        reviewedAt: new Date(),
                        assignedTier: tier as any,
                    },
                }),
                this.prisma.user.update({
                    where: { id: app.userId },
                    data: { vipTier: tier as any },
                }),
            ]);
            return { success: true, message: `Application approved with ${tier} tier.` };
        }

        // If rejecting, reset user tier to NONE
        if (dto.status === 'REJECTED') {
            await this.prisma.$transaction([
                this.prisma.vipApplication.update({
                    where: { id },
                    data: {
                        status: 'REJECTED',
                        reviewedBy: adminId,
                        reviewNotes: dto.reviewNotes ?? null,
                        reviewedAt: new Date(),
                        assignedTier: null,
                    },
                }),
                this.prisma.user.update({
                    where: { id: app.userId },
                    data: { vipTier: 'NONE' },
                }),
            ]);
            return { success: true, message: 'Application rejected.' };
        }

        // Under review — just update status
        return this.prisma.vipApplication.update({
            where: { id },
            data: {
                status: dto.status as any,
                reviewedBy: adminId,
                reviewNotes: dto.reviewNotes ?? null,
                reviewedAt: new Date(),
            },
        });
    }

    // ─── ADMIN: List VIP members ────────────────────────────────────────────
    async listVipMembers(page = 1, limit = 20, tier?: string, search?: string) {
        const skip = (page - 1) * limit;
        const where: any = { vipTier: { not: 'NONE' } };

        if (tier && tier !== 'ALL') {
            where.vipTier = tier;
        }
        if (search) {
            where.OR = [
                { username: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [members, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { totalDeposited: 'desc' },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    phoneNumber: true,
                    vipTier: true,
                    balance: true,
                    totalDeposited: true,
                    totalWagered: true,
                    kycStatus: true,
                    createdAt: true,
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        return { members, total, page, limit, pages: Math.ceil(total / limit) };
    }

    // ─── ADMIN: Update user's VIP tier ──────────────────────────────────────
    async updateUserTier(userId: number, dto: UpdateVipTierDto, adminId: number) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        await this.prisma.user.update({
            where: { id: userId },
            data: { vipTier: dto.tier as any },
        });

        return { success: true, message: `User ${user.username} tier updated to ${dto.tier}.` };
    }

    // ─── ADMIN: Dashboard stats ──────────────────────────────────────────────
    async getStats() {
        const [total, pending, underReview, approved, rejected, transfer] =
            await this.prisma.$transaction([
                this.prisma.vipApplication.count(),
                this.prisma.vipApplication.count({ where: { status: 'PENDING' } }),
                this.prisma.vipApplication.count({ where: { status: 'UNDER_REVIEW' } }),
                this.prisma.vipApplication.count({ where: { status: 'APPROVED' } }),
                this.prisma.vipApplication.count({ where: { status: 'REJECTED' } }),
                this.prisma.vipApplication.count({ where: { status: 'TRANSFER_REQUESTED' } }),
            ]);

        // Tier distribution
        const [silver, gold, platinum, diamond] = await this.prisma.$transaction([
            this.prisma.user.count({ where: { vipTier: 'SILVER' } }),
            this.prisma.user.count({ where: { vipTier: 'GOLD' } }),
            this.prisma.user.count({ where: { vipTier: 'PLATINUM' } }),
            this.prisma.user.count({ where: { vipTier: 'DIAMOND' } }),
        ]);

        return {
            total, pending, underReview, approved, rejected, transfer,
            tierDistribution: { silver, gold, platinum, diamond, total: silver + gold + platinum + diamond },
        };
    }

    // ─── VIP Tier Settings (from SystemConfig) ──────────────────────────────
    async getVipTierSettings() {
        const record = await this.prisma.systemConfig.findUnique({
            where: { key: 'VIP_TIER_SETTINGS' },
        });
        if (!record?.value) return DEFAULT_VIP_TIER_SETTINGS;
        try {
            return JSON.parse(record.value);
        } catch {
            return DEFAULT_VIP_TIER_SETTINGS;
        }
    }
}

// Default tier configs
const DEFAULT_VIP_TIER_SETTINGS = [
    { key: 'SILVER',   name: 'Silver',   color: '#94A3B8', lossbackPct: 5,  reloadBonusPct: 2,  priorityWithdrawal: false, dedicatedHost: false, freeWithdrawals: false, minDeposit: 50000 },
    { key: 'GOLD',     name: 'Gold',     color: '#F59E0B', lossbackPct: 10, reloadBonusPct: 5,  priorityWithdrawal: true,  dedicatedHost: false, freeWithdrawals: true,  minDeposit: 200000 },
    { key: 'PLATINUM', name: 'Platinum', color: '#8B5CF6', lossbackPct: 15, reloadBonusPct: 8,  priorityWithdrawal: true,  dedicatedHost: true,  freeWithdrawals: true,  minDeposit: 500000 },
    { key: 'DIAMOND',  name: 'Diamond',  color: '#3B82F6', lossbackPct: 20, reloadBonusPct: 12, priorityWithdrawal: true,  dedicatedHost: true,  freeWithdrawals: true,  minDeposit: 1000000 },
];
