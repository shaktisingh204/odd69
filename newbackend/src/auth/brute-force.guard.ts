import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/** Max failed attempts before lock kicks in */
const MAX_ATTEMPTS = 5;

/** Rolling window to count failures (15 minutes) */
const WINDOW_SECONDS = 15 * 60;

/** How long to lock the account (1 hour) */
const LOCKOUT_SECONDS = 60 * 60;

/**
 * BruteForceGuard
 *
 * Tracks failed login attempts in Redis per identifier (email/phone/username).
 * After MAX_ATTEMPTS failures within WINDOW_SECONDS, the account/IP is locked
 * for LOCKOUT_SECONDS (1 hour). Apply ONLY to POST /auth/login.
 *
 * Usage:
 *   @UseGuards(BruteForceGuard)
 *   @Post('login')
 *   async login(...) { ... }
 *
 * The guard exposes two static helper keys so the controller can call
 * BruteForceGuard.recordFailure(redis, identifier) and
 * BruteForceGuard.clearAttempts(redis, identifier) after login result.
 */
@Injectable()
export class BruteForceGuard implements CanActivate {
    private readonly logger = new Logger(BruteForceGuard.name);

    constructor(private readonly redisService: RedisService) {}

    // ─── Redis key helpers ────────────────────────────────────────────────────

    static lockKey(identifier: string): string {
        return `bf:lock:${identifier.toLowerCase().trim()}`;
    }

    static attemptKey(identifier: string): string {
        return `bf:attempts:${identifier.toLowerCase().trim()}`;
    }

    // ─── Guard logic ──────────────────────────────────────────────────────────

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const identifier: string | undefined = request.body?.identifier;

        // If no identifier, let the controller handle the invalid-body case
        if (!identifier) return true;

        const redis = this.redisService.getClient();
        const lockKey = BruteForceGuard.lockKey(identifier);

        const locked = await redis.get(lockKey);
        if (locked) {
            const ttl = await redis.ttl(lockKey);
            const minutes = Math.ceil(ttl / 60);
            this.logger.warn(`Brute-force lockout for identifier: ${identifier} (${ttl}s remaining)`);
            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    error: 'Too Many Requests',
                    message: `Account temporarily locked due to too many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
                    lockedUntilSeconds: ttl,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        return true;
    }

    // ─── Static helpers (called by AuthController after login result) ─────────

    /**
     * Record a failed login attempt. Locks the account after MAX_ATTEMPTS.
     * Returns: { locked: boolean; attemptsLeft: number }
     */
    static async recordFailure(
        redisService: RedisService,
        identifier: string,
    ): Promise<{ locked: boolean; attemptsLeft: number }> {
        const redis = redisService.getClient();
        const attemptKey = BruteForceGuard.attemptKey(identifier);
        const lockKey = BruteForceGuard.lockKey(identifier);

        // Increment failure count with rolling TTL
        const count = await redis.incr(attemptKey);
        if (count === 1) {
            // First failure — start the window
            await redis.expire(attemptKey, WINDOW_SECONDS);
        }

        if (count >= MAX_ATTEMPTS) {
            // Lock the account
            await redis.set(lockKey, '1', 'EX', LOCKOUT_SECONDS);
            // Clear attempt counter so it resets after lockout expires
            await redis.del(attemptKey);
            return { locked: true, attemptsLeft: 0 };
        }

        return { locked: false, attemptsLeft: MAX_ATTEMPTS - count };
    }

    /**
     * Clear all failure counters on successful login.
     */
    static async clearAttempts(
        redisService: RedisService,
        identifier: string,
    ): Promise<void> {
        const redis = redisService.getClient();
        await redis.del(BruteForceGuard.attemptKey(identifier));
        await redis.del(BruteForceGuard.lockKey(identifier));
    }
}
