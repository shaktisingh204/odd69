import { Body, Controller, Get, HttpStatus, Logger, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Payment4Service } from './payment4.service';
import { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SecurityTokenGuard } from '../auth/security-token.guard';
import { PrismaService } from '../prisma.service';
import { BonusService } from '../bonus/bonus.service';
import { UsersService } from '../users/users.service';
import { ReferralService } from '../referral/referral.service';
import { EmailService } from '../email/email.service';
import { assertMinDeposit } from '../payment/payment-limits.util';

@Controller('payment4')
export class Payment4Controller {
    private readonly logger = new Logger(Payment4Controller.name);

    constructor(
        private readonly payment4Service: Payment4Service,
        private readonly prisma: PrismaService,
        private readonly bonusService: BonusService,
        private readonly usersService: UsersService,
        private readonly referralService: ReferralService,
        private readonly emailService: EmailService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    //  CREATE ORDER (FRONTEND INITIATED)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Post('create')
    async createDepositOrder(
        @Body() body: { orderNo: string; amount: string; userId: number; bonusCode?: string; payerName?: string },
        @Res() res: Response,
    ) {
        try {
            const minErr = await assertMinDeposit(this.prisma, parseFloat(body.amount), { gatewayKey: 'MIN_DEPOSIT_UPI4' });
            if (minErr) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: minErr });
            }
            const result = await this.payment4Service.createDepositOrder({
                orderNo: body.orderNo,
                amount: body.amount,
                userId: body.userId,
                bonusCode: body.bonusCode,
                payerName: body.payerName,
            });
            return res.status(HttpStatus.OK).json(result);
        } catch (error) {
            this.logger.error(`[UPI4] createDepositOrder error: ${error.message}`);
            return res
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json({ success: false, message: error.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  WEBHOOK CALLBACK (FROM SILKPAY)
    // ─────────────────────────────────────────────────────────────────────────
    @Public()
    @Post('notify')
    async depositNotify(
        @Body() body: any,
        @Res() res: Response,
    ) {
        this.logger.log(`[UPI4] Deposit webhook received: ${JSON.stringify(body)}`);

        try {
            // 1. Verify signature
            const signValid = this.payment4Service.verifyWebhookSignature(body);
            if (!signValid) {
                this.logger.warn('[UPI4] Webhook: invalid signature — rejecting');
                return res.status(HttpStatus.BAD_REQUEST).send('fail');
            }

            // 2. Extract fields
            const tradeNo: string = body.mOrderId;
            const status: string = String(body.status);
            const paidPrice = parseFloat(body.amount ?? '0');

            if (!tradeNo) {
                this.logger.warn('[UPI4] Webhook: no tradeNo (mOrderId) in payload — ignoring');
                return res.status(HttpStatus.OK).send('success');
            }

            if (status === '1') { // 1 = Success
                await this.creditDeposit(tradeNo, paidPrice);
            } else {
                this.logger.log(
                    `[UPI4] Webhook: non-success status "${status}" for tradeNo ${tradeNo} — no credit`,
                );
            }

            // Gateway expects a 200 "success" acknowledgement
            return res.status(HttpStatus.OK).send('success');
        } catch (error) {
            this.logger.error(`[UPI4] Webhook error: ${error.message}`);
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
            const result = await this.payment4Service.queryDepositOrder(orderNo);
            return res.status(HttpStatus.OK).json({ success: true, data: result });
        } catch (error) {
            this.logger.error(`[UPI4] queryOrder error: ${error.message}`);
            return res
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json({ success: false, message: error.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ADMIN — PROCESS WITHDRAWAL (UPI 4 / Silkpay)
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
            const ifscCode = pd.acctCode || pd.ifsc || pd.ifscCode || '';
            if (!acctNo) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Beneficiary account / UPI ID missing' });
            }

            const orderNo = txn.utr || `UPI4W${txn.id}${Date.now()}`;

            const result = await this.payment4Service.createPayoutOrder({
                orderNo, amount: txn.amount, acctName, acctNo, ifscCode,
            });

            if (!result.success) {
                return res.status(HttpStatus.OK).json({ success: false, message: result.message || 'Gateway rejected payout' });
            }

            await this.prisma.transaction.update({
                where: { id: txn.id },
                data: {
                    status: 'PROCESSING',
                    paymentMethod: 'UPI Gateway 4',
                    utr: orderNo,
                    adminId: adminId ?? txn.adminId,
                    remarks: remarks || 'Sent to UPI Gateway 4',
                    paymentDetails: { ...pd, gateway: 'upi4', orderNo } as any,
                },
            });

            this.logger.log(`[UPI4] Admin payout triggered — txn:${txn.id} orderNo:${orderNo}`);
            return res.status(HttpStatus.OK).json({ success: true, orderNo });
        } catch (error) {
            this.logger.error(`[UPI4] adminProcessWithdrawal error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PAYOUT WEBHOOK (UPI 4 / Silkpay)
    // ─────────────────────────────────────────────────────────────────────────
    @Public()
    @Post('payout/notify')
    async payoutNotify(
        @Body() body: any,
        @Res() res: Response,
    ) {
        this.logger.log(`[UPI4] Payout webhook received: ${JSON.stringify(body)}`);

        try {
            const signValid = this.payment4Service.verifyPayoutWebhookSignature(body);
            if (!signValid) {
                this.logger.warn('[UPI4] Payout webhook: invalid signature');
                return res.status(HttpStatus.BAD_REQUEST).send('fail');
            }

            const tradeNo: string = body.mOrderId;
            const status: string = String(body.status);

            if (!tradeNo) {
                return res.status(HttpStatus.OK).send('success');
            }

            const txn = await this.prisma.transaction.findUnique({ where: { utr: tradeNo } });
            if (txn && ['PENDING', 'PROCESSED', 'APPROVED', 'PROCESSING'].includes(txn.status)) {
                if (status === '1') {
                    // Success
                    await this.prisma.transaction.update({
                        where: { id: txn.id },
                        data: { status: 'COMPLETED' },
                    });
                    this.logger.log(`[UPI4] Payout COMPLETED — ${tradeNo}`);
                } else if (['2', '3', '4'].includes(status)) {
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
                    this.logger.warn(`[UPI4] Payout REJECTED & refunded — ${tradeNo}`);
                }
            }

            return res.status(HttpStatus.OK).send('success');
        } catch (error) {
            this.logger.error(`[UPI4] Payout webhook error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('fail');
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
                this.logger.warn(`[UPI4] creditDeposit: no transaction found for tradeNo: ${tradeNo}`);
                return;
            }

            if (txn.status !== 'PENDING') {
                this.logger.warn(`[UPI4] creditDeposit: already ${txn.status} — skipping`);
                return;
            }

            // SECURITY: pin credit to the stored PENDING txn amount; never accept
            // the webhook body's amount field which could be replayed/tampered.
            if (
                gatewayAmount > 0 &&
                Math.abs(gatewayAmount - txn.amount) > 0.01
            ) {
                this.logger.warn(
                    `[UPI4] Amount mismatch — stored ₹${txn.amount}, gateway reported ₹${gatewayAmount}. Refusing credit.`,
                );
                return;
            }
            const creditAmount = txn.amount;

            // Count prior approved deposits for bonus eligibility checks
            const previousDeposits = await this.prisma.transaction.count({
                where: { userId: txn.userId, type: 'DEPOSIT', status: 'APPROVED' },
            });

            // Atomic PENDING→APPROVED guard — prevents race with cancellation
            // and blocks double-credit from replayed webhooks.
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
                this.logger.warn(`[UPI4] creditDeposit skipped — not PENDING (tradeNo: ${tradeNo})`);
                return;
            }

            this.logger.log(
                `[UPI4] Deposit APPROVED — userId: ${txn.userId}, amount: ₹${creditAmount}, tradeNo: ${tradeNo}`,
            );

            // ── Track total deposited (wagering) ──────────────────────────────
            try {
                await this.usersService.setWageringOnFirstDeposit(txn.userId, creditAmount);
            } catch (e) {
                this.logger.error(`[UPI4] Wagering update failed (non-fatal): ${e.message}`);
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
                        `[UPI4] Bonus redeemed — userId: ${txn.userId}, code: ${bonusCode}`,
                    );
                } catch (e) {
                    this.logger.error(`[UPI4] Bonus redemption failed (non-fatal): ${e.message}`);
                }
            }

            // ── Default 1× deposit wagering lock if no bonus handled it ───────
            if (!depositWageringApplied) {
                try {
                    await this.bonusService.applyDepositWagering(txn.userId, creditAmount, 1);
                } catch (e) {
                    this.logger.error(`[UPI4] Deposit wagering lock failed (non-fatal): ${e.message}`);
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
                    `[UPI4] Referral reward failed (non-fatal): ${e.message}`,
                );
            }

            // ── Deposit confirmation email ───────────────────────────────────
            try {
                const user = await this.prisma.user.findUnique({ where: { id: txn.userId }, select: { email: true, username: true } });
                if (user?.email) {
                    this.emailService.sendDepositSuccess(user.email, user.username || user.email, creditAmount.toFixed(2), 'INR').catch(() => {});
                }
            } catch (e) {
                this.logger.error(`[UPI4] Deposit email failed (non-fatal): ${e.message}`);
            }
        } catch (e) {
            this.logger.error(`[UPI4] creditDeposit error: ${e.message}`);
        }
    }
}
