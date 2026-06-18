import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { ReferralService } from '../referral/referral.service';
import { BonusService } from '../bonus/bonus.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class TransactionsService {
    constructor(
        private prisma: PrismaService,
        private referralService: ReferralService,
        private bonusService: BonusService,
        private emailService: EmailService,
    ) { }

    async createDeposit(userId: number, amount: number, paymentMethod: string, utr: string, currency: string, type: string, proof?: string, bonusCode?: string) {
        // Check if UTR already exists
        const existingTransaction = await this.prisma.transaction.findUnique({
            where: { utr },
        });

        if (existingTransaction) {
            throw new BadRequestException('Transaction with this UTR already exists');
        }

        return this.prisma.transaction.create({
            data: {
                userId,
                amount,
                type: 'DEPOSIT',
                status: 'PENDING',
                paymentMethod,
                utr,
                proof,
                // Store bonus code in paymentDetails so approveTransaction can redeem it
                paymentDetails: bonusCode
                    ? { bonusCode: bonusCode.toUpperCase(), currency, depositCurrency: currency }
                    : { currency, depositCurrency: currency } as any,
            },
        });
    }

    async createWithdrawal(userId: number, amount: number, paymentDetails: any) {
        if (!amount || amount <= 0) {
            throw new BadRequestException('Invalid withdrawal amount');
        }

        // ── Server-side minimum withdrawal enforcement ────────────────────
        // Clients must not be able to bypass the min withdrawal limit by
        // hitting the API directly. Read the configured minimum from
        // SystemConfig (same source frontend reads via /settings/public).
        const isCrypto =
            String(paymentDetails?.method || '').toUpperCase() === 'CRYPTO' ||
            String(paymentDetails?.currency || '').toUpperCase() === 'CRYPTO';
        const configKey = isCrypto ? 'MIN_WITHDRAWAL_CRYPTO' : 'MIN_WITHDRAWAL';
        const defaultMin = isCrypto ? 10 : 500;
        const cfg = await this.prisma.systemConfig.findUnique({ where: { key: configKey } });
        const parsedMin = cfg ? parseFloat(cfg.value) : NaN;
        const minWithdrawal = !isNaN(parsedMin) && parsedMin > 0 ? parsedMin : defaultMin;
        if (amount < minWithdrawal) {
            throw new BadRequestException(
                `Minimum withdrawal amount is ${isCrypto ? '$' : '₹'}${minWithdrawal}`,
            );
        }

        // Check user balance — crypto withdrawals must be checked/debited
        // against the crypto wallet (`cryptoBalance`), NOT the fiat wallet.
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new BadRequestException('Insufficient balance');
        }
        const currentWalletBalance = isCrypto
            ? Number((user as any).cryptoBalance ?? 0)
            : Number(user.balance ?? 0);
        if (currentWalletBalance < amount) {
            throw new BadRequestException('Insufficient balance');
        }

        // Require full profile (Name, Surname, City, Country, Email, Phone) before withdrawal
        const u = user as any;
        if (
            !u.firstName?.trim() ||
            !u.lastName?.trim() ||
            !u.city?.trim() ||
            !u.country?.trim() ||
            !u.email?.trim() ||
            !u.phoneNumber?.trim()
        ) {
            throw new BadRequestException('Please complete your Personal Information in Settings before requesting a withdrawal.');
        }

        // ── Deposit Wagering Lock ────────────────────────────────────────────
        // Every deposit applies a 1× wagering requirement. Block withdrawal
        // until the user has wagered at least the deposited amount.
        const depositWageringRequired = Number(u.depositWageringRequired || 0);
        const depositWageringDone = Number(u.depositWageringDone || 0);
        if (depositWageringRequired > 0 && depositWageringDone < depositWageringRequired) {
            const remaining = Math.max(0, depositWageringRequired - depositWageringDone);
            throw new BadRequestException(
                `Deposit wagering requirement not met. ` +
                `Please wager ${remaining.toFixed(2)} more before withdrawing.`,
            );
        }

        // ── iGaming Bonus Policy ──────────────────────────────────────────────
        // If user has an active bonus with incomplete wagering, BLOCK the
        // withdrawal. Auto-forfeiting silently allowed attackers to withdraw
        // deposit + un-wagered bonus funds from a shared wallet. The user
        // must explicitly complete wagering or manually forfeit the bonus.
        const activeBonus = await (this.prisma as any).userBonus.findFirst({
            where: { userId, status: 'ACTIVE' }
        });
        if (activeBonus) {
            const required = Number(activeBonus.wageringRequired || 0);
            const done = Number(activeBonus.wageringDone || 0);
            if (done < required) {
                const remaining = Math.max(0, required - done);
                throw new BadRequestException(
                    `You have an active bonus with incomplete wagering. ` +
                    `Please complete ${remaining.toFixed(2)} more wagering ` +
                    `or forfeit the bonus from Settings before withdrawing.`,
                );
            }
            // Wagering is complete — mark bonus as completed before withdrawal.
            await this.bonusService.forfeitActiveBonus(userId, 'Withdrawal after wagering complete');
        }

        return this.prisma.$transaction(async (prisma) => {
            // SECURITY: conditional decrement — only succeeds if the DB row
            // still has sufficient balance at commit time. The balance check
            // at line ~72 above races with concurrent bets/transfers; this
            // atomic guard prevents negative balances. If count === 0 we know
            // the balance was drained between the read and this update, so
            // we abort (rolling back the enclosing $transaction).
            const deduct = isCrypto
                ? await prisma.user.updateMany({
                    where: { id: userId, cryptoBalance: { gte: amount } },
                    data: { cryptoBalance: { decrement: amount } },
                })
                : await prisma.user.updateMany({
                    where: { id: userId, balance: { gte: amount } },
                    data: { balance: { decrement: amount } },
                });
            if (deduct.count === 0) {
                throw new BadRequestException(
                    'Insufficient balance (concurrent update detected). Please retry.',
                );
            }

            // Derive a clean paymentMethod label for display
            const methodLabel = paymentDetails?.method
                ? (paymentDetails.method as string).toUpperCase() === 'UPI' ? 'UPI'
                    : (paymentDetails.method as string).toUpperCase() === 'BANK' ? 'BANK'
                        : (paymentDetails.method as string).toUpperCase() === 'CRYPTO' ? 'CRYPTO'
                            : 'WITHDRAWAL'
                : 'WITHDRAWAL';

            // Create transaction record
            const txn = await prisma.transaction.create({
                data: {
                    userId,
                    amount,
                    type: 'WITHDRAWAL',
                    status: 'PENDING',
                    paymentMethod: methodLabel,
                    paymentDetails,
                },
            });

            // Send pending withdrawal email (non-blocking)
            if (user.email) {
                const amountStr = amount.toFixed(2);
                const currency = paymentDetails?.currency || 'INR';
                this.emailService.sendWithdrawalPending(
                    user.email,
                    user.username || user.email,
                    amountStr,
                    currency,
                ).catch(() => { });
            }

            return txn;
        });
    }

    async getLatestPendingDeposit(userId: number) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
        const txn = await this.prisma.transaction.findFirst({
            where: {
                userId,
                type: 'DEPOSIT',
                status: 'PENDING',
                createdAt: { gte: cutoff },
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                utr: true,
                amount: true,
                paymentMethod: true,
                createdAt: true,
            },
        });
        return { pending: !!txn, transaction: txn };
    }

    async getUserTransactions(userId: number) {
        return this.prisma.transaction.findMany({
            where: {
                userId,
                NOT: {
                    type: { in: ['BET', 'BET_PLACE', 'BONUS_CONVERT_REVERSED'] },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getAllTransactions(page: number = 1, limit: number = 20, type?: string, status?: string, search?: string) {
        const skip = (page - 1) * limit;
        const where: any = {};

        if (type && type !== 'ALL') where.type = type;
        if (status && status !== 'ALL') where.status = status;
        if (search) {
            where.OR = [
                { utr: { contains: search, mode: 'insensitive' } },
                { user: { username: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } }
            ];
        }

        const [transactions, total] = await Promise.all([
            this.prisma.transaction.findMany({
                where,
                include: { user: { select: { username: true, email: true } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            this.prisma.transaction.count({ where })
        ]);

        return {
            transactions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // ── Withdrawal 4-step flow: PENDING → PROCESSED → APPROVED → COMPLETED ──

    /**
     * Step 1→2: Mark a PENDING withdrawal as PROCESSED (admin has reviewed it).
     */
    async processWithdrawal(id: number, adminId: number, remarks?: string) {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!transaction) throw new BadRequestException('Transaction not found');
        if (transaction.type !== 'WITHDRAWAL') throw new BadRequestException('Transaction is not a withdrawal');
        if (transaction.status !== 'PENDING') throw new BadRequestException('Transaction is not pending');

        const updated = await this.prisma.transaction.update({
            where: { id },
            data: { status: 'PROCESSED', adminId, remarks },
        });

        // Send processed email (non-blocking)
        if (transaction.user?.email) {
            const amountStr = transaction.amount.toFixed(2);
            const currency = (transaction.paymentDetails as any)?.currency || 'INR';
            this.emailService.sendWithdrawalProcessed(
                transaction.user.email,
                transaction.user.username || transaction.user.email,
                amountStr,
                currency,
            ).catch(() => { });
        }

        return updated;
    }

    /**
     * Step 2→3: Mark a PROCESSED withdrawal as APPROVED (payment initiated).
     */
    async approveWithdrawal(id: number, adminId: number, remarks?: string) {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!transaction) throw new BadRequestException('Transaction not found');
        if (transaction.type !== 'WITHDRAWAL') throw new BadRequestException('Transaction is not a withdrawal');
        if (transaction.status !== 'PROCESSED') throw new BadRequestException('Transaction must be in PROCESSED status to approve');

        const updated = await this.prisma.transaction.update({
            where: { id },
            data: { status: 'APPROVED', adminId, remarks },
        });

        // Send approved email (non-blocking)
        if (transaction.user?.email) {
            const amountStr = transaction.amount.toFixed(2);
            const currency = (transaction.paymentDetails as any)?.currency || 'INR';
            this.emailService.sendWithdrawalApproved(
                transaction.user.email,
                transaction.user.username || transaction.user.email,
                amountStr,
                currency,
            ).catch(() => { });
        }

        return updated;
    }

    /**
     * Step 3→4: Mark an APPROVED withdrawal as COMPLETED (payment confirmed).
     */
    async completeWithdrawal(id: number, adminId: number, remarks?: string, transactionIdStr?: string) {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!transaction) throw new BadRequestException('Transaction not found');
        if (transaction.type !== 'WITHDRAWAL') throw new BadRequestException('Transaction is not a withdrawal');
        if (transaction.status !== 'APPROVED') throw new BadRequestException('Transaction must be in APPROVED status to complete');

        const updated = await this.prisma.transaction.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                adminId,
                remarks,
                ...(transactionIdStr ? { transactionId: transactionIdStr } : {}),
            },
        });

        // Send email notification (non-blocking)
        if (transaction.user?.email) {
            const amountStr = transaction.amount.toFixed(2);
            const currency = (transaction.paymentDetails as any)?.currency || 'INR';
            this.emailService.sendWithdrawalSuccess(
                transaction.user.email,
                transaction.user.username || transaction.user.email,
                amountStr,
                currency,
            ).catch(() => { });
        }

        return updated;
    }

    /**
     * Deposit approval (unchanged logic, extracted from old approveTransaction).
     */
    async approveTransaction(id: number, adminId: number, remarks?: string) {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id },
            include: { user: true },
        });

        if (!transaction) throw new BadRequestException('Transaction not found');
        if (transaction.status !== 'PENDING') throw new BadRequestException('Transaction is not pending');

        return this.prisma.$transaction(async (prisma) => {
            if (transaction.type === 'DEPOSIT') {
                // ── Wallet routing: INR vs CRYPTO ─────────────────────────────
                // Deposit currency is carried on the transaction's paymentDetails
                // (set by the gateway / admin UI) or on paymentMethod. Crypto
                // deposits must credit `cryptoBalance` and skip the INR-only
                // `totalDeposited` + `depositWagering` lock, since both are
                // denominated in INR and would corrupt fiat analytics.
                const details = (transaction.paymentDetails as any) || {};
                const isCrypto =
                    String(details?.depositCurrency || '').toUpperCase() === 'CRYPTO' ||
                    String(details?.currency || '').toUpperCase() === 'CRYPTO' ||
                    String(details?.wallet || '').toUpperCase() === 'CRYPTO' ||
                    String(details?.method || '').toUpperCase().includes('CRYPTO') ||
                    String(transaction.paymentMethod || '').toUpperCase().includes('CRYPTO');

                await prisma.user.update({
                    where: { id: transaction.userId },
                    data: isCrypto
                        ? { cryptoBalance: { increment: transaction.amount } }
                        : { balance: { increment: transaction.amount } },
                });

                // Check for First Deposit
                const previousDeposits = await prisma.transaction.count({
                    where: {
                        userId: transaction.userId,
                        type: 'DEPOSIT',
                        status: { in: ['APPROVED', 'COMPLETED'] },
                    },
                });

                try {
                    if (previousDeposits === 0) {
                        await this.referralService.checkAndAward(transaction.userId, 'DEPOSIT_FIRST', transaction.amount, `dep_${transaction.id}_first`);
                    }
                    await this.referralService.checkAndAward(transaction.userId, 'DEPOSIT_RECURRING', transaction.amount, `dep_${transaction.id}_rec`);
                } catch (e) {
                    console.error('Referral award failed', e);
                }

                const bonusCode = details?.bonusCode;
                const depositCurrency = isCrypto ? 'CRYPTO' : 'INR';
                let depositWageringApplied = false;
                if (bonusCode) {
                    try {
                        const result = await this.bonusService.redeemBonus(transaction.userId, bonusCode, transaction.amount, {
                            depositCurrency,
                            approvedDepositCountBeforeThisDeposit: previousDeposits,
                        });
                        if (result) depositWageringApplied = true;
                    } catch (e) {
                        console.error('Bonus redemption failed (non-fatal):', e);
                    }
                }

                // Deposit wagering lock + totalDeposited are INR analytics —
                // only applied to fiat deposits.
                if (!isCrypto) {
                    if (!depositWageringApplied) {
                        try {
                            await this.bonusService.applyDepositWagering(transaction.userId, transaction.amount, 1);
                        } catch (e) {
                            console.error('Deposit wagering lock failed (non-fatal):', e);
                        }
                    }

                    try {
                        await (this.prisma as any).user.update({
                            where: { id: transaction.userId },
                            data: { totalDeposited: { increment: transaction.amount } },
                        });
                    } catch (e) {
                        console.error('totalDeposited increment failed (non-fatal):', e);
                    }
                }
            }

            const approved = await prisma.transaction.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    adminId,
                    remarks,
                },
            });

            // Send email notification (non-blocking)
            if (transaction.user?.email) {
                const amountStr = transaction.amount.toFixed(2);
                const currency = (transaction.paymentDetails as any)?.currency || 'INR';
                if (transaction.type === 'DEPOSIT') {
                    this.emailService.sendDepositSuccess(
                        transaction.user.email,
                        transaction.user.username || transaction.user.email,
                        amountStr,
                        currency,
                    ).catch(() => { });
                }
            }

            return approved;
        });
    }

    /**
     * Reject a withdrawal — allowed from PENDING or PROCESSED status.
     * Refunds the user's balance.
     */
    async rejectTransaction(id: number, adminId: number, remarks?: string) {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id },
        });

        if (!transaction) throw new BadRequestException('Transaction not found');
        if (!['PENDING', 'PROCESSED'].includes(transaction.status)) {
            throw new BadRequestException('Transaction can only be rejected from PENDING or PROCESSED status');
        }

        return this.prisma.$transaction(async (prisma) => {
            if (transaction.type === 'WITHDRAWAL') {
                // Refund to the wallet the withdrawal was originally debited
                // from. Crypto withdrawals debit `cryptoBalance`, so we must
                // credit the same wallet on reject — not `balance`.
                const details = (transaction.paymentDetails as any) || {};
                const wasCrypto =
                    String(transaction.paymentMethod || '').toUpperCase() === 'CRYPTO' ||
                    String(details?.method || '').toUpperCase() === 'CRYPTO' ||
                    String(details?.currency || '').toUpperCase() === 'CRYPTO';

                await prisma.user.update({
                    where: { id: transaction.userId },
                    data: wasCrypto
                        ? { cryptoBalance: { increment: transaction.amount } }
                        : { balance: { increment: transaction.amount } },
                });
            }

            return prisma.transaction.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    adminId,
                    remarks,
                },
            });
        });
    }
}
