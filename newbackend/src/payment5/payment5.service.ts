import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import * as https from 'https';

/**
 * Payment5Service — RezorPay Gateway Integration
 *
 * Security protocol:
 *   - Requests: Auth using 'user_token' in the form-encoded payload.
 *   - Webhooks (Callbacks): Hash verification using HMAC_SHA256(order_id|status|amount) with 'secret_key'.
 */
@Injectable()
export class Payment5Service {
    private readonly logger = new Logger(Payment5Service.name);
    private readonly httpsAgent = new https.Agent({ family: 4 }); // Force IPv4 to prevent Cloudflare hanging

    constructor(private readonly configService: ConfigService) { }

    // ─────────────────────────────────────────────────────────────────────────
    //  Config helpers
    // ─────────────────────────────────────────────────────────────────────────
    private get baseUrl(): string {
        return (
            this.configService.get<string>('PAYMENT5_BASE_URL') ||
            'https://api-gateway.asia/api'
        );
    }
    private get userToken(): string {
        return this.configService.get<string>('PAYMENT5_USER_TOKEN') || '';
    }
    private get secretKey(): string {
        return this.configService.get<string>('PAYMENT5_SECRET_KEY') || '';
    }
    private get redirectUrl(): string {
        return this.configService.get<string>('PAYMENT5_REDIRECT_URL') || 'https://zeero.bet/profile/transactions';
    }

    private assertConfig() {
        if (!this.userToken) {
            this.logger.warn('PAYMENT5_USER_TOKEN is not defined in .env');
        }
        if (!this.secretKey) {
            this.logger.warn('PAYMENT5_SECRET_KEY is not defined in .env');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Crypto — HMAC SHA256 Webhook Verification
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Verify an inbound webhook/callback payload.
     * Returns true if signature is valid, false otherwise.
     */
    verifyWebhookSignature(body: Record<string, any>): boolean {
        try {
            const order_id = String(body.order_id ?? '');
            const status = String(body.status ?? '');
            const amount = String(body.amount ?? '');
            const recvHash = String(body.hash ?? '');

            if (!order_id || !status || !amount || !recvHash) {
                this.logger.warn('[Gateway 5] Webhook missing required verification fields');
                return false;
            }

            const baseString = `${order_id}|${status}|${amount}`;
            const genHash = crypto
                .createHmac('sha256', this.secretKey)
                .update(baseString)
                .digest('hex');

            const valid = crypto.timingSafeEqual(
                Buffer.from(genHash, 'utf8'),
                Buffer.from(recvHash, 'utf8')
            );

            if (!valid) {
                this.logger.warn(`[Gateway 5] Webhook signature mismatch. Expected: ${genHash}, Got: ${recvHash}`);
            }

            return valid;
        } catch (e) {
            this.logger.error(`[Gateway 5] verifyWebhookSignature error: ${e.message}`);
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Deposit (Pay-In) API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create a deposit order with the RezorPay gateway.
     *
     * @param tradeNo   Your unique order ID
     * @param amount    Amount in INR (integer/float, min 300, max 100000)
     * @param params    Optional: { payerName, payMobile, method }
     * @returns         { payUrl, tradeNo, status, message }
     */
    async createDepositOrder(
        tradeNo: string,
        amount: number,
        params: { payerName?: string; payMobile?: string; method?: string } = {},
    ): Promise<{ payUrl: string; tradeNo: string; status: boolean; message: string }> {
        this.assertConfig();

        const safeTradeRef = tradeNo.slice(-8);
        const customerName = String(params.payerName || '').trim() || `Player_${safeTradeRef}`;
        const customerMobile = String(params.payMobile || '').trim() || '9999999999';
        const method = String(params.method || 'INTENT').trim();

        const postData = new URLSearchParams();
        postData.append('customer_name', customerName);
        postData.append('customer_mobile', customerMobile);
        postData.append('user_token', this.userToken);
        postData.append('amount', String(amount));
        postData.append('order_id', tradeNo);
        postData.append('redirect_url', this.redirectUrl);
        postData.append('remark1', 'deposit');
        postData.append('remark2', 'zeerobet');
        postData.append('method', method);

        const url = `${this.baseUrl}/create-order`;

        this.logger.log(`[Gateway 5] → POST ${url} - method: ${method}, amount: ${amount}, tradeNo: ${tradeNo}`);

        try {
            const response = await axios.post<Record<string, any>>(url, postData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 15_000,
                httpsAgent: this.httpsAgent,
                validateStatus: () => true, // resolve on all status codes to parse errors safely
            });

            this.logger.log(
                `[Gateway 5] ← HTTP ${response.status} | status: ${response.data?.status} | message: ${response.data?.message}`,
            );

            if (response.status >= 400 || !response.data) {
                const errMessage = response.data?.message || `Gateway HTTP Error ${response.status}`;
                throw new Error(`[Gateway 5] ${errMessage}`);
            }

            const { status, message, result } = response.data;
            const payUrl = result?.payment_url || '';

            return { payUrl, tradeNo, status: status === true, message: message || '' };
        } catch (err: any) {
            this.logger.error(`[Gateway 5] Gateway call failed: ${err.message}`);
            // Bubble up generic formatted message if no strict format matched
            if (err.message?.startsWith('[Gateway 5]')) throw err;
            throw new Error(`[Gateway 5] Failed to create deposit request: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Additional Pay-In & Payout Methods
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Query the status of a Pay-In (Deposit) order.
     */
    async queryDepositOrder(orderId: string): Promise<Record<string, any>> {
        this.assertConfig();
        const url = `${this.baseUrl}/check-order-status`;

        const postData = new URLSearchParams();
        postData.append('user_token', this.userToken);
        postData.append('order_id', orderId);

        try {
            const response = await axios.post(url, postData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 10000,
                httpsAgent: this.httpsAgent,
                validateStatus: () => true,
            });

            if (response.status >= 400 || !response.data) {
                const errMessage = response.data?.message || `Gateway HTTP Error ${response.status}`;
                throw new Error(`[Gateway 5 Query] ${errMessage}`);
            }

            return response.data;
        } catch (e: any) {
            this.logger.error(`[Gateway 5] queryDepositOrder failed: ${e.message}`);
            throw e;
        }
    }

    /**
     * Verify Payout Webhook Signature
     */
    verifyPayoutWebhookSignature(body: Record<string, any>): boolean {
        try {
            const withdraw_id = String(body.withdraw_id ?? '');
            const status = String(body.status ?? '');
            const amount = String(body.amount ?? '');
            const recvHash = String(body.hash ?? '');

            if (!withdraw_id || !status || !amount || !recvHash) {
                this.logger.warn('[Gateway 5 Payout] Webhook missing required verification fields');
                return false;
            }

            const baseString = `${withdraw_id}|${status}|${amount}`;
            const genHash = crypto
                .createHmac('sha256', this.secretKey)
                .update(baseString)
                .digest('hex');

            const valid = crypto.timingSafeEqual(
                Buffer.from(genHash, 'utf8'),
                Buffer.from(recvHash, 'utf8')
            );

            if (!valid) {
                this.logger.warn(`[Gateway 5 Payout] Webhook signature mismatch. Expected: ${genHash}, Got: ${recvHash}`);
            }

            return valid;
        } catch (e) {
            this.logger.error(`[Gateway 5 Payout] verifyWebhookSignature error: ${e.message}`);
            return false;
        }
    }

    /**
     * Create a Payout (Withdrawal) order.
     */
    async createPayoutOrder(
        withdrawId: string,
        amount: number,
        bankAccount: string,
        ifscCode: string,
        accountHolder: string,
        remark: string = 'Payout Request',
    ): Promise<Record<string, any>> {
        this.assertConfig();
        const url = `${this.baseUrl}/create-payout`;

        const postData = new URLSearchParams();
        postData.append('user_token', this.userToken);
        postData.append('secret_key', this.secretKey);
        postData.append('amount', String(amount));
        postData.append('bank_account', bankAccount);
        postData.append('ifsc_code', ifscCode);
        postData.append('account_holder', accountHolder);
        postData.append('withdraw_id', withdrawId);
        postData.append('remark', remark);

        this.logger.log(`[Gateway 5] → POST payout ${url} - amount: ${amount}, withdrawId: ${withdrawId}`);

        try {
            const response = await axios.post(url, postData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 15_000,
                httpsAgent: this.httpsAgent,
                validateStatus: () => true,
            });

            this.logger.log(
                `[Gateway 5] ← Payout HTTP ${response.status} | status: ${response.data?.status} | message: ${response.data?.message}`,
            );

            if (response.status >= 400 || !response.data) {
                const errMessage = response.data?.message || `Gateway HTTP Error ${response.status}`;
                throw new Error(`[Gateway 5 Payout] ${errMessage}`);
            }

            return response.data;
        } catch (e: any) {
            this.logger.error(`[Gateway 5 Payout] Gateway call failed: ${e.message}`);
            throw e;
        }
    }

    /**
     * Query the status of a Payout order.
     */
    async queryPayoutOrder(withdrawId: string): Promise<Record<string, any>> {
        this.assertConfig();
        const url = `${this.baseUrl}/check-payout-status`;

        const postData = new URLSearchParams();
        postData.append('user_token', this.userToken);
        postData.append('withdraw_id', withdrawId);

        try {
            const response = await axios.post(url, postData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 10000,
                httpsAgent: this.httpsAgent,
                validateStatus: () => true,
            });

            if (response.status >= 400 || !response.data) {
                const errMessage = response.data?.message || `Gateway HTTP Error ${response.status}`;
                throw new Error(`[Gateway 5 Payout Query] ${errMessage}`);
            }

            return response.data;
        } catch (e: any) {
            this.logger.error(`[Gateway 5 Payout] queryPayoutOrder failed: ${e.message}`);
            throw e;
        }
    }

    /**
     * Check Merchant Wallet Balance
     */
    async checkBalance(): Promise<Record<string, any>> {
        this.assertConfig();
        const url = `${this.baseUrl}/check-balance`; // Intrinsic assumption based on pattern

        try {
            const response = await axios.post(
                url,
                { user_token: this.userToken },
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'X-Secret-Key': this.secretKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    timeout: 10000,
                    httpsAgent: this.httpsAgent,
                    validateStatus: () => true,
                }
            );

            if (response.status >= 400 || !response.data) {
                const errMessage = response.data?.error?.message || response.data?.message || `HTTP Error ${response.status}`;
                throw new Error(`[Gateway 5 Balance] ${errMessage}`);
            }

            return response.data;
        } catch (e: any) {
            this.logger.error(`[Gateway 5 Balance] checkBalance failed: ${e.message}`);
            throw e;
        }
    }
}
