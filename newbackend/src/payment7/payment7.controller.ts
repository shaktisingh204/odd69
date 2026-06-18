import {
    Controller,
    Post,
    Get,
    Body,
    Res,
    Query,
    HttpStatus,
    Logger,
    UseGuards,
    Headers,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Response } from 'express';
import { Payment7Service } from './payment7.service';
import { PrismaService } from '../prisma.service';
import { Public } from '../auth/public.decorator';
import { SecurityTokenGuard } from '../auth/security-token.guard';
import { EmailService } from '../email/email.service';

@Controller('payment7')
export class Payment7Controller {
    private readonly logger = new Logger(Payment7Controller.name);

    constructor(
        private readonly payment7Service: Payment7Service,
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
    ) {}

    /**
     * Real bank UTRs are max 12 digits. NexPay occasionally returns longer
     * values (13+) which are typically garbage / not a real UTR. In that case
     * we must NOT mark the withdrawal as COMPLETED — we keep it in its current
     * pre-complete state and stamp a remark for the admin to investigate.
     */
    private isValidBankUtr(utr: unknown): boolean {
        if (utr === null || utr === undefined) return true; // no UTR yet — allowed
        const s = String(utr).trim();
        if (!s) return true;
        const digits = s.replace(/\D/g, '');
        return digits.length > 0 && digits.length <= 12;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ADMIN — PROCESS WITHDRAWAL (NexPay)
    //
    //  Admin triggers payout via NexPay for a PENDING/PROCESSED withdrawal.
    //  Extracts beneficiary bank details from transaction.paymentDetails.
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(SecurityTokenGuard)
    @Post('admin/process-withdrawal')
    async adminProcessWithdrawal(
        @Body()
        body: {
            transactionId: number;
            adminId?: number;
            remarks?: string;
            transferMode?: 'IMPS' | 'NEFT' | 'RTGS';
        },
        @Res() res: Response,
    ) {
        try {
            const { transactionId, adminId, remarks, transferMode } = body;
            if (!transactionId) {
                return res
                    .status(HttpStatus.BAD_REQUEST)
                    .json({ success: false, message: 'transactionId is required' });
            }

            const txn = await this.prisma.transaction.findUnique({
                where: { id: Number(transactionId) },
                include: { user: true },
            });
            if (!txn) {
                return res
                    .status(HttpStatus.NOT_FOUND)
                    .json({ success: false, message: 'Transaction not found' });
            }
            if (txn.type !== 'WITHDRAWAL') {
                return res
                    .status(HttpStatus.BAD_REQUEST)
                    .json({ success: false, message: 'Not a withdrawal' });
            }
            if (!['PENDING', 'PROCESSED'].includes(txn.status)) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: `Transaction must be PENDING or PROCESSED (current: ${txn.status})`,
                });
            }

            // Extract beneficiary details from paymentDetails
            const pd = (txn.paymentDetails as Record<string, any>) || {};
            const payeeName =
                pd.holderName || pd.acctName || pd.receive_name || pd.payeeName || 'Beneficiary';
            const payeeAccount =
                pd.accountNo || pd.acctNo || pd.receive_account || pd.receiveAccount || pd.payeeAccount;
            const payeeIfsc =
                pd.ifsc || pd.ifscCode || pd.acctCode || pd.payeeIfsc || '';
            const payeeAcType =
                pd.accountType || pd.payeeAcType || 'savings';
            const payeeBankName =
                pd.bankName || pd.payeeBankName || 'Unknown Bank';
            const rawMobile =
                pd.phoneNumber || pd.mobile || pd.phone || (txn as any).user?.phoneNumber || '9999999999';
            const cleanMobile = rawMobile.replace(/\D/g, '').slice(-10);
            const payeeMobile = cleanMobile.slice(0, 2) + '00000' + cleanMobile.slice(7);
            const payeeEmail =
                pd.email || (txn as any).user?.email || 'user@zeero.bet';

            if (!payeeAccount) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'Beneficiary account number missing in payment details',
                });
            }
            if (!payeeIfsc) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'Beneficiary IFSC missing in payment details',
                });
            }

            // Generate unique external txn ID
            const externalTxnId = `NXP${txn.id}_${Date.now()}`;

            const result = await this.payment7Service.createPayoutOrder({
                amount: txn.amount,
                externalTxnId,
                payeeName,
                payeeAccount,
                payeeMobile,
                payeeEmail,
                payeeIfsc,
                payeeAcType: payeeAcType as 'savings' | 'current',
                payeeBankName,
                transferMode: transferMode || 'IMPS',
            });

            if (result.success) {
                // Gateway accepted — update status to PROCESSING
                await this.prisma.transaction.update({
                    where: { id: txn.id },
                    data: {
                        status: 'PROCESSING',
                        paymentMethod: 'NexPay',
                        utr: externalTxnId,
                        adminId: adminId ?? txn.adminId,
                        remarks: remarks || 'Sent to NexPay',
                        paymentDetails: {
                            ...pd,
                            gateway: 'nexpay',
                            externalTxnId,
                            bankRefNo: result.data?.bank_ref_no,
                        } as any,
                    },
                });

                this.logger.log(
                    `[NexPay] Payout triggered — txn:${txn.id} externalTxnId:${externalTxnId}`,
                );

                // Send approved/processing email
                if (txn.user?.email) {
                    const amountStr = txn.amount.toFixed(2);
                    const currency = pd.currency || 'INR';
                    this.emailService
                        .sendWithdrawalApproved(
                            txn.user.email,
                            txn.user.username || txn.user.email,
                            amountStr,
                            currency,
                        )
                        .catch(() => {});
                }

                return res
                    .status(HttpStatus.OK)
                    .json({ success: true, externalTxnId, data: result.data });
            } else {
                // Gateway rejected — do NOT refund yet (admin can retry with another gateway)
                this.logger.warn(
                    `[NexPay] Payout rejected — txn:${txn.id} message: ${result.message}`,
                );
                return res.status(HttpStatus.OK).json({
                    success: false,
                    message: result.message || 'NexPay rejected the payout',
                });
            }
        } catch (error) {
            this.logger.error(
                `[NexPay] adminProcessWithdrawal error: ${error.message}`,
            );
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message,
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PAYOUT WEBHOOK (NexPay callback)
    //
    //  Receives callback from NexPay with final payout status.
    //  This is the PRIMARY path for completion — sends email immediately.
    //  If UTR is missing, email tells user to check profile page.
    //  Payload: { type, externalTxnId, status, amount, utr, message }
    // ─────────────────────────────────────────────────────────────────────────
    @Public()
    @Post('payout/notify')
    async payoutNotify(
        @Body() body: any,
        @Res() res: Response,
    ) {
        this.logger.log(
            `[NexPay] Payout webhook received — externalTxnId: ${body?.externalTxnId}, status: ${body?.status}, utr: ${body?.utr}`,
        );

        try {
            const {
                externalTxnId,
                status,
                utr: bankUtr,
                message,
            } = body || {};

            if (!externalTxnId) {
                this.logger.warn('[NexPay] Webhook: missing externalTxnId');
                return res.status(HttpStatus.OK).send('ok');
            }

            const txn = await this.prisma.transaction.findUnique({
                where: { utr: externalTxnId },
                include: { user: true },
            });

            if (!txn) {
                this.logger.warn(
                    `[NexPay] Webhook: no transaction found for externalTxnId: ${externalTxnId}`,
                );
                return res.status(HttpStatus.OK).send('ok');
            }

            // Only process if in an active withdrawal state
            if (
                !['PENDING', 'PROCESSED', 'APPROVED', 'PROCESSING'].includes(
                    txn.status,
                )
            ) {
                this.logger.warn(
                    `[NexPay] Webhook: txn ${txn.id} already ${txn.status} — skipping`,
                );
                return res.status(HttpStatus.OK).send('ok');
            }

            const pd = (txn.paymentDetails as Record<string, any>) || {};
            const currency = pd.currency || 'INR';

            if (String(status).toLowerCase() === 'success') {
                // Guard: reject suspiciously long UTRs (>12 digits) — do NOT complete
                if (!this.isValidBankUtr(bankUtr)) {
                    const utrDigits = String(bankUtr).replace(/\D/g, '').length;
                    await this.prisma.transaction.update({
                        where: { id: txn.id },
                        data: {
                            remarks: `got ${utrDigits} digit utr ${bankUtr}`,
                            paymentDetails: {
                                ...pd,
                                suspectUtr: bankUtr,
                                nexpayMessage: message,
                            } as any,
                        },
                    });
                    this.logger.warn(
                        `[NexPay] Webhook: txn:${txn.id} received ${utrDigits}-digit utr "${bankUtr}" — NOT marking COMPLETED`,
                    );
                    return res.status(HttpStatus.OK).send('ok');
                }

                // Payout successful
                await this.prisma.transaction.update({
                    where: { id: txn.id },
                    data: {
                        status: 'COMPLETED',
                        transactionId: bankUtr || undefined,
                        remarks: message || 'NexPay payout success',
                        paymentDetails: {
                            ...pd,
                            bankUtr: bankUtr || undefined,
                            nexpayMessage: message,
                        } as any,
                    },
                });
                this.logger.log(
                    `[NexPay] Payout COMPLETED — txn:${txn.id} utr:${bankUtr || 'pending'}`,
                );

                // Send success email — if UTR missing, tell user to check profile
                if (txn.user?.email) {
                    this.emailService
                        .sendWithdrawalSuccess(
                            txn.user.email,
                            txn.user.username || txn.user.email,
                            txn.amount.toFixed(2),
                            currency,
                            bankUtr || undefined,
                        )
                        .catch(() => {});
                }
            } else if (String(status).toLowerCase() === 'failure' || String(status).toLowerCase() === 'failed') {
                // Payout failed — move back to PROCESSED so admin can retry
                await this.prisma.transaction.update({
                    where: { id: txn.id },
                    data: {
                        status: 'PROCESSED',
                        paymentMethod: null,
                        utr: null,
                        transactionId: null,
                        remarks: message || 'NexPay payout failed — moved back to processed',
                        paymentDetails: {
                            ...pd,
                            nexpayMessage: message,
                            nexpayFailedAt: new Date().toISOString(),
                            failedExternalTxnId: txn.utr,
                        } as any,
                    },
                });
                this.logger.warn(
                    `[NexPay] Payout FAILED — txn:${txn.id} moved back to PROCESSED for retry`,
                );
            } else {
                this.logger.log(
                    `[NexPay] Webhook: unrecognized status "${status}" for txn:${txn.id} — ignoring`,
                );
            }

            return res.status(HttpStatus.OK).send('ok');
        } catch (error) {
            this.logger.error(`[NexPay] Webhook error: ${error.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('fail');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PAYOUT STATUS CHECK (admin manual reconciliation)
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(SecurityTokenGuard)
    @Get('payout/status')
    async checkPayoutStatus(
        @Query('externalTxnId') externalTxnId: string,
        @Res() res: Response,
    ) {
        try {
            if (!externalTxnId) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'externalTxnId is required',
                });
            }

            const result =
                await this.payment7Service.checkPayoutStatus(externalTxnId);

            return res
                .status(HttpStatus.OK)
                .json({ success: true, data: result });
        } catch (error) {
            this.logger.error(
                `[NexPay] checkPayoutStatus error: ${error.message}`,
            );
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message,
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  MANUAL SYNC — poll NexPay and update local transaction
    // ─────────────────────────────────────────────────────────────────────────
    @UseGuards(SecurityTokenGuard)
    @Post('payout/sync')
    async syncPayoutStatus(
        @Body() body: { transactionId: number },
        @Res() res: Response,
    ) {
        try {
            const { transactionId } = body;
            if (!transactionId) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'transactionId is required',
                });
            }

            const txn = await this.prisma.transaction.findUnique({
                where: { id: Number(transactionId) },
                include: { user: true },
            });
            if (!txn) {
                return res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    message: 'Transaction not found',
                });
            }

            const pd = (txn.paymentDetails as Record<string, any>) || {};
            const externalTxnId = pd.externalTxnId || txn.utr;
            if (!externalTxnId) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: 'No externalTxnId found on this transaction',
                });
            }

            const result =
                await this.payment7Service.checkPayoutStatus(externalTxnId);

            const currency = pd.currency || 'INR';

            const isSuccess = result.txnStatus === 'SUCCESS' || result.status === 'SUCCESS';
            const isFailed = result.txnStatus === 'FAILED' || result.status === 'FAILED';

            // Skip non-200 responses unless the body explicitly says FAILED
            if (result.httpStatus !== 200 && !isSuccess && !isFailed) {
                return res.status(HttpStatus.OK).json({
                    success: false,
                    message: `NexPay API error HTTP:${result.httpStatus} — ${result.message}`,
                    data: result,
                });
            }

            if (
                isSuccess &&
                ['PENDING', 'PROCESSED', 'APPROVED', 'PROCESSING'].includes(txn.status)
            ) {
                // Guard: reject suspiciously long UTRs (>12 digits) — do NOT complete
                if (!this.isValidBankUtr(result.utr)) {
                    const utrDigits = String(result.utr).replace(/\D/g, '').length;
                    await this.prisma.transaction.update({
                        where: { id: txn.id },
                        data: {
                            remarks: `got ${utrDigits} digit utr ${result.utr}`,
                            paymentDetails: {
                                ...pd,
                                suspectUtr: result.utr,
                                nexpayMessage: result.message,
                            } as any,
                        },
                    });
                    this.logger.warn(
                        `[NexPay] Sync: txn:${txn.id} received ${utrDigits}-digit utr "${result.utr}" — NOT marking COMPLETED`,
                    );
                    return res.status(HttpStatus.OK).json({
                        success: false,
                        message: `Got ${utrDigits}-digit UTR from NexPay — not completed, needs manual review`,
                        data: result,
                    });
                }

                await this.prisma.transaction.update({
                    where: { id: txn.id },
                    data: {
                        status: 'COMPLETED',
                        transactionId: result.utr || undefined,
                        remarks: result.message || 'NexPay sync: success',
                        paymentDetails: {
                            ...pd,
                            bankUtr: result.utr,
                            nexpayMessage: result.message,
                        } as any,
                    },
                });

                // Send success email with UTR
                if (txn.user?.email) {
                    this.emailService
                        .sendWithdrawalSuccess(
                            txn.user.email,
                            txn.user.username || txn.user.email,
                            txn.amount.toFixed(2),
                            currency,
                            result.utr || undefined,
                        )
                        .catch(() => {});
                }

                return res.status(HttpStatus.OK).json({
                    success: true,
                    message: 'Transaction synced — COMPLETED',
                    data: result,
                });
            } else if (
                isFailed &&
                ['PENDING', 'PROCESSED', 'APPROVED', 'PROCESSING'].includes(txn.status)
            ) {
                // Move back to PROCESSED so admin can retry with another gateway
                await this.prisma.transaction.update({
                    where: { id: txn.id },
                    data: {
                        status: 'PROCESSED',
                        paymentMethod: null,
                        utr: null,
                        transactionId: null,
                        remarks: result.message || 'NexPay sync: failed — moved back to processed',
                        paymentDetails: {
                            ...pd,
                            nexpayMessage: result.message,
                            nexpayFailedAt: new Date().toISOString(),
                            failedExternalTxnId: externalTxnId,
                        } as any,
                    },
                });

                return res.status(HttpStatus.OK).json({
                    success: true,
                    message: 'Transaction synced — FAILED, moved back to PROCESSED for retry',
                    data: result,
                });
            }

            return res.status(HttpStatus.OK).json({
                success: true,
                message: `NexPay status: ${result.txnStatus} — no local update needed`,
                data: result,
            });
        } catch (error) {
            this.logger.error(
                `[NexPay] syncPayoutStatus error: ${error.message}`,
            );
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message,
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CRON — Auto-sync NexPay payouts every 2 minutes
    //
    //  Two jobs:
    //  1. PROCESSING/APPROVED txns → if webhook hasn't arrived, check API.
    //     If SUCCESS → complete + send email with UTR.
    //     If FAILED → refund.
    //  2. COMPLETED txns missing UTR → fetch UTR from API and update.
    // ─────────────────────────────────────────────────────────────────────────
    @Cron('*/2 * * * *')
    async cronSyncNexpayPayouts() {
        try {
            // ── Job 1: Complete pending payouts that webhook missed ──
            const pendingTxns = await this.prisma.transaction.findMany({
                where: {
                    type: 'WITHDRAWAL',
                    status: { in: ['APPROVED', 'PROCESSING'] },
                    paymentMethod: 'NexPay',
                },
                include: { user: true },
                take: 50,
            });

            if (pendingTxns.length) {
                this.logger.log(`[NexPay Cron] Syncing ${pendingTxns.length} pending payout(s)`);
            }

            for (const txn of pendingTxns) {
                try {
                    const pd = (txn.paymentDetails as Record<string, any>) || {};
                    const externalTxnId = pd.externalTxnId || txn.utr;
                    if (!externalTxnId) continue;

                    const result = await this.payment7Service.checkPayoutStatus(externalTxnId);
                    const currency = pd.currency || 'INR';

                    const isSuccess = result.txnStatus === 'SUCCESS' || result.status === 'SUCCESS';
                    const isFailed = result.txnStatus === 'FAILED' || result.status === 'FAILED';

                    // Skip non-200 responses unless the body explicitly says FAILED
                    if (result.httpStatus !== 200 && !isFailed) {
                        this.logger.warn(`[NexPay Cron] txn:${txn.id} API error HTTP:${result.httpStatus} — skipping`);
                        continue;
                    }

                    if (isSuccess) {
                        // Guard: reject suspiciously long UTRs (>12 digits) — do NOT complete
                        if (!this.isValidBankUtr(result.utr)) {
                            const utrDigits = String(result.utr).replace(/\D/g, '').length;
                            await this.prisma.transaction.update({
                                where: { id: txn.id },
                                data: {
                                    remarks: `got ${utrDigits} digit utr ${result.utr}`,
                                    paymentDetails: {
                                        ...pd,
                                        suspectUtr: result.utr,
                                        nexpayMessage: result.message,
                                    } as any,
                                },
                            });
                            this.logger.warn(
                                `[NexPay Cron] txn:${txn.id} received ${utrDigits}-digit utr "${result.utr}" — NOT marking COMPLETED`,
                            );
                            continue;
                        }

                        await this.prisma.transaction.update({
                            where: { id: txn.id },
                            data: {
                                status: 'COMPLETED',
                                transactionId: result.utr || undefined,
                                remarks: result.message || 'NexPay cron: success',
                                paymentDetails: {
                                    ...pd,
                                    bankUtr: result.utr,
                                    nexpayMessage: result.message,
                                } as any,
                            },
                        });

                        // Send email with UTR from API
                        if (txn.user?.email) {
                            this.emailService
                                .sendWithdrawalSuccess(
                                    txn.user.email,
                                    txn.user.username || txn.user.email,
                                    txn.amount.toFixed(2),
                                    currency,
                                    result.utr || undefined,
                                )
                                .catch(() => {});
                        }

                        this.logger.log(`[NexPay Cron] txn:${txn.id} COMPLETED — utr:${result.utr}`);
                    } else if (isFailed) {
                        // Move back to PROCESSED so admin can retry
                        await this.prisma.transaction.update({
                            where: { id: txn.id },
                            data: {
                                status: 'PROCESSED',
                                paymentMethod: null,
                                utr: null,
                                transactionId: null,
                                remarks: result.message || 'NexPay cron: failed — moved back to processed',
                                paymentDetails: {
                                    ...pd,
                                    nexpayMessage: result.message,
                                    nexpayFailedAt: new Date().toISOString(),
                                    failedExternalTxnId: externalTxnId,
                                } as any,
                            },
                        });

                        this.logger.log(`[NexPay Cron] txn:${txn.id} FAILED — moved back to PROCESSED`);
                    }
                } catch (err: any) {
                    this.logger.error(`[NexPay Cron] Failed to sync txn:${txn.id} — ${err.message}`);
                }
            }

            // ── Job 2: Backfill UTR on completed txns that are missing it ──
            const missingUtrTxns = await this.prisma.transaction.findMany({
                where: {
                    type: 'WITHDRAWAL',
                    status: 'COMPLETED',
                    paymentMethod: 'NexPay',
                    transactionId: null,
                },
                take: 20,
            });

            for (const txn of missingUtrTxns) {
                try {
                    const pd = (txn.paymentDetails as Record<string, any>) || {};
                    const externalTxnId = pd.externalTxnId || txn.utr;
                    if (!externalTxnId) continue;

                    const result = await this.payment7Service.checkPayoutStatus(externalTxnId);

                    if (result.httpStatus !== 200) continue;

                    if (result.utr) {
                        if (!this.isValidBankUtr(result.utr)) {
                            const utrDigits = String(result.utr).replace(/\D/g, '').length;
                            this.logger.warn(
                                `[NexPay Cron] txn:${txn.id} UTR backfill skipped — ${utrDigits}-digit utr "${result.utr}"`,
                            );
                            await this.prisma.transaction.update({
                                where: { id: txn.id },
                                data: {
                                    remarks: `got ${utrDigits} digit utr ${result.utr}`,
                                    paymentDetails: {
                                        ...pd,
                                        suspectUtr: result.utr,
                                    } as any,
                                },
                            });
                            continue;
                        }
                        await this.prisma.transaction.update({
                            where: { id: txn.id },
                            data: {
                                transactionId: result.utr,
                                paymentDetails: {
                                    ...pd,
                                    bankUtr: result.utr,
                                } as any,
                            },
                        });
                        this.logger.log(`[NexPay Cron] txn:${txn.id} UTR backfilled — ${result.utr}`);
                    }
                } catch (err: any) {
                    this.logger.error(`[NexPay Cron] UTR backfill failed txn:${txn.id} — ${err.message}`);
                }
            }
        } catch (err: any) {
            this.logger.error(`[NexPay Cron] Fatal error: ${err.message}`);
        }
    }
}
