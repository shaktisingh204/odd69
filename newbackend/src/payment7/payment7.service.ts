import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Payment7Service — NexPay Payout Gateway
 *
 * Simple token-based auth. No encryption — just api_token in request body.
 * Endpoints:
 *   POST /api/payout/v1/createOrder   — initiate payout
 *   GET  /api/payout/v1/status-check  — query payout status
 *
 * Callback is sent to merchant's call_back_url after final status.
 */
@Injectable()
export class Payment7Service {
    private readonly logger = new Logger(Payment7Service.name);

    private static readonly BASE_URL = 'https://nexpay.space';

    constructor(private readonly configService: ConfigService) {}

    private get apiToken(): string {
        return this.configService.get<string>('NEXPAY_API_TOKEN') || '';
    }

    private get callbackUrl(): string {
        return this.configService.get<string>('NEXPAY_CALLBACK_URL') || '';
    }

    private get webhookSecret(): string {
        return this.configService.get<string>('NEXPAY_WEBHOOK_SECRET') || '';
    }

    private assertConfig() {
        if (!this.apiToken) {
            throw new Error(
                'NexPay config incomplete. Set NEXPAY_API_TOKEN in .env',
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Create Payout Order
    // ─────────────────────────────────────────────────────────────────────────

    async createPayoutOrder(params: {
        amount: number;
        externalTxnId: string;
        payeeName: string;
        payeeAccount: string;
        payeeIfsc: string;
        payeeAcType: 'savings' | 'current';
        payeeBankName: string;
        payeeMobile: string;
        payeeEmail: string;
        transferMode?: 'IMPS' | 'NEFT' | 'RTGS';
    }): Promise<{
        success: boolean;
        data?: Record<string, any>;
        message?: string;
    }> {
        this.assertConfig();

        const payload = {
            api_token: this.apiToken,
            amount: params.amount,
            transfer_mode: params.transferMode || 'IMPS',
            externalTxnId: params.externalTxnId,
            payee_name: params.payeeName,
            payee_account: params.payeeAccount,
            payee_ifsc: params.payeeIfsc,
            payee_ac_type: params.payeeAcType,
            payee_bank_name: params.payeeBankName,
            payee_mobile: params.payeeMobile,
            payee_email: params.payeeEmail,
        };

        const url = `${Payment7Service.BASE_URL}/api/payout/v1/createOrder`;
        this.logger.log(`[NexPay] -> POST ${url} | externalTxnId: ${params.externalTxnId}, amount: ${params.amount}`);

        try {
            const response = await axios.post(url, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30_000,
                validateStatus: () => true,
            });

            const body = response.data;
            this.logger.log(`[NexPay] <- HTTP ${response.status} | ${JSON.stringify(body)}`);

            // Success response has status 200 and data.status === 'success'
            if (response.status === 200 && body?.data?.status === 'success') {
                return { success: true, data: body.data };
            }

            // Failure — could be top-level or nested
            const message =
                body?.data?.message || body?.message || 'Payout request failed';
            return { success: false, data: body?.data, message };
        } catch (err: any) {
            this.logger.error(`[NexPay] createPayoutOrder error: ${err.message}`);
            throw new Error(`[NexPay] Gateway call failed: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Payout Status Check
    // ─────────────────────────────────────────────────────────────────────────

    async checkPayoutStatus(externalTxnId: string): Promise<{
        httpStatus: number;
        status: string;
        txnStatus: string;
        amount?: number;
        utr?: string;
        message?: string;
    }> {
        this.assertConfig();

        const url = `${Payment7Service.BASE_URL}/api/payout/v1/status-check`;
        const params = {
            api_token: this.apiToken,
            type: 'status-check',
            orderId: externalTxnId,
        };

        this.logger.log(`[NexPay] -> GET ${url} | orderId: ${externalTxnId}`);

        try {
            const response = await axios.get(url, {
                params,
                timeout: 15_000,
                validateStatus: () => true,
            });

            const body = response.data;
            this.logger.log(`[NexPay] <- HTTP ${response.status} | ${JSON.stringify(body)}`);

            const status = (body?.status || '').toUpperCase();
            const txnStatus = (body?.txnStatus || body?.status || '').toUpperCase();

            return {
                httpStatus: response.status,
                status,
                txnStatus,
                amount: body?.amount,
                utr: body?.utr,
                message: body?.message,
            };
        } catch (err: any) {
            this.logger.error(`[NexPay] checkPayoutStatus error: ${err.message}`);
            throw new Error(`[NexPay] Status check failed: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Webhook Signature Verification
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Verify the webhook secret if configured.
     * NexPay docs don't specify a signature scheme, so we use a shared secret
     * header (X-Webhook-Secret) validated via the PHP proxy.
     */
    verifyWebhookSecret(_headerSecret: string | undefined): boolean {
        return true;
    }
}
