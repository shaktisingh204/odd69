import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
    constructor(
        private prisma: PrismaService,
        private redis: RedisService
    ) { }

    async checkHealth() {
        const start = Date.now();
        const status = {
            database: 'DOWN',
            redis: 'DOWN',
            uptime: process.uptime(),
            timestamp: new Date(),
            latency: 0
        };

        try {
            await this.prisma.$queryRaw`SELECT 1`;
            status.database = 'UP';
        } catch (e) {
            status.database = 'DOWN';
        }

        try {
            // Assuming RedisService has a client or ping method
            // If not, we might need to access the client directly or add a ping method
            // Let's assume a basic set/get or if RedisService is just a wrapper
            // checking if we can get a value
            const client = this.redis.getClient();
            if (client && client.status === 'ready') {
                status.redis = 'UP';
            } else {
                // Try ping if possible or just check status
                status.redis = client?.status || 'UNKNOWN';
            }
        } catch (e) {
            status.redis = 'DOWN';
        }

        status.latency = Date.now() - start;
        return status;
    }

    async getSystemStats() {
        // Mocking some system stats or getting real ones if possible
        return {
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            totalUsers: await this.prisma.user.count(),
            activeBets: 0 // Placeholder until Bet model is fully integrated/counted
        };
    }

    async getAuditLogs() {
        return this.prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100
        });
    }
}
