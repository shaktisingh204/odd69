import {
    Body,
    Controller,
    Get,
    HttpStatus,
    Logger,
    Post,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Payment9Service } from './payment9.service';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma.service';
import { BonusService } from '../bonus/bonus.service';
import { UsersService } from '../users/users.service';
import { ReferralService } from '../referral/referral.service';
import { EmailService } from '../email/email.service';
import { assertMinDeposit } from '../payment/payment-limits.util';

@Controller('payment9')
export class Payment9Controller {
    private readonly logger = new Logger(Payment9Controller.name);

    constructor(
        private readonly payment9Service: Payment9Service,
        private readonly prisma: PrismaService,
        private readonly bonusService: BonusService,
        private readonly usersService: UsersService,
        private readonly referralService: ReferralService,
        private readonly emailService: EmailService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    //  CREATE ORDER (FRONTEND-INITIATED)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Post('create')
    async createDepositOrder(
        @Body()
        body: {
            orderNo: string;
            amount: string;
            userId: number;
            bonusCode?: string;
            payerName?: string;
            payerMobile?: string;
            payerEmail?: string;
        },
        @Res() res: Response,
    ) {
        try {
            const minErr = await assertMinDeposit(
                this.prisma,
                parseFloat(body.amount),
                { gatewayKey: 'MIN_DEPOSIT_UPI9' },
            );
            if (minErr) {
                return res
                    .status(HttpStatus.BAD_REQUEST)
                    .json({ success: false, message: minErr });
            }

            const result = await this.payment9Service.createDepositOrder({
                orderNo: body.orderNo,
                amount: body.amount,
                userId: body.userId,
                bonusCode: body.bonusCode,
                payerName: body.payerName,
                payerMobile: body.payerMobile,
                payerEmail: body.payerEmail,
            });
            return res.status(HttpStatus.OK).json(result);
        } catch (error: any) {
            this.logger.error(`[UPI9] createDepositOrder error: ${error.message}`);
            return res
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json({ success: false, message: error.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  WEBHOOK CALLBACK
    // ─────────────────────────────────────────────────────────────────────────
    @Public()
    @Post('notify')
    async depositNotify(@Body() body: any, @Res() res: Response) {
        this.logger.log(`[UPI9] Deposit webhook received: ${JSON.stringify(body)}`);

        try {
            // 1. Signature (no-op when no secret is configured)
            if (!this.payment9Service.verifyWebhookSignature(body)) {
                this.logger.warn('[UPI9] Webhook: invalid signature — rejecting');
                return res.status(HttpStatus.BAD_REQUEST).send('fail');
            }

            // 2. Resolve our internal reference. UltraPay's exact field name
            //    isn't documented; check the common candidates.
            const tradeNo: string =
                body.client_txn_id ||
                body.clientTxnId ||
                body.merchant_txn_id ||
                body.order_id ||
                body.orderId ||
                body.mOrderId ||
                '';

            const status: string = String(
                body.status ?? body.txn_status ?? body.payment_status ?? '',
            ).toLowerCase();

            const paidPrice = parseFloat(
                body.amount ?? body.paid_amount ?? body.txn_amount ?? '0',
            );

            if (!tradeNo) {
                this.logger.warn('[UPI9] Webhook: no client_txn_id in payload — ignoring');
                return res.status(HttpStatus.OK).send('success');
            }

            // UltraPay status conventions seen in similar aggregators:
            //   "success", "completed", "paid", "1", "approved" → success
            //   "failed", "rejected", "cancelled", "2"…         → ignore (no credit)
            const isSuccess = ['success', 'completed', 'paid', '1', 'approved'].includes(
                status,
            );

            if (isSuccess) {
                await this.creditDeposit(tradeNo, paidPrice);
            } else {
                this.logger.log(
                    `[UPI9] Webhook: non-success status "${status}" for ${tradeNo} — no credit`,
                );
            }

            return res.status(HttpStatus.OK).send('success');
        } catch (error: any) {
            this.logger.error(`[UPI9] Webhook error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('fail');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  QUERY ORDER (admin / manual reconciliation)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('query')
    async queryOrder(@Query('txnId') txnId: string, @Res() res: Response) {
        try {
            if (!txnId) {
                return res
                    .status(HttpStatus.BAD_REQUEST)
                    .json({ success: false, message: 'txnId is required' });
            }
            const result = await this.payment9Service.queryDepositOrder(txnId);
            return res.status(HttpStatus.OK).json({ success: true, data: result });
        } catch (error: any) {
            this.logger.error(`[UPI9] queryOrder error: ${error.message}`);
            return res
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .json({ success: false, message: error.message });
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
                this.logger.warn(
                    `[UPI9] creditDeposit: no transaction found for tradeNo: ${tradeNo}`,
                );
                return;
            }

            if (txn.status !== 'PENDING') {
                this.logger.warn(
                    `[UPI9] creditDeposit: already ${txn.status} — skipping`,
                );
                return;
            }

            // SECURITY: pin to stored amount; never trust the gateway-reported
            // value as authoritative (replay / tamper guard).
            if (
                gatewayAmount > 0 &&
                Math.abs(gatewayAmount - txn.amount) > 0.01
            ) {
                this.logger.warn(
                    `[UPI9] Amount mismatch — stored ₹${txn.amount}, gateway reported ₹${gatewayAmount}. Refusing credit.`,
                );
                return;
            }
            const creditAmount = txn.amount;

            const previousDeposits = await this.prisma.transaction.count({
                where: {
                    userId: txn.userId,
                    type: 'DEPOSIT',
                    status: 'APPROVED',
                },
            });

            // Atomic PENDING → APPROVED guard. updateMany with the PENDING
            // predicate prevents double-credits from concurrent webhook
            // retries — only the first one flips the row.
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
                this.logger.warn(
                    `[UPI9] creditDeposit skipped — not PENDING (tradeNo: ${tradeNo})`,
                );
                return;
            }

            this.logger.log(
                `[UPI9] Deposit APPROVED — userId: ${txn.userId}, amount: ₹${creditAmount}, tradeNo: ${tradeNo}`,
            );

            // ── Wagering / first-deposit tracking ─────────────────────────
            try {
                await this.usersService.setWageringOnFirstDeposit(
                    txn.userId,
                    creditAmount,
                );
            } catch (e: any) {
                this.logger.error(`[UPI9] Wagering update failed (non-fatal): ${e.message}`);
            }

            // ── Bonus redemption ──────────────────────────────────────────
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
                        `[UPI9] Bonus redeemed — userId: ${txn.userId}, code: ${bonusCode}`,
                    );
                } catch (e: any) {
                    this.logger.error(
                        `[UPI9] Bonus redemption failed (non-fatal): ${e.message}`,
                    );
                }
            }
            if (!depositWageringApplied) {
                try {
                    await this.bonusService.applyDepositWagering(
                        txn.userId,
                        creditAmount,
                        1,
                    );
                } catch (e: any) {
                    this.logger.error(
                        `[UPI9] Deposit wagering lock failed (non-fatal): ${e.message}`,
                    );
                }
            }

            // ── Referral rewards ──────────────────────────────────────────
            try {
                if (previousDeposits === 0) {
                    await this.referralService.checkAndAward(
                        txn.userId,
                        'DEPOSIT_FIRST',
                        creditAmount,
                        `dep_${txn.id}_first`,
                    );
                }
                await this.referralService.checkAndAward(
                    txn.userId,
                    'DEPOSIT_RECURRING',
                    creditAmount,
                    `dep_${txn.id}_rec`,
                );
            } catch (e: any) {
                this.logger.error(
                    `[UPI9] Referral reward failed (non-fatal): ${e.message}`,
                );
            }

            // ── Confirmation email ───────────────────────────────────────
            try {
                const user = await this.prisma.user.findUnique({
                    where: { id: txn.userId },
                    select: { email: true, username: true },
                });
                if (user?.email) {
                    this.emailService
                        .sendDepositSuccess(
                            user.email,
                            user.username || user.email,
                            creditAmount.toFixed(2),
                            'INR',
                        )
                        .catch(() => {});
                }
            } catch (e: any) {
                this.logger.error(`[UPI9] Deposit email failed (non-fatal): ${e.message}`);
            }
        } catch (e: any) {
            this.logger.error(`[UPI9] creditDeposit error: ${e.message}`);
        }
    }
}
