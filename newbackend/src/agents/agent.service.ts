import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AgentService {
    constructor(private prisma: PrismaService) { }

    // Get Agent Hierarchy (Downline)
    async getAgentDownline(agentId: number) {
        // Find all users where referrerId is this agentId
        // And recursively find their referrals? 
        // For standard 2-level (Master -> Agent -> User), we can just fetch direct.
        // But let's support deeper if needed. For now, simple direct list.

        const agent = await this.prisma.user.findUnique({
            where: { id: agentId },
            include: {
                referrals: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                        balance: true,
                        exposure: true,
                        referrals: { // Grand-children (Users under Agent)
                            select: {
                                id: true,
                                username: true,
                                role: true,
                                balance: true
                            }
                        }
                    }
                }
            }
        });
        return agent?.referrals || [];
    }

    async createAgent(data: any, creatorId: number) {
        // Creator must be Master or Admin
        const creator = await this.prisma.user.findUnique({ where: { id: creatorId } });
        if (!creator) throw new BadRequestException('Creator not found');

        // Allowed roles to create
        const allowedRoles = ['TECH_MASTER', 'SUPER_ADMIN', 'MASTER'];
        if (!allowedRoles.includes(creator.role)) {
            throw new BadRequestException('Insufficient permissions to create agent');
        }

        // Validate new user role
        if (!['MASTER', 'AGENT'].includes(data.role)) {
            throw new BadRequestException('Invalid role for agent creation');
        }

        // Create User
        const hashedPassword = await bcrypt.hash(data.password, 10);
        return this.prisma.user.create({
            data: {
                username: data.username,
                password: hashedPassword,
                email: data.email,
                phoneNumber: data.phoneNumber,
                role: data.role as any,
                referrerId: creatorId,
                // Initial credit limit or balance can be handled separately
            }
        });
    }

    async getStats(agentId: number) {
        // Aggregate stats for this agent's downline
        // Total Users, Total Turnover, Total PL

        // 1. Get all IDs in downline
        const downline = await this.prisma.user.findMany({
            where: { referrerId: agentId },
            select: { id: true }
        });

        const userIds = downline.map(u => u.id);

        // 2. Aggregate Transactions or Bets? 
        // Bets are in Mongo, might be slow to aggregate across many users here.
        // Quick stats: Balance

        const totalBalance = await this.prisma.user.aggregate({
            where: { id: { in: userIds } },
            _sum: { balance: true, exposure: true }
        });

        return {
            totalUsers: userIds.length,
            totalMarketLiability: totalBalance._sum.exposure || 0,
            totalPlayerBalance: totalBalance._sum.balance || 0
        };
    }
}
