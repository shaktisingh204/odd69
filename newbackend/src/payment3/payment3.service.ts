import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';

/**
 * Payment3Service — iPayment / ZCT Gateway (UPI 3)
 *
 * Security protocol (dual-layer):
 *   1. Encrypt inner JSON payload with AES-128-CBC (key = ENC_KEY, IV = "0102030405060708")
 *   2. Sign encrypted payload: MD5(encryptedPayload + SIGN_KEY).toUpperCase()
 *
 * Request envelope:
 *   { mchNo, payload: "<AES-Base64>", sign: "<MD5-UPPER>" }
 *
 * Response / Webhook envelope (same shape):
 *   { state, code, message, mchNo, payload: "<AES-Base64>", sign: "<MD5-UPPER>" }
 */
@Injectable()
export class Payment3Service {
    private readonly logger = new Logger(Payment3Service.name);

    // Fixed IV per gateway spec — do NOT change
    private static readonly AES_IV = '0102030405060708';

    constructor(private readonly configService: ConfigService) { }

    // ─────────────────────────────────────────────────────────────────────────
    //  Config helpers
    // ─────────────────────────────────────────────────────────────────────────
    private get baseUrl(): string {
        return (
            this.configService.get<string>('PAYMENT3_BASE_URL') ||
            'https://phpay.ipayment.vip/dgateway'
        );
    }
    private get mchNo(): string {
        return this.configService.get<string>('PAYMENT3_MCH_NO') || '';
    }
    private get encKey(): string {
        return this.configService.get<string>('PAYMENT3_ENC_KEY') || '';
    }
    private get signKey(): string {
        return this.configService.get<string>('PAYMENT3_SIGN_KEY') || '';
    }
    private get notifyUrl(): string {
        return this.configService.get<string>('PAYMENT3_NOTIFY_URL') || '';
    }

    private assertConfig() {
        if (!this.mchNo || !this.encKey || !this.signKey) {
            throw new Error(
                'iPayment (gateway 3) config incomplete. ' +
                'Set PAYMENT3_MCH_NO, PAYMENT3_ENC_KEY and PAYMENT3_SIGN_KEY in .env',
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Crypto — AES-128-CBC + MD5
    // ─────────────────────────────────────────────────────────────────────────

    /** Encrypt a plaintext string → AES-128-CBC → Base64 */
    aesEncrypt(plainText: string): string {
        const key = Buffer.from(this.encKey, 'utf8');     // 16 bytes
        const iv = Buffer.from(Payment3Service.AES_IV, 'utf8');
        const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
        let encrypted = cipher.update(plainText, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    }

    /** Decrypt a Base64 AES-128-CBC string → plaintext */
    aesDecrypt(encryptedBase64: string): string {
        const key = Buffer.from(this.encKey, 'ascii');    // matches Java getBytes("ASCII")
        const iv = Buffer.from(Payment3Service.AES_IV, 'utf8');
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    /** MD5(encryptedPayload + SIGN_KEY).toUpperCase() */
    private computeSign(encryptedPayload: string): string {
        return crypto
            .createHash('md5')
            .update(encryptedPayload + this.signKey, 'utf8')
            .digest('hex')
            .toUpperCase();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Request / Response helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Wrap an inner payload object into the signed outer request envelope.
     * extra fields (name, email, mobile) go in the OUTER body (unencrypted)
     * so the gateway can validate them before decryption.
     * Returns { mchNo, payload, sign, ...outerExtra } ready for JSON.stringify.
     */
    buildRequest(
        innerPayload: Record<string, any>,
        outerExtra?: Record<string, any>,
    ): Record<string, any> {
        const plainText = JSON.stringify(innerPayload);
        const encryptedPayload = this.aesEncrypt(plainText);
        const sign = this.computeSign(encryptedPayload);
        return {
            mchNo: this.mchNo,
            payload: encryptedPayload,
            sign,
            ...(outerExtra || {}),
        };
    }

    /**
     * Verify + decrypt an outer response envelope (API response or webhook body).
     * Returns the parsed inner JSON object, or throws with the gateway's error details.
     */
    parseResponse(outerResponse: Record<string, any>): Record<string, any> {
        const { state, payload, sign, code, message } = outerResponse;

        if (state !== 'Successful') {
            throw new Error(
                `[${code || 'ERR'}] ${message || state || 'Gateway error'}`,
            );
        }

        if (!payload || !sign) {
            throw new Error('Gateway response missing payload or sign');
        }

        const expectedSign = this.computeSign(payload);
        if (expectedSign !== sign) {
            throw new Error(
                `Gateway signature mismatch — expected ${expectedSign}, got ${sign}`,
            );
        }

        const plainText = this.aesDecrypt(payload);
        return JSON.parse(plainText);
    }

    /**
     * Verify an inbound webhook/callback envelope without throwing.
     * Returns true if signature is valid, false otherwise.
     */
    verifyWebhookSignature(body: Record<string, any>): boolean {
        try {
            const { payload, sign } = body;
            if (!payload || !sign) {
                this.logger.warn('[UPI3] Webhook missing payload or sign');
                return false;
            }
            const expected = this.computeSign(payload);
            const valid = expected === sign;
            if (!valid) {
                this.logger.warn(
                    `[UPI3] Webhook signature mismatch. Expected: ${expected}, Got: ${sign}`,
                );
            }
            return valid;
        } catch (e) {
            this.logger.error(`[UPI3] verifyWebhookSignature error: ${e.message}`);
            return false;
        }
    }

    /**
     * Decrypt webhook payload body (after signature is verified).
     * Returns the parsed inner object.
     */
    decryptWebhookPayload(body: Record<string, any>): Record<string, any> {
        const plain = this.aesDecrypt(body.payload);
        return JSON.parse(plain);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Gateway HTTP calls
    // ─────────────────────────────────────────────────────────────────────────

    /** POST to a gateway endpoint and return the parsed inner response object */
    private async callGateway(
        endpoint: string,
        innerPayload: Record<string, any>,
        outerExtra?: Record<string, any>,
    ): Promise<Record<string, any>> {
        const outerBody = this.buildRequest(innerPayload, outerExtra);
        const url = `${this.baseUrl}${endpoint}`;

        this.logger.log(`[UPI3] → POST ${url}`);
        this.logger.log(`[UPI3] Inner payload (pre-encrypt): ${JSON.stringify(innerPayload)}`);
        if (outerExtra) {
            this.logger.log(`[UPI3] Outer extra fields: ${JSON.stringify(outerExtra)}`);
        }

        try {
            const response = await axios.post<Record<string, any>>(url, outerBody, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15_000,
                validateStatus: () => true,
            });

            this.logger.log(
                `[UPI3] ← HTTP ${response.status} | state: ${response.data?.state} | code: ${response.data?.code} | msg: ${response.data?.message}`,
            );

            if (response.status >= 400) {
                const errBody = response.data;
                throw new Error(
                    `[${errBody?.code || response.status}] ${errBody?.message || 'Gateway HTTP error'}`,
                );
            }

            return this.parseResponse(response.data);
        } catch (err: any) {
            if (err.message?.startsWith('[')) throw err;
            throw new Error(`[UPI3] Gateway call failed: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Deposit (Pay-In)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create a deposit order with the iPayment gateway.
     *
     * @param tradeNo   Your unique order ID (max 32 chars)
     * @param amount    Amount in INR (integer, min 1)
     * @param params    Optional: { payerName, payMobile, payEmail }
     * @returns         { payUrl, tradeNo, status, statusDesc }
     */
    async createDepositOrder(
        tradeNo: string,
        amount: number,
        params: { payerName?: string; payMobile?: string; payEmail?: string } = {},
    ): Promise<{ payUrl: string; tradeNo: string; status: string; statusDesc: string }> {
        this.assertConfig();

        if (!this.notifyUrl) {
            throw new Error('PAYMENT3_NOTIFY_URL is not configured in .env');
        }

        // IST timestamp formatted as yyyyMMddHHmmss per the gateway spec.
        // Using toISOString() would emit UTC, which the gateway rejects in some
        // environments — compose from local parts instead.
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const orderDate =
            `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
            `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

        const innerPayload: Record<string, any> = {
            versionNo: '1',
            mchNo: this.mchNo,
            price: String(Math.round(amount)),
            orderDate,
            tradeNo,
            notifyUrl: this.notifyUrl,
            payType: '01',
        };

        // Payer fields: the published spec keeps these OPTIONAL inside the
        // encrypted payload (payerName/payMobile/payEmail per the Java demo),
        // but this merchant's config additionally validates an unencrypted
        // `extra` envelope on the OUTER body — the gateway returns
        // `[extra.mobile] cannot be empty` if it's missing. We therefore
        // always include a populated `extra`, falling back to synthesized
        // placeholders so the call never fails because of PII the user didn't
        // supply. Same values are mirrored inside the encrypted payload.
        const payerName = (params.payerName || '').trim() || 'Customer';
        const payMobile = (params.payMobile || '').replace(/\D/g, '') || '9000000000';
        const payEmail = (params.payEmail || '').trim() || 'noreply@zeero.bet';

        innerPayload.payerName = payerName.slice(0, 50);
        innerPayload.payMobile = payMobile.slice(0, 20);
        innerPayload.payEmail = payEmail.slice(0, 120);

        const extra = {
            name: payerName.slice(0, 50),
            mobile: payMobile.slice(0, 20),
            email: payEmail.slice(0, 120),
        };

        const inner = await this.callGateway(
            '/ws/trans/nocard/makeOrder',
            innerPayload,
            { extra },
        );

        const status: string = inner.status ?? '';
        const statusDesc: string = inner.statusDesc ?? '';
        const payUrl: string = inner.payUrl ?? '';

        this.logger.log(
            `[UPI3] Order created — tradeNo: ${tradeNo}, status: ${status}, payUrl: ${payUrl ? '(present)' : '(empty)'}`,
        );

        return { payUrl, tradeNo, status, statusDesc };
    }

    /**
     * Query the status of an existing deposit order.
     * Useful for manual reconciliation / polling.
     */
    async queryDepositOrder(tradeNo: string): Promise<Record<string, any>> {
        this.assertConfig();

        const innerPayload = {
            versionNo: '1',
            mchNo: this.mchNo,
            tradeNo,
        };

        const inner = await this.callGateway('/ws/trans/nocard/orderQuery', innerPayload);
        this.logger.log(`[UPI3] Order query — tradeNo: ${tradeNo}, status: ${inner.status}`);
        return inner;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Payout (Withdrawal)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create a payout/withdrawal order with the iPayment gateway.
     *
     * @param tradeNo       Unique payout order ID (max 32 chars)
     * @param amount        Amount in INR
     * @param acctName      Beneficiary name
     * @param acctNo        Beneficiary account / UPI ID
     * @param acctCode      IFSC code (for bank transfers)
     * @returns             Parsed inner response from gateway
     */
    async createPayoutOrder(
        tradeNo: string,
        amount: number,
        acctName: string,
        acctNo: string,
        acctCode: string = '',
    ): Promise<Record<string, any>> {
        this.assertConfig();

        if (!this.notifyUrl) {
            throw new Error('PAYMENT3_NOTIFY_URL is not configured in .env');
        }

        // Build payout notify URL by replacing deposit path with payout path
        const payoutNotifyUrl = this.notifyUrl.replace('/payment3/notify', '/payment3/payout/notify');

        const innerPayload: Record<string, any> = {
            versionNo: '1',
            mchNo: this.mchNo,
            price: String(Math.round(amount)),
            tradeNo,
            notifyUrl: payoutNotifyUrl,
            acctName,
            acctNo,
            acctCode,
        };

        this.logger.log(`[UPI3] Creating payout order — tradeNo: ${tradeNo}, amount: ${amount}`);
        const inner = await this.callGateway('/ws/trans/nocard/payOut', innerPayload);

        this.logger.log(
            `[UPI3] Payout order created — tradeNo: ${tradeNo}, status: ${inner.status}`,
        );

        return inner;
    }

    /**
     * Query the status of an existing payout order.
     */
    async queryPayoutOrder(tradeNo: string): Promise<Record<string, any>> {
        this.assertConfig();

        const innerPayload = {
            versionNo: '1',
            mchNo: this.mchNo,
            tradeNo,
        };

        const inner = await this.callGateway('/ws/trans/nocard/payOutQuery', innerPayload);
        this.logger.log(`[UPI3] Payout query — tradeNo: ${tradeNo}, status: ${inner.status}`);
        return inner;
    }
}
