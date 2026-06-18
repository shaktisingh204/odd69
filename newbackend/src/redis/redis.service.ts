import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);

    constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) { }

    onModuleDestroy() {
        this.redisClient.disconnect();
    }

    getClient(): Redis {
        return this.redisClient;
    }

    // --- Rate Limiting (Token Bucket / Rolling Window) ---
    async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
        const now = Date.now();
        const clearBefore = now - (windowSeconds * 1000);

        try {
            const multi = this.redisClient.multi();
            multi.zremrangebyscore(key, 0, clearBefore);
            multi.zadd(key, now, `${now}-${Math.random()}`);
            multi.zcard(key);
            multi.expire(key, windowSeconds);

            const results = await multi.exec();
            // results[2] is the zcard result (count)
            const count = results?.[2]?.[1] as number;

            return count <= limit;
        } catch (error) {
            this.logger.error(`Rate limit check failed for ${key}: ${error.message}`);
            return false; // Fail safe? Or allow? Let's be strict for provider limits.
        }
    }

    // --- Active Market Management ---
    async getActiveMarketCount(): Promise<number> {
        // We can maintain a SET of active market IDs
        return this.redisClient.scard('active_imported_markets');
    }

    async addActiveMarket(marketId: string): Promise<void> {
        await this.redisClient.sadd('active_imported_markets', marketId);
    }

    async removeActiveMarket(marketId: string): Promise<void> {
        await this.redisClient.srem('active_imported_markets', marketId);
        // Also clean up market data
        await this.redisClient.del(`market:${marketId}`);
    }

    async getActiveMarkets(): Promise<string[]> {
        return this.redisClient.smembers('active_imported_markets');
    }

    // --- Locking ---
    async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
        const result = await this.redisClient.set(key, 'LOCKED', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
    }

    async releaseLock(key: string): Promise<void> {
        await this.redisClient.del(key);
    }

    // --- Market Data ---
    async setPacket(key: string, data: any, ttlSeconds: number = 3600): Promise<void> {
        await this.redisClient.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    }

    async getPacket<T>(key: string): Promise<T | null> {
        const data = await this.redisClient.get(key);
        return data ? JSON.parse(data) : null;
    }
}
