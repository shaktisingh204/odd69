import { Controller, Post, Body, Res, HttpStatus, Logger, Req, UseGuards, RawBodyRequest, Headers } from '@nestjs/common';
import { Payment1Service } from './payment1.service';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BonusService } from '../bonus/bonus.service';
import { UsersService } from '../users/users.service';
import { ReferralService } from '../referral/referral.service';
import { EmailService } from '../email/email.service';
import { assertMinDeposit } from '../payment/payment-limits.util';
import { buildPaymentToken } from '../payment/payment-token.util';
import { sanitizeReturnUrl } from '../payment/return-url.util';

@Controller('payment1')
export class Payment1Controller {
    private readonly logger = new Logger(Payment1Controller.name);

    constructor(
        private readonly payment1Service: Payment1Service,
        private readonly prisma: PrismaService,
        private configService: ConfigService,
        private readonly bonusService: BonusService,
        private readonly usersService: UsersService,
        private readonly referralService: ReferralService,
        private readonly emailService: EmailService,
    ) { }

    @UseGuards(JwtAuthGuard)
    @Post('create')
    async createPayment(@Body() body: any, @Req() req: Request, @Res() res: Response) {
        try {
            const {
                orderNo,
                amount,
                bonusCode,
                promoCode,
                returnUrl,
            } = body;

            this.logger.log(`[UPI1] Creating deposit — orderNo: ${orderNo}, amount: ${amount}`);

            const minErr = await assertMinDeposit(this.prisma, parseFloat(amount), { gatewayKey: 'MIN_DEPOSIT_CASHFREE' });
            if (minErr) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: minErr });
            }

            // Fetch Cashfree Gateway URL from SystemConfig dynamically
            const configObj = await this.prisma.systemConfig.findUnique({ where: { key: 'CASHFREE_GATEWAY_URL' } });
            const phpGatewayBaseUrl = configObj?.value || this.configService.get<string>('PAYMENT1_BASE_URL');

            if (!phpGatewayBaseUrl) {
                return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                    success: false,
                    message: 'CASHFREE_GATEWAY_URL is not configured in Admin Dashboard or .env',
                });
            }

            const userId: number = (req as any).user?.id || body.userId;
            const effectiveBonusCode = ((bonusCode || promoCode || '').trim().toUpperCase()) || undefined;

            if (userId && orderNo) {
                try {
                    const existing = await this.prisma.transaction.findUnique({ where: { utr: orderNo } });
                    if (!existing) {
                        await this.prisma.transaction.create({
                            data: {
                                userId,
                                amount: parseFloat(amount),
                                type: 'DEPOSIT',
                                status: 'PENDING',
                                paymentMethod: 'UPI Gateway 1 (Cashfree)',
                                utr: orderNo,
                                paymentDetails: {
                                    gateway: 'upi1',
                                    depositCurrency: 'INR',
                                    orderNo,
                                    ...(effectiveBonusCode ? { bonusCode: effectiveBonusCode } : {}),
                                } as any,
                            },
                        });
                        this.logger.log(`✅ [UPI1] DB: PENDING deposit CREATED — utr: ${orderNo}, userId: ${userId}`);
                    }
                } catch (e) {
                    this.logger.error(`❌ [UPI1] DB: failed to create PENDING deposit — ${e.message}`);
                }
            }

            // Sanitize returnUrl against the host allowlist and omit userId from
            // the client-visible token. Token is HMAC-signed for tamper detection.
            // Crediting is always driven by the PENDING txn looked up via orderNo,
            // not by this token.
            const safeReturnUrl = await sanitizeReturnUrl(returnUrl, this.prisma);
            const token = buildPaymentToken({
                orderNo,
                amount,
                returnUrl: safeReturnUrl,
            });
            const redirectUrl = `${phpGatewayBaseUrl}/index.php?token=${encodeURIComponent(token)}`;

            return res.status(HttpStatus.OK).json({
                success: true,
                payUrl: redirectUrl,
            });
        } catch (error) {
            this.logger.error(`[UPI1] Create deposit error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to initiate UPI 1 deposit',
            });
        }
    }

    @Public()
    @Post('notify')
    async paymentCallback(@Req() req: Request, @Body() body: any, @Res() res: Response) {
        this.logger.log(`[UPI1] Deposit callback (Return URL): ${JSON.stringify(body)}`);

        try {
            const { orderNo, amount, status, gatewayTxn } = body;

            if (!gatewayTxn) {
                this.logger.warn(`[UPI1] Deposit callback missing gatewayTxn!`);
            }

            this.logger.log(
                `[UPI1] Deposit callback acknowledged — orderNo: ${orderNo}, status: ${status}, amount: ${amount}. (Actual crediting will be handled securely by Webhook).`
            );

            // Note: We DO NOT call verifyPaymentWithCashfree() anymore per configuration,
            // and we DO NOT call this.creditDeposit() here to prevent client-side frontend spoofing.
            // The secure cashfree-webhook endpoint will natively fulfill the transaction.

            return res.status(HttpStatus.OK).send('ok');
        } catch (error) {
            this.logger.error(`[UPI1] Deposit callback error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('fail');
        }
    }

    /**
     * Direct Cashfree Webhook — handles custom events sent by Cashfree servers.
     * Cashfree uses x-webhook-timestamp and x-webhook-signature Headers.
     */
    @Public()
    @Post('cashfree-webhook')
    async cashfreeWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('x-webhook-signature') signature: string,
        @Headers('x-webhook-timestamp') timestamp: string,
        @Body() body: any,
        @Res() res: Response,
    ) {
        this.logger.log(`[UPI1-Webhook] Received event: ${body?.type || 'unknown'}`);

        try {
            // 1. Verify signature using raw body and timestamp
            const rawBody = req.rawBody?.toString();
            if (!rawBody) {
                this.logger.error('[UPI1-Webhook] Raw body not available — cannot verify signature');
                return res.status(HttpStatus.BAD_REQUEST).json({ status: 'error', message: 'Raw body unavailable' });
            }

            const isValid = this.payment1Service.verifyWebhookSignature(timestamp || '', rawBody, signature);
            if (!isValid) {
                this.logger.warn('[UPI1-Webhook] Invalid webhook signature — rejecting');
                return res.status(HttpStatus.BAD_REQUEST).json({ status: 'error', message: 'Invalid signature' });
            }

            const eventType = body?.type;
            const paymentEntity = body?.data?.payment;
            const orderEntity = body?.data?.order;

            if (!paymentEntity && !orderEntity) {
                this.logger.warn('[UPI1-Webhook] No payment/order entity in payload');
                return res.status(HttpStatus.OK).json({ status: 'ok' });
            }

            // Fallback for getting identifiers
            const cashfreePaymentId = paymentEntity?.cf_payment_id;
            const cashfreeOrderId = orderEntity?.order_id;
            const amountInINR = paymentEntity?.payment_amount || orderEntity?.order_amount;
            const paymentStatus = paymentEntity?.payment_status;

            // Optional note parsing depending on how Cashfree is set up at checkout
            const adxOrderNo: string | undefined = orderEntity?.order_tags?.orderNo || orderEntity?.order_id;

            this.logger.log(`[UPI1-Webhook] Event: ${eventType}, PaymentID: ${cashfreePaymentId}, OrderID: ${cashfreeOrderId}, Amount: ₹${amountInINR}, Status: ${paymentStatus}, OrderNo: ${adxOrderNo || 'N/A'}`);

            if (!adxOrderNo) {
                this.logger.warn(`[UPI1-Webhook] No orderNo found — cannot match transaction. Ignoring.`);
                return res.status(HttpStatus.OK).json({ status: 'ok' });
            }

            if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
                const txn = await this.prisma.transaction.findUnique({ where: { utr: adxOrderNo } });

                if (txn && txn.status === 'PENDING') {
                    await this.creditDeposit(txn.utr, amountInINR);
                    this.logger.log(`[UPI1-Webhook] SUCCESS processed for txn ${txn.utr}`);
                } else if (txn) {
                    this.logger.log(`[UPI1-Webhook] Txn ${adxOrderNo} already ${txn.status} — skip`);
                } else {
                    this.logger.warn(`[UPI1-Webhook] No transaction found for orderNo ${adxOrderNo}`);
                }
            } else if (eventType === 'PAYMENT_FAILED_WEBHOOK') {
                const txn = await this.prisma.transaction.findUnique({ where: { utr: adxOrderNo } });

                if (txn && txn.status === 'PENDING') {
                    await this.markDepositFailed(txn.utr);
                    this.logger.log(`[UPI1-Webhook] FAILED — marked txn ${txn.utr} as REJECTED`);
                } else if (txn) {
                    this.logger.log(`[UPI1-Webhook] Txn ${adxOrderNo} already ${txn.status} — skip`);
                } else {
                    this.logger.warn(`[UPI1-Webhook] No transaction found for orderNo ${adxOrderNo}`);
                }
            } else {
                this.logger.log(`[UPI1-Webhook] Ignoring event: ${eventType}`);
            }

            return res.status(HttpStatus.OK).json({ status: 'ok' });
        } catch (error) {
            this.logger.error(`[UPI1-Webhook] Error processing webhook: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: 'error' });
        }
    }

    private async creditDeposit(orderNo: string, gatewayAmount: number) {
        try {
            const txn = await this.prisma.transaction.findUnique({ where: { utr: orderNo } });
            if (!txn) { this.logger.warn(`[UPI1] No transaction for orderNo: ${orderNo}`); return; }
            if (txn.status !== 'PENDING') { this.logger.warn(`[UPI1] Already ${txn.status} — skip`); return; }

            // SECURITY: pin credit to the stored PENDING txn amount; never accept
            // the webhook body's amount field which could be replayed/tampered.
            if (
                gatewayAmount > 0 &&
                Math.abs(gatewayAmount - txn.amount) > 0.01
            ) {
                this.logger.warn(
                    `[UPI1] Amount mismatch — stored ₹${txn.amount}, gateway reported ₹${gatewayAmount}. Refusing credit.`,
                );
                return;
            }
            const credit = txn.amount;
            const previousDeposits = await this.prisma.transaction.count({
                where: { userId: txn.userId, type: 'DEPOSIT', status: 'APPROVED' },
            });

            const processed = await this.prisma.$transaction(async (tx) => {
                // Use atomic lock validation via updateMany to prevent concurrent rapid webhooks from double crediting
                const updatedCount = await tx.transaction.updateMany({
                    where: { id: txn.id, status: 'PENDING' },
                    data: { status: 'APPROVED', amount: credit }
                });
                
                if (updatedCount.count === 0) return false;

                await tx.user.update({ where: { id: txn.userId }, data: { balance: { increment: credit } } });
                return true;
            });

            if (!processed) {
                this.logger.warn(`[UPI1] Transaction already processed concurrently — skip`);
                return;
            }

            this.logger.log(`[UPI1] Deposit APPROVED — userId: ${txn.userId}, amount: ${credit}`);

            try {
                await this.usersService.setWageringOnFirstDeposit(txn.userId, credit);
            } catch (e) {
                this.logger.error(`[UPI1] Wagering update failed (non-fatal): ${e.message}`);
            }

            let depositWageringApplied = false;
            const bonusCode = (txn.paymentDetails as any)?.bonusCode;
            if (bonusCode) {
                try {
                    const bonusResult = await this.bonusService.redeemBonus(txn.userId, bonusCode, credit, {
                        depositCurrency: 'INR',
                        approvedDepositCountBeforeThisDeposit: previousDeposits,
                    });
                    if (bonusResult) {
                        depositWageringApplied = true;
                        this.logger.log(`[UPI1] Bonus redeemed — userId: ${txn.userId}, code: ${bonusCode}`);
                    } else {
                        this.logger.warn(`[UPI1] Bonus code "${bonusCode}" not applied (validation failed) — userId: ${txn.userId}`);
                    }
                } catch (e) {
                    this.logger.error(`[UPI1] Bonus redemption failed (non-fatal): ${e.message}`);
                }
            }

            // ── Default 1× deposit wagering lock if no bonus handled it ───────
            if (!depositWageringApplied) {
                try {
                    await this.bonusService.applyDepositWagering(txn.userId, credit, 1);
                } catch (e) {
                    this.logger.error(`[UPI1] Deposit wagering lock failed (non-fatal): ${e.message}`);
                }
            }

            // ── Referral rewards ──────────────────────────────────────────────
            try {
                if (previousDeposits === 0) {
                    await this.referralService.checkAndAward(txn.userId, 'DEPOSIT_FIRST', credit, `dep_${txn.id}_first`);
                }
                await this.referralService.checkAndAward(txn.userId, 'DEPOSIT_RECURRING', credit, `dep_${txn.id}_rec`);
            } catch (e) {
                this.logger.error(
                    `[UPI1] Referral reward failed (non-fatal): ${e.message}`,
                );
            }

            // ── Deposit confirmation email ───────────────────────────────────
            try {
                const user = await this.prisma.user.findUnique({ where: { id: txn.userId }, select: { email: true, username: true } });
                if (user?.email) {
                    this.emailService.sendDepositSuccess(user.email, user.username || user.email, credit.toFixed(2), 'INR').catch(() => {});
                }
            } catch (e) {
                this.logger.error(`[UPI1] Deposit email failed (non-fatal): ${e.message}`);
            }
        } catch (e) {
            this.logger.error(`[UPI1] creditDeposit error: ${e.message}`);
        }
    }

    private async markDepositFailed(orderNo: string) {
        try {
            const txn = await this.prisma.transaction.findUnique({ where: { utr: orderNo } });
            if (!txn) { this.logger.warn(`[UPI1-Webhook] No transaction for orderNo: ${orderNo}`); return; }
            if (txn.status !== 'PENDING') { this.logger.warn(`[UPI1-Webhook] Already ${txn.status} — skip`); return; }

            // Use atomic lock validation
            const updatedCount = await this.prisma.transaction.updateMany({
                where: { id: txn.id, status: 'PENDING' },
                data: { status: 'REJECTED' },
            });
            
            if (updatedCount.count === 0) {
                this.logger.warn(`[UPI1-Webhook] Transaction already processed concurrently — skip`);
                return;
            }
            this.logger.log(`[UPI1-Webhook] Deposit REJECTED — userId: ${txn.userId}, orderNo: ${orderNo}`);
        } catch (e) {
            this.logger.error(`[UPI1-Webhook] markDepositFailed error: ${e.message}`);
        }
    }
}
