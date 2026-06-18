import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';
import * as https from 'https';
import FormData = require('form-data');

/** All payment types supported by A-Pay */
export const APAY_ALL_PAYMENT_SYSTEMS = [
    'upi_link',
    'upi_push',
    'upi_fast_vip',
    'upi_fast_qr',
    'imps',
    'paytm',
    'phonepe',
] as const;

export type ApayPaymentSystem = (typeof APAY_ALL_PAYMENT_SYSTEMS)[number];

/**
 * Payment6Service — A-Pay Gateway Integration (Gateway 6)
 */
@Injectable()
export class Payment6Service {
    private readonly logger = new Logger(Payment6Service.name);
    private readonly httpsAgent = new https.Agent({ family: 4 });

    /** In-memory cache for export bearer token */
    private exportToken: { accessToken: string; refreshToken: string; expiresAt: number } | null = null;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {}

    private get baseUrl(): string {
        return this.configService.get<string>('PAYMENT6_BASE_URL') || 'https://api.a-pay.one/Remotes';
    }

    /** Base URL for the export/report API (different path root than /Remotes) */
    private get reportBaseUrl(): string {
        return this.configService.get<string>('PAYMENT6_REPORT_BASE_URL') || 'https://api.a-pay.one';
    }

    private get apiKey(): string {
        return this.configService.get<string>('PAYMENT6_API_KEY') || '';
    }

    private get accessKey(): string {
        return this.configService.get<string>('PAYMENT6_ACCESS_KEY') || '';
    }

    private get privateKey(): string {
        return this.configService.get<string>('PAYMENT6_PRIVATE_KEY') || '';
    }

    private get returnUrl(): string {
        return this.configService.get<string>('PAYMENT6_RETURN_URL') || 'https://example.com';
    }

    private get projectId(): string {
        return this.configService.get<string>('PAYMENT6_PROJECT_ID') || '';
    }

    private get webhookId(): string {
        return this.configService.get<string>('PAYMENT6_WEBHOOK_ID') || '3416796';
    }

    /** Export API credentials (login/password based) */
    private get exportLogin(): string {
        return this.configService.get<string>('PAYMENT6_EXPORT_LOGIN') || '';
    }

    private get exportPassword(): string {
        return this.configService.get<string>('PAYMENT6_EXPORT_PASSWORD') || '';
    }

    private assertConfig() {
        if (!this.apiKey) {
            this.logger.warn('PAYMENT6_API_KEY is not defined in .env');
        }
    }

    /** Common headers for /Remotes endpoints */
    private get remoteHeaders() {
        return {
            'Content-Type': 'application/json',
            'apikey': this.apiKey,
            'Accept': 'application/json',
        };
    }

    /**
     * Reads APAY_PAYMENT_SYSTEMS from SystemConfig.
     * Value is a JSON object like: {"upi_link":true,"paytm":false,...}
     * Returns only the enabled keys. Falls back to all systems if not configured.
     */
    private async getEnabledPaymentSystems(): Promise<string[]> {
        try {
            const cfg = await this.prisma.systemConfig.findUnique({
                where: { key: 'APAY_PAYMENT_SYSTEMS' },
            });
            if (cfg?.value) {
                const map: Record<string, boolean> = JSON.parse(cfg.value);
                const enabled = APAY_ALL_PAYMENT_SYSTEMS.filter((s) => map[s] !== false);
                if (enabled.length > 0) return enabled;
            }
        } catch (e) {
            this.logger.warn(`[Gateway 6 A-Pay] Failed to read APAY_PAYMENT_SYSTEMS config: ${e.message}`);
        }
        return [...APAY_ALL_PAYMENT_SYSTEMS];
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DEPOSITS
    // ─────────────────────────────────────────────────────────────────────────

    async createDepositOrder(
        tradeNo: string,
        amount: number,
        userId: string | number,
    ): Promise<{ payUrl: string; tradeNo: string; status: boolean; message: string; orderId?: string }> {
        this.assertConfig();

        const url = `${this.baseUrl}/create-payment-page`;
        const enabledSystems = await this.getEnabledPaymentSystems();

        const payload = {
            amount: amount,
            currency: 'INR',
            buttons: [100, 500, 1000, 5000],
            payment_system: enabledSystems,
            webhook_id: this.webhookId,
            custom_transaction_id: String(tradeNo),
            custom_user_id: String(userId),
            return_url: this.returnUrl,
            language: 'EN'
        };

        this.logger.log(`[Gateway 6 A-Pay] → POST ${url} - amount: ${amount}, tradeNo: ${tradeNo}`);
        this.logger.log(`[Gateway 6 A-Pay] Request Payload: ${JSON.stringify(payload)}`);

        try {
            const response = await axios.post<any>(url, payload, {
                headers: this.remoteHeaders,
                timeout: 15_000,
                httpsAgent: this.httpsAgent,
                validateStatus: () => true,
            });

            this.logger.log(
                `[Gateway 6 A-Pay] ← HTTP ${response.status} | success: ${response.data?.success}`
            );

            if (response.status >= 400 || !response.data?.success) {
                const errMessage = response.data?.message || `Gateway HTTP Error ${response.status}`;
                throw new Error(`[Gateway 6 A-Pay] Error: ${errMessage} (Code: ${response.data?.code})`);
            }

            const { url: payUrl, order_id } = response.data;

            return { payUrl, tradeNo, status: true, message: 'success', orderId: order_id };
        } catch (err: any) {
            this.logger.error(`[Gateway 6 A-Pay] Gateway call failed: ${err.message}`);
            if (err.message?.startsWith('[Gateway 6 A-Pay]')) throw err;
            throw new Error(`[Gateway 6 A-Pay] Failed to create deposit request: ${err.message}`);
        }
    }

    /**
     * Activate a deposit that requires user confirmation (e.g. upi_p2p, paytm, phonepe, imps).
     * The user provides a transaction-ID / key which is forwarded to A-Pay.
     */
    async activateDeposit(
        orderId: string,
        paymentSystem: string,
        activationKey: string,
    ): Promise<{ success: boolean; orderId: string; message?: string; data?: any }> {
        this.assertConfig();

        const url = `${this.baseUrl}/deposit-activate?project_id=${this.projectId}&order_id=${orderId}`;
        const payload = {
            payment_system: paymentSystem,
            data: { key: activationKey },
        };

        this.logger.log(`[Gateway 6 A-Pay] → POST deposit-activate orderId: ${orderId}`);

        try {
            const response = await axios.post<any>(url, payload, {
                headers: this.remoteHeaders,
                timeout: 15_000,
                httpsAgent: this.httpsAgent,
                validateStatus: () => true,
            });

            this.logger.log(`[Gateway 6 A-Pay] ← deposit-activate HTTP ${response.status}`);

            if (response.status >= 400 || !response.data?.success) {
                const msg = response.data?.message || `HTTP ${response.status}`;
                return { success: false, orderId, message: msg };
            }

            return {
                success: true,
                orderId: response.data.order_id || orderId,
                message: response.data.message,
                data: response.data.data,
            };
        } catch (err: any) {
            this.logger.error(`[Gateway 6 A-Pay] deposit-activate failed: ${err.message}`);
            throw new Error(`[Gateway 6 A-Pay] Failed to activate deposit: ${err.message}`);
        }
    }

    /**
     * Query deposit status from A-Pay.
     * At least one of orderId or customTransactionId must be provided.
     */
    async getDepositInfo(opts: {
        orderId?: string;
        customTransactionId?: string;
    }): Promise<any> {
        this.assertConfig();

        const params = new URLSearchParams();
        params.set('project_id', this.projectId);
        if (opts.orderId) params.set('order_id', opts.orderId);
        if (opts.customTransactionId) params.set('custom_transaction_id', opts.customTransactionId);

        const url = `${this.baseUrl}/deposit-info?${params.toString()}`;

        this.logger.log(`[Gateway 6 A-Pay] → GET deposit-info`);

        const response = await axios.get<any>(url, {
            headers: this.remoteHeaders,
            timeout: 15_000,
            httpsAgent: this.httpsAgent,
            validateStatus: () => true,
        });

        if (response.status >= 400 || !response.data?.success) {
            const msg = response.data?.message || `HTTP ${response.status}`;
            throw new Error(`[Gateway 6 A-Pay] deposit-info error: ${msg}`);
        }

        return response.data;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  WITHDRAWALS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create a withdrawal request via A-Pay.
     *
     * @param tradeNo   Unique custom_transaction_id
     * @param amount    Withdrawal amount
     * @param currency  Currency code (e.g. 'INR')
     * @param paymentSystem  Payment system name (e.g. 'imps', 'paytm', 'upi_p2p')
     * @param userId    Custom user ID
     * @param data      Payment-system-specific beneficiary data
     */
    async createWithdrawal(
        tradeNo: string,
        amount: number,
        currency: string,
        paymentSystem: string,
        userId: string | number,
        data: Record<string, any>,
    ): Promise<{ success: boolean; orderId?: string; message: string }> {
        this.assertConfig();

        const url = `${this.baseUrl}/create-withdrawal?project_id=${this.projectId}`;
        const payload = {
            amount,
            currency,
            payment_system: paymentSystem,
            custom_transaction_id: String(tradeNo),
            custom_user_id: String(userId),
            webhook_id: this.webhookId,
            data,
        };

        this.logger.log(`[Gateway 6 A-Pay] → POST create-withdrawal tradeNo: ${tradeNo}, amount: ${amount}`);

        try {
            const response = await axios.post<any>(url, payload, {
                headers: this.remoteHeaders,
                timeout: 15_000,
                httpsAgent: this.httpsAgent,
                validateStatus: () => true,
            });

            this.logger.log(`[Gateway 6 A-Pay] ← create-withdrawal HTTP ${response.status}`);

            if (response.status >= 400 || !response.data?.success) {
                const msg = response.data?.message || `HTTP ${response.status}`;
                return { success: false, message: msg };
            }

            return {
                success: true,
                orderId: response.data.order_id,
                message: 'success',
            };
        } catch (err: any) {
            this.logger.error(`[Gateway 6 A-Pay] create-withdrawal failed: ${err.message}`);
            throw new Error(`[Gateway 6 A-Pay] Failed to create withdrawal: ${err.message}`);
        }
    }

    /**
     * Query withdrawal status from A-Pay.
     */
    async getWithdrawalInfo(opts: {
        orderId?: string;
        customTransactionId?: string;
    }): Promise<any> {
        this.assertConfig();

        const params = new URLSearchParams();
        params.set('project_id', this.projectId);
        if (opts.orderId) params.set('order_id', opts.orderId);
        if (opts.customTransactionId) params.set('custom_transaction_id', opts.customTransactionId);

        const url = `${this.baseUrl}/withdrawal-info?${params.toString()}`;

        this.logger.log(`[Gateway 6 A-Pay] → GET withdrawal-info`);

        const response = await axios.get<any>(url, {
            headers: this.remoteHeaders,
            timeout: 15_000,
            httpsAgent: this.httpsAgent,
            validateStatus: () => true,
        });

        if (response.status >= 400 || !response.data?.success) {
            const msg = response.data?.message || `HTTP ${response.status}`;
            throw new Error(`[Gateway 6 A-Pay] withdrawal-info error: ${msg}`);
        }

        return response.data;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PAYMENT SYSTEMS INFO
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fetch available payment systems with their limits from A-Pay.
     */
    async getPaymentSystemsInfo(): Promise<any> {
        this.assertConfig();

        const url = `${this.baseUrl}/payment-systems-info?project_id=${this.projectId}`;

        this.logger.log(`[Gateway 6 A-Pay] → GET payment-systems-info`);

        const response = await axios.get<any>(url, {
            headers: this.remoteHeaders,
            timeout: 15_000,
            httpsAgent: this.httpsAgent,
            validateStatus: () => true,
        });

        if (response.status >= 400 || !response.data?.success) {
            const msg = response.data?.message || `HTTP ${response.status}`;
            throw new Error(`[Gateway 6 A-Pay] payment-systems-info error: ${msg}`);
        }

        return response.data;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  LOST TRANSACTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Report a lost transaction to A-Pay with a proof file.
     *
     * @param file      File buffer + metadata from multer
     * @param opts      order_id or custom_transaction_id + optional description
     */
    async createLostTransaction(
        file: { buffer: Buffer; originalname: string; mimetype: string },
        opts: { orderId?: string; customTransactionId?: string; description?: string },
    ): Promise<any> {
        this.assertConfig();

        const url = `${this.baseUrl}/create-lost-transaction?project_id=${this.projectId}`;

        const form = new FormData();
        form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });
        if (opts.orderId) form.append('order_id', opts.orderId);
        if (opts.customTransactionId) form.append('custom_transaction_id', opts.customTransactionId);
        if (opts.description) form.append('description', opts.description);

        this.logger.log(`[Gateway 6 A-Pay] → POST create-lost-transaction`);

        const response = await axios.post<any>(url, form, {
            headers: {
                ...form.getHeaders(),
                'apikey': this.apiKey,
            },
            timeout: 30_000,
            httpsAgent: this.httpsAgent,
            validateStatus: () => true,
        });

        if (response.status >= 400 || !response.data?.success) {
            const msg = response.data?.message || `HTTP ${response.status}`;
            throw new Error(`[Gateway 6 A-Pay] create-lost-transaction error: ${msg}`);
        }

        return response.data;
    }

    /**
     * Query lost transaction status from A-Pay.
     */
    async getLostTransactionInfo(opts: {
        orderId?: string;
        customTransactionId?: string;
    }): Promise<any> {
        this.assertConfig();

        const params = new URLSearchParams();
        params.set('project_id', this.projectId);
        if (opts.orderId) params.append('order_id', opts.orderId);
        if (opts.customTransactionId) params.append('custom_transaction_id', opts.customTransactionId);

        const url = `${this.baseUrl}/lost-transaction-info?${params.toString()}`;

        this.logger.log(`[Gateway 6 A-Pay] → GET lost-transaction-info`);

        const response = await axios.get<any>(url, {
            headers: this.remoteHeaders,
            timeout: 15_000,
            httpsAgent: this.httpsAgent,
            validateStatus: () => true,
        });

        if (response.status >= 400 || !response.data?.success) {
            const msg = response.data?.message || `HTTP ${response.status}`;
            throw new Error(`[Gateway 6 A-Pay] lost-transaction-info error: ${msg}`);
        }

        return response.data;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  EXPORT / REPORTING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Authenticate with the A-Pay export API and cache the bearer token.
     */
    private async ensureExportToken(): Promise<string> {
        const now = Date.now();

        // Token still valid (with 60s buffer)
        if (this.exportToken && this.exportToken.expiresAt > now + 60_000) {
            return this.exportToken.accessToken;
        }

        // Try refresh first
        if (this.exportToken?.refreshToken) {
            try {
                const res = await axios.post<any>(
                    `${this.reportBaseUrl}/api/v1/report/auth/refresh`,
                    { refresh_token: this.exportToken.refreshToken },
                    { headers: { 'Content-Type': 'application/json' }, timeout: 15_000, httpsAgent: this.httpsAgent, validateStatus: () => true },
                );
                if (res.status === 200 && res.data?.access_token) {
                    this.exportToken.accessToken = res.data.access_token;
                    // Access token lasts 1 hour
                    this.exportToken.expiresAt = now + 55 * 60_000;
                    return this.exportToken.accessToken;
                }
            } catch { /* fall through to full signin */ }
        }

        // Full signin
        const res = await axios.post<any>(
            `${this.reportBaseUrl}/api/v1/report/auth/signin`,
            { login: this.exportLogin, password: this.exportPassword },
            { headers: { 'Content-Type': 'application/json' }, timeout: 15_000, httpsAgent: this.httpsAgent, validateStatus: () => true },
        );

        if (res.status !== 200 || !res.data?.access_token) {
            const msg = res.data?.message || `HTTP ${res.status}`;
            throw new Error(`[Gateway 6 A-Pay] Export auth failed: ${msg}`);
        }

        this.exportToken = {
            accessToken: res.data.access_token,
            refreshToken: res.data.refresh_token,
            expiresAt: now + 55 * 60_000,
        };

        return this.exportToken.accessToken;
    }

    /**
     * Start an export job on A-Pay.
     *
     * @param type      'deposit' or 'withdrawal'
     * @param filters   { created_at?: { from, to }, activated_at?: { from, to }, status?: string[] }
     * @param format    'csv' or 'txt'
     * @param columns   Optional list of columns to include
     */
    async startExport(
        type: 'deposit' | 'withdrawal',
        filters: Record<string, any>,
        format: 'csv' | 'txt' = 'csv',
        columns?: string[],
    ): Promise<{ taskId: string; status: string; createdAt: string }> {
        const token = await this.ensureExportToken();

        const payload: any = { type, format, filters };
        if (columns?.length) payload.columns = columns;

        this.logger.log(`[Gateway 6 A-Pay] → POST export type=${type}`);

        const res = await axios.post<any>(`${this.reportBaseUrl}/api/v1/report`, payload, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            timeout: 15_000,
            httpsAgent: this.httpsAgent,
            validateStatus: () => true,
        });

        if (res.status !== 202 || !res.data?.task_id) {
            const msg = res.data?.message || `HTTP ${res.status}`;
            throw new Error(`[Gateway 6 A-Pay] Export start failed: ${msg}`);
        }

        return { taskId: res.data.task_id, status: res.data.status, createdAt: res.data.created_at };
    }

    /**
     * Check export job status.
     */
    async getExportStatus(taskId: string): Promise<any> {
        const token = await this.ensureExportToken();

        const res = await axios.get<any>(`${this.reportBaseUrl}/api/v1/report/status/${taskId}`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15_000,
            httpsAgent: this.httpsAgent,
            validateStatus: () => true,
        });

        if (res.status >= 400) {
            const msg = res.data?.message || `HTTP ${res.status}`;
            throw new Error(`[Gateway 6 A-Pay] Export status error: ${msg}`);
        }

        return res.data;
    }

    /**
     * Download an export file. Returns the raw CSV/txt buffer.
     */
    async downloadExport(fileId: string): Promise<{ data: Buffer; contentType: string; filename: string }> {
        const token = await this.ensureExportToken();

        const res = await axios.get(`${this.reportBaseUrl}/api/v1/report/${fileId}`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 60_000,
            httpsAgent: this.httpsAgent,
            responseType: 'arraybuffer',
            validateStatus: () => true,
        });

        if (res.status >= 400) {
            throw new Error(`[Gateway 6 A-Pay] Export download error: HTTP ${res.status}`);
        }

        const contentDisposition = res.headers['content-disposition'] || '';
        const filenameMatch = contentDisposition.match(/filename=([^\s;]+)/);
        const filename = filenameMatch ? filenameMatch[1] : `${fileId}.csv`;

        return {
            data: Buffer.from(res.data),
            contentType: String(res.headers['content-type'] || 'text/csv'),
            filename,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  WEBHOOK SIGNATURE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Webhook signature validation.
     * Evaluates A-Pay signature matching openapi.json rules.
     */
    verifyWebhookSignature(body: Record<string, any>): boolean {
        try {
            const receivedSignature = String(body?.signature || '');
            const transactionsArray = body?.transactions;

            if (!receivedSignature || !Array.isArray(transactionsArray)) {
                this.logger.warn(`[Gateway 6 A-Pay] Missing signature or transactions array in webhook`);
                return false;
            }

            // A-Pay requires md5 over the raw JSON without esaped slashes/unicode.
            // JSON.stringify natively does not escape slashes or unicode in V8.
            const transactionsJson = JSON.stringify(transactionsArray);
            const md5Hash = crypto.createHash('md5').update(transactionsJson, 'utf8').digest('hex');

            const baseString = this.accessKey + this.privateKey + md5Hash;
            const expectedSignature = crypto.createHash('sha1').update(baseString, 'utf8').digest('hex');

            if (expectedSignature !== receivedSignature) {
                this.logger.warn(`[Gateway 6 A-Pay] Signature mismatch. Expected: ${expectedSignature}, Got: ${receivedSignature}`);
                return false;
            }

            return true;
        } catch (e: any) {
            this.logger.error(`[Gateway 6 A-Pay] verifyWebhookSignature error: ${e.message}`);
            return false;
        }
    }
}
