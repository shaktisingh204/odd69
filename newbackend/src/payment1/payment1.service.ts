import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class Payment1Service {
    private readonly logger = new Logger(Payment1Service.name);

    constructor(private configService: ConfigService) { }

    /**
     * Verify a payment directly with Cashfree API (used by PHP callback flow).
     */
    async verifyPaymentWithCashfree(gatewayTxn: string, expectedAmount: number): Promise<boolean> {
        try {
            const appId = this.configService.get<string>('CASHFREE_APP_ID') || '';
            const secretKey = this.configService.get<string>('CASHFREE_SECRET_KEY') || '';

            this.logger.log(`[UPI1] Verifying payment ${gatewayTxn} directly with Cashfree...`);
            const res = await axios.get(`https://api.cashfree.com/pg/orders/${gatewayTxn}`, {
                headers: {
                    'x-api-version': '2023-08-01',
                    'x-client-id': appId,
                    'x-client-secret': secretKey
                }
            });

            const data = res.data;
            if (data.order_status === 'PAID') {
                const paidAmountInINR = data.order_amount;

                if (paidAmountInINR >= expectedAmount) {
                    this.logger.log(`[UPI1] Cashfree API Verification Successful for ${gatewayTxn} (Paid: ₹${paidAmountInINR})`);
                    return true;
                } else {
                    this.logger.warn(`[UPI1] Amount mismatch from Cashfree. Expected ${expectedAmount}, got ${paidAmountInINR}`);
                    return false;
                }
            } else {
                this.logger.warn(`[UPI1] Cashfree status is not PAID: ${data.order_status}`);
                return false;
            }
        } catch (error: any) {
            this.logger.error(`[UPI1] Cashfree verification failed: ${error.response?.data?.message || error.message}`);
            return false;
        }
    }

    /**
     * Verify the X-Webhook-Signature header on incoming webhook events.
     * Cashfree signs the raw JSON body with HMAC SHA-256 using the Secret Key.
     */
    verifyWebhookSignature(timestamp: string, rawBody: string | Buffer, receivedSignature: string): boolean {
        const webhookSecret = this.configService.get<string>('CASHFREE_SECRET_KEY');

        if (!webhookSecret) {
            this.logger.error('[UPI1-Webhook] CASHFREE_SECRET_KEY is not configured in .env');
            return false;
        }

        if (!receivedSignature) {
            this.logger.warn('[UPI1-Webhook] Missing X-Webhook-Signature header');
            return false;
        }

        // Cashfree signature verification: signature is generated over timestamp + rawBody
        const signaturePayload = timestamp + rawBody;
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(signaturePayload)
            .digest('base64');

        const valid = expectedSignature === receivedSignature;

        if (!valid) {
            this.logger.warn(`[UPI1-Webhook] Signature mismatch. Expected: ${expectedSignature}, Got: ${receivedSignature}`);
        }

        return valid;
    }
}
