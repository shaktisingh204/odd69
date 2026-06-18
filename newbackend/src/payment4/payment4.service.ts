import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class Payment4Service {
    private readonly logger = new Logger(Payment4Service.name);

    private get baseUrl() {
        return this.configService.get<string>('PAYMENT4_BASE_URL', 'https://api.dev.silkpay.ai');
    }

    private get mId() {
        return this.configService.get<string>('PAYMENT4_MERCHANT_ID', 'TEST');
    }

    private get secretKey() {
        return this.configService.get<string>('PAYMENT4_SECRET_KEY', 'SIb3DQEBAQ');
    }

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) { }

    private generateSignature(mOrderId: string, amount: string, timestamp: string): string {
        // mId + mOrderId + amount + timestamp + secretKey
        const rawStr = `${this.mId}${mOrderId}${amount}${timestamp}${this.secretKey}`;
        return crypto.createHash('md5').update(rawStr).digest('hex'); // lowercase hex
    }

    async createDepositOrder(params: {
        orderNo: string;
        amount: string;
        userId: number;
        bonusCode?: string;
        payerName?: string;
    }) {
        const amountFloat = parseFloat(params.amount);
        if (isNaN(amountFloat) || amountFloat < 1) {
            throw new Error('Invalid amount for UPI Gateway 4');
        }

        // Amount must retain two decimal places
        const formattedAmount = amountFloat.toFixed(2);
        const timestamp = Date.now().toString();

        const sign = this.generateSignature(params.orderNo, formattedAmount, timestamp);

        const appUrl = this.configService.get<string>('APP_URL') || 'https://zeero.bet';
        const returnUrl = `${appUrl}/profile/transactions`;
        const notifyUrl = this.configService.get<string>(
            'PAYMENT4_NOTIFY_URL',
            `${this.configService.get<string>('API_URL', 'https://zeero.bet/api')}/payment4/notify`
        );

        const payload = {
            mId: this.mId,
            mOrderId: params.orderNo,
            amount: formattedAmount,
            currency: 'INR',
            notifyUrl: notifyUrl,
            returnUrl: returnUrl,
            timestamp: parseInt(timestamp, 10),
            sign: sign,
        };

        this.logger.log(`[UPI4] createDepositOrder Payload: ${JSON.stringify(payload)}`);

        try {
            const apiRes = await axios.post(`${this.baseUrl}/transaction/payin/v2`, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000,
            });

            const data = apiRes.data;
            this.logger.log(`[UPI4] Gateway response: ${JSON.stringify(data)}`);

            const isSuccess = data?.status === '200' || data?.status === 200 || data?.code === 0;
            const payUrl = data?.data?.paymentUrl || data?.data?.payUrl;

            if (isSuccess && payUrl) {
                // Record PENDING transaction
                await this.prisma.transaction.create({
                    data: {
                        userId: params.userId,
                        amount: amountFloat,
                        type: 'DEPOSIT',
                        status: 'PENDING',
                        paymentMethod: 'UPI4',
                        utr: params.orderNo,
                        remarks: 'Deposit via Gateway 4 (Silkpay)',
                        paymentDetails: params.bonusCode ? { bonusCode: params.bonusCode } : {},
                    },
                });

                return {
                    success: true,
                    payUrl: payUrl,
                    mOrderId: params.orderNo,
                };
            } else {
                return {
                    success: false,
                    message: data?.message || data?.msg || 'Gateway rejected request',
                };
            }
        } catch (error: any) {
            this.logger.error(`[UPI4] Axios error: ${error.message}`);
            if (error.response) {
                this.logger.error(`[UPI4] Response data: ${JSON.stringify(error.response.data)}`);
            }
            throw new HttpException(
                error.response?.data?.msg || 'Failed to connect to UPI Gateway 4',
                HttpStatus.BAD_GATEWAY
            );
        }
    }

    verifyWebhookSignature(body: any): boolean {
        const amount = String(body.amount);
        const mOrderId = String(body.mOrderId);
        const timestamp = String(body.timestamp);
        const providedSign = body.sign;

        // Silkpay Callback Signature Formula: md5(amount + mId + mOrderId + timestamp + secretKey)
        const rawString = `${amount}${this.mId}${mOrderId}${timestamp}${this.secretKey}`;
        const expectedSign = crypto.createHash('md5').update(rawString).digest('hex');
        
        if (expectedSign.toLowerCase() === (providedSign || '').toLowerCase()) {
            return true;
        }

        this.logger.debug(`[UPI4] Webhook signature mismatch. Expected ${expectedSign}, got ${providedSign}`);
        return false;
    }

    async queryDepositOrder(orderNo: string): Promise<any> {
        const timestamp = Date.now().toString();
        const rawStr = `${this.mId}${orderNo}${timestamp}${this.secretKey}`;
        const sign = crypto.createHash('md5').update(rawStr).digest('hex');

        const payload = {
            mId: this.mId,
            mOrderId: orderNo,
            timestamp: parseInt(timestamp, 10),
            sign,
        };

        try {
            const apiRes = await axios.post(`${this.baseUrl}/transaction/query/v1`, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
            });
            return apiRes.data;
        } catch (error: any) {
            this.logger.error(`[UPI4] queryOrder error: ${error.message}`);
            return {
                success: false,
                message: error.response?.data?.msg || error.message,
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Payout (Withdrawal)
    // ─────────────────────────────────────────────────────────────────────────

    private generatePayoutSignature(mOrderId: string, amount: string, timestamp: string): string {
        // Payout signature: mId + mOrderId + amount + timestamp + secretKey
        const rawStr = `${this.mId}${mOrderId}${amount}${timestamp}${this.secretKey}`;
        return crypto.createHash('md5').update(rawStr).digest('hex');
    }

    async createPayoutOrder(params: {
        orderNo: string;
        amount: number;
        acctName: string;
        acctNo: string;
        ifscCode?: string;
    }): Promise<any> {
        const formattedAmount = params.amount.toFixed(2);
        const timestamp = Date.now().toString();
        const sign = this.generatePayoutSignature(params.orderNo, formattedAmount, timestamp);

        const notifyUrl = this.configService.get<string>(
            'PAYMENT4_PAYOUT_NOTIFY_URL',
            `${this.configService.get<string>('API_URL', 'https://zeero.bet/api')}/payment4/payout/notify`,
        );

        const payload = {
            mId: this.mId,
            mOrderId: params.orderNo,
            amount: formattedAmount,
            currency: 'INR',
            acctName: params.acctName,
            acctNo: params.acctNo,
            ifscCode: params.ifscCode || '',
            notifyUrl,
            timestamp: parseInt(timestamp, 10),
            sign,
        };

        this.logger.log(`[UPI4] createPayoutOrder Payload: ${JSON.stringify(payload)}`);

        try {
            const apiRes = await axios.post(`${this.baseUrl}/transaction/payout/v2`, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000,
            });

            const data = apiRes.data;
            this.logger.log(`[UPI4] Payout gateway response: ${JSON.stringify(data)}`);

            const isSuccess = data?.status === '200' || data?.status === 200 || data?.code === 0;
            if (isSuccess) {
                return { success: true, data };
            }
            return { success: false, message: data?.message || data?.msg || 'Gateway rejected payout' };
        } catch (error: any) {
            this.logger.error(`[UPI4] Payout error: ${error.message}`);
            throw new HttpException(
                error.response?.data?.msg || 'Failed to connect to UPI Gateway 4 for payout',
                HttpStatus.BAD_GATEWAY,
            );
        }
    }

    verifyPayoutWebhookSignature(body: any): boolean {
        const amount = String(body.amount);
        const mOrderId = String(body.mOrderId);
        const timestamp = String(body.timestamp);
        const providedSign = body.sign;

        // Payout callback signature: md5(amount + mId + mOrderId + timestamp + secretKey)
        const rawString = `${amount}${this.mId}${mOrderId}${timestamp}${this.secretKey}`;
        const expectedSign = crypto.createHash('md5').update(rawString).digest('hex');

        if (expectedSign.toLowerCase() === (providedSign || '').toLowerCase()) {
            return true;
        }

        this.logger.debug(`[UPI4] Payout webhook signature mismatch. Expected ${expectedSign}, got ${providedSign}`);
        return false;
    }
}
