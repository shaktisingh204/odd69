import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CrmService {
    constructor(private prisma: PrismaService) { }

    async getCustomerSegments() {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // 1. VIP Users (Deposit > 50000 OR Balance > 100000)
        // Note: Total deposit calculation might be expensive. Let's use Balance or a flagged field if possible.
        // For now, let's use Balance > 100000 as a proxy for VIP.
        const vipCount = await this.prisma.user.count({
            where: { balance: { gte: 100000 } }
        });

        // 2. New Users (Joined < 7 days)
        const newUsersCount = await this.prisma.user.count({
            where: { createdAt: { gte: sevenDaysAgo } }
        });

        // 3. active Users (Login or Update in last 7 days - Proxy via updatedAt)
        const activeCount = await this.prisma.user.count({
            where: { updatedAt: { gte: sevenDaysAgo } }
        });

        // 4. Churned Users (No update in 30 days)
        const churnedCount = await this.prisma.user.count({
            where: { updatedAt: { lt: thirtyDaysAgo } }
        });

        return {
            vip: vipCount,
            new: newUsersCount,
            active: activeCount,
            churned: churnedCount,
            total: await this.prisma.user.count()
        };
    }

    async getSegmentUsers(segment: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        let where: any = {};

        switch (segment) {
            case 'VIP':
                where = { balance: { gte: 100000 } };
                break;
            case 'NEW':
                where = { createdAt: { gte: sevenDaysAgo } };
                break;
            case 'ACTIVE':
                where = { updatedAt: { gte: sevenDaysAgo } };
                break;
            case 'CHURNED':
                where = { updatedAt: { lt: thirtyDaysAgo } };
                break;
            default:
                break;
        }

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: { id: true, username: true, email: true, balance: true, createdAt: true, updatedAt: true },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            this.prisma.user.count({ where })
        ]);

        return {
            users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async sendNotification(segment: string, message: string) {
        // Mock implementation
        // Real impl would queue Type 1 (In-App), Type 2 (Email), Type 3 (Push)
        return {
            success: true,
            message: `Queued notification for ${segment} segment`,
            preview: message
        };
    }
}
