import { Injectable, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import { Bonus, BonusDocument } from './schemas/bonus.schema';
import { Bet, BetDocument } from '../bets/schemas/bet.schema';
import { PendingDepositBonus, PendingDepositBonusDocument } from './schemas/pending-deposit-bonus.schema';
import { EventsGateway } from '../events.gateway';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';

// Helper: access new Prisma tables/fields not yet in generated types
const db = (prisma: any) => prisma as any;

// ── Safeguard constants ──────────────────────────────────────────────────────
const MIN_WAGERABLE_BET = 1.0;         // ₹1 minimum bet to count toward wagering
const MAX_DAILY_REDEMPTIONS = 3;       // max bonus codes a user can redeem per 24h
const VALIDATE_RATE_LIMIT = 10;        // max validate calls per IP per 60s
const REDEEM_MUTEX_TTL = 8;            // seconds: mutex lock on redeemBonus
const DEDUP_CACHE_TTL = 3600;          // seconds (1h): idempotency window — prevents replays after lock release
const IP_CLAIM_TTL = 60 * 60 * 24 * 30; // 30 days: per-IP bonus claim memory

export type DepositCurrency = 'INR' | 'CRYPTO';
type UserBonusType = 'CASINO' | 'SPORTS';
type AdminDirectBonusType = 'FIAT_BONUS' | 'CASINO_BONUS' | 'SPORTS_BONUS' | 'CRYPTO_BONUS';

interface BonusRedemptionContext {
    depositCurrency?: DepositCurrency;
    approvedDepositCountBeforeThisDeposit?: number;
    ip?: string; // caller IP for cross-account dedup
}

@Injectable()
export class BonusService {
    private readonly logger = new Logger(BonusService.name);

    constructor(
        @InjectModel(Bonus.name) private bonusModel: Model<BonusDocument>,
        @InjectModel(Bet.name) private betModel: Model<BetDocument>,
        @InjectModel(PendingDepositBonus.name) private pendingBonusModel: Model<PendingDepositBonusDocument>,
        private prisma: PrismaService,
        private eventsGateway: EventsGateway,
        private redisService: RedisService,
        private emailService: EmailService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    //  SAFEGUARD HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /** Normalise raw IP (strip IPv6 prefix, pick first forwarded IP) */
    private normalizeIp(ip: string): string {
        const raw = (ip || '').split(',')[0].trim();
        return raw.replace(/^::ffff:/, '') || 'unknown';
    }

    /**
     * Acquire a per-user Redis mutex to prevent concurrent bonus redemptions.
     * Returns a release function — always call it in a finally block.
     */
    private async acquireRedeemLock(userId: number): Promise<() => Promise<void>> {
        const key = `bonus:lock:redeem:${userId}`;
        const acquired = await this.redisService.acquireLock(key, REDEEM_MUTEX_TTL);
        if (!acquired) {
            throw new BadRequestException('A bonus redemption is already in progress. Please wait a moment and try again.');
        }
        return async () => { await this.redisService.releaseLock(key); };
    }

    /**
     * Check and record an IP-level bonus claim to detect cross-account abuse.
     * Throws if the same IP already claimed this bonus on another account.
     */
    private async checkAndRecordIpClaim(ip: string, bonusId: string, userId: number): Promise<void> {
        if (!ip || ip === 'unknown') return; // skip unknown IPs
        const redis = this.redisService.getClient();
        const key = `bonus:ip:${ip}:${bonusId}`;
        const existing = await redis.get(key);
        if (existing && existing !== String(userId)) {
            this.logger.warn(`[Bonus] IP ${ip} already claimed bonus ${bonusId} under userId ${existing}, blocked for userId ${userId}`);
            throw new BadRequestException('This bonus has already been claimed from your network. Please contact support.');
        }
        // Record this claim (TTL 30 days)
        await redis.set(key, String(userId), 'EX', IP_CLAIM_TTL);
    }

    /**
     * Velocity throttle — block if user has redeemed too many bonuses in last 24h.
     */
    private async checkRedemptionVelocity(userId: number): Promise<void> {
        const key = `bonus:velocity:${userId}`;
        const allowed = await this.redisService.checkRateLimit(key, MAX_DAILY_REDEMPTIONS, 60 * 60 * 24);
        if (!allowed) {
            throw new HttpException(
                `You have reached the maximum of ${MAX_DAILY_REDEMPTIONS} bonus redemptions per day.`,
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
    }

    /**
     * Phone-number cross-account dedup for any bonus type.
     * Returns silently if phone is unset (don't block users without a phone).
     */
    private async checkPhoneDedup(userId: number, bonusId: string): Promise<void> {
        const claimingUser = await db(this.prisma).user.findUnique({
            where: { id: userId },
            select: { phoneNumber: true },
        });
        const phone = claimingUser?.phoneNumber?.trim();
        if (!phone) return;

        const samePhoneUsers = await db(this.prisma).user.findMany({
            where: { phoneNumber: phone, id: { not: userId } },
            select: { id: true },
        });
        if (samePhoneUsers.length === 0) return;

        const samePhoneIds = samePhoneUsers.map((u: any) => u.id);
        const priorClaim = await db(this.prisma).userBonus.findFirst({
            where: { userId: { in: samePhoneIds }, bonusId, status: { not: 'FORFEITED' } },
        });
        if (priorClaim) {
            throw new BadRequestException('This bonus has already been claimed from your mobile number.');
        }
    }

    /**
     * Idempotency dedup cache — if same (userId, bonusCode) succeeded in last 5s, skip re-processing.
     */
    private async checkAndSetDedup(userId: number, bonusCode: string): Promise<boolean> {
        const key = `bonus:dedup:${userId}:${bonusCode}`;
        const redis = this.redisService.getClient();
        const hit = await redis.get(key);
        if (hit) return true; // already processed
        await redis.set(key, '1', 'EX', DEDUP_CACHE_TTL);
        return false;
    }

    public emitWalletRefresh(userId: number, payload: Record<string, any> = {}) {
        this.eventsGateway.emitUserWalletUpdate(userId, payload);
    }

    private getBonusWalletField(applicableTo: string | null | undefined, isCrypto: boolean) {
        if (isCrypto) return 'cryptoBonus';
        return applicableTo === 'SPORTS' ? 'sportsBonus' : 'casinoBonus';
    }

    private getBonusWalletLabel(applicableTo: string | null | undefined, isCrypto: boolean) {
        if (isCrypto) return 'Crypto Bonus';
        return applicableTo === 'SPORTS' ? 'Sports Bonus' : 'Casino Bonus';
    }

    private roundCurrency(value: number) {
        return parseFloat((Number(value || 0)).toFixed(2));
    }

    private getApplicableBonusTypes(type: UserBonusType) {
        return type === 'CASINO' ? ['CASINO', 'BOTH'] : ['SPORTS'];
    }

    private getDirectBonusConfig(type: AdminDirectBonusType) {
        switch (type) {
            case 'FIAT_BONUS':
                return {
                    walletField: 'fiatBonus',
                    walletLabel: 'Fiat Bonus',
                    applicableTo: 'CASINO',
                    bonusCurrency: 'INR',
                    shouldTrackCasinoWagering: true,
                    shouldTrackSportsWagering: false,
                };
            case 'SPORTS_BONUS':
                return {
                    walletField: 'sportsBonus',
                    walletLabel: 'Sports Bonus',
                    applicableTo: 'SPORTS',
                    bonusCurrency: 'INR',
                    shouldTrackCasinoWagering: false,
                    shouldTrackSportsWagering: true,
                };
            case 'CRYPTO_BONUS':
                return {
                    walletField: 'cryptoBonus',
                    walletLabel: 'Crypto Bonus',
                    applicableTo: 'BOTH',
                    bonusCurrency: 'CRYPTO',
                    shouldTrackCasinoWagering: false,
                    shouldTrackSportsWagering: false,
                };
            case 'CASINO_BONUS':
            default:
                return {
                    walletField: 'casinoBonus',
                    walletLabel: 'Casino Bonus',
                    applicableTo: 'CASINO',
                    bonusCurrency: 'INR',
                    shouldTrackCasinoWagering: true,
                    shouldTrackSportsWagering: false,
                };
        }
    }

    private getEligibleBonusSnapshot(
        user: { casinoBonus?: number | null; sportsBonus?: number | null; fiatBonus?: number | null; cryptoBonus?: number | null } | null | undefined,
        applicableTo: string | null | undefined,
        isCrypto: boolean,
        requestedAmount?: number | null,
        conversionCapAmount?: number | null,
    ) {
        const requestedWalletAmount =
            requestedAmount == null ? null : this.roundCurrency(Number(requestedAmount || 0));
        const requestedCreditCap =
            conversionCapAmount == null
                ? null
                : this.roundCurrency(Number(conversionCapAmount || 0));

        if (isCrypto) {
            const cryptoBonus = this.roundCurrency(Number(user?.cryptoBonus || 0));
            const deductibleAmount =
                requestedWalletAmount == null ? cryptoBonus : Math.min(cryptoBonus, requestedWalletAmount);
            const convertibleAmount =
                requestedCreditCap == null
                    ? deductibleAmount
                    : Math.min(deductibleAmount, requestedCreditCap);
            return {
                convertibleAmount,
                deductibleAmount,
                forfeitedAmount: this.roundCurrency(Math.max(0, deductibleAmount - convertibleAmount)),
                deductionData:
                    deductibleAmount > 0
                        ? { cryptoBonus: { decrement: deductibleAmount } }
                        : {},
                walletLabel: 'Crypto Bonus',
            };
        }

        if (applicableTo === 'SPORTS') {
            const sportsBonus = this.roundCurrency(Number(user?.sportsBonus || 0));
            const deductibleAmount =
                requestedWalletAmount == null ? sportsBonus : Math.min(sportsBonus, requestedWalletAmount);
            const convertibleAmount =
                requestedCreditCap == null
                    ? deductibleAmount
                    : Math.min(deductibleAmount, requestedCreditCap);
            return {
                convertibleAmount,
                deductibleAmount,
                forfeitedAmount: this.roundCurrency(Math.max(0, deductibleAmount - convertibleAmount)),
                deductionData:
                    deductibleAmount > 0
                        ? { sportsBonus: { decrement: deductibleAmount } }
                        : {},
                walletLabel: 'Sports Bonus',
            };
        }

        const casinoBonus = this.roundCurrency(Number(user?.casinoBonus || 0));
        const legacyFiatBonus = this.roundCurrency(Number(user?.fiatBonus || 0));
        const totalAvailable = this.roundCurrency(casinoBonus + legacyFiatBonus);
        const deductibleAmount =
            requestedWalletAmount == null ? totalAvailable : Math.min(totalAvailable, requestedWalletAmount);
        const convertibleAmount =
            requestedCreditCap == null
                ? deductibleAmount
                : Math.min(deductibleAmount, requestedCreditCap);
        const cappedCasinoDeduction = this.roundCurrency(
            Math.min(casinoBonus, deductibleAmount),
        );
        const cappedLegacyDeduction = this.roundCurrency(
            Math.max(0, deductibleAmount - cappedCasinoDeduction),
        );

        return {
            convertibleAmount,
            deductibleAmount,
            forfeitedAmount: this.roundCurrency(Math.max(0, deductibleAmount - convertibleAmount)),
            deductionData: {
                ...(cappedCasinoDeduction > 0
                    ? { casinoBonus: { decrement: cappedCasinoDeduction } }
                    : {}),
                ...(cappedLegacyDeduction > 0
                    ? { fiatBonus: { decrement: cappedLegacyDeduction } }
                    : {}),
            },
            walletLabel: 'Casino Bonus',
        };
    }

    private getBonusConversionCapAmount(
        bonus: {
            bonusAmount?: number | null;
            depositAmount?: number | null;
        } | null | undefined,
    ) {
        const bonusAmount = this.roundCurrency(Number(bonus?.bonusAmount || 0));
        const depositAmount = this.roundCurrency(Number(bonus?.depositAmount || 0));

        if (depositAmount > 0) {
            return Math.min(bonusAmount, depositAmount);
        }

        return bonusAmount;
    }

    private buildBonusGrantPaymentDetails(params: {
        source: string;
        bonusCode: string;
        applicableTo: string | null | undefined;
        walletLabel: string;
        bonusCurrency: string | null | undefined;
        depositAmount?: number | null;
        bonusAmount?: number | null;
        wageringRequired?: number | null;
        wageringRequirement?: number | null;
        extra?: Record<string, any>;
    }) {
        const depositAmount = this.roundCurrency(Number(params.depositAmount || 0));
        const bonusAmount = this.roundCurrency(Number(params.bonusAmount || 0));
        const wageringRequired = this.roundCurrency(Number(params.wageringRequired || 0));
        const conversionCapAmount = this.getBonusConversionCapAmount({
            bonusAmount,
            depositAmount,
        });

        return {
            source: params.source,
            bonusCode: params.bonusCode,
            bonusType: params.applicableTo || 'BOTH',
            applicableTo: params.applicableTo || 'BOTH',
            walletLabel: params.walletLabel,
            bonusCurrency: params.bonusCurrency || 'INR',
            depositAmount,
            bonusAmount,
            conversionCapAmount,
            wageringRequired,
            ...(params.wageringRequirement != null
                ? { wageringRequirement: Number(params.wageringRequirement || 0) }
                : {}),
            ...(params.extra || {}),
        };
    }

    private normalizeDepositCurrency(currency?: string): DepositCurrency {
        return currency === 'CRYPTO' ? 'CRYPTO' : 'INR';
    }

    private normalizeBonusTemplateData(data: Record<string, any>) {
        const currency = data.currency === 'CRYPTO' || data.currency === 'BOTH' ? data.currency : 'INR';
        const legacyMinimum = this.roundCurrency(Number(data.minDeposit || 0));
        const minDepositFiat = data.minDepositFiat == null
            ? (currency === 'CRYPTO' ? 0 : legacyMinimum)
            : this.roundCurrency(Number(data.minDepositFiat || 0));
        const minDepositCrypto = data.minDepositCrypto == null
            ? (currency === 'INR' ? 0 : legacyMinimum)
            : this.roundCurrency(Number(data.minDepositCrypto || 0));

        return {
            ...data,
            code: data.code?.toUpperCase?.() ?? data.code,
            currency,
            minDeposit: currency === 'CRYPTO' ? minDepositCrypto : minDepositFiat,
            minDepositFiat,
            minDepositCrypto,
            validFrom: data.validFrom || undefined,
            validUntil: data.validUntil || undefined,
        };
    }

    private getMinimumDepositForCurrency(
        bonus: {
            minDeposit?: number | null;
            minDepositFiat?: number | null;
            minDepositCrypto?: number | null;
        },
        depositCurrency: DepositCurrency,
    ) {
        const legacyMinimum = this.roundCurrency(Number(bonus.minDeposit || 0));
        const fiatMinimum = bonus.minDepositFiat == null
            ? null
            : this.roundCurrency(Number(bonus.minDepositFiat || 0));
        const cryptoMinimum = bonus.minDepositCrypto == null
            ? null
            : this.roundCurrency(Number(bonus.minDepositCrypto || 0));

        if (depositCurrency === 'CRYPTO') return cryptoMinimum ?? legacyMinimum;
        return fiatMinimum ?? legacyMinimum;
    }

    private isBonusCurrencyEligible(bonusCurrency: string | null | undefined, depositCurrency: DepositCurrency) {
        return !bonusCurrency || bonusCurrency === 'BOTH' || bonusCurrency === depositCurrency;
    }

    private async getApprovedDepositCount(userId: number, excludeTransactionId?: number) {
        return this.prisma.transaction.count({
            where: {
                userId,
                type: 'DEPOSIT',
                status: { in: ['APPROVED', 'COMPLETED'] },
                ...(typeof excludeTransactionId === 'number' ? { id: { not: excludeTransactionId } } : {}),
            },
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PENDING DEPOSIT BONUS — store in MongoDB so it works across sessions/devices
    // ─────────────────────────────────────────────────────────────────────────

    async savePendingDepositBonus(userId: number, bonusCode: string) {
        await this.pendingBonusModel.findOneAndUpdate(
            { userId },
            { userId, bonusCode: bonusCode.toUpperCase() },
            { upsert: true, returnDocument: 'after' },
        );
        return { success: true };
    }

    async getPendingDepositBonus(userId: number) {
        const record = await this.pendingBonusModel.findOne({ userId }).lean();
        return record ? { bonusCode: record.bonusCode } : null;
    }

    async clearPendingDepositBonus(userId: number) {
        await this.pendingBonusModel.deleteOne({ userId });
        return { success: true };
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ADMIN: Bonus Template CRUD
    // ─────────────────────────────────────────────────────────────────────────

    async create(data: any) {
        const bonus = new this.bonusModel(this.normalizeBonusTemplateData(data));
        return bonus.save();
    }

    async findAll() {
        return this.bonusModel.find().sort({ createdAt: -1 }).exec();
    }

    async findOne(id: string) {
        return this.bonusModel.findById(id).exec();
    }

    async update(id: string, data: any) {
        return this.bonusModel.findByIdAndUpdate(id, this.normalizeBonusTemplateData(data), { returnDocument: 'after' }).exec();
    }

    async remove(id: string) {
        return this.bonusModel.findByIdAndDelete(id).exec();
    }

    async toggleActive(id: string) {
        const bonus = await this.bonusModel.findById(id);
        if (!bonus) return null;
        bonus.isActive = !bonus.isActive;
        return bonus.save();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  HELPER: Check & expire overdue bonuses for a user
    // ─────────────────────────────────────────────────────────────────────────

    private async expireOverdueUserBonuses(userId: number): Promise<void> {
        const now = new Date();
        const expired = await db(this.prisma).userBonus.findMany({
            where: { userId, status: 'ACTIVE', expiresAt: { lte: now } },
        });
        for (const ub of expired) {
            await this.forfeitBonusById(ub.id, 'Bonus expired');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PUBLIC: Promo Code Validation (preview before deposit)
    // ─────────────────────────────────────────────────────────────────────────

    async validatePromoCode(code: string, userId: number, depositAmount: number, depositCurrency?: string, ip?: string) {
        // ── Guard: IP rate-limit on code probing (10 calls/min) ──────────────────
        if (ip) {
            const normalizedIp = this.normalizeIp(ip);
            const rateLimitKey = `bonus:ratelimit:validate:${normalizedIp}`;
            const allowed = await this.redisService.checkRateLimit(rateLimitKey, VALIDATE_RATE_LIMIT, 60);
            if (!allowed) {
                throw new HttpException('Too many promo code lookups. Please slow down.', HttpStatus.TOO_MANY_REQUESTS);
            }
        }

        const bonus = await this.bonusModel.findOne({ code: code.toUpperCase(), isActive: true });
        if (!bonus) throw new BadRequestException('Invalid or expired promo code');

        const now = new Date();
        const normalizedDepositCurrency = this.normalizeDepositCurrency(depositCurrency);
        const approvedDepositCount = await this.getApprovedDepositCount(userId);
        const isFirstDeposit = approvedDepositCount === 0;

        if (bonus.validFrom && bonus.validFrom > now) throw new BadRequestException('Promo code is not yet active');
        if (bonus.validUntil && bonus.validUntil < now) throw new BadRequestException('Promo code has expired');
        if (bonus.usageLimit > 0 && bonus.usageCount >= bonus.usageLimit)
            throw new BadRequestException('Promo code has reached its usage limit');
        if (!this.isBonusCurrencyEligible(bonus.currency, normalizedDepositCurrency)) {
            throw new BadRequestException(
                bonus.currency === 'CRYPTO'
                    ? 'This bonus is only available for crypto deposits'
                    : 'This bonus is only available for fiat deposits',
            );
        }
        if (bonus.forFirstDepositOnly && !isFirstDeposit) {
            await this.clearPendingDepositBonus(userId);
            throw new BadRequestException('This bonus is only available on your first deposit');
        }
        const minimumDeposit = this.getMinimumDepositForCurrency(bonus, normalizedDepositCurrency);
        if (depositAmount > 0 && depositAmount < minimumDeposit)
            throw new BadRequestException(
                normalizedDepositCurrency === 'CRYPTO'
                    ? `Minimum deposit of $${minimumDeposit} required for this bonus`
                    : `Minimum deposit of ₹${minimumDeposit} required for this bonus`,
            );

        // Check one-time usage enforcement (cannot claim same bonus code twice)
        const alreadyUsed = await db(this.prisma).userBonus.findFirst({
            where: { userId, bonusId: String(bonus._id), status: { not: 'FORFEITED' } }
        });
        if (alreadyUsed) throw new BadRequestException('You have already used this bonus code');

        // Check per-type conflict
        const applicableTo = (bonus as any).applicableTo || 'BOTH';
        const conflictTypes = applicableTo === 'BOTH' ? ['CASINO', 'SPORTS', 'BOTH'] : [applicableTo, 'BOTH'];
        const hasConflict = await db(this.prisma).userBonus.findFirst({
            where: { userId, status: 'ACTIVE', applicableTo: { in: conflictTypes } }
        });

        const bonusAmount = this.calculateBonusAmount(bonus, depositAmount);
        const depositMultiplier = (bonus as any).depositWagerMultiplier ?? 1;
        const expiryDays = (bonus as any).expiryDays ?? 30;

        return {
            valid: true,
            hasConflict: !!hasConflict,
            conflictBonus: hasConflict ? { applicableTo: hasConflict.applicableTo, title: hasConflict.bonusTitle } : null,
            bonus: {
                id: bonus._id,
                code: bonus.code,
                title: bonus.title,
                description: bonus.description,
                type: bonus.type,
                applicableTo,
                currency: bonus.currency,
                percentage: bonus.percentage,
                amount: bonus.amount,
                minDeposit: minimumDeposit,
                minDepositFiat: bonus.minDepositFiat ?? bonus.minDeposit ?? 0,
                minDepositCrypto: bonus.minDepositCrypto ?? bonus.minDeposit ?? 0,
                maxBonus: bonus.maxBonus,
                wageringRequirement: bonus.wageringRequirement,
                depositWagerMultiplier: depositMultiplier,
                expiryDays,
                validUntil: bonus.validUntil,
                forFirstDepositOnly: bonus.forFirstDepositOnly,
            },
            estimatedBonus: bonusAmount,
            wageringRequired: bonusAmount * bonus.wageringRequirement,
            depositWageringRequired: depositAmount * depositMultiplier,
            eligibility: {
                depositCurrency: normalizedDepositCurrency,
                approvedDepositCount,
                isFirstDeposit,
                requiresFirstDeposit: !!bonus.forFirstDepositOnly,
                minDeposit: minimumDeposit,
                minDepositMet: depositAmount >= minimumDeposit,
                minDepositShortfall: Math.max(0, minimumDeposit - depositAmount),
            },
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CORE: Redeem Bonus on Deposit Approval
    // ─────────────────────────────────────────────────────────────────────────

    async redeemBonus(userId: number, bonusCode: string, depositAmount: number, context: BonusRedemptionContext = {}) {
        const code = bonusCode.toUpperCase();

        // ── Guard 1: Idempotency cache (5s dedup) ────────────────────────────
        const alreadyProcessed = await this.checkAndSetDedup(userId, code);
        if (alreadyProcessed) {
            this.logger.log(`[Bonus] Dedup cache hit — skipping duplicate redeemBonus for user ${userId}, code ${code}`);
            return null;
        }

        // ── Guard 2: Redis mutex — prevent concurrent double-redemption ───────
        const releaseLock = await this.acquireRedeemLock(userId);
        try { return await this._redeemBonusInner(userId, code, depositAmount, context); }
        finally { await releaseLock(); }
    }

    /** Inner logic called after lock is acquired */
    private async _redeemBonusInner(userId: number, code: string, depositAmount: number, context: BonusRedemptionContext) {
        const bonus = await this.bonusModel.findOne({ code, isActive: true });
        if (!bonus) {
            this.logger.warn(`[Bonus] Code "${code}" not found or inactive for user ${userId}`);
            return null;
        }

        const now = new Date();
        const normalizedDepositCurrency = this.normalizeDepositCurrency(context.depositCurrency);
        const approvedDepositCount = typeof context.approvedDepositCountBeforeThisDeposit === 'number'
            ? context.approvedDepositCountBeforeThisDeposit
            : await this.getApprovedDepositCount(userId);

        if (bonus.validFrom && bonus.validFrom > now) return null;
        if (bonus.validUntil && bonus.validUntil < now) return null;
        if (bonus.usageLimit > 0 && bonus.usageCount >= bonus.usageLimit) return null;
        if (!this.isBonusCurrencyEligible(bonus.currency, normalizedDepositCurrency)) {
            this.logger.warn(`[Bonus] Code "${code}" is not valid for ${normalizedDepositCurrency} deposits`);
            return null;
        }
        if (bonus.forFirstDepositOnly && approvedDepositCount > 0) {
            this.logger.warn(`[Bonus] Code "${code}" is first-deposit only for user ${userId}`);
            return null;
        }
        const minimumDeposit = this.getMinimumDepositForCurrency(bonus, normalizedDepositCurrency);
        if (depositAmount < minimumDeposit) return null;

        // ── Guard 3: One-time usage check ────────────────────────────────────
        const alreadyUsed = await db(this.prisma).userBonus.findFirst({
            where: { userId, bonusId: String(bonus._id), status: { not: 'FORFEITED' } }
        });
        if (alreadyUsed) {
            this.logger.warn(`[Bonus] User ${userId} already used code "${code}"`);
            return null;
        }

        // ── Guard 4: Phone dedup (same phone on another account) ─────────────
        await this.checkPhoneDedup(userId, String(bonus._id));

        // ── Guard 5: IP cross-account dedup ──────────────────────────────────
        if (context.ip) {
            await this.checkAndRecordIpClaim(this.normalizeIp(context.ip), String(bonus._id), userId);
        }

        // ── Guard 6: Daily velocity throttle ─────────────────────────────────
        await this.checkRedemptionVelocity(userId);

        const applicableTo = (bonus as any).applicableTo || 'BOTH';
        const expiryDays = (bonus as any).expiryDays ?? 30;

        // Forfeit existing active bonus of the same type (user confirmed in UI)
        await this.expireOverdueUserBonuses(userId);
        const conflictTypes = applicableTo === 'BOTH' ? ['CASINO', 'SPORTS', 'BOTH'] : [applicableTo, 'BOTH'];
        const existingConflict = await db(this.prisma).userBonus.findFirst({
            where: { userId, status: 'ACTIVE', applicableTo: { in: conflictTypes } }
        });
        if (existingConflict) {
            await this.forfeitBonusById(existingConflict.id, `Replaced by new bonus "${code}"`);
        }

        const bonusAmount = this.calculateBonusAmount(bonus, depositAmount);
        if (bonusAmount <= 0) return null;

        const wageringRequired = bonusAmount * bonus.wageringRequirement;
        const depositMultiplier = (bonus as any).depositWagerMultiplier ?? 1;
        const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

        // Determine which bonus wallet to credit based on applicableTo + currency
        const isCrypto = bonus.currency === 'CRYPTO';
        // Separate casino/sports bonus wallets (fiat only; crypto still uses cryptoBonus)
        const bonusWalletField = this.getBonusWalletField(applicableTo, isCrypto);
        const walletLabel = this.getBonusWalletLabel(applicableTo, isCrypto);

        // Determine which wagering fields to update based on applicableTo
        const casinoWagerInc = applicableTo === 'SPORTS' ? 0 : wageringRequired;
        const sportsWagerInc = applicableTo === 'SPORTS' ? wageringRequired : 0;

        const result = await this.prisma.$transaction(async (tx: any) => {
            const userBonus = await tx.userBonus.create({
                data: {
                    userId,
                    bonusId: String(bonus._id),
                    bonusCode: code,
                    bonusTitle: bonus.title,
                    bonusCurrency: bonus.currency,
                    applicableTo,
                    depositAmount,
                    bonusAmount,
                    wageringRequired,
                    wageringDone: 0,
                    status: 'ACTIVE',
                    expiresAt,
                },
            });

            const userUpdate: any = {
                [bonusWalletField]: { increment: bonusAmount },
                wageringRequired: { increment: wageringRequired },
                depositWageringRequired: { increment: depositAmount * depositMultiplier },
            };
            if (casinoWagerInc > 0) userUpdate.casinoBonusWageringRequired = { increment: casinoWagerInc };
            if (sportsWagerInc > 0) userUpdate.sportsBonusWageringRequired = { increment: sportsWagerInc };

            await tx.user.update({ where: { id: userId }, data: userUpdate });

            await tx.transaction.create({
                data: {
                    userId,
                    amount: bonusAmount,
                    type: 'BONUS',
                    status: 'APPROVED',
                    paymentMethod: 'BONUS_WALLET',
                    paymentDetails: this.buildBonusGrantPaymentDetails({
                        source: 'PROMO_REDEEM',
                        bonusCode: code,
                        applicableTo,
                        walletLabel,
                        bonusCurrency: bonus.currency,
                        depositAmount,
                        bonusAmount,
                        wageringRequired,
                        wageringRequirement: bonus.wageringRequirement,
                    }),
                    remarks: `${walletLabel}: ${bonus.title} (${code}) — ${bonus.wageringRequirement}x wagering, ${applicableTo} only`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });

            return userBonus;
        });

        await this.bonusModel.findByIdAndUpdate(bonus._id, { $inc: { usageCount: 1 } });

        this.emitWalletRefresh(userId);

        this.logger.log(`[Bonus] User ${userId} redeemed "${code}" → ${walletLabel}: ${bonusAmount}, wagering: ${wageringRequired}, applicableTo: ${applicableTo}`);

        // ── Bonus credited email (fire-and-forget) ───────────────────────
        try {
            const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, username: true } });
            if (user?.email) {
                this.emailService.sendBonusCredited(
                    user.email, user.username || user.email,
                    bonusAmount.toFixed(2), walletLabel,
                    wageringRequired.toFixed(2), code,
                    bonus.currency === 'CRYPTO' ? 'CRYPTO' : 'INR',
                ).catch(() => {});
            }
        } catch (e) {
            this.logger.error(`[Bonus] Bonus credited email failed (non-fatal): ${e.message}`);
        }

        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CORE: Apply deposit wagering lock WITHOUT a promo code
    // ─────────────────────────────────────────────────────────────────────────

    async applyDepositWagering(userId: number, depositAmount: number, multiplier = 1) {
        const req = parseFloat((depositAmount * multiplier).toFixed(2));
        if (req <= 0) return;
        await db(this.prisma).user.update({
            where: { id: userId },
            data: { depositWageringRequired: { increment: req } } as any,
        });
        this.emitWalletRefresh(userId);
        this.logger.log(`[Bonus] Deposit wagering lock applied for user ${userId}: ${depositAmount} × ${multiplier}x = ${req} required`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CORE: Record Wagering Progress (game-type aware)
    //  Called from betting / casino on every bet placed.
    //  gameType: 'CASINO' | 'SPORTS'
    //  betSource: identifies which wallet funded the bet
    //    Sports: 'balance' | 'sportsBonus' | 'sportsBonus+balance'
    //    Casino:  'main' | 'fiatbonus' | 'cryptobonus' | 'usd' | 'crypto'
    //  Deposit wagering ALWAYS progresses (all bets count).
    //  Bonus wagering ONLY progresses when betSource includes bonus funds.
    // ─────────────────────────────────────────────────────────────────────────

    private isBonusBetSource(betSource: string, gameType: 'CASINO' | 'SPORTS'): boolean {
        if (!betSource) return false;
        const src = betSource.toLowerCase();
        if (gameType === 'SPORTS') {
            return src.includes('sportsbonus') || src.includes('sports_bonus');
        }
        // CASINO: fiatbonus or cryptobonus wallet modes
        return src === 'fiatbonus' || src === 'cryptobonus';
    }

    async recordWagering(
        userId: number,
        stakeAmount: number,
        gameType: 'CASINO' | 'SPORTS' = 'SPORTS',
        betSource: string = '',
        bonusStakeAmount?: number,
    ) {
        // ── Guard: Minimum bet size — bets below ₹1 don't count toward wagering ───
        // Prevents micro-bet spamming (e.g. 10,000 × ₹0.50 bets) to game wagering progress.
        if (stakeAmount < MIN_WAGERABLE_BET) {
            this.logger.debug(`[Bonus] Bet ₹${stakeAmount} < min ₹${MIN_WAGERABLE_BET} — skipping wagering for user ${userId}`);
            return;
        }

        await this.expireOverdueUserBonuses(userId);

        const user = await db(this.prisma).user.findUnique({
            where: { id: userId },
            select: {
                depositWageringRequired: true,
                depositWageringDone: true,
                totalWagered: true,
                wageringRequired: true,
                wageringDone: true,
                casinoBonusWageringRequired: true,
                casinoBonusWageringDone: true,
                sportsBonusWageringRequired: true,
                sportsBonusWageringDone: true,
                casinoBonus: true,
                sportsBonus: true,
                fiatBonus: true,
                cryptoBonus: true,
            },
        });
        if (!user) return null;

        const updates: Record<string, any> = {
            totalWagered: { increment: stakeAmount },
        };

        // ── 1. Deposit wagering lock (always applies — all bets count) ───────
        const depReq: number = user.depositWageringRequired ?? 0;
        const depDone: number = user.depositWageringDone ?? 0;
        let depositUnlocked = false;

        if (depReq > 0 && depDone < depReq) {
            const newDepDone = Math.min(depDone + stakeAmount, depReq);
            updates.depositWageringDone = newDepDone;

            if (newDepDone >= depReq) {
                depositUnlocked = true;
                this.logger.log(`[Bonus] User ${userId}: deposit wagering complete — withdrawals unlocked`);
                this.eventsGateway.server.to(`user:${userId}`).emit('depositWageringComplete', {
                    userId,
                    message: '🎉 Deposit wagering complete! You can now withdraw.',
                });
            }
        }

        // ── 2. Bonus wagering — only when bet is from bonus funds ────────────
        // Skip bonus wagering entirely if the bet came from the main wallet
        const shouldTrackBonusWagering = this.isBonusBetSource(betSource, gameType);
        const normalizedBonusStakeAmount = this.roundCurrency(
            Number(
                bonusStakeAmount == null
                    ? (shouldTrackBonusWagering ? stakeAmount : 0)
                    : bonusStakeAmount,
            ),
        );
        const effectiveBonusWagerAmount = this.roundCurrency(
            Math.min(stakeAmount, Math.max(0, normalizedBonusStakeAmount)),
        );

        if (!shouldTrackBonusWagering) {
            this.logger.debug(`[Bonus] User ${userId}: skipping bonus wagering — betSource="${betSource}" is not bonus`);
            // Still apply deposit wagering + totalWagered updates
            if (Object.keys(updates).length > 0) {
                await db(this.prisma).user.update({
                    where: { id: userId },
                    data: updates as any,
                });
            }
            this.emitWalletRefresh(userId);
            return {
                depositWagering: {
                    done: (user.depositWageringDone ?? 0) + stakeAmount,
                    required: user.depositWageringRequired ?? 0,
                    unlocked: depositUnlocked,
                },
                bonusWagering: { casino: null, converted: [] },
            };
        }

        if (effectiveBonusWagerAmount <= 0) {
            this.logger.debug(
                `[Bonus] User ${userId}: skipping strict bonus wagering — no bonus-funded stake recorded for betSource="${betSource}"`,
            );
            if (Object.keys(updates).length > 0) {
                await db(this.prisma).user.update({
                    where: { id: userId },
                    data: updates as any,
                });
            }
            this.emitWalletRefresh(userId);
            return {
                depositWagering: {
                    done: (user.depositWageringDone ?? 0) + stakeAmount,
                    required: user.depositWageringRequired ?? 0,
                    unlocked: depositUnlocked,
                },
                bonusWagering: { casino: null, converted: [] },
            };
        }

        // Find active bonuses that apply to this game type
        const applicableTypes = gameType === 'CASINO'
            ? ['CASINO', 'BOTH']
            : ['SPORTS', 'BOTH'];

        const activeBonuses = await db(this.prisma).userBonus.findMany({
            where: { userId, status: 'ACTIVE', applicableTo: { in: applicableTypes } },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });

        let remainingBonusWagerBudget = effectiveBonusWagerAmount;
        let partialGlobalWagerIncrement = 0;
        let partialCasinoWagerIncrement = 0;
        let partialSportsWagerIncrement = 0;
        const convertedBonuses: any[] = [];

        for (const activeBonus of activeBonuses) {
            if (remainingBonusWagerBudget <= 0) {
                break;
            }

            if ((activeBonus.wageringRequired ?? 0) <= 0) {
                continue;
            }

            const wageringRemaining = this.roundCurrency(
                Math.max(
                    0,
                    Number(activeBonus.wageringRequired || 0) -
                    Number(activeBonus.wageringDone || 0),
                ),
            );
            if (wageringRemaining <= 0) {
                continue;
            }

            const appliedWagerAmount = this.roundCurrency(
                Math.min(remainingBonusWagerBudget, wageringRemaining),
            );
            if (appliedWagerAmount <= 0) {
                continue;
            }

            const newWageringDone = this.roundCurrency(
                Number(activeBonus.wageringDone || 0) + appliedWagerAmount,
            );
            const isComplete = newWageringDone >= activeBonus.wageringRequired;

            const bonusApplicableTo = activeBonus.applicableTo;

            if (isComplete) {
                const isCrypto = activeBonus.bonusCurrency === 'CRYPTO';
                const completedWagering = Math.min(newWageringDone, activeBonus.wageringRequired);

                await db(this.prisma).userBonus.update({
                    where: { id: activeBonus.id },
                    data: { status: 'PENDING_CONVERSION', wageringDone: completedWagering },
                });

                convertedBonuses.push(activeBonus);
                remainingBonusWagerBudget = this.roundCurrency(
                    Math.max(0, remainingBonusWagerBudget - appliedWagerAmount),
                );
                this.logger.log(`[Bonus] User ${userId} completed ${bonusApplicableTo} bonus wagering for "${activeBonus.bonusCode}" — pending admin conversion!`);

                this.eventsGateway.server.to(`user:${userId}`).emit('bonusConverted', {
                    userId,
                    message: `🎉 ${bonusApplicableTo} bonus wagering complete! Awaiting admin approval to move to your ${isCrypto ? 'crypto' : 'main'} wallet.`,
                });

                // ── Wagering complete email (fire-and-forget) ────────────────
                try {
                    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, username: true } });
                    if (user?.email) {
                        this.emailService.sendBonusWagered(
                            user.email, user.username || user.email,
                            activeBonus.bonusTitle || activeBonus.bonusCode,
                            String(activeBonus.bonusAmount),
                            isCrypto ? 'CRYPTO' : 'INR',
                        ).catch(() => {});
                    }
                } catch (e) {
                    this.logger.error(`[Bonus] Wagering email failed (non-fatal): ${e.message}`);
                }
            } else {
                partialGlobalWagerIncrement = this.roundCurrency(
                    partialGlobalWagerIncrement + appliedWagerAmount,
                );
                if (bonusApplicableTo !== 'SPORTS') {
                    partialCasinoWagerIncrement = this.roundCurrency(
                        partialCasinoWagerIncrement + appliedWagerAmount,
                    );
                }
                if (bonusApplicableTo === 'SPORTS') {
                    partialSportsWagerIncrement = this.roundCurrency(
                        partialSportsWagerIncrement + appliedWagerAmount,
                    );
                }
                await db(this.prisma).userBonus.update({
                    where: { id: activeBonus.id },
                    data: { wageringDone: newWageringDone },
                });
                remainingBonusWagerBudget = this.roundCurrency(
                    Math.max(0, remainingBonusWagerBudget - appliedWagerAmount),
                );
            }
        }

        if (partialGlobalWagerIncrement > 0) {
            updates.wageringDone = { increment: partialGlobalWagerIncrement };
        }
        if (partialCasinoWagerIncrement > 0) {
            updates.casinoBonusWageringDone = { increment: partialCasinoWagerIncrement };
        }
        if (partialSportsWagerIncrement > 0) {
            updates.sportsBonusWageringDone = { increment: partialSportsWagerIncrement };
        }

        if (Object.keys(updates).length > 0) {
            await db(this.prisma).user.update({
                where: { id: userId },
                data: updates as any,
            });
        }

        this.emitWalletRefresh(userId);

        return {
            depositWagering: {
                done: (user.depositWageringDone ?? 0) + stakeAmount,
                required: user.depositWageringRequired ?? 0,
                unlocked: depositUnlocked,
                },
                bonusWagering: {
                    casino: activeBonuses.find((b: any) => b.applicableTo === 'CASINO' || b.applicableTo === 'BOTH')
                    ? { done: activeBonuses[0].wageringDone + effectiveBonusWagerAmount, required: activeBonuses[0].wageringRequired }
                    : null,
                    converted: convertedBonuses.map(b => b.bonusCode),
                },
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CORE: Forfeit Bonus (by UserBonus ID)
    // ─────────────────────────────────────────────────────────────────────────

    private async forfeitBonusById(userBonusId: number, reason = 'Forfeited') {
        const ub = await db(this.prisma).userBonus.findUnique({ where: { id: userBonusId } });
        if (!ub || (ub.status !== 'ACTIVE' && ub.status !== 'PENDING_CONVERSION')) return null;

        const isCrypto = ub.bonusCurrency === 'CRYPTO';
        const applicableTo = ub.applicableTo || 'BOTH';

        await this.prisma.$transaction(async (tx: any) => {
            const walletUser = await tx.user.findUnique({
                where: { id: ub.userId },
                select: {
                    casinoBonus: true,
                    sportsBonus: true,
                    fiatBonus: true,
                    cryptoBonus: true,
                },
            });

            await tx.userBonus.update({
                where: { id: userBonusId },
                data: { status: 'FORFEITED', forfeitedAt: new Date() },
            });

            const snapshot = this.getEligibleBonusSnapshot(
                walletUser,
                applicableTo,
                isCrypto,
                ub.bonusAmount,
            );

            // Use the smaller of (bonusAmount stored at grant time) vs (actual wallet snapshot)
            // to ensure wagering counters—set using bonusAmount—are never decremented more than they were incremented.
            const safeWageringDecrement = this.roundCurrency(
                Math.min(ub.wageringRequired, Math.max(0, Number(ub.wageringRequired || 0))),
            );
            const safeDoneDecrement = Math.min(Number(ub.wageringDone || 0), safeWageringDecrement);

            const updateData: any = {
                ...snapshot.deductionData,
                wageringRequired: { decrement: safeWageringDecrement },
                wageringDone: { decrement: safeDoneDecrement },
            };
            if (applicableTo !== 'SPORTS') {
                updateData.casinoBonusWageringRequired = { decrement: safeWageringDecrement };
                updateData.casinoBonusWageringDone = { decrement: safeDoneDecrement };
            }
            if (applicableTo === 'SPORTS') {
                updateData.sportsBonusWageringRequired = { decrement: safeWageringDecrement };
                updateData.sportsBonusWageringDone = { decrement: safeDoneDecrement };
            }

            await tx.user.update({ where: { id: ub.userId }, data: updateData });
        });

        this.emitWalletRefresh(ub.userId);
        this.logger.log(`[Bonus] UserBonus #${userBonusId} forfeited — ${reason}`);
        return ub;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CORE: Forfeit Active Bonus (by type or all)
    // ─────────────────────────────────────────────────────────────────────────

    async forfeitActiveBonus(userId: number, reason = 'Withdrawal requested') {
        // Forfeit all active bonuses
        const activeBonuses = await db(this.prisma).userBonus.findMany({ where: { userId, status: { in: ['ACTIVE', 'PENDING_CONVERSION'] } } });
        for (const ub of activeBonuses) {
            await this.forfeitBonusById(ub.id, reason);
        }
        return activeBonuses;
    }

    async forfeitActiveBonusByType(userId: number, type: 'CASINO' | 'SPORTS', reason = 'User revoked') {
        const applicableTypes = type === 'CASINO' ? ['CASINO', 'BOTH'] : ['SPORTS'];
        const active = await db(this.prisma).userBonus.findFirst({
            where: { userId, status: { in: ['ACTIVE', 'PENDING_CONVERSION'] }, applicableTo: { in: applicableTypes } },
        });
        if (!active) throw new BadRequestException(`No active or pending ${type} bonus found`);
        return this.forfeitBonusById(active.id, reason);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  USER: Get Active Bonuses (split by type) + Progress
    // ─────────────────────────────────────────────────────────────────────────

    async getUserActiveBonuses(userId: number) {
        await this.expireOverdueUserBonuses(userId);

        const [activeBonuses, user] = await Promise.all([
            db(this.prisma).userBonus.findMany({ where: { userId, status: { in: ['ACTIVE', 'PENDING_CONVERSION'] } } }),
            db(this.prisma).user.findUnique({
                where: { id: userId },
                select: { casinoBonus: true, sportsBonus: true, fiatBonus: true, cryptoBonus: true },
            }),
        ]);

        // CASINO and BOTH bonuses → casino slot; SPORTS → sports slot only.
        const casinoBonus = activeBonuses.find((b: any) =>
            b.applicableTo === 'CASINO' || b.applicableTo === 'BOTH'
        ) || null;
        const sportsBonus = activeBonuses.find((b: any) =>
            b.applicableTo === 'SPORTS'
        ) || null;

        const enrichBonus = (b: any, walletField: string) => {
            if (!b) return null;
            const remaining = Math.max(0, b.wageringRequired - b.wageringDone);
            const progressPct = b.wageringRequired > 0
                ? Math.min(100, Math.floor((b.wageringDone / b.wageringRequired) * 100))
                : 0;
            const daysLeft = b.expiresAt
                ? Math.max(0, Math.ceil((new Date(b.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : null;
            // Live wallet balance for this bonus type
            const currentBalance = parseFloat(((user as any)?.[walletField] || 0).toString());
            return { ...b, wageringRemaining: remaining, progressPercent: progressPct, daysLeft, currentBalance };
        };

        // Determine wallet field: casino/BOTH → casinoBonus (plus fiatBonus for backward compat)
        const casinoWalletBalance =
            parseFloat(((user as any)?.casinoBonus || 0).toString()) +
            parseFloat(((user as any)?.fiatBonus || 0).toString());
        const casinoBonusWithBalance = casinoBonus
            ? { ...enrichBonus(casinoBonus, 'casinoBonus'), currentBalance: casinoWalletBalance }
            : null;

        const sportsWalletBalance = parseFloat(((user as any)?.sportsBonus || 0).toString());

        // ── Wallet Balance Fallback ──────────────────────────────────────────
        // If no UserBonus record exists but the user has non-zero bonus wallet
        // fields (e.g. credited directly by admin), return synthetic bonus objects
        // so the frontend can still display the bonus balance.
        let syntheticCasino = casinoBonusWithBalance;
        let syntheticSports = enrichBonus(sportsBonus, 'sportsBonus');

        if (!casinoBonusWithBalance && casinoWalletBalance > 0) {
            syntheticCasino = {
                id: null,
                bonusCode: 'DIRECT_CREDIT',
                bonusTitle: 'Admin Bonus Credit',
                bonusCurrency: 'INR',
                applicableTo: 'CASINO',
                bonusAmount: casinoWalletBalance,
                currentBalance: casinoWalletBalance,
                wageringRequired: 0,
                wageringDone: 0,
                wageringRemaining: 0,
                progressPercent: 100,
                daysLeft: null,
                isEnabled: true,
                status: 'ACTIVE',
                isSynthetic: true,  // flag for frontend to disable revoke/toggle
            };
        }

        if (!syntheticSports && sportsWalletBalance > 0) {
            syntheticSports = {
                id: null,
                bonusCode: 'DIRECT_CREDIT',
                bonusTitle: 'Admin Sports Bonus Credit',
                bonusCurrency: 'INR',
                applicableTo: 'SPORTS',
                bonusAmount: sportsWalletBalance,
                currentBalance: sportsWalletBalance,
                wageringRequired: 0,
                wageringDone: 0,
                wageringRemaining: 0,
                progressPercent: 100,
                daysLeft: null,
                isEnabled: true,
                status: 'ACTIVE',
                isSynthetic: true,
            };
        }

        return {
            casino: syntheticCasino,
            sports: syntheticSports,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  USER: Toggle bonus isEnabled (select / deselect without forfeiting)
    // ─────────────────────────────────────────────────────────────────────────

    async toggleBonusEnabled(userId: number, type: 'CASINO' | 'SPORTS') {
        const applicableTypes = type === 'CASINO' ? ['CASINO', 'BOTH'] : ['SPORTS'];
        const bonus = await db(this.prisma).userBonus.findFirst({
            where: { userId, status: { in: ['ACTIVE', 'PENDING_CONVERSION'] }, applicableTo: { in: applicableTypes } },
        });
        if (!bonus) throw new BadRequestException(`No active or pending ${type} bonus found`);

        const updated = await db(this.prisma).userBonus.update({
            where: { id: bonus.id },
            data: { isEnabled: !bonus.isEnabled },
        });
        this.logger.log(`[Bonus] User ${userId} toggled ${type} bonus → isEnabled: ${updated.isEnabled}`);
        return { id: updated.id, type, isEnabled: updated.isEnabled };
    }

    // Legacy single-bonus getter for backward compat
    async getUserActiveBonus(userId: number) {
        const { casino, sports } = await this.getUserActiveBonuses(userId);
        return casino || sports;
    }

    async getUserBonusHistory(userId: number) {
        return db(this.prisma).userBonus.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ADMIN: Redemptions Management
    // ─────────────────────────────────────────────────────────────────────────

    async getAllRedemptions(page = 1, limit = 20, status?: string, bonusId?: string, search?: string) {
        const skip = (page - 1) * limit;
        const where: any = {};
        if (status && status !== 'ALL') where.status = status;
        if (bonusId) where.bonusId = bonusId;
        if (search) {
            where.OR = [
                { user: { username: { contains: search, mode: 'insensitive' } } },
                { bonusCode: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [redemptions, total] = await Promise.all([
            db(this.prisma).userBonus.findMany({
                where, include: { user: { select: { id: true, username: true, email: true } } },
                orderBy: { createdAt: 'desc' }, skip, take: limit,
            }),
            db(this.prisma).userBonus.count({ where }),
        ]);

        return {
            redemptions,
            total,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async adminForfeitBonus(userBonusId: number, adminId: number) {
        const ub = await db(this.prisma).userBonus.findUnique({ where: { id: userBonusId } });
        if (!ub || (ub.status !== 'ACTIVE' && ub.status !== 'PENDING_CONVERSION')) throw new BadRequestException('Bonus not found or not active');
        return this.forfeitBonusById(userBonusId, `Admin forfeit by admin #${adminId}`);
    }

    async adminCompleteBonus(userBonusId: number, adminId: number) {
        const ub = await db(this.prisma).userBonus.findUnique({ where: { id: userBonusId } });
        if (!ub || (ub.status !== 'ACTIVE' && ub.status !== 'PENDING_CONVERSION')) throw new BadRequestException('Bonus not found or not active');

        const isCrypto = ub.bonusCurrency === 'CRYPTO';
        const mainWalletField = isCrypto ? 'cryptoBalance' : 'balance';
        const applicableTo = ub.applicableTo || 'BOTH';

        // ── Sweep pending bets created with bonus wallet before continuing ──
        const pendingBonusBets = await this.betModel.find({
            userId: ub.userId,
            status: 'PENDING',
            betSource: { $regex: /bonus/i } // Matches "sportsBonus", "sportsBonus+balance", "casinoBonus", etc.
        });

        let realRefundInr = 0;
        let realRefundCrypto = 0;
        let exposureDecrement = 0;

        for (const pBet of pendingBonusBets) {
            const walletStake = Number((pBet as any).walletStakeAmount || 0);
            if (pBet.walletType === 'crypto') {
                realRefundCrypto += walletStake;
            } else {
                realRefundInr += walletStake;
            }
            exposureDecrement += Number(pBet.stake || 0);

            // Void in Mongo
            pBet.status = 'VOID';
            (pBet as any).settledReason = 'Bet was voided by admin due to bonus conversion.';
            (pBet as any).settledAt = new Date();
            await pBet.save();

            // Clear from active bets cache in Redis
            await this.redisService.getClient().srem(`active_bets:${ub.userId}`, pBet._id.toString());
        }

        await this.prisma.$transaction(async (tx: any) => {
            const walletUser = await tx.user.findUnique({
                where: { id: ub.userId },
                select: {
                    casinoBonus: true,
                    sportsBonus: true,
                    fiatBonus: true,
                    cryptoBonus: true,
                },
            });
            const walletSnapshot = this.getEligibleBonusSnapshot(
                walletUser,
                applicableTo,
                isCrypto,
                ub.bonusAmount,
                this.getBonusConversionCapAmount(ub),
            );
            await tx.userBonus.update({
                where: { id: userBonusId },
                data: { status: 'COMPLETED', wageringDone: ub.wageringRequired, completedAt: new Date() },
            });

            // ── Also forfeit all other ACTIVE or PENDING_CONVERSION bonuses for this user since we just reset their wallets ──
            await tx.userBonus.updateMany({
                where: { 
                    userId: ub.userId,
                    id: { not: userBonusId },
                    status: { in: ['ACTIVE', 'PENDING_CONVERSION'] }
                },
                data: {
                    status: 'FORFEITED',
                    forfeitedAt: new Date()
                }
            });

            let finalBalanceIncrement = 0;
            let finalCryptoIncrement = 0;
            if (walletSnapshot.convertibleAmount > 0) {
                if (mainWalletField === 'cryptoBalance') finalCryptoIncrement += walletSnapshot.convertibleAmount;
                else finalBalanceIncrement += walletSnapshot.convertibleAmount;
            }
            finalBalanceIncrement += realRefundInr;
            finalCryptoIncrement += realRefundCrypto;

            const updateData: any = {
                wageringRequired: 0,
                wageringDone: 0,
                casinoBonusWageringRequired: 0,
                casinoBonusWageringDone: 0,
                sportsBonusWageringRequired: 0,
                sportsBonusWageringDone: 0,
                casinoBonus: 0,
                sportsBonus: 0,
                fiatBonus: 0,
                cryptoBonus: 0,
            };

            if (finalBalanceIncrement > 0) updateData.balance = { increment: finalBalanceIncrement };
            if (finalCryptoIncrement > 0) updateData.cryptoBalance = { increment: finalCryptoIncrement };
            if (exposureDecrement > 0) updateData.exposure = { decrement: exposureDecrement };

            await tx.user.update({ where: { id: ub.userId }, data: updateData });
            if (walletSnapshot.convertibleAmount > 0) {
                await tx.transaction.create({
                    data: {
                        userId: ub.userId,
                        amount: walletSnapshot.convertibleAmount,
                        type: 'BONUS_CONVERT',
                        status: 'APPROVED',
                        paymentMethod: 'BONUS_WALLET',
                        paymentDetails: {
                            source: 'ADMIN_COMPLETE',
                            bonusCode: ub.bonusCode,
                            bonusType: applicableTo,
                            walletLabel: walletSnapshot.walletLabel,
                            bonusAmount: ub.bonusAmount,
                            deductionAmount: walletSnapshot.deductibleAmount,
                            conversionCapAmount: this.getBonusConversionCapAmount(ub),
                            forfeitedAmount: walletSnapshot.forfeitedAmount,
                            destinationWallet: isCrypto ? 'CRYPTO_WALLET' : 'MAIN_WALLET',
                        },
                        remarks: `Admin force-completed bonus: ${ub.bonusCode} by admin #${adminId}${walletSnapshot.forfeitedAmount > 0 ? `, capped at ${walletSnapshot.convertibleAmount}` : ''}`,
                        adminId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                });
            }
        });

        this.emitWalletRefresh(ub.userId);
    }

    async convertBonusBalance(userId: number, type: UserBonusType) {
        await this.expireOverdueUserBonuses(userId);

        const applicableTypes = this.getApplicableBonusTypes(type);
        const [activeBonus, user] = await Promise.all([
            // Only fetch ACTIVE bonuses — PENDING_CONVERSION requires admin approval and cannot be self-converted
            db(this.prisma).userBonus.findFirst({
                where: { userId, status: 'ACTIVE', applicableTo: { in: applicableTypes } },
            }),
            db(this.prisma).user.findUnique({
                where: { id: userId },
                select: {
                    balance: true,
                    casinoBonus: true,
                    sportsBonus: true,
                    fiatBonus: true,
                    cryptoBonus: true,
                    wageringRequired: true,
                    wageringDone: true,
                    casinoBonusWageringRequired: true,
                    casinoBonusWageringDone: true,
                    sportsBonusWageringRequired: true,
                    sportsBonusWageringDone: true,
                },
            }),
        ]);

        if (!user) {
            throw new BadRequestException('User not found');
        }

        if (!activeBonus) {
            // Check if there's a PENDING_CONVERSION bonus and give a specific error
            const pendingBonus = await db(this.prisma).userBonus.findFirst({
                where: { userId, status: 'PENDING_CONVERSION', applicableTo: { in: applicableTypes } },
            });
            if (pendingBonus) {
                throw new BadRequestException(
                    `Your ${type.toLowerCase()} bonus is awaiting admin approval. You will be notified once it is converted to your main wallet.`,
                );
            }
            throw new BadRequestException(
                `No tracked active ${type.toLowerCase()} bonus found to convert. Please refresh your wallet or contact support.`,
            );
        }

        const wageringRemaining = Math.max(0, Number(activeBonus.wageringRequired || 0) - Number(activeBonus.wageringDone || 0));
        if (wageringRemaining > 0) {
            throw new BadRequestException(`Complete your ${type.toLowerCase()} bonus wagering before moving it to the main wallet`);
        }

        const walletSnapshot = this.getEligibleBonusSnapshot(
            user,
            activeBonus.applicableTo || type,
            false,
            activeBonus.bonusAmount,
            this.getBonusConversionCapAmount(activeBonus),
        );
        if (walletSnapshot.convertibleAmount <= 0) {
            throw new BadRequestException(`No ${walletSnapshot.walletLabel.toLowerCase()} balance available to move`);
        }

        await this.prisma.$transaction(async (tx: any) => {
            if (activeBonus) {
                await tx.userBonus.update({
                    where: { id: activeBonus.id },
                    data: {
                        status: 'COMPLETED',
                        wageringDone: activeBonus.wageringRequired,
                        completedAt: new Date(),
                    },
                });
            }

            const updateData: any = {
                balance: { increment: walletSnapshot.convertibleAmount },
                ...walletSnapshot.deductionData,
            };

            if (activeBonus && Number(activeBonus.wageringRequired || 0) > 0) {
                updateData.wageringRequired = { decrement: activeBonus.wageringRequired };
                updateData.wageringDone = { decrement: Math.min(activeBonus.wageringDone, activeBonus.wageringRequired) };

                if (type === 'CASINO') {
                    updateData.casinoBonusWageringRequired = { decrement: activeBonus.wageringRequired };
                    updateData.casinoBonusWageringDone = { decrement: Math.min(activeBonus.wageringDone, activeBonus.wageringRequired) };
                } else {
                    updateData.sportsBonusWageringRequired = { decrement: activeBonus.wageringRequired };
                    updateData.sportsBonusWageringDone = { decrement: Math.min(activeBonus.wageringDone, activeBonus.wageringRequired) };
                }
            }

            await tx.user.update({
                where: { id: userId },
                data: updateData,
            });

            await tx.transaction.create({
                data: {
                    userId,
                    amount: walletSnapshot.convertibleAmount,
                    type: 'BONUS_CONVERT',
                    status: 'APPROVED',
                    paymentMethod: 'BONUS_WALLET',
                    paymentDetails: {
                        source: 'USER_REQUEST',
                        bonusCode: activeBonus?.bonusCode || null,
                        bonusType: type,
                        walletLabel: walletSnapshot.walletLabel,
                        bonusAmount: activeBonus?.bonusAmount || walletSnapshot.deductibleAmount,
                        deductionAmount: walletSnapshot.deductibleAmount,
                        conversionCapAmount: activeBonus ? this.getBonusConversionCapAmount(activeBonus) : walletSnapshot.convertibleAmount,
                        forfeitedAmount: walletSnapshot.forfeitedAmount,
                        destinationWallet: 'MAIN_WALLET',
                    },
                    remarks: `${walletSnapshot.walletLabel} moved to main wallet${activeBonus?.bonusCode ? `: ${activeBonus.bonusCode}` : ''}${walletSnapshot.forfeitedAmount > 0 ? `, capped at ${walletSnapshot.convertibleAmount}` : ''}`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        });

        this.emitWalletRefresh(userId);

        return {
            success: true,
            type,
            amount: walletSnapshot.convertibleAmount,
            walletLabel: walletSnapshot.walletLabel,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ADMIN: Give bonus directly to a user
    // ─────────────────────────────────────────────────────────────────────────

    async adminGiveBonus(
        adminId: number,
        userId: number,
        payload: {
            bonusCode?: string;
            customAmount?: number;
            bonusType?: AdminDirectBonusType;
            amount?: number;
            title?: string;
            wageringRequirement?: number;
        },
    ) {
        if (payload.bonusType) {
            return this.adminGiveDirectBonus(adminId, userId, payload);
        }

        const code = String(payload.bonusCode || '').toUpperCase().trim();
        const customAmount = payload.customAmount;
        const bonus = await this.bonusModel.findOne({ code });
        if (!bonus) throw new BadRequestException(`Bonus code "${code}" not found`);

        const depositAmount = customAmount || 0;
        let bonusAmount = customAmount || this.calculateBonusAmount(bonus, depositAmount);
        if (bonusAmount <= 0) throw new BadRequestException('Cannot compute a non-zero bonus amount.');

        const applicableTo = (bonus as any).applicableTo || 'BOTH';
        const expiryDays = (bonus as any).expiryDays ?? 30;
        const wageringRequired = bonusAmount * bonus.wageringRequirement;
        const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
        const isCrypto = bonus.currency === 'CRYPTO';
        const bonusWalletField = this.getBonusWalletField(applicableTo, isCrypto);
        const walletLabel = this.getBonusWalletLabel(applicableTo, isCrypto);

        const casinoWagerInc = applicableTo === 'SPORTS' ? 0 : wageringRequired;
        const sportsWagerInc = applicableTo === 'SPORTS' ? wageringRequired : 0;

        await this.prisma.$transaction(async (tx: any) => {
            await tx.userBonus.create({
                data: {
                    userId,
                    bonusId: String(bonus._id),
                    bonusCode: code,
                    bonusTitle: bonus.title,
                    bonusCurrency: bonus.currency,
                    applicableTo,
                    depositAmount,
                    bonusAmount,
                    wageringRequired,
                    wageringDone: 0,
                    status: 'ACTIVE',
                    expiresAt,
                },
            });

            const userUpdate: any = {
                [bonusWalletField]: { increment: bonusAmount },
                wageringRequired: { increment: wageringRequired },
            };
            if (casinoWagerInc > 0) userUpdate.casinoBonusWageringRequired = { increment: casinoWagerInc };
            if (sportsWagerInc > 0) userUpdate.sportsBonusWageringRequired = { increment: sportsWagerInc };

            await tx.user.update({ where: { id: userId }, data: userUpdate });

            await tx.transaction.create({
                data: {
                    userId,
                    amount: bonusAmount,
                    type: 'BONUS',
                    status: 'APPROVED',
                    adminId,
                    paymentMethod: 'BONUS_WALLET',
                    paymentDetails: this.buildBonusGrantPaymentDetails({
                        source: 'ADMIN_TEMPLATE',
                        bonusCode: code,
                        applicableTo,
                        walletLabel,
                        bonusCurrency: bonus.currency,
                        depositAmount,
                        bonusAmount,
                        wageringRequired,
                        wageringRequirement: bonus.wageringRequirement,
                        extra: {
                            adminId,
                        },
                    }),
                    remarks: `Manual bonus grant: ${bonus.title} (${code}) — by admin #${adminId}`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        });

        await this.bonusModel.findByIdAndUpdate(bonus._id, { $inc: { usageCount: 1 } });

        this.emitWalletRefresh(userId);
        this.logger.log(`[Bonus] Admin #${adminId} manually granted "${code}" (${bonusAmount}) to user #${userId}, applicableTo: ${applicableTo}`);

        return { success: true, bonusAmount, bonusCode: code };
    }

    private async adminGiveDirectBonus(
        adminId: number,
        userId: number,
        payload: {
            bonusType?: AdminDirectBonusType;
            amount?: number;
            title?: string;
            wageringRequirement?: number;
        },
    ) {
        const bonusType = payload.bonusType as AdminDirectBonusType;
        const amount = this.roundCurrency(Number(payload.amount || 0));
        if (amount <= 0) throw new BadRequestException('Bonus amount must be greater than zero');

        const config = this.getDirectBonusConfig(bonusType);
        const wageringRequirement = Math.max(0, Number(payload.wageringRequirement || 0));
        const wageringRequired = this.roundCurrency(amount * wageringRequirement);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const bonusTitle = (payload.title || `${config.walletLabel} Manual Credit`).trim();
        const bonusCode = `ADMIN_${bonusType}`;

        await this.prisma.$transaction(async (tx: any) => {
            await tx.userBonus.create({
                data: {
                    userId,
                    bonusId: `admin_direct_${bonusType.toLowerCase()}`,
                    bonusCode,
                    bonusTitle,
                    bonusCurrency: config.bonusCurrency,
                    applicableTo: config.applicableTo,
                    depositAmount: 0,
                    bonusAmount: amount,
                    wageringRequired,
                    wageringDone: 0,
                    status: 'ACTIVE',
                    expiresAt,
                },
            });

            const userUpdate: any = {
                [config.walletField]: { increment: amount },
                wageringRequired: { increment: wageringRequired },
            };

            if (config.shouldTrackCasinoWagering && wageringRequired > 0) {
                userUpdate.casinoBonusWageringRequired = { increment: wageringRequired };
            }
            if (config.shouldTrackSportsWagering && wageringRequired > 0) {
                userUpdate.sportsBonusWageringRequired = { increment: wageringRequired };
            }

            await tx.user.update({
                where: { id: userId },
                data: userUpdate,
            });

            await tx.transaction.create({
                data: {
                    userId,
                    amount,
                    type: 'BONUS',
                    status: 'APPROVED',
                    adminId,
                    paymentMethod: 'BONUS_WALLET',
                    paymentDetails: this.buildBonusGrantPaymentDetails({
                        source: 'ADMIN_DIRECT',
                        bonusCode,
                        applicableTo: config.applicableTo,
                        walletLabel: config.walletLabel,
                        bonusCurrency: config.bonusCurrency,
                        depositAmount: 0,
                        bonusAmount: amount,
                        wageringRequired,
                        wageringRequirement,
                        extra: {
                            adminId,
                            adminDirectBonusType: bonusType,
                        },
                    }),
                    remarks: `Manual ${config.walletLabel} credit: ${bonusTitle} by admin #${adminId}`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        });

        this.emitWalletRefresh(userId);
        this.logger.log(
            `[Bonus] Admin #${adminId} manually granted ${amount} to user #${userId} as ${bonusType} (${config.walletLabel}), wagering=${wageringRequired}`,
        );

        return {
            success: true,
            bonusAmount: amount,
            bonusCode,
            bonusType,
            walletLabel: config.walletLabel,
        };
    }

    async getBonusStats() {
        const [active, completed, forfeited, expired, bonusValueAgg, wageringDoneAgg, wageringRequiredAgg] = await Promise.all([
            db(this.prisma).userBonus.count({ where: { status: 'ACTIVE' } }),
            db(this.prisma).userBonus.count({ where: { status: 'COMPLETED' } }),
            db(this.prisma).userBonus.count({ where: { status: 'FORFEITED' } }),
            db(this.prisma).userBonus.count({ where: { status: 'EXPIRED' } }),
            db(this.prisma).userBonus.aggregate({ _sum: { bonusAmount: true } }),
            db(this.prisma).userBonus.aggregate({ _sum: { wageringDone: true } }),
            db(this.prisma).userBonus.aggregate({ _sum: { wageringRequired: true } }),
        ]);

        return {
            active,
            completed,
            forfeited,
            expired,
            totalBonusValue: bonusValueAgg._sum?.bonusAmount || 0,
            totalWageringDone: wageringDoneAgg._sum?.wageringDone || 0,
            totalWageringRequired: wageringRequiredAgg._sum?.wageringRequired || 0,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  SIGNUP: Show welcome bonus options & Redeem at registration
    // ─────────────────────────────────────────────────────────────────────────

    async getSignupBonuses() {
        const now = new Date();
        return this.bonusModel.find({
            showOnSignup: true,
            isActive: true,
            $or: [
                { validUntil: null },
                { validUntil: { $exists: false } },
                { validUntil: { $gt: now } },
            ],
        }).select('code title description type applicableTo amount percentage minDeposit minDepositFiat minDepositCrypto maxBonus wageringRequirement depositWagerMultiplier expiryDays imageUrl forFirstDepositOnly currency').sort({ createdAt: -1 }).exec();
    }

    async redeemSignupBonus(userId: number, bonusCode: string, ip?: string) {
        const bonus = await this.bonusModel.findOne({ code: bonusCode.toUpperCase() });
        if (!bonus || !bonus.isActive || !bonus.showOnSignup)
            throw new BadRequestException('Invalid or unavailable signup bonus');
        if (bonus.forFirstDepositOnly)
            throw new BadRequestException('This bonus is credited on your first deposit, not immediately');
        if (bonus.type !== 'NO_DEPOSIT')
            throw new BadRequestException('Only NO_DEPOSIT bonuses are immediately redeemable at signup');

        // ── Guard 1: Concurrent mutex lock ───────────────────────────────────────
        const releaseLock = await this.acquireRedeemLock(userId);
        try {

        // ── Guard 2: One-time usage ──────────────────────────────────────────
        const alreadyUsed = await db(this.prisma).userBonus.findFirst({
            where: { userId, bonusId: String(bonus._id), status: { not: 'FORFEITED' } }
        });
        if (alreadyUsed) throw new BadRequestException('You have already used this bonus');

        // ── Guard 3: Phone dedup (shared helper) ────────────────────────────
        await this.checkPhoneDedup(userId, String(bonus._id));

        // ── Guard 4: IP cross-account dedup ────────────────────────────────
        if (ip) {
            await this.checkAndRecordIpClaim(this.normalizeIp(ip), String(bonus._id), userId);
        }

        const bonusAmount = bonus.amount > 0 ? bonus.amount : 0;
        if (bonusAmount <= 0) throw new BadRequestException('Bonus has no value');

        const applicableTo = (bonus as any).applicableTo || 'BOTH';
        const expiryDays = (bonus as any).expiryDays ?? 30;
        const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
        const wageringRequired = bonusAmount * bonus.wageringRequirement;
        const isCrypto = bonus.currency === 'CRYPTO';
        const bonusWalletField = this.getBonusWalletField(applicableTo, isCrypto);

        const casinoWagerInc = applicableTo === 'SPORTS' ? 0 : wageringRequired;
        const sportsWagerInc = applicableTo === 'SPORTS' ? wageringRequired : 0;

        await this.prisma.$transaction(async (tx: any) => {
            await tx.userBonus.create({
                data: {
                    userId,
                    bonusId: String(bonus._id),
                    bonusCode: bonus.code,
                    bonusTitle: bonus.title,
                    bonusCurrency: bonus.currency,
                    applicableTo,
                    depositAmount: 0,
                    bonusAmount,
                    wageringRequired,
                    wageringDone: 0,
                    status: 'ACTIVE',
                    expiresAt,
                },
            });
            const userUpdate: any = {
                [bonusWalletField]: { increment: bonusAmount },
                wageringRequired: { increment: wageringRequired },
            };
            if (casinoWagerInc > 0) userUpdate.casinoBonusWageringRequired = { increment: casinoWagerInc };
            if (sportsWagerInc > 0) userUpdate.sportsBonusWageringRequired = { increment: sportsWagerInc };
            await tx.user.update({ where: { id: userId }, data: userUpdate });
            await tx.transaction.create({
                data: {
                    userId,
                    amount: bonusAmount,
                    type: 'BONUS',
                    status: 'APPROVED',
                    paymentMethod: 'BONUS_WALLET',
                    paymentDetails: this.buildBonusGrantPaymentDetails({
                        source: 'SIGNUP_BONUS',
                        bonusCode: bonus.code,
                        applicableTo,
                        walletLabel: this.getBonusWalletLabel(applicableTo, isCrypto),
                        bonusCurrency: bonus.currency,
                        depositAmount: 0,
                        bonusAmount,
                        wageringRequired,
                        wageringRequirement: bonus.wageringRequirement,
                    }),
                    remarks: `Signup bonus: ${bonus.title} (${bonus.code}) — ${bonus.wageringRequirement}x wagering, ${applicableTo}`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        });

        await this.bonusModel.findByIdAndUpdate(bonus._id, { $inc: { usageCount: 1 } });
        this.emitWalletRefresh(userId);
        this.logger.log(`[Bonus] Signup bonus redeemed for user ${userId}: ${bonus.code} — ${bonusAmount}`);
        return { success: true, bonusAmount, bonusCode: bonus.code };

        } finally { await releaseLock(); }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  HELPER
    // ─────────────────────────────────────────────────────────────────────────

    private calculateBonusAmount(bonus: any, depositAmount: number): number {
        let amount = 0;
        if (bonus.percentage > 0) {
            amount = (depositAmount * bonus.percentage) / 100;
        } else {
            amount = bonus.amount;
        }
        if (bonus.maxBonus > 0 && amount > bonus.maxBonus) {
            amount = bonus.maxBonus;
        }
        return parseFloat(amount.toFixed(2));
    }
}
