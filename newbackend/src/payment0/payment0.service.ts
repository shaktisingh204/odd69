import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class Payment0Service {
    private readonly logger = new Logger(Payment0Service.name);

    constructor(private configService: ConfigService) { }

    /**
     * Verify a payment directly with Razorpay API (used by PHP callback flow).
     */
    async verifyPaymentWithRazorpay(gatewayTxn: string, expectedAmount: number): Promise<boolean> {
        try {
            const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
            const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
            if (!keyId || !keySecret) {
                this.logger.error('[UPI0] RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET not configured');
                return false;
            }

            const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

            this.logger.log(`[UPI0] Verifying payment ${gatewayTxn} directly with Razorpay...`);
            const res = await axios.get(`https://api.razorpay.com/v1/payments/${gatewayTxn}`, {
                headers: { 'Authorization': `Basic ${auth}` }
            });

            const data = res.data;
            if (data.status === 'captured') {
                const paidAmountInINR = data.amount / 100;

                if (paidAmountInINR >= expectedAmount) {
                    this.logger.log(`[UPI0] Razorpay API Verification Successful for ${gatewayTxn} (Paid: ₹${paidAmountInINR})`);
                    return true;
                } else {
                    this.logger.warn(`[UPI0] Amount mismatch from Razorpay. Expected ${expectedAmount}, got ${paidAmountInINR}`);
                    return false;
                }
            } else {
                this.logger.warn(`[UPI0] Razorpay status is not captured: ${data.status}`);
                return false;
            }
        } catch (error: any) {
            this.logger.error(`[UPI0] Razorpay verification failed: ${error.response?.data?.error?.description || error.message}`);
            return false;
        }
    }

    /**
     * Verify the X-Razorpay-Signature header on incoming webhook events.
     * Razorpay signs the raw JSON body with HMAC SHA-256 using the Webhook Secret.
     */
    verifyWebhookSignature(rawBody: string | Buffer, receivedSignature: string): boolean {
        const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');

        if (!webhookSecret) {
            this.logger.error('[UPI0-Webhook] RAZORPAY_WEBHOOK_SECRET is not configured in .env');
            return false;
        }

        if (!receivedSignature) {
            this.logger.warn('[UPI0-Webhook] Missing X-Razorpay-Signature header');
            return false;
        }

        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');

        let valid = false;
        try {
            const a = Buffer.from(expectedSignature, 'utf8');
            const b = Buffer.from(receivedSignature, 'utf8');
            valid = a.length === b.length && crypto.timingSafeEqual(a, b);
        } catch {
            valid = false;
        }

        if (!valid) {
            this.logger.warn(`[UPI0-Webhook] Signature mismatch. Expected: ${expectedSignature}, Got: ${receivedSignature}`);
        }

        return valid;
    }
}
