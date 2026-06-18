import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import axios from 'axios';

/**
 * Payment9Service — UltraPay (ultrapay.online) deposit gateway
 *
 * Endpoints (from postman collection):
 *   POST https://ultrapay.online/api/v1/ultrapay/payin       — create payin
 *   POST https://ultrapay.online/api/v1/oniktech/status-check — query status
 *
 * Auth: header `X-API-KEY: <api_token>` on every call.
 *
 * Status-check uses a separate api key in the collection; both fall back to
 * a single shared key if only one env var is configured.
 */
@Injectable()
export class Payment9Service {
    private readonly logger = new Logger(Payment9Service.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {}

    private get baseUrl(): string {
        return this.configService.get<string>(
            'PAYMENT9_BASE_URL',
            'https://ultrapay.online',
        );
    }

    private get payinApiKey(): string {
        return (
            this.configService.get<string>('PAYMENT9_PAYIN_API_KEY') ||
            this.configService.get<string>('PAYMENT9_API_KEY') ||
            ''
        );
    }

    private get statusApiKey(): string {
        return (
            this.configService.get<string>('PAYMENT9_STATUS_API_KEY') ||
            this.configService.get<string>('PAYMENT9_API_KEY') ||
            this.payinApiKey
        );
    }

    private get webhookSecret(): string {
        return this.configService.get<string>('PAYMENT9_WEBHOOK_SECRET') || '';
    }

    private assertConfig() {
        if (!this.payinApiKey) {
            this.logger.warn(
                '[UPI9] PAYMENT9_PAYIN_API_KEY (or PAYMENT9_API_KEY) is not defined in .env',
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Create payin (deposit)
    // ─────────────────────────────────────────────────────────────────────────
    async createDepositOrder(params: {
        orderNo: string;
        amount: string;
        userId: number;
        bonusCode?: string;
        payerName?: string;
        payerMobile?: string;
        payerEmail?: string;
    }): Promise<{
        success: boolean;
        payUrl?: string;
        upiLink?: string;
        qrCode?: string;
        gatewayTxnId?: string;
        vendorId?: string;
        mOrderId?: string;
        message?: string;
    }> {
        this.assertConfig();

        const amountFloat = parseFloat(params.amount);
        if (isNaN(amountFloat) || amountFloat < 1) {
            throw new Error('Invalid amount for UltraPay (Gateway 9)');
        }

        // UltraPay requires client_txn_id to be a unique numeric-only string.
        // We own generation here so the contract is guaranteed regardless of
        // what the caller sends in orderNo. 13-digit ms timestamp + userId +
        // 4-digit random → globally unique and always digits.
        const clientTxnId =
            `${Date.now()}${params.userId}${Math.floor(1000 + Math.random() * 9000)}`;

        // Never forward real user PII to UltraPay — always synthesize
        // well-formed placeholder values. UltraPay validates format only.
        const randomMobile = (): string => {
            // Indian 10-digit mobile: first digit 6-9, remaining 9 random digits.
            const first = 6 + Math.floor(Math.random() * 4);
            let rest = '';
            for (let i = 0; i < 9; i++) rest += Math.floor(Math.random() * 10);
            return `${first}${rest}`;
        };
        const randomAlpha = (len: number): string => {
            const chars = 'abcdefghijklmnopqrstuvwxyz';
            let s = '';
            for (let i = 0; i < len; i++)
                s += chars[Math.floor(Math.random() * chars.length)];
            return s;
        };

        const mobile = randomMobile();
        const email = `${randomAlpha(8)}@gmail.com`;
        const name = randomAlpha(6);

        const url = `${this.baseUrl}/api/v1/ultrapay/payin`;
        const payload = {
            amount: amountFloat,
            mobile,
            email,
            name,
            client_txn_id: clientTxnId,
        };

        const reqHeaders = {
            'Content-Type': 'application/json',
            'X-API-KEY': this.payinApiKey,
            Accept: 'application/json',
        };

        // Mask the API key in logs — print everything else verbatim so we can
        // diff what we actually sent against what UltraPay expects.
        const headersForLog = {
            ...reqHeaders,
            'X-API-KEY': this.payinApiKey
                ? `${this.payinApiKey.slice(0, 6)}…${this.payinApiKey.slice(-4)}`
                : '(empty)',
        };

        this.logger.log(`[UPI9] -> POST ${url}`);
        this.logger.log(`[UPI9]    headers: ${JSON.stringify(headersForLog)}`);
        this.logger.log(`[UPI9]    body:    ${JSON.stringify(payload)}`);

        try {
            const apiRes = await axios.post(url, payload, {
                headers: reqHeaders,
                timeout: 30_000,
                validateStatus: () => true,
            });

            const data = apiRes.data;
            this.logger.log(
                `[UPI9] <- HTTP ${apiRes.status} | ${JSON.stringify(data)}`,
            );

            // UltraPay success shape:
            //   { status: true, message, data: { txn_id, vendor_id, upi_link, qr_code, response_time } }
            const isSuccess =
                apiRes.status >= 200 &&
                apiRes.status < 300 &&
                (data?.status === true ||
                    data?.status === 'success' ||
                    data?.success === true);

            const upiLink: string = data?.data?.upi_link || '';
            const qrCode: string = data?.data?.qr_code || '';

            // Hosted-checkout URL is optional — some flows return only upi_link.
            // Prefer upi_link (it's what the user actually pays with) and fall
            // back to any redirect-style URL the gateway might add later.
            const payUrl =
                upiLink ||
                data?.data?.payment_url ||
                data?.data?.checkout_url ||
                data?.data?.redirect_url ||
                data?.data?.url ||
                '';

            const gatewayTxnId: string | undefined =
                data?.data?.txn_id || undefined;
            const vendorId: string | undefined =
                data?.data?.vendor_id || undefined;

            if (!isSuccess) {
                return {
                    success: false,
                    message:
                        data?.message ||
                        data?.msg ||
                        `Gateway rejected request (HTTP ${apiRes.status})`,
                };
            }

            if (!payUrl && !qrCode) {
                this.logger.warn(
                    `[UPI9] status=true but no upi_link/qr_code/payUrl — txn_id:${gatewayTxnId}. Frontend will show pending state.`,
                );
            }

            // Record PENDING transaction. utr = our numeric client_txn_id so
            // the webhook handler (which looks up by client_txn_id → utr)
            // finds this row. The frontend's orderNo is kept in
            // paymentDetails for audit/correlation only.
            await this.prisma.transaction.create({
                data: {
                    userId: params.userId,
                    amount: amountFloat,
                    type: 'DEPOSIT',
                    status: 'PENDING',
                    paymentMethod: 'UPI9',
                    utr: clientTxnId,
                    remarks: 'Deposit via Gateway 9 (UltraPay)',
                    paymentDetails: {
                        ...(params.bonusCode ? { bonusCode: params.bonusCode } : {}),
                        ...(gatewayTxnId ? { gatewayTxnId } : {}),
                        ...(vendorId ? { vendorId } : {}),
                        ...(upiLink ? { upiLink } : {}),
                        ...(qrCode ? { qrCode } : {}),
                        ...(params.orderNo ? { frontendOrderNo: params.orderNo } : {}),
                        gateway: 'ultrapay',
                    } as any,
                },
            });

            return {
                success: true,
                payUrl,
                upiLink,
                qrCode,
                gatewayTxnId,
                vendorId,
                mOrderId: clientTxnId,
            };
        } catch (error: any) {
            this.logger.error(`[UPI9] createDepositOrder error: ${error.message}`);
            if (error.response) {
                this.logger.error(
                    `[UPI9] Response data: ${JSON.stringify(error.response.data)}`,
                );
            }
            throw new HttpException(
                error.response?.data?.message ||
                    error.response?.data?.msg ||
                    'Failed to connect to UltraPay (Gateway 9)',
                HttpStatus.BAD_GATEWAY,
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Query deposit status
    // ─────────────────────────────────────────────────────────────────────────
    async queryDepositOrder(txnId: string): Promise<any> {
        const url = `${this.baseUrl}/api/v1/oniktech/status-check`;
        const payload = { txn_id: txnId };

        this.logger.log(`[UPI9] -> POST ${url} | txn_id: ${txnId}`);

        try {
            const apiRes = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': this.statusApiKey,
                    Accept: 'application/json',
                },
                timeout: 15_000,
                validateStatus: () => true,
            });

            this.logger.log(
                `[UPI9] <- status-check HTTP ${apiRes.status} | ${JSON.stringify(apiRes.data)}`,
            );

            return apiRes.data;
        } catch (error: any) {
            this.logger.error(`[UPI9] queryDepositOrder error: ${error.message}`);
            return {
                success: false,
                message: error.response?.data?.message || error.message,
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Webhook signature verification
    //
    //  UltraPay's webhook signature scheme isn't documented in the postman
    //  collection. If a `PAYMENT9_WEBHOOK_SECRET` is configured AND the
    //  webhook body carries any of {signature, sign, token}, we require a
    //  match against that shared secret. Otherwise we trust the body and
    //  let the controller's own checks (client_txn_id lookup + amount pin)
    //  guard against replay/tamper.
    // ─────────────────────────────────────────────────────────────────────────
    verifyWebhookSignature(body: any): boolean {
        const secret = this.webhookSecret;
        if (!secret) return true;

        const provided = String(
            body?.signature || body?.sign || body?.token || '',
        );
        if (!provided) {
            this.logger.warn(
                '[UPI9] Webhook secret configured but no signature/sign/token in body — rejecting',
            );
            return false;
        }
        const ok = provided === secret;
        if (!ok) {
            this.logger.warn(
                `[UPI9] Webhook signature mismatch. Expected: ${secret}, got: ${provided}`,
            );
        }
        return ok;
    }
}
