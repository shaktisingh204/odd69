import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class Payment2Service {
    private readonly logger = new Logger(Payment2Service.name);

    constructor(private configService: ConfigService) { }

    /**
     * UPI 2 Gateway Signature Algorithm:
     *
     * 1. Collect all parameters to sign (exclude 'sign' itself).
     * 2. Sort them LEXICOGRAPHICALLY (ascending) by key name.
     * 3. Join them as "key=value&key=value" (standard query-string format).
     * 4. Concatenate the api_key DIRECTLY (no '&' separator before it).
     * 5. MD5 the resulting string.
     *
     * Example:
     *   params = { merchNo:"only", orderNo:"123456", amount:"100.00", currency:"INR" }
     *   source = "amount=100.00&currency=INR&merchNo=only&orderNo=123456"
     *   sign   = MD5(source + api_key)
     */
    generateSignature(params: Record<string, any>, apiKey: string): string {
        const sortedKeys = Object.keys(params)
            .filter(
                (k) =>
                    k !== 'sign' &&
                    params[k] !== undefined &&
                    params[k] !== null &&
                    params[k] !== '',
            )
            .sort(); // lexicographic sort

        const source = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
        const raw = source + apiKey; // NO '&' between source and key

        this.logger.debug(`[UPI2] Signature source: ${raw}`);

        return crypto.createHash('md5').update(raw, 'utf8').digest('hex').toLowerCase();
    }

    /**
     * Build a signed deposit (collection) payload for UPI 2 gateway.
     * The caller supplies the business-layer fields; this method injects
     * merchNo and the computed sign.
     */
    createPaymentPayload(orderData: Record<string, any>): Record<string, any> {
        const apiKey = this.configService.get<string>('PAYMENT2_API_KEY');
        const merchNo = this.configService.get<string>('PAYMENT2_MERCH_NO');

        if (!apiKey || !merchNo) {
            throw new Error(
                'UPI 2 payment configuration is incomplete. ' +
                'Please set PAYMENT2_API_KEY and PAYMENT2_MERCH_NO in .env',
            );
        }

        const payload: Record<string, any> = {
            merchNo,
            ...orderData,
        };

        payload['sign'] = this.generateSignature(payload, apiKey);
        return payload;
    }

    /**
     * Verify an inbound asynchronous callback from the UPI 2 gateway.
     *
     * Per gateway docs:
     *   - The outer envelope is { code, msg, data }.
     *   - Only the fields INSIDE `data` participate in the signature.
     *   - The sign field itself is included inside data but excluded from signing.
     *   - Always sort dynamically — the field list may change with gateway updates.
     */
    verifyCallbackSignature(data: Record<string, any>): boolean {
        const apiKey = this.configService.get<string>('PAYMENT2_API_KEY');

        if (!apiKey) {
            this.logger.error('[UPI2] PAYMENT2_API_KEY is not configured');
            return false;
        }

        const receivedSign = data['sign'];
        if (!receivedSign) {
            this.logger.warn('[UPI2] Callback missing sign field');
            return false;
        }

        const calculatedSign = this.generateSignature(data, apiKey);
        const valid = calculatedSign === receivedSign.toLowerCase();

        if (!valid) {
            this.logger.warn(
                `[UPI2] Signature mismatch. Expected: ${calculatedSign}, Got: ${receivedSign}`,
            );
        }

        return valid;
    }

    /**
     * Build a signed payout (payment-on-behalf) payload for UPI 2 gateway.
     */
    createPayoutPayload(transferData: Record<string, any>): Record<string, any> {
        const apiKey = this.configService.get<string>('PAYMENT2_PAYOUT_API_KEY');
        const merchNo = this.configService.get<string>('PAYMENT2_MERCH_NO');

        if (!apiKey || !merchNo) {
            throw new Error(
                'UPI 2 payout configuration is incomplete. ' +
                'Please set PAYMENT2_PAYOUT_API_KEY and PAYMENT2_MERCH_NO in .env',
            );
        }

        const payload: Record<string, any> = {
            merchNo,
            ...transferData,
        };

        payload['sign'] = this.generateSignature(payload, apiKey);
        return payload;
    }

    /**
     * Verify an inbound payout asynchronous callback from the UPI 2 gateway.
     * Uses the same logic as collection callbacks — sign is inside data.
     */
    verifyPayoutCallbackSignature(data: Record<string, any>): boolean {
        // For payout callbacks the gateway may use the same api_key or a separate one.
        // Using PAYMENT2_PAYOUT_API_KEY, falling back to PAYMENT2_API_KEY.
        const apiKey =
            this.configService.get<string>('PAYMENT2_PAYOUT_API_KEY') ||
            this.configService.get<string>('PAYMENT2_API_KEY');

        if (!apiKey) {
            this.logger.error('[UPI2] No API key configured for payout callback verification');
            return false;
        }

        const receivedSign = data['sign'];
        if (!receivedSign) {
            this.logger.warn('[UPI2] Payout callback missing sign field');
            return false;
        }

        const calculatedSign = this.generateSignature(data, apiKey);
        const valid = calculatedSign === receivedSign.toLowerCase();

        if (!valid) {
            this.logger.warn(
                `[UPI2] Payout signature mismatch. Expected: ${calculatedSign}, Got: ${receivedSign}`,
            );
        }

        return valid;
    }
}
