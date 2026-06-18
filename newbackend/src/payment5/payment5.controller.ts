import {
    Controller,
    Post,
    Get,
    Body,
    Req,
    Res,
    HttpStatus,
    Logger,
    UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Payment5Service } from './payment5.service';
import { PrismaService } from '../prisma.service';
import { BonusService } from '../bonus/bonus.service';
import { UsersService } from '../users/users.service';
import { ReferralService } from '../referral/referral.service';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { SecurityTokenGuard } from '../auth/security-token.guard';

@Controller('payment5')
export class Payment5Controller {
    private readonly logger = new Logger(Payment5Controller.name);

    constructor(
        private readonly payment5Service: Payment5Service,
        private readonly prisma: PrismaService,
        private readonly bonusService: BonusService,
        private readonly usersService: UsersService,
        private readonly referralService: ReferralService,
        private readonly emailService: EmailService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    //  CREATE DEPOSIT (Gateway 5 - RezorPay)
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

            const { orderNo, amount, bonusCode, promoCode, payerName, payMobile, method } = body;
            const numAmount = parseFloat(amount);

            if (!orderNo || !numAmount || numAmount < 300 || numAmount > 100000) {
                return res
                    .status(HttpStatus.BAD_REQUEST)
                    .json({ success: false, message: 'orderNo and a valid amount (300 - 100,000) are required' });
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
                            paymentMethod: 'UPI Gateway 5',
                            utr: orderNo,
                            paymentDetails: {
                                gateway: 'rezorpay',
                                gatewayRoute: 'UPI5',
                                depositCurrency: 'INR',
                                orderNo,
                                ...(effectiveBonusCode ? { bonusCode: effectiveBonusCode } : {}),
                            } as any,
                        },
                    });
                    this.logger.log(
                        `✅ [Gateway 5] PENDING deposit created — utr: ${orderNo}, userId: ${userId}, amount: ${numAmount}${effectiveBonusCode ? `, bonus: ${effectiveBonusCode}` : ''}`,
                    );
                } else {
                    this.logger.warn(`⚠️ [Gateway 5] Duplicate orderNo ${orderNo} — skipped DB insert`);
                }
            } catch (dbErr) {
                this.logger.error(`❌ [Gateway 5] DB write failed: ${dbErr.message}`);
            }

            // ── 2. Call RezorPay gateway ──────────────────────────────────────
            const { payUrl, status, message } =
                await this.payment5Service.createDepositOrder(
                    orderNo,
                    numAmount,
                    {
                        payerName: (payerName || '').trim() || undefined,
                        payMobile: (payMobile || '').trim() || undefined,
                        method: (method || 'INTENT').trim() || undefined,
                    },
                );

            if (!status || !payUrl) {
                this.logger.warn(
                    `[Gateway 5] Gateway rejected order — status: ${status}, message: ${message}`,
                );
                // Rollback: mark as REJECTED so user can retry
                await this.prisma.transaction
                    .update({
                        where: { utr: orderNo },
                        data: { status: 'REJECTED', remarks: `Gateway: ${message}` },
                    })
                    .catch(() => { /* ignore */ });

                return res.status(HttpStatus.OK).json({
                    success: false,
                    message: message || 'Gateway rejected the deposit request',
                });
            }

            return res.status(HttpStatus.OK).json({ success: true, payUrl });
        } catch (error) {
            this.logger.error(`[Gateway 5] createDeposit error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to create Payment deposit',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DEPOSIT WEBHOOK (Gateway 5 - RezorPay)
    // ─────────────────────────────────────────────────────────────────────────
    @Public()
    @Post('notify')
    async depositNotify(
        @Body() body: any,
        @Res() res: Response,
    ) {
        this.logger.log(`[Gateway 5] Deposit webhook received: ${JSON.stringify(body)}`);

        try {
            // 1. Verify webhook signature
            const signValid = this.payment5Service.verifyWebhookSignature(body);
            if (!signValid) {
                this.logger.warn('[Gateway 5] Webhook: invalid signature — rejecting');
                return res.status(HttpStatus.FORBIDDEN).json({ status: false, message: 'Invalid signature' });
            }

            const tradeNo = String(body.order_id ?? '');
            const status = String(body.status ?? '');
            const paidPrice = parseFloat(body.amount ?? '0');

            if (!tradeNo) {
                this.logger.warn('[Gateway 5] Webhook: no order_id in payload — ignoring');
                return res.status(HttpStatus.BAD_REQUEST).json({ status: false, message: 'Missing order_id' });
            }

            if (status.toUpperCase() === 'SUCCESS') {
                await this.creditDeposit(tradeNo, paidPrice);
            } else {
                this.logger.log(
                    `[Gateway 5] Webhook: non-success status "${status}" for tradeNo ${tradeNo} — no credit`,
                );
            }

            // Gateway expects a success acknowledgment
            return res.status(HttpStatus.OK).json({ status: true, message: 'success' });
        } catch (error) {
            this.logger.error(`[Gateway 5] Webhook error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Internal Server Error' });
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
                this.logger.warn(`[Gateway 5] creditDeposit: no transaction found for tradeNo: ${tradeNo}`);
                return;
            }

            if (txn.status !== 'PENDING') {
                this.logger.warn(`[Gateway 5] creditDeposit: already ${txn.status} — skipping`);
                return;
            }

            // SECURITY: credit the stored PENDING txn amount, not body.amount.
            if (
                gatewayAmount > 0 &&
                Math.abs(gatewayAmount - txn.amount) > 0.01
            ) {
                this.logger.warn(
                    `[Gateway 5] Amount mismatch — stored ₹${txn.amount}, gateway reported ₹${gatewayAmount}. Refusing credit.`,
                );
                return;
            }
            const creditAmount = txn.amount;

            const previousDeposits = await this.prisma.transaction.count({
                where: { userId: txn.userId, type: 'DEPOSIT', status: 'APPROVED' },
            });

            // Atomic PENDING→APPROVED guard — prevents race with cancellation
            // and blocks double-credit from replayed webhooks.
            const creditApplied = await this.prisma.$transaction(async (tx) => {
                const updated = await tx.transaction.updateMany({
                    where: { id: txn.id, status: 'PENDING' },
                    data: { status: 'APPROVED' },
                });
                if (updated.count === 0) return false;
                await tx.user.update({
                    where: { id: txn.userId },
                    data: { balance: { increment: creditAmount } },
                });
                return true;
            });
            if (!creditApplied) {
                this.logger.warn(`[Gateway 5] creditDeposit skipped — not PENDING (tradeNo: ${tradeNo})`);
                return;
            }

            this.logger.log(
                `[Gateway 5] Deposit APPROVED — userId: ${txn.userId}, amount: ₹${creditAmount}, tradeNo: ${tradeNo}`,
            );

            try {
                await this.usersService.setWageringOnFirstDeposit(txn.userId, creditAmount);
            } catch (e) {
                this.logger.error(`[Gateway 5] Wagering update failed (non-fatal): ${e.message}`);
            }

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
                        `[Gateway 5] Bonus redeemed — userId: ${txn.userId}, code: ${bonusCode}`,
                    );
                } catch (e) {
                    this.logger.error(`[Gateway 5] Bonus redemption failed (non-fatal): ${e.message}`);
                }
            }

            if (!depositWageringApplied) {
                try {
                    await this.bonusService.applyDepositWagering(txn.userId, creditAmount, 1);
                } catch (e) {
                    this.logger.error(`[Gateway 5] Deposit wagering lock failed (non-fatal): ${e.message}`);
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
                    `[UPI5] Referral reward failed (non-fatal): ${e.message}`,
                );
            }

            // ── Deposit confirmation email ───────────────────────────────────
            try {
                const user = await this.prisma.user.findUnique({ where: { id: txn.userId }, select: { email: true, username: true } });
                if (user?.email) {
                    this.emailService.sendDepositSuccess(user.email, user.username || user.email, creditAmount.toFixed(2), 'INR').catch(() => {});
                }
            } catch (e) {
                this.logger.error(`[Gateway 5] Deposit email failed (non-fatal): ${e.message}`);
            }
        } catch (e) {
            this.logger.error(`[Gateway 5] creditDeposit error: ${e.message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  QUERY ORDER (Pay-In/Deposit)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('query-deposit')
    async queryDeposit(
        @Req() req: Request,
        @Res() res: Response,
    ) {
        try {
            const orderNo = req.query.orderNo as string;
            if (!orderNo) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'orderNo is required' });
            }
            const data = await this.payment5Service.queryDepositOrder(orderNo);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ADMIN — PROCESS WITHDRAWAL (Gateway 5 - RezorPay)
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
            const accountHolder = pd.acctName || pd.holderName || pd.receive_name || 'Beneficiary';
            const bankAccount = pd.acctNo || pd.upiId || pd.receive_account || pd.receiveAccount || pd.accountNo;
            const ifscCode = pd.acctCode || pd.ifsc || pd.ifscCode || '';
            if (!bankAccount) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Beneficiary account / UPI ID missing' });
            }

            const withdrawId = txn.utr || `UPI5W${txn.id}${Date.now()}`;

            const gatewayData = await this.payment5Service.createPayoutOrder(
                withdrawId, txn.amount, bankAccount, ifscCode, accountHolder,
            );

            await this.prisma.transaction.update({
                where: { id: txn.id },
                data: {
                    status: 'PROCESSING',
                    paymentMethod: 'UPI Gateway 5',
                    utr: withdrawId,
                    adminId: adminId ?? txn.adminId,
                    remarks: remarks || 'Sent to UPI Gateway 5',
                    paymentDetails: { ...pd, gateway: 'upi5', orderNo: withdrawId } as any,
                },
            });

            this.logger.log(`[Gateway 5] Admin payout triggered — txn:${txn.id} withdrawId:${withdrawId}`);
            return res.status(HttpStatus.OK).json({ success: true, orderNo: withdrawId, data: gatewayData });
        } catch (error) {
            this.logger.error(`[Gateway 5] adminProcessWithdrawal error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CREATE PAYOUT (Gateway 5 - RezorPay) — user-initiated
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Post('create-payout')
    async createPayout(
        @Body() body: any,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        try {
            const userId: number = (req as any).user?.id || body.userId;
            if (!userId) {
                return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Not authenticated' });
            }

            const { withdrawId, amount, bankAccount, ifscCode, accountHolder, remark } = body;
            const numAmount = parseFloat(amount);

            if (!withdrawId || !numAmount || numAmount < 1000 || numAmount > 100000) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Validation failed. amount must be 1000-100000.' });
            }

            const data = await this.payment5Service.createPayoutOrder(
                withdrawId,
                numAmount,
                bankAccount,
                ifscCode,
                accountHolder,
                remark
            );

            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error) {
            this.logger.error(`[Gateway 5 Payout] createPayout error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PAYOUT WEBHOOK (Gateway 5 - RezorPay)
    // ─────────────────────────────────────────────────────────────────────────
    @Public()
    @Post('payout-notify')
    async payoutNotify(
        @Body() body: any,
        @Res() res: Response,
    ) {
        this.logger.log(`[Gateway 5 Payout] Webhook received: ${JSON.stringify(body)}`);

        try {
            const signValid = this.payment5Service.verifyPayoutWebhookSignature(body);
            if (!signValid) {
                this.logger.warn('[Gateway 5 Payout] Webhook invalid signature');
                return res.status(HttpStatus.FORBIDDEN).json({ status: false, message: 'Invalid signature' });
            }

            const withdrawId = String(body.withdraw_id ?? '');
            const status = String(body.status ?? '').toUpperCase();

            if (!withdrawId) {
                return res.status(HttpStatus.BAD_REQUEST).json({ status: false, message: 'Missing withdraw_id' });
            }

            const txn = await this.prisma.transaction.findUnique({ where: { utr: withdrawId } });
            if (txn && ['PENDING', 'PROCESSED', 'APPROVED', 'PROCESSING'].includes(txn.status)) {
                if (status === 'SUCCESS') {
                    await this.prisma.transaction.update({
                        where: { id: txn.id },
                        data: { status: 'COMPLETED' },
                    });
                    this.logger.log(`[Gateway 5] Payout COMPLETED — ${withdrawId}`);
                } else if (['FAILED', 'REJECTED', 'REVERSED'].includes(status)) {
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
                    this.logger.warn(`[Gateway 5] Payout REJECTED & refunded — ${withdrawId}`);
                }
            }

            return res.status(HttpStatus.OK).json({ status: true, message: 'Verified' });
        } catch (error) {
            this.logger.error(`[Gateway 5 Payout] Webhook error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Internal Server Error' });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  QUERY ORDER (Payout)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('query-payout')
    async queryPayout(
        @Req() req: Request,
        @Res() res: Response,
    ) {
        try {
            const withdrawId = req.query.withdrawId as string;
            if (!withdrawId) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'withdrawId is required' });
            }
            const data = await this.payment5Service.queryPayoutOrder(withdrawId);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  BALANCE CHECK
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('balance')
    async checkBalance(
        @Res() res: Response,
    ) {
        try {
            const data = await this.payment5Service.checkBalance();
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }
}
