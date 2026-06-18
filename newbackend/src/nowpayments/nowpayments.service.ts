import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { ReferralService } from '../referral/referral.service';
import { BonusService } from '../bonus/bonus.service';

interface NowPaymentsFullCurrency {
    id: number;
    code: string;
    name: string;
    enable: boolean;
    wallet_regex: string | null;
    priority: number | null;
    extra_id_exists: boolean;
    extra_id_regex: string | null;
    logo_url: string | null;
    track: boolean;
    cg_id: string | null;
    is_maxlimit: boolean;
    network: string | null;
    smart_contract: string | null;
    network_precision: number | null;
}

export interface NowPaymentsCurrencyOption {
    id: string;
    code: string;
    label: string;
    network: string;
    logoUrl: string | null;
    enabled: boolean;
    isAvailableForPayment: boolean;
}

export interface NowPaymentsCurrencyCatalog {
    coins: Array<{
        code: string;
        label: string;
        logoUrl: string | null;
        networks: NowPaymentsCurrencyOption[];
    }>;
    syncedAt: string | null;
}

interface NowPaymentsCurrencyOverrideNetwork {
    id: string;
    code?: string;
    network: string;
    logoUrl?: string | null;
    enabled?: boolean;
    isAvailableForPayment?: boolean;
}

interface NowPaymentsCurrencyOverride {
    code?: string;
    label?: string;
    logoUrl?: string | null;
    networks?: NowPaymentsCurrencyOverrideNetwork[];
}

type NowPaymentsCurrencyOverrides = Record<string, NowPaymentsCurrencyOverride>;

@Injectable()
export class NowpaymentsService implements OnModuleInit {
    private readonly logger = new Logger(NowpaymentsService.name);
    private readonly baseUrl = 'https://api.nowpayments.io/v1';
    private readonly fullCurrenciesConfigKey = 'NOWPAYMENTS_FULL_CURRENCIES';
    private readonly fullCurrenciesSyncedAtConfigKey = 'NOWPAYMENTS_FULL_CURRENCIES_SYNCED_AT';
    private readonly currencyOverridesConfigKey = 'NOWPAYMENTS_CURRENCY_OVERRIDES';

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
        private referralService: ReferralService,
        private bonusService: BonusService,
    ) { }

    async onModuleInit() {
        await this.syncFullCurrencies('startup');
    }

    private get apiKey(): string {
        return this.configService.get<string>('NOWPAYMENTS_API_KEY') || '';
    }

    private get ipnSecret(): string {
        // Do NOT default to empty string — an empty HMAC key produces a
        // deterministic signature that attackers can forge. Returning empty
        // and letting the verifier bail forces verification to fail closed.
        return this.configService.get<string>('NOWPAYMENTS_IPN_SECRET') || '';
    }

    private get callbackUrl(): string {
        const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3001';
        return `${backendUrl}/nowpayments/ipn`;
    }

    private async apiRequest<T>(method: string, path: string, body?: any): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const headers: Record<string, string> = {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
        };

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorText = await response.text();
            this.logger.error(`NOWPayments API error [${method} ${path}]: ${response.status} - ${errorText}`);
            throw new BadRequestException(`NOWPayments API error: ${response.status}`);
        }

        return response.json() as Promise<T>;
    }

    @Cron('0 0 * * *')
    async syncFullCurrenciesNightly() {
        await this.syncFullCurrencies('nightly-cron');
    }

    async syncFullCurrencies(source: 'startup' | 'nightly-cron' | 'manual' = 'manual') {
        if (!this.apiKey) {
            this.logger.warn(`Skipping NOWPayments full-currencies sync on ${source}: NOWPAYMENTS_API_KEY is not configured`);
            return;
        }

        try {
            const data = await this.apiRequest<{ currencies: NowPaymentsFullCurrency[] }>('GET', '/full-currencies');

            const serializedPayload = JSON.stringify(data);
            const syncedAt = new Date().toISOString();

            await this.prisma.$transaction([
                this.prisma.systemConfig.upsert({
                    where: { key: this.fullCurrenciesConfigKey },
                    update: { value: serializedPayload },
                    create: { key: this.fullCurrenciesConfigKey, value: serializedPayload },
                }),
                this.prisma.systemConfig.upsert({
                    where: { key: this.fullCurrenciesSyncedAtConfigKey },
                    update: { value: syncedAt },
                    create: { key: this.fullCurrenciesSyncedAtConfigKey, value: syncedAt },
                }),
            ]);

            this.logger.log(
                `NOWPayments full-currencies sync complete via ${source}: ${data.currencies?.length || 0} currencies stored at ${syncedAt}`,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`NOWPayments full-currencies sync failed via ${source}: ${message}`);
        }
    }

    private normalizeNetworkLabel(network: string | null, code: string): string {
        if (!network) return code.toUpperCase();

        const normalized = network.trim().toLowerCase();
        const map: Record<string, string> = {
            eth: 'ERC20',
            erc20: 'ERC20',
            tron: 'TRC20',
            trx: 'TRC20',
            trc20: 'TRC20',
            bsc: 'BSC',
            binance: 'BSC',
            'binance smart chain': 'BSC',
            polygon: 'Polygon',
            matic: 'Polygon',
            maticmainnet: 'Polygon',
            sol: 'Solana',
            solana: 'Solana',
            btc: 'BTC',
            arbitrum: 'Arbitrum',
            arb: 'Arbitrum',
            etharb: 'Arbitrum',
            optimism: 'Optimism',
            op: 'Optimism',
            base: 'Base',
            avax: 'Avalanche',
            avalanche: 'Avalanche',
            'avalanche c-chain': 'Avalanche',
            avaxc: 'Avalanche',
            arc20: 'Avalanche',
            ton: 'TON',
            toncoin: 'TON',
            zk: 'zkSync',
            zksync: 'zkSync',
            'zksync era': 'zkSync',
            linea: 'Linea',
            fantom: 'Fantom',
            ftm: 'Fantom',
            xlm: 'Stellar',
            stellar: 'Stellar',
            xrp: 'XRP',
            doge: 'Dogecoin',
            ltc: 'Litecoin',
            bch: 'Bitcoin Cash',
            tonstation: 'TON',
            near: 'NEAR',
            apt: 'Aptos',
            aptos: 'Aptos',
            sei: 'Sei',
            pulsechain: 'PulseChain',
            pls: 'PulseChain',
            mainnet: 'Mainnet',
        };

        return map[normalized] || network.toUpperCase();
    }

    private extractBaseAssetCode(code: string, network?: string | null): string {
        const normalized = code.trim().toUpperCase();
        const knownSuffixes = new Set([
            'TRC20',
            'ERC20',
            'BSC',
            'MATIC',
            'MAINNET',
            'SOL',
            'ARB',
            'ARC20',
            'USDCE',
            'BRC20',
            'ETH',
            'TRON',
            'SOLANA',
            'POLYGON',
            'AVALANCHE',
            'OPTIMISM',
            'BASE',
            'LINEA',
            'ZKSYNC',
            'TON',
        ]);

        const normalizedNetwork = (network || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (normalizedNetwork.length >= 3) {
            knownSuffixes.add(normalizedNetwork);
        }

        const sortedSuffixes = Array.from(knownSuffixes).sort((a, b) => b.length - a.length);

        for (const suffix of sortedSuffixes) {
            if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
                return normalized.slice(0, -suffix.length);
            }
        }

        return normalized;
    }

    private getBaseAssetLabel(name: string | null | undefined, code: string): string {
        const rawName = (name || code).trim();
        const withoutParentheses = rawName.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
        return withoutParentheses || code.toUpperCase();
    }

    private getCoinGroupKey(currency: NowPaymentsFullCurrency): string {
        const baseCode = this.extractBaseAssetCode(currency.code, currency.network);
        if (baseCode) return baseCode.toLowerCase();
        if (currency.cg_id?.trim()) return currency.cg_id.trim().toLowerCase();
        return this.getBaseAssetLabel(currency.name, currency.code).toLowerCase();
    }

    private async getCachedFullCurrencies(): Promise<{ currencies: NowPaymentsFullCurrency[]; syncedAt: string | null }> {
        const [currenciesConfig, syncedAtConfig] = await this.prisma.$transaction([
            this.prisma.systemConfig.findUnique({ where: { key: this.fullCurrenciesConfigKey } }),
            this.prisma.systemConfig.findUnique({ where: { key: this.fullCurrenciesSyncedAtConfigKey } }),
        ]);

        if (!currenciesConfig?.value) {
            return { currencies: [], syncedAt: syncedAtConfig?.value || null };
        }

        try {
            const parsed = JSON.parse(currenciesConfig.value) as { currencies?: NowPaymentsFullCurrency[] };
            return {
                currencies: Array.isArray(parsed?.currencies) ? parsed.currencies : [],
                syncedAt: syncedAtConfig?.value || null,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to parse cached NOWPayments full currencies: ${message}`);
            return { currencies: [], syncedAt: syncedAtConfig?.value || null };
        }
    }

    private async getCurrencyOverrides(): Promise<NowPaymentsCurrencyOverrides> {
        const overridesConfig = await this.prisma.systemConfig.findUnique({
            where: { key: this.currencyOverridesConfigKey },
        });

        if (!overridesConfig?.value) {
            return {};
        }

        try {
            const parsed = JSON.parse(overridesConfig.value) as NowPaymentsCurrencyOverrides;
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to parse NOWPayments currency overrides: ${message}`);
            return {};
        }
    }

    async getCurrencyCatalog(): Promise<NowPaymentsCurrencyCatalog> {
        const [{ currencies: fullCurrencies, syncedAt }, availableCurrencies, overrides] = await Promise.all([
            this.getCachedFullCurrencies(),
            this.getAvailableCurrencies(),
            this.getCurrencyOverrides(),
        ]);

        const availableCurrencySet = new Set(availableCurrencies.map((currency) => currency.toLowerCase()));
        const coinMap = new Map<string, { code: string; label: string; logoUrl: string | null; networks: NowPaymentsCurrencyOption[] }>();

        for (const currency of fullCurrencies) {
            const payCurrency = currency.code.toLowerCase();
            const isAvailableForPayment = currency.enable && availableCurrencySet.has(payCurrency);

            if (!isAvailableForPayment) continue;

            const coinCode = this.extractBaseAssetCode(currency.code, currency.network);
            const coinLabel = this.getBaseAssetLabel(currency.name, currency.code);
            const networkOption: NowPaymentsCurrencyOption = {
                id: payCurrency,
                code: currency.code.toUpperCase(),
                label: coinLabel,
                network: this.normalizeNetworkLabel(currency.network, currency.code),
                logoUrl: currency.logo_url || null,
                enabled: currency.enable,
                isAvailableForPayment,
            };

            const groupKey = this.getCoinGroupKey(currency);
            const existingCoin = coinMap.get(groupKey);
            if (existingCoin) {
                if (!existingCoin.networks.find((network) => network.id === networkOption.id)) {
                    existingCoin.networks.push(networkOption);
                }
            } else {
                coinMap.set(groupKey, {
                    code: coinCode,
                    label: coinLabel,
                    logoUrl: currency.logo_url || null,
                    networks: [networkOption],
                });
            }
        }

        for (const [groupKey, override] of Object.entries(overrides)) {
            const normalizedGroupKey = groupKey.trim().toLowerCase();
            if (!normalizedGroupKey) continue;

            const resolvedGroupKey = coinMap.has(normalizedGroupKey)
                ? normalizedGroupKey
                : Array.from(coinMap.entries()).find(([, coin]) => coin.code.toLowerCase() === normalizedGroupKey)?.[0]
                    || normalizedGroupKey;

            const existingCoin = coinMap.get(resolvedGroupKey) ?? {
                code: override.code?.trim().toUpperCase() || normalizedGroupKey.toUpperCase(),
                label: override.label?.trim() || normalizedGroupKey.toUpperCase(),
                logoUrl: override.logoUrl || null,
                networks: [],
            };

            existingCoin.code = override.code?.trim().toUpperCase() || existingCoin.code;
            existingCoin.label = override.label?.trim() || existingCoin.label;
            existingCoin.logoUrl = override.logoUrl ?? existingCoin.logoUrl;

            for (const overrideNetwork of override.networks || []) {
                const id = overrideNetwork.id?.trim().toLowerCase();
                if (!id) continue;

                const existingNetwork = existingCoin.networks.find((network) => network.id === id);
                const nextNetwork: NowPaymentsCurrencyOption = {
                    id,
                    code: overrideNetwork.code?.trim().toUpperCase() || id.toUpperCase(),
                    label: existingCoin.label,
                    network: overrideNetwork.network?.trim() || id.toUpperCase(),
                    logoUrl: overrideNetwork.logoUrl ?? existingCoin.logoUrl ?? null,
                    enabled: overrideNetwork.enabled ?? true,
                    isAvailableForPayment: overrideNetwork.isAvailableForPayment ?? true,
                };

                if (existingNetwork) {
                    existingNetwork.code = nextNetwork.code;
                    existingNetwork.label = nextNetwork.label;
                    existingNetwork.network = nextNetwork.network;
                    existingNetwork.logoUrl = nextNetwork.logoUrl;
                    existingNetwork.enabled = nextNetwork.enabled;
                    existingNetwork.isAvailableForPayment = nextNetwork.isAvailableForPayment;
                } else {
                    existingCoin.networks.push(nextNetwork);
                }
            }

            coinMap.set(resolvedGroupKey, existingCoin);
        }

        const coins = Array.from(coinMap.values())
            .map((coin) => ({
                ...coin,
                networks: coin.networks
                    .filter((network) => network.enabled && network.isAvailableForPayment)
                    .sort((a, b) => a.network.localeCompare(b.network) || a.code.localeCompare(b.code)),
            }))
            .filter((coin) => coin.networks.length > 0)
            .sort((a, b) => a.label.localeCompare(b.label));

        return { coins, syncedAt };
    }

    async isSupportedPayCurrency(payCurrency: string): Promise<boolean> {
        const catalog = await this.getCurrencyCatalog();
        return catalog.coins.some((coin) => coin.networks.some((network) => network.id === payCurrency.toLowerCase()));
    }

    /**
     * Creates a NOWPayments cryptocurrency payment and stores the pending transaction in DB.
     */
    async createPayment(
        userId: number,
        priceAmount: number,
        priceCurrency: string = 'usd',
        payCurrency: string,
        bonusCode?: string,
    ): Promise<{
        paymentId: string;
        payAddress: string;
        payAmount: number;
        payCurrency: string;
        expiresAt: string | null;
        transactionDbId: number;
    }> {
        if (!this.apiKey) {
            throw new BadRequestException('NOWPayments API key is not configured');
        }

        const orderId = `CRYPTO_${userId}_${Date.now()}`;

        const nowPaymentsResponse = await this.apiRequest<any>('POST', '/payment', {
            price_amount: priceAmount,
            price_currency: priceCurrency.toLowerCase(),
            pay_currency: payCurrency.toLowerCase(),
            order_id: orderId,
            ipn_callback_url: this.callbackUrl,
            is_fixed_rate: false,
            is_fee_paid_by_user: false,
        });

        this.logger.log(`NOWPayments payment created: ${JSON.stringify(nowPaymentsResponse)}`);

        const paymentId = nowPaymentsResponse.payment_id?.toString();
        const payAddress = nowPaymentsResponse.pay_address;
        const payAmount = nowPaymentsResponse.pay_amount;
        const expiresAt = nowPaymentsResponse.expiration_estimate_date || null;

        if (!paymentId || !payAddress) {
            throw new BadRequestException('Invalid response from NOWPayments');
        }

        const effectiveBonusCode = (bonusCode || '').trim().toUpperCase() || undefined;

        // Store in DB as PENDING transaction
        const transaction = await this.prisma.transaction.create({
            data: {
                userId,
                amount: priceAmount,
                type: 'DEPOSIT',
                status: 'PENDING',
                paymentMethod: `CRYPTO_${payCurrency.toUpperCase()}`,
                transactionId: paymentId,
                utr: orderId,
                paymentDetails: {
                    payAddress,
                    payAmount,
                    payCurrency: payCurrency.toUpperCase(),
                    depositCurrency: 'CRYPTO',
                    priceCurrency: priceCurrency.toUpperCase(),
                    priceAmount,
                    expiresAt,
                    nowpaymentsOrderId: orderId,
                    ...(effectiveBonusCode ? { bonusCode: effectiveBonusCode } : {}),
                } as any,
            },
        });

        return {
            paymentId,
            payAddress,
            payAmount,
            payCurrency: payCurrency.toUpperCase(),
            expiresAt,
            transactionDbId: transaction.id,
        };
    }

    /**
     * Fetches the current status of a payment from NOWPayments API.
     */
    async getPaymentStatus(paymentId: string): Promise<{
        paymentId: string;
        status: string;
        payAddress: string;
        payAmount: number;
        actuallyPaid: number;
        payCurrency: string;
        outcomeAmount: number | null;
    }> {
        const data = await this.apiRequest<any>('GET', `/payment/${paymentId}`);
        return {
            paymentId: data.payment_id?.toString(),
            status: data.payment_status,
            payAddress: data.pay_address,
            payAmount: data.pay_amount,
            actuallyPaid: data.actually_paid || 0,
            payCurrency: data.pay_currency?.toUpperCase(),
            outcomeAmount: data.outcome_amount || null,
        };
    }

    /**
     * Verifies the HMAC-SHA512 signature from NOWPayments IPN webhook.
     */
    verifyIpnSignature(rawBody: string | object, receivedSignature: string): boolean {
        if (!this.ipnSecret) {
            // SECURITY: fail CLOSED if the IPN secret is missing. An empty
            // HMAC key produces a fixed signature anyone can compute.
            this.logger.error('NOWPAYMENTS_IPN_SECRET is not set — refusing IPN');
            return false;
        }
        if (!receivedSignature || typeof receivedSignature !== 'string') {
            return false;
        }

        // Sort keys alphabetically and stringify
        const bodyObj = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        const sortedKeys = Object.keys(bodyObj).sort();
        const sortedObj: Record<string, any> = {};
        for (const key of sortedKeys) {
            sortedObj[key] = bodyObj[key];
        }
        const sortedString = JSON.stringify(sortedObj);

        const hmac = crypto
            .createHmac('sha512', this.ipnSecret)
            .update(sortedString)
            .digest('hex');

        // Constant-time comparison to prevent timing-oracle signature forgery.
        try {
            const a = Buffer.from(hmac, 'utf8');
            const b = Buffer.from(receivedSignature, 'utf8');
            return a.length === b.length && crypto.timingSafeEqual(a, b);
        } catch {
            return false;
        }
    }

    /**
     * Handles a verified IPN callback — auto-approves deposit on 'finished' status.
     */
    async handleIpnCallback(ipnBody: any): Promise<void> {
        const paymentId = ipnBody.payment_id?.toString();
        const status = ipnBody.payment_status;

        this.logger.log(`IPN received for payment ${paymentId}: status = ${status}`);

        if (!paymentId) return;

        // Find the matching transaction in our DB
        const transaction = await this.prisma.transaction.findFirst({
            where: { transactionId: paymentId },
            include: { user: true },
        });

        if (!transaction) {
            this.logger.warn(`IPN: No transaction found for payment_id ${paymentId}`);
            return;
        }

        if (status === 'finished' || status === 'confirmed') {
            // SECURITY: atomic PENDING→APPROVED guard so a replayed IPN or a
            // second concurrent webhook can't double-credit. Previously the
            // status check happened in a separate read before the update.
            const creditApplied = await this.prisma.$transaction(async (prisma) => {
                const updated = await prisma.transaction.updateMany({
                    where: { id: transaction.id, status: 'PENDING' },
                    data: {
                        status: 'APPROVED',
                        remarks: `Auto-approved via NOWPayments IPN. Credited to CRYPTO USD wallet. Status: ${status}. Actually paid: ${ipnBody.actually_paid} ${ipnBody.pay_currency?.toUpperCase()}`,
                    },
                });
                if (updated.count === 0) return false;
                await prisma.user.update({
                    where: { id: transaction.userId },
                    data: { cryptoBalance: { increment: transaction.amount } } as any,
                });
                return true;
            });

            if (!creditApplied) {
                this.logger.log(`IPN: Transaction ${transaction.id} not in PENDING state, skipping credit.`);
                return;
            }

            // Handle referral rewards
            try {
                const previousDeposits = await this.prisma.transaction.count({
                    where: {
                        userId: transaction.userId,
                        type: 'DEPOSIT',
                        status: 'APPROVED',
                        id: { not: transaction.id },
                    },
                });
                if (previousDeposits === 0) {
                    await this.referralService.checkAndAward(transaction.userId, 'DEPOSIT_FIRST', transaction.amount, `dep_${transaction.id}_first`);
                }
                await this.referralService.checkAndAward(transaction.userId, 'DEPOSIT_RECURRING', transaction.amount, `dep_${transaction.id}_rec`);

                let depositWageringApplied = false;
                const bonusCode = (transaction.paymentDetails as any)?.bonusCode;
                if (bonusCode) {
                    try {
                        const result = await this.bonusService.redeemBonus(transaction.userId, bonusCode, transaction.amount, {
                            depositCurrency: 'CRYPTO',
                            approvedDepositCountBeforeThisDeposit: previousDeposits,
                        });
                        if (result) {
                            depositWageringApplied = true;
                            this.logger.log(`[Crypto] Bonus redeemed — userId: ${transaction.userId}, code: ${bonusCode}`);
                        } else {
                            this.logger.warn(`[Crypto] Bonus code "${bonusCode}" not applied (validation failed) — userId: ${transaction.userId}`);
                        }
                    } catch (e) {
                        this.logger.error(`[Crypto] Bonus redemption failed (non-fatal): ${e.message}`);
                    }
                }

                // ── Default 1× deposit wagering lock if no bonus handled it ───────
                if (!depositWageringApplied) {
                    try {
                        await this.bonusService.applyDepositWagering(transaction.userId, transaction.amount, 1);
                    } catch (e) {
                        this.logger.error(`[Crypto] Deposit wagering lock failed (non-fatal): ${e.message}`);
                    }
                }

                // ── Track totalDeposited ──────────────────────────────────────────
                await this.prisma.user.update({
                    where: { id: transaction.userId },
                    data: { totalDeposited: { increment: transaction.amount } } as any,
                });
            } catch (e) {
                this.logger.error(`Post-deposit processing failed for user ${transaction.userId}: ${e.message}`);
            }

            this.logger.log(`✅ Auto-approved crypto deposit ${transaction.id} for user ${transaction.userId} — amount: ${transaction.amount}`);
        } else if (status === 'partially_paid') {
            await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    remarks: `Partially paid via NOWPayments. Actually paid: ${ipnBody.actually_paid} ${ipnBody.pay_currency?.toUpperCase()}. Requires manual review.`,
                },
            });
            this.logger.warn(`⚠️  Partial payment for transaction ${transaction.id} — requires manual admin review`);
        } else if (status === 'expired' || status === 'failed') {
            await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: 'REJECTED',
                    remarks: `Payment ${status} via NOWPayments IPN.`,
                },
            });
            this.logger.log(`❌ Payment ${status} for transaction ${transaction.id}`);
        }
    }

    /**
     * Returns list of available currencies from NOWPayments.
     */
    async getAvailableCurrencies(): Promise<string[]> {
        try {
            const data = await this.apiRequest<{ currencies: string[] }>('GET', '/currencies');
            return data.currencies || [];
        } catch (e) {
            this.logger.error(`Failed to fetch currencies: ${e.message}`);
            return ['btc', 'eth', 'usdt', 'ltc', 'bnb', 'xrp', 'trx'];
        }
    }

    /**
     * Get approximate crypto amount for a given fiat price.
     */
    async getEstimatedAmount(fromCurrency: string, toCurrency: string, amount: number): Promise<number> {
        try {
            const data = await this.apiRequest<{ estimated_amount: number }>(
                'GET',
                `/estimate?amount=${amount}&currency_from=${fromCurrency}&currency_to=${toCurrency}`,
            );
            return data.estimated_amount;
        } catch (e) {
            this.logger.error(`Failed to get estimate: ${e.message}`);
            return 0;
        }
    }

    /**
     * Fetches the minimum payment amount for a given currency pair from NOWPayments.
     * Returns 0 on error (so we don't block the user unnecessarily).
     */
    async getMinimumAmount(currencyFrom: string, currencyTo: string): Promise<number> {
        try {
            const data = await this.apiRequest<{ min_amount: number; currency_from: string; currency_to: string }>(
                'GET',
                `/min-amount?currency_from=${currencyFrom.toLowerCase()}&currency_to=${currencyTo.toLowerCase()}`,
            );
            return data.min_amount || 0;
        } catch (e) {
            this.logger.error(`Failed to get min-amount for ${currencyFrom}→${currencyTo}: ${e.message}`);
            return 0; // Don't block on error — let NOWPayments reject if truly too low
        }
    }
}
