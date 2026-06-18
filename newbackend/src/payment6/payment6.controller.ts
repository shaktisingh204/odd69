import {
    Controller,
    Post,
    Get,
    Body,
    Query,
    Req,
    Res,
    HttpStatus,
    Logger,
    UseGuards,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import { Payment6Service } from './payment6.service';
import { PrismaService } from '../prisma.service';
import { BonusService } from '../bonus/bonus.service';
import { UsersService } from '../users/users.service';
import { ReferralService } from '../referral/referral.service';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

@Controller('payment6')
export class Payment6Controller {
    private readonly logger = new Logger(Payment6Controller.name);

    constructor(
        private readonly payment6Service: Payment6Service,
        private readonly prisma: PrismaService,
        private readonly bonusService: BonusService,
        private readonly usersService: UsersService,
        private readonly referralService: ReferralService,
        private readonly emailService: EmailService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    //  CREATE DEPOSIT (Gateway 6 - A-Pay)
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

            const { orderNo, amount, bonusCode, promoCode } = body;
            const numAmount = parseFloat(amount);

            if (!orderNo || !numAmount || numAmount < 100) {
                return res
                    .status(HttpStatus.BAD_REQUEST)
                    .json({ success: false, message: 'orderNo and a valid amount (>= 100) are required' });
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
                            paymentMethod: 'UPI Gateway 6',
                            utr: orderNo,
                            paymentDetails: {
                                gateway: 'apay',
                                gatewayRoute: 'UPI6',
                                depositCurrency: 'INR',
                                orderNo,
                                ...(effectiveBonusCode ? { bonusCode: effectiveBonusCode } : {}),
                            } as any,
                        },
                    });
                    this.logger.log(
                        `✅ [Gateway 6 A-Pay] PENDING deposit created — utr: ${orderNo}, userId: ${userId}, amount: ${numAmount}${effectiveBonusCode ? `, bonus: ${effectiveBonusCode}` : ''}`,
                    );
                } else {
                    this.logger.warn(`⚠️ [Gateway 6 A-Pay] Duplicate orderNo ${orderNo} — skipped DB insert`);
                }
            } catch (dbErr) {
                this.logger.error(`❌ [Gateway 6 A-Pay] DB write failed: ${dbErr.message}`);
            }

            // ── 2. Call A-Pay gateway ──────────────────────────────────────
            const { payUrl, status, message, orderId } =
                await this.payment6Service.createDepositOrder(
                    orderNo,
                    numAmount,
                    userId
                );

            if (!status || !payUrl) {
                this.logger.warn(
                    `[Gateway 6 A-Pay] Gateway rejected order — status: ${status}, message: ${message}`,
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

            return res.status(HttpStatus.OK).json({ success: true, payUrl, orderId });
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] createDeposit error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to create Payment deposit',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DEPOSIT WEBHOOK (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @Public()
    @Post('notify')
    async depositNotify(
        @Body() body: any,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        this.logger.log(`[Gateway 6 A-Pay] Deposit webhook received: ${JSON.stringify(body)}`);

        try {
            // 1. Verify webhook signature
            const signValid = this.payment6Service.verifyWebhookSignature(body);
            if (!signValid) {
                this.logger.warn('[Gateway 6 A-Pay] Webhook: invalid signature — rejecting');
                return res.status(HttpStatus.FORBIDDEN).json({ status: false, message: 'Invalid signature' });
            }

            // Extract logic based on A-Pay's webhook format
            const transactions = body?.transactions;

            if (!Array.isArray(transactions) || transactions.length === 0) {
                this.logger.warn('[Gateway 6 A-Pay] Webhook: no transactions in payload — ignoring');
                return res.status(HttpStatus.BAD_REQUEST).json({ status: false, message: 'Missing transactions array' });
            }

            for (const txn of transactions) {
                const tradeNo = String(txn.custom_transaction_id ?? txn.order_id ?? '');
                const status = String(txn.status ?? '');
                const paidPrice = parseFloat(txn.amount ?? '0');

                if (!tradeNo) continue;

                // Checking for success status
                if (status === 'Success') {
                    await this.creditDeposit(tradeNo, paidPrice);
                } else {
                    this.logger.log(
                        `[Gateway 6 A-Pay] Webhook: non-success status "${status}" for tradeNo ${tradeNo} — no credit`,
                    );
                }
            }

            // Gateway expects a success acknowledgment
            return res.status(HttpStatus.OK).json({ status: true, message: 'success' });
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] Webhook error: ${error.message}`);
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
                this.logger.warn(`[Gateway 6 A-Pay] creditDeposit: no transaction found for tradeNo: ${tradeNo}`);
                return;
            }

            if (txn.status !== 'PENDING') {
                this.logger.warn(`[Gateway 6 A-Pay] creditDeposit: already ${txn.status} — skipping`);
                return;
            }

            // SECURITY: pin credit to the stored PENDING txn amount; never accept
            // the webhook body's amount field which could be replayed/tampered.
            if (
                gatewayAmount > 0 &&
                Math.abs(gatewayAmount - txn.amount) > 0.01
            ) {
                this.logger.warn(
                    `[Gateway 6 A-Pay] Amount mismatch — stored ₹${txn.amount}, gateway reported ₹${gatewayAmount}. Refusing credit.`,
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
                this.logger.warn(`[Gateway 6 A-Pay] creditDeposit skipped — not PENDING (tradeNo: ${tradeNo})`);
                return;
            }

            this.logger.log(
                `[Gateway 6 A-Pay] Deposit APPROVED — userId: ${txn.userId}, amount: ₹${creditAmount}, tradeNo: ${tradeNo}`,
            );

            try {
                await this.usersService.setWageringOnFirstDeposit(txn.userId, creditAmount);
            } catch (e) {
                this.logger.error(`[Gateway 6 A-Pay] Wagering update failed (non-fatal): ${e.message}`);
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
                        `[Gateway 6 A-Pay] Bonus redeemed — userId: ${txn.userId}, code: ${bonusCode}`,
                    );
                } catch (e) {
                    this.logger.error(`[Gateway 6 A-Pay] Bonus redemption failed (non-fatal): ${e.message}`);
                }
            }

            if (!depositWageringApplied) {
                try {
                    await this.bonusService.applyDepositWagering(txn.userId, creditAmount, 1);
                } catch (e) {
                    this.logger.error(`[Gateway 6 A-Pay] Deposit wagering lock failed (non-fatal): ${e.message}`);
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
                    `[UPI6] Referral reward failed (non-fatal): ${e.message}`,
                );
            }

            // ── Deposit confirmation email ───────────────────────────────────
            try {
                const user = await this.prisma.user.findUnique({ where: { id: txn.userId }, select: { email: true, username: true } });
                if (user?.email) {
                    this.emailService.sendDepositSuccess(user.email, user.username || user.email, creditAmount.toFixed(2), 'INR').catch(() => {});
                }
            } catch (e) {
                this.logger.error(`[Gateway 6] Deposit email failed (non-fatal): ${e.message}`);
            }
        } catch (e) {
            this.logger.error(`[Gateway 6 A-Pay] creditDeposit error: ${e.message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DEPOSIT ACTIVATION (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Post('deposit-activate')
    async activateDeposit(
        @Body() body: { orderId: string; paymentSystem: string; key: string },
        @Res() res: Response,
    ) {
        try {
            const { orderId, paymentSystem, key } = body;
            if (!orderId || !paymentSystem || !key) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'orderId, paymentSystem, and key are required',
                });
            }

            const result = await this.payment6Service.activateDeposit(orderId, paymentSystem, key);
            return res.status(HttpStatus.OK).json(result);
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] activateDeposit error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to activate deposit',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DEPOSIT STATUS (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('deposit-info')
    async getDepositInfo(
        @Query('orderId') orderId: string,
        @Query('customTransactionId') customTransactionId: string,
        @Res() res: Response,
    ) {
        try {
            if (!orderId && !customTransactionId) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'orderId or customTransactionId is required',
                });
            }

            const data = await this.payment6Service.getDepositInfo({ orderId, customTransactionId });
            return res.status(HttpStatus.OK).json({ success: true, ...data });
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] getDepositInfo error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to get deposit info',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CREATE WITHDRAWAL (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Post('withdraw')
    async createWithdrawal(
        @Body() body: any,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        try {
            const userId: number = (req as any).user?.id || body.userId;
            if (!userId) {
                return res.status(HttpStatus.UNAUTHORIZED).json({
                    success: false,
                    message: 'Not authenticated',
                });
            }

            const { orderNo, amount, paymentSystem, currency, data: beneficiaryData } = body;
            const numAmount = parseFloat(amount);

            if (!orderNo || !numAmount || numAmount <= 0) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'orderNo and a valid amount are required',
                });
            }

            if (!paymentSystem) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'paymentSystem is required',
                });
            }

            if (!beneficiaryData || typeof beneficiaryData !== 'object') {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'Beneficiary data is required',
                });
            }

            // Check balance
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.balance < numAmount) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'Insufficient balance',
                });
            }

            // Debit balance atomically and create PENDING withdrawal
            const txn = await this.prisma.$transaction(async (tx) => {
                const deducted = await tx.user.updateMany({
                    where: { id: userId, balance: { gte: numAmount } },
                    data: { balance: { decrement: numAmount } },
                });
                if (deducted.count === 0) {
                    throw new Error('Insufficient balance (concurrent update)');
                }

                return tx.transaction.create({
                    data: {
                        userId,
                        amount: numAmount,
                        type: 'WITHDRAWAL',
                        status: 'PENDING',
                        paymentMethod: 'UPI Gateway 6',
                        utr: orderNo,
                        paymentDetails: {
                            gateway: 'apay',
                            gatewayRoute: 'UPI6',
                            currency: currency || 'INR',
                            paymentSystem,
                            beneficiaryData,
                            orderNo,
                        } as any,
                    },
                });
            });

            this.logger.log(`[Gateway 6 A-Pay] PENDING withdrawal created — utr: ${orderNo}, userId: ${userId}`);

            // Call A-Pay gateway
            const result = await this.payment6Service.createWithdrawal(
                orderNo,
                numAmount,
                currency || 'INR',
                paymentSystem,
                userId,
                beneficiaryData,
            );

            if (!result.success) {
                // Rollback: refund balance and mark as REJECTED
                await this.prisma.$transaction(async (tx) => {
                    await tx.user.update({
                        where: { id: userId },
                        data: { balance: { increment: numAmount } },
                    });
                    await tx.transaction.update({
                        where: { id: txn.id },
                        data: { status: 'REJECTED', remarks: `Gateway: ${result.message}` },
                    });
                });
                this.logger.warn(`[Gateway 6 A-Pay] Withdrawal rejected — refunded userId: ${userId}`);

                return res.status(HttpStatus.OK).json({
                    success: false,
                    message: result.message || 'Gateway rejected the withdrawal',
                });
            }

            return res.status(HttpStatus.OK).json({
                success: true,
                orderId: result.orderId,
                message: 'Withdrawal request submitted',
            });
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] createWithdrawal error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to create withdrawal',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  WITHDRAWAL WEBHOOK (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @Public()
    @Post('withdraw-notify')
    async withdrawalNotify(
        @Body() body: any,
        @Res() res: Response,
    ) {
        this.logger.log(`[Gateway 6 A-Pay] Withdrawal webhook received: ${JSON.stringify(body)}`);

        try {
            const signValid = this.payment6Service.verifyWebhookSignature(body);
            if (!signValid) {
                this.logger.warn('[Gateway 6 A-Pay] Withdrawal webhook: invalid signature');
                return res.status(HttpStatus.FORBIDDEN).json({ status: false, message: 'Invalid signature' });
            }

            const transactions = body?.transactions;
            if (!Array.isArray(transactions) || transactions.length === 0) {
                return res.status(HttpStatus.BAD_REQUEST).json({ status: false, message: 'Missing transactions' });
            }

            for (const txn of transactions) {
                const tradeNo = String(txn.custom_transaction_id ?? txn.order_id ?? '');
                const status = String(txn.status ?? '');

                if (!tradeNo) continue;

                if (status === 'Success') {
                    await this.settleWithdrawal(tradeNo, 'APPROVED');
                } else if (status === 'Failed' || status === 'Rejected') {
                    await this.settleWithdrawal(tradeNo, 'REJECTED');
                } else {
                    this.logger.log(`[Gateway 6 A-Pay] Withdrawal webhook: status "${status}" for ${tradeNo} — no action`);
                }
            }

            return res.status(HttpStatus.OK).json({ status: true, message: 'success' });
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] Withdrawal webhook error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Internal Server Error' });
        }
    }

    private async settleWithdrawal(tradeNo: string, finalStatus: 'APPROVED' | 'REJECTED') {
        try {
            const txn = await this.prisma.transaction.findUnique({ where: { utr: tradeNo } });
            if (!txn) {
                this.logger.warn(`[Gateway 6 A-Pay] settleWithdrawal: no txn for tradeNo: ${tradeNo}`);
                return;
            }
            if (txn.status !== 'PENDING') {
                this.logger.warn(`[Gateway 6 A-Pay] settleWithdrawal: already ${txn.status} — skipping`);
                return;
            }

            if (finalStatus === 'APPROVED') {
                // Withdrawal succeeded — just mark as APPROVED (balance already deducted)
                await this.prisma.transaction.update({
                    where: { id: txn.id },
                    data: { status: 'APPROVED' },
                });
                this.logger.log(`[Gateway 6 A-Pay] Withdrawal APPROVED — userId: ${txn.userId}, amount: ${txn.amount}`);
            } else {
                // Withdrawal failed/rejected — refund balance
                await this.prisma.$transaction(async (tx) => {
                    await tx.transaction.update({
                        where: { id: txn.id },
                        data: { status: 'REJECTED', remarks: 'Gateway rejected withdrawal' },
                    });
                    await tx.user.update({
                        where: { id: txn.userId },
                        data: { balance: { increment: txn.amount } },
                    });
                });
                this.logger.log(`[Gateway 6 A-Pay] Withdrawal REJECTED — refunded userId: ${txn.userId}, amount: ${txn.amount}`);
            }
        } catch (e) {
            this.logger.error(`[Gateway 6 A-Pay] settleWithdrawal error: ${e.message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  WITHDRAWAL STATUS (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('withdrawal-info')
    async getWithdrawalInfo(
        @Query('orderId') orderId: string,
        @Query('customTransactionId') customTransactionId: string,
        @Res() res: Response,
    ) {
        try {
            if (!orderId && !customTransactionId) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'orderId or customTransactionId is required',
                });
            }

            const data = await this.payment6Service.getWithdrawalInfo({ orderId, customTransactionId });
            return res.status(HttpStatus.OK).json({ success: true, ...data });
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] getWithdrawalInfo error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to get withdrawal info',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PAYMENT SYSTEMS INFO (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('payment-systems')
    async getPaymentSystems(@Res() res: Response) {
        try {
            const data = await this.payment6Service.getPaymentSystemsInfo();
            return res.status(HttpStatus.OK).json(data);
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] getPaymentSystems error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to fetch payment systems',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  LOST TRANSACTION — CREATE (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Post('lost-transaction')
    @UseInterceptors(FileInterceptor('file'))
    async createLostTransaction(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { orderId?: string; customTransactionId?: string; description?: string },
        @Res() res: Response,
    ) {
        try {
            if (!file) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'A proof file (jpg, png, heic, jpeg, pdf) is required',
                });
            }

            if (!body.orderId && !body.customTransactionId) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'orderId or customTransactionId is required',
                });
            }

            const data = await this.payment6Service.createLostTransaction(
                { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype },
                { orderId: body.orderId, customTransactionId: body.customTransactionId, description: body.description },
            );

            return res.status(HttpStatus.OK).json(data);
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] createLostTransaction error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to create lost transaction',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  LOST TRANSACTION — INFO (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('lost-transaction')
    async getLostTransactionInfo(
        @Query('orderId') orderId: string,
        @Query('customTransactionId') customTransactionId: string,
        @Res() res: Response,
    ) {
        try {
            if (!orderId && !customTransactionId) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'orderId or customTransactionId is required',
                });
            }

            const data = await this.payment6Service.getLostTransactionInfo({ orderId, customTransactionId });
            return res.status(HttpStatus.OK).json({ success: true, ...data });
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] getLostTransactionInfo error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to get lost transaction info',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  EXPORT — START (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Post('export')
    async startExport(
        @Body() body: { type: 'deposit' | 'withdrawal'; filters: any; format?: 'csv' | 'txt'; columns?: string[] },
        @Res() res: Response,
    ) {
        try {
            if (!body.type || !body.filters) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'type and filters are required',
                });
            }

            const result = await this.payment6Service.startExport(
                body.type,
                body.filters,
                body.format || 'csv',
                body.columns,
            );

            return res.status(HttpStatus.OK).json({ success: true, ...result });
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] startExport error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to start export',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  EXPORT — STATUS (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('export-status')
    async getExportStatus(
        @Query('taskId') taskId: string,
        @Res() res: Response,
    ) {
        try {
            if (!taskId) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'taskId is required',
                });
            }

            const data = await this.payment6Service.getExportStatus(taskId);
            return res.status(HttpStatus.OK).json({ success: true, ...data });
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] getExportStatus error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to get export status',
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  EXPORT — DOWNLOAD (Gateway 6 - A-Pay)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('export-download')
    async downloadExport(
        @Query('fileId') fileId: string,
        @Res() res: Response,
    ) {
        try {
            if (!fileId) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'fileId is required',
                });
            }

            const { data, contentType, filename } = await this.payment6Service.downloadExport(fileId);

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
            return res.send(data);
        } catch (error) {
            this.logger.error(`[Gateway 6 A-Pay] downloadExport error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message || 'Failed to download export',
            });
        }
    }
}
