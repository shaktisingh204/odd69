import {
    Controller,
    Post,
    Get,
    Body,
    Req,
    Res,
    Query,
    HttpStatus,
    Logger,
    UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Payment3Service } from './payment3.service';
import { PrismaService } from '../prisma.service';
import { BonusService } from '../bonus/bonus.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { SecurityTokenGuard } from '../auth/security-token.guard';
import { assertMinDeposit } from '../payment/payment-limits.util';
import { ReferralService } from '../referral/referral.service';
import { EmailService } from '../email/email.service';

@Controller('payment3')
export class Payment3Controller {
    private readonly logger = new Logger(Payment3Controller.name);

    constructor(
        private readonly payment3Service: Payment3Service,
        private readonly prisma: PrismaService,
        private readonly bonusService: BonusService,
        private readonly usersService: UsersService,
        private readonly referralService: ReferralService,
        private readonly emailService: EmailService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    //  CREATE DEPOSIT  (iPayment / UPI 3)
    //
    //  Steps:
    //    1. Validate auth + amount
    //    2. Write PENDING transaction to DB (idempotent)
    //    3. Call iPayment to create the order → receive payUrl
    //    4. Return { success, payUrl } to frontend so it can redirect the user
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Post('create')
    async createDeposit(
        @Body() body: any,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        try {
            const userId: number = (req as any).user?.id || body.userId;
            if (!userId) {
                return res
                    .status(HttpStatus.UNAUTHORIZED)
                    .json({ success: false, message: 'Not authenticated' });
            }

            const { orderNo, amount, bonusCode, promoCode, payerName, payMobile, payEmail } = body;
            const numAmount = parseFloat(amount);

            if (!orderNo || !numAmount || numAmount <= 0) {
                return res
                    .status(HttpStatus.BAD_REQUEST)
                    .json({ success: false, message: 'orderNo and a valid amount are required' });
            }

            const minErr = await assertMinDeposit(this.prisma, numAmount, { gatewayKey: 'MIN_DEPOSIT_UPI3' });
            if (minErr) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: minErr });
            }

            const effectiveBonusCode =
                ((bonusCode || promoCode || '').trim().toUpperCase()) || undefined;

            // ── 1. Write PENDING deposit to DB (idempotent) ───────────────────
            try {
                const existing = await this.prisma.transaction.findUnique({
                    where: { utr: orderNo },
                });
                if (!existing) {
                    await this.prisma.transaction.create({
                        data: {
                            userId,
                            amount: numAmount,
                            type: 'DEPOSIT',
                            status: 'PENDING',
                            paymentMethod: 'UPI Gateway 3',
                            utr: orderNo,
                            paymentDetails: {
                                gateway: 'ipayment',
                                gatewayRoute: 'UPI3',
                                depositCurrency: 'INR',
                                orderNo,
                                ...(effectiveBonusCode ? { bonusCode: effectiveBonusCode } : {}),
                            } as any,
                        },
                    });
                    this.logger.log(
                        `✅ [UPI3] PENDING deposit created — utr: ${orderNo}, userId: ${userId}, amount: ${numAmount}${effectiveBonusCode ? `, bonus: ${effectiveBonusCode}` : ''}`,
                    );
                } else {
                    this.logger.warn(`⚠️ [UPI3] Duplicate orderNo ${orderNo} — skipped DB insert`);
                }
            } catch (dbErr) {
                this.logger.error(`❌ [UPI3] DB write failed: ${dbErr.message}`);
                // Non-fatal — continue to call gateway
            }

            // ── 2. Call iPayment gateway ──────────────────────────────────────
            const { payUrl, status, statusDesc } =
                await this.payment3Service.createDepositOrder(
                    orderNo,
                    numAmount,
                    {
                        payerName: (payerName || '').trim() || undefined,
                        payMobile: (payMobile || '').trim() || undefined,
                        payEmail:  (payEmail  || '').trim() || undefined,
                    },
                );

            // status "00" = order created successfully, payUrl is available
            if (status !== '00') {
                this.logger.warn(
                    `[UPI3] Gateway rejected order — status: ${status}, desc: ${statusDesc}`,
                );
                // Rollback: mark as REJECTED so user can retry
                await this.prisma.transaction
                    .update({
                        where: { utr: orderNo },
                        data: { status: 'REJECTED', remarks: `Gateway: ${statusDesc}` },
                    })
                    .catch(() => { /* ignore — transaction may not exist */ });

                return res.status(HttpStatus.OK).json({
                    success: false,
                    message: statusDesc || 'Gateway rejected the deposit request',
                });
            }

            return res.status(HttpStatus.OK).json({ success: true, payUrl });
        } catch (error) {
            this.logger.error(`[UPI3] createDeposit error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to create iPayment deposit',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DEPOSIT WEBHOOK  (iPayment / UPI 3)
    //
    //  The gateway POSTs to this URL when a payment completes (success or fail).
    //  Outer envelope: { state, code, mchNo, payload, sign }
    //  Inner payload (after AES decrypt) contains: { tradeNo, status, price, … }
    //  status "00" = payment successful.
    // ─────────────────────────────────────────────────────────────────────────
    @Public()
    @Post('notify')
    async depositNotify(
        @Body() body: any,
        @Res() res: Response,
    ) {
        this.logger.log(`[UPI3] Deposit webhook received — state: ${body?.state}`);

        try {
            // 1. Verify outer signature
            const signValid = this.payment3Service.verifyWebhookSignature(body);
            if (!signValid) {
                this.logger.warn('[UPI3] Webhook: invalid signature — rejecting');
                return res.status(HttpStatus.BAD_REQUEST).send('fail');
            }

            // 2. Decrypt inner payload
            const inner = this.payment3Service.decryptWebhookPayload(body);
            this.logger.log(`[UPI3] Webhook inner: ${JSON.stringify(inner)}`);

            const tradeNo: string = inner.tradeNo || inner.mchTradeNo;
            const status: string = inner.status ?? '';
            const paidPrice = parseFloat(inner.price ?? '0');

            if (!tradeNo) {
                this.logger.warn('[UPI3] Webhook: no tradeNo in inner payload — ignoring');
                return res.status(HttpStatus.OK).send('success');
            }

            if (status === '00') {
                await this.creditDeposit(tradeNo, paidPrice);
            } else {
                this.logger.log(
                    `[UPI3] Webhook: non-success status "${status}" for tradeNo ${tradeNo} — no credit`,
                );
            }

            // Gateway expects a 200 "success" acknowledgement
            return res.status(HttpStatus.OK).send('success');
        } catch (error) {
            this.logger.error(`[UPI3] Webhook error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('fail');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  QUERY ORDER  (for manual reconciliation / admin checks)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('query')
    async queryOrder(
        @Query('orderNo') orderNo: string,
        @Res() res: Response,
    ) {
        try {
            if (!orderNo) {
                return res
                    .status(HttpStatus.BAD_REQUEST)
                    .json({ success: false, message: 'orderNo is required' });
            }
            const result = await this.payment3Service.queryDepositOrder(orderNo);
            return res.status(HttpStatus.OK).json({ success: true, data: result });
        } catch (error) {
            this.logger.error(`[UPI3] queryOrder error: ${error.message}`);
            return res
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json({ success: false, message: error.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ADMIN — PROCESS WITHDRAWAL (UPI 3)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(SecurityTokenGuard)
    @Post('admin/process-withdrawal')
    async adminProcessWithdrawal(
        @Body() body: { transactionId: number; adminId?: number; remarks?: string },
        @Res() res: Response,
    ) {
        try {
            const { transactionId, adminId, remarks } = body;
            if (!transactionId) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'transactionId is required' });
            }

            const txn = await this.prisma.transaction.findUnique({ where: { id: Number(transactionId) } });
            if (!txn) return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Transaction not found' });
            if (txn.type !== 'WITHDRAWAL') return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Not a withdrawal' });
            if (!['PENDING', 'PROCESSED'].includes(txn.status)) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: `Transaction must be PENDING or PROCESSED (current: ${txn.status})` });
            }

            const pd = (txn.paymentDetails as Record<string, any>) || {};
            const acctName = pd.acctName || pd.holderName || pd.receive_name || 'Beneficiary';
            const acctNo = pd.acctNo || pd.upiId || pd.receive_account || pd.receiveAccount || pd.accountNo;
            const acctCode = pd.acctCode || pd.ifsc || pd.ifscCode || '';
            if (!acctNo) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Beneficiary account / UPI ID missing' });
            }

            const orderNo = txn.utr || `UPI3W${txn.id}${Date.now()}`;

            const gatewayData = await this.payment3Service.createPayoutOrder(
                orderNo, txn.amount, acctName, acctNo, acctCode,
            );

            // Gateway accepted — update status
            await this.prisma.transaction.update({
                where: { id: txn.id },
                data: {
                    status: 'PROCESSING',
                    paymentMethod: 'UPI Gateway 3',
                    utr: orderNo,
                    adminId: adminId ?? txn.adminId,
                    remarks: remarks || 'Sent to UPI Gateway 3',
                    paymentDetails: { ...pd, gateway: 'upi3', orderNo } as any,
                },
            });

            this.logger.log(`[UPI3] Admin payout triggered — txn:${txn.id} orderNo:${orderNo}`);
            return res.status(HttpStatus.OK).json({ success: true, orderNo, data: gatewayData });
        } catch (error) {
            this.logger.error(`[UPI3] adminProcessWithdrawal error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PAYOUT WEBHOOK (UPI 3)
    // ─────────────────────────────────────────────────────────────────────────
    @Public()
    @Post('payout/notify')
    async payoutNotify(
        @Body() body: any,
        @Res() res: Response,
    ) {
        this.logger.log(`[UPI3] Payout webhook received — state: ${body?.state}`);

        try {
            const signValid = this.payment3Service.verifyWebhookSignature(body);
            if (!signValid) {
                this.logger.warn('[UPI3] Payout webhook: invalid signature');
                return res.status(HttpStatus.BAD_REQUEST).send('fail');
            }

            const inner = this.payment3Service.decryptWebhookPayload(body);
            this.logger.log(`[UPI3] Payout webhook inner: ${JSON.stringify(inner)}`);

            const tradeNo: string = inner.tradeNo || inner.mchTradeNo;
            const status: string = inner.status ?? '';

            if (!tradeNo) {
                return res.status(HttpStatus.OK).send('success');
            }

            const txn = await this.prisma.transaction.findUnique({ where: { utr: tradeNo } });
            if (txn && ['PENDING', 'PROCESSED', 'APPROVED', 'PROCESSING'].includes(txn.status)) {
                if (status === '00') {
                    // Success
                    await this.prisma.transaction.update({
                        where: { id: txn.id },
                        data: { status: 'COMPLETED' },
                    });
                    this.logger.log(`[UPI3] Payout COMPLETED — ${tradeNo}`);
                } else if (['01', '02', '03'].includes(status)) {
                    // Failed — refund
                    await this.prisma.$transaction([
                        this.prisma.user.update({
                            where: { id: txn.userId },
                            data: { balance: { increment: txn.amount } },
                        }),
                        this.prisma.transaction.update({
                            where: { id: txn.id },
                            data: { status: 'REJECTED', remarks: `Gateway payout status: ${status}` },
                        }),
                    ]);
                    this.logger.warn(`[UPI3] Payout REJECTED & refunded — ${tradeNo}`);
                }
            }

            return res.status(HttpStatus.OK).send('success');
        } catch (error) {
            this.logger.error(`[UPI3] Payout webhook error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('fail');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  QUERY PAYOUT ORDER
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(SecurityTokenGuard)
    @Get('payout/query')
    async queryPayoutOrder(
        @Query('orderNo') orderNo: string,
        @Res() res: Response,
    ) {
        try {
            if (!orderNo) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'orderNo is required' });
            }
            const result = await this.payment3Service.queryPayoutOrder(orderNo);
            return res.status(HttpStatus.OK).json({ success: true, data: result });
        } catch (error) {
            this.logger.error(`[UPI3] queryPayoutOrder error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  HELPER — credit deposit on successful webhook
    // ─────────────────────────────────────────────────────────────────────────
    private async creditDeposit(tradeNo: string, gatewayAmount: number) {
        try {
            const txn = await this.prisma.transaction.findUnique({
                where: { utr: tradeNo },
            });

            if (!txn) {
                this.logger.warn(`[UPI3] creditDeposit: no transaction found for tradeNo: ${tradeNo}`);
                return;
            }

            if (txn.status !== 'PENDING') {
                this.logger.warn(`[UPI3] creditDeposit: already ${txn.status} — skipping`);
                return;
            }

            // SECURITY: pin credit to the stored PENDING txn amount; never accept
            // the webhook body's amount field which could be replayed/tampered.
            if (
                gatewayAmount > 0 &&
                Math.abs(gatewayAmount - txn.amount) > 0.01
            ) {
                this.logger.warn(
                    `[UPI3] Amount mismatch — stored ₹${txn.amount}, gateway reported ₹${gatewayAmount}. Refusing credit.`,
                );
                return;
            }
            const creditAmount = txn.amount;

            // Count prior approved deposits for bonus eligibility checks
            const previousDeposits = await this.prisma.transaction.count({
                where: { userId: txn.userId, type: 'DEPOSIT', status: 'APPROVED' },
            });

            // Atomic PENDING→APPROVED transition with updateMany guard to block
            // race with cancellation and replayed webhook double-credit.
            const creditApplied = await this.prisma.$transaction(async (tx) => {
                const updated = await tx.transaction.updateMany({
                    where: { id: txn.id, status: 'PENDING' },
                    data: { status: 'APPROVED', amount: creditAmount },
                });
                if (updated.count === 0) return false;
                await tx.user.update({
                    where: { id: txn.userId },
                    data: { balance: { increment: creditAmount } },
                });
                return true;
            });
            if (!creditApplied) {
                this.logger.warn(`[UPI3] creditDeposit skipped — not PENDING (tradeNo: ${tradeNo})`);
                return;
            }

            this.logger.log(
                `[UPI3] Deposit APPROVED — userId: ${txn.userId}, amount: ₹${creditAmount}, tradeNo: ${tradeNo}`,
            );

            // ── Track total deposited (wagering) ──────────────────────────────
            try {
                await this.usersService.setWageringOnFirstDeposit(txn.userId, creditAmount);
            } catch (e) {
                this.logger.error(`[UPI3] Wagering update failed (non-fatal): ${e.message}`);
            }

            // ── Apply bonus if stored at deposit time ─────────────────────────
            const bonusCode = (txn.paymentDetails as any)?.bonusCode;
            let depositWageringApplied = false;

            if (bonusCode) {
                try {
                    const result = await this.bonusService.redeemBonus(
                        txn.userId,
                        bonusCode,
                        creditAmount,
                        {
                            depositCurrency: 'INR',
                            approvedDepositCountBeforeThisDeposit: previousDeposits,
                        },
                    );
                    if (result) depositWageringApplied = true;
                    this.logger.log(
                        `[UPI3] Bonus redeemed — userId: ${txn.userId}, code: ${bonusCode}`,
                    );
                } catch (e) {
                    this.logger.error(`[UPI3] Bonus redemption failed (non-fatal): ${e.message}`);
                }
            }

            // ── Default 1× deposit wagering lock if no bonus handled it ───────
            if (!depositWageringApplied) {
                try {
                    await this.bonusService.applyDepositWagering(txn.userId, creditAmount, 1);
                } catch (e) {
                    this.logger.error(`[UPI3] Deposit wagering lock failed (non-fatal): ${e.message}`);
                }
            }

            // ── Referral rewards ──────────────────────────────────────────────
            try {
                if (previousDeposits === 0) {
                    await this.referralService.checkAndAward(txn.userId, 'DEPOSIT_FIRST', creditAmount, `dep_${txn.id}_first`);
                }
                await this.referralService.checkAndAward(txn.userId, 'DEPOSIT_RECURRING', creditAmount, `dep_${txn.id}_rec`);
            } catch (e) {
                this.logger.error(
                    `[UPI3] Referral reward failed (non-fatal): ${e.message}`,
                );
            }

            // ── Deposit confirmation email ───────────────────────────────────
            try {
                const user = await this.prisma.user.findUnique({ where: { id: txn.userId }, select: { email: true, username: true } });
                if (user?.email) {
                    this.emailService.sendDepositSuccess(user.email, user.username || user.email, creditAmount.toFixed(2), 'INR').catch(() => {});
                }
            } catch (e) {
                this.logger.error(`[UPI3] Deposit email failed (non-fatal): ${e.message}`);
            }
        } catch (e) {
            this.logger.error(`[UPI3] creditDeposit error: ${e.message}`);
        }
    }
}
