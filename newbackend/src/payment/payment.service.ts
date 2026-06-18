import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(private configService: ConfigService) { }

    /**
     * Sorts all fields requiring signature in ascending order of ASCII code,
     * concatenates them into a string (k=v&k=v), appends the merchant key (&key=x),
     * and generates an MD5 hash (lowercase).
     */
    /** Fields that are internal to our system and must never be sent to / signed for the gateway. */
    private static readonly INTERNAL_FIELDS = new Set([
        'userId', 'promoCode', 'bonusCode', 'internalNote',
    ]);

    generateSignature(params: Record<string, any>, key: string): string {
        const sortedKeys = Object.keys(params)
            .filter((k) =>
                k !== 'sign' &&
                k !== 'sign_type' &&
                k !== 'signType' &&
                !PaymentService.INTERNAL_FIELDS.has(k) &&
                params[k] !== undefined &&
                params[k] !== null &&
                params[k] !== '',
            )
            .sort();

        const queryParts = sortedKeys.map((k) => `${k}=${params[k]}`);
        const queryString = queryParts.join('&') + `&key=${key}`;

        this.logger.log(`[Sig] Query string: ${queryString}`);

        return crypto.createHash('md5').update(queryString, 'utf8').digest('hex').toLowerCase();
    }

    /**
     * Generates a complete payment request payload with signature
     */
    createPaymentPayload(orderData: Record<string, any>): Record<string, any> {
        const mchKey = this.configService.get<string>('PAYMENT_MCH_KEY');
        const mchId = this.configService.get<string>('PAYMENT_MCH_ID');
        const notifyUrl = this.configService.get<string>('PAYMENT_NOTIFY_URL');

        if (!mchKey || !mchId || !notifyUrl) {
            throw new Error('Payment configuration is incomplete');
        }

        const payload = {
            version: '1.0',
            mch_id: mchId,
            notify_url: notifyUrl,
            sign_type: 'MD5',
            ...orderData,
        };

        const sign = this.generateSignature(payload, mchKey);
        payload['sign'] = sign;

        return payload;
    }

    /**
     * Verifies the signature from a webhook/callback request
     */
    verifyCallbackSignature(callbackData: Record<string, any>): boolean {
        const mchKey = this.configService.get<string>('PAYMENT_MCH_KEY');

        if (!mchKey) {
            this.logger.error('PAYMENT_MCH_KEY is not configured during callback verification');
            return false;
        }

        const receivedSign = callbackData['sign'];
        if (!receivedSign) {
            return false;
        }

        const calculatedSign = this.generateSignature(callbackData, mchKey);
        return this.constantTimeEqual(calculatedSign, String(receivedSign).toLowerCase());
    }

    private constantTimeEqual(a: string, b: string): boolean {
        if (typeof a !== 'string' || typeof b !== 'string') return false;
        if (a.length !== b.length) return false;
        try {
            return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
        } catch {
            return false;
        }
    }

    /**
     * Generates a complete payout request payload with signature
     */
    createPayoutPayload(transferData: Record<string, any>): Record<string, any> {
        // PAYMENT_PAYOUT_KEY is optional — fall back to the standard merchant key
        // if the gateway uses a single key for both deposits and payouts.
        const payoutKey =
            this.configService.get<string>('PAYMENT_PAYOUT_KEY') ||
            this.configService.get<string>('PAYMENT_MCH_KEY');
        const mchId = this.configService.get<string>('PAYMENT_MCH_ID');
        const notifyUrl = this.configService.get<string>('PAYMENT_PAYOUT_NOTIFY_URL') ||
            this.configService.get<string>('PAYMENT_NOTIFY_URL');

        if (!payoutKey || !mchId || !notifyUrl) {
            throw new Error('Payout configuration is incomplete — missing PAYMENT_MCH_KEY / PAYMENT_PAYOUT_KEY, PAYMENT_MCH_ID, or PAYMENT_PAYOUT_NOTIFY_URL');
        }

        const payload = {
            mch_id: mchId,
            notify_url: notifyUrl,
            sign_type: 'MD5',
            ...transferData,
        };

        this.logger.log(`[Payout] Unsigned payload: ${JSON.stringify(payload)}`);

        const sign = this.generateSignature(payload, payoutKey);
        payload['sign'] = sign;

        return payload;
    }

    /**
     * Verifies the signature from a payout webhook/callback request
     */
    verifyPayoutCallbackSignature(callbackData: Record<string, any>): boolean {
        const payoutKey =
            this.configService.get<string>('PAYMENT_PAYOUT_KEY') ||
            this.configService.get<string>('PAYMENT_MCH_KEY');

        if (!payoutKey) {
            this.logger.error('Neither PAYMENT_PAYOUT_KEY nor PAYMENT_MCH_KEY is configured during payout callback verification');
            return false;
        }

        const receivedSign = callbackData['sign'];
        if (!receivedSign) {
            return false;
        }

        const calculatedSign = this.generateSignature(callbackData, payoutKey);
        return this.constantTimeEqual(calculatedSign, String(receivedSign).toLowerCase());
    }
}
