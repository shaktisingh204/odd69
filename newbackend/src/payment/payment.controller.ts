import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  Logger,
  Req,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BonusService } from '../bonus/bonus.service';
import { UsersService } from '../users/users.service';
import { ReferralService } from '../referral/referral.service';
import { EmailService } from '../email/email.service';
import { buildGatewayRetryContext } from './payment-retry.util';
import { assertMinDeposit } from './payment-limits.util';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
    private configService: ConfigService,
    private readonly bonusService: BonusService,
    private readonly usersService: UsersService,
    private readonly referralService: ReferralService,
    private readonly emailService: EmailService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  //  CREATE DEPOSIT  (UPI 1 / NekPay)
  //  Stores a PENDING transaction then redirects user to the payment page.
  // ─────────────────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createPayment(
    @Body() orderData: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(
        `Creating payment request for order: ${orderData.mch_order_no}`,
      );

      const userId: number = (req as any).user?.id || orderData.userId;
      if (!userId) {
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ success: false, message: 'Not authenticated' });
      }

      const minErr = await assertMinDeposit(
        this.prisma,
        parseFloat(orderData.trade_amount),
        { gatewayKey: 'MIN_DEPOSIT' },
      );
      if (minErr) {
        return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: minErr });
      }

      const retryContext = await buildGatewayRetryContext(
        this.prisma,
        userId,
        orderData.mch_order_no,
      );
      if (retryContext.manualRequired) {
        return res.status(HttpStatus.CONFLICT).json({
          success: false,
          manualRequired: true,
          message: retryContext.retryState.message,
          retryState: retryContext.retryState,
        });
      }

      // Strip internal-only fields that must not be signed or forwarded to the gateway
      const { promoCode, bonusCode, ...gatewayOrderData } = orderData;
      const payload =
        this.paymentService.createPaymentPayload(gatewayOrderData);

      // POST signed payload to NekPay gateway
      const gatewayUrl =
        this.configService.get<string>('PAYMENT_GATEWAY_URL') ||
        'https://api.nekpayment.com/pay/web';
      const formBody = Object.keys(payload)
        .map(
          (key) =>
            encodeURIComponent(key) + '=' + encodeURIComponent(payload[key]),
        )
        .join('&');

      this.logger.log(`Dispatching payment request to ${gatewayUrl}`);
      const gatewayResponse = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
      });

      const rawText = await gatewayResponse.text();
      this.logger.log(`NekPay Gateway Response: ${rawText}`);

      let nekpayData: any;
      try {
        nekpayData = JSON.parse(rawText);
      } catch {
        this.logger.error(`NekPay returned non-JSON: ${rawText}`);
        return res
          .status(HttpStatus.BAD_GATEWAY)
          .json({ success: false, message: `Gateway error: ${rawText}` });
      }

      if (nekpayData.respCode === 'SUCCESS' || nekpayData.tradeResult === '1') {
        // ── Persist PENDING deposit so the notify callback can credit balance + bonus ──
        const effectiveBonusCode =
          (bonusCode || promoCode || '').trim().toUpperCase() || undefined;
        if (userId) {
          try {
            const existing = await this.prisma.transaction.findUnique({
              where: { utr: orderData.mch_order_no },
            });
            if (!existing) {
              await this.prisma.transaction.create({
                data: {
                  userId,
                  amount: parseFloat(orderData.trade_amount),
                  type: 'DEPOSIT',
                  status: 'PENDING',
                  paymentMethod: 'UPI Gateway 1',
                  utr: orderData.mch_order_no,
                  remarks:
                    retryContext.gatewayRetryAttempt > 0
                      ? `Gateway retry ${retryContext.gatewayRetryAttempt} for pending payment ${retryContext.previousPendingUtr || retryContext.retryGroupId}`
                      : undefined,
                  // Store bonusCode so creditDeposit can redeem it on callback
                  paymentDetails: {
                    gateway: 'nekpay',
                    gatewayRoute: 'UPI1',
                    depositCurrency: 'INR',
                    orderNo: orderData.mch_order_no,
                    retryGroupId: retryContext.retryGroupId,
                    gatewayRetryAttempt: retryContext.gatewayRetryAttempt,
                    previousPendingTransactionId:
                      retryContext.previousPendingTransactionId,
                    previousPendingUtr: retryContext.previousPendingUtr,
                    ...(effectiveBonusCode
                      ? { bonusCode: effectiveBonusCode }
                      : {}),
                  } as any,
                },
              });
              this.logger.log(
                `✅ [UPI1] DB: PENDING deposit CREATED — orderId: ${orderData.mch_order_no}, userId: ${userId}, amount: ${orderData.trade_amount}${effectiveBonusCode ? `, bonusCode: ${effectiveBonusCode}` : ''}`,
              );
            } else {
              this.logger.warn(
                `⚠️ [UPI1] DB: deposit already exists (orderId: ${orderData.mch_order_no}) — skipped duplicate`,
              );
            }
          } catch (e) {
            this.logger.error(
              `❌ [UPI1] DB: failed to create PENDING deposit — ${e.message}`,
            );
          }
        } else {
          this.logger.error(
            `❌ [UPI1] DB: PENDING deposit NOT created — userId=${userId}, orderId=${orderData.mch_order_no}. Check JWT auth.`,
          );
        }

        return res
          .status(HttpStatus.OK)
          .json({ success: true, data: nekpayData });
      } else {
        this.logger.warn(
          `NekPay rejected payment: ${JSON.stringify(nekpayData)}`,
        );
        return res.status(HttpStatus.OK).json({
          success: false,
          message:
            nekpayData.tradeMsg ||
            nekpayData.respMsg ||
            'Payment gateway rejected the request',
          data: nekpayData,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          message: error.message || 'Failed to initiate payment',
        });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  DEPOSIT CALLBACK  (UPI 1 / NekPay)
  //  Called by gateway when payment completes. Credits user balance.
  // ─────────────────────────────────────────────────────────────────────────
  @Public()
  @Post('notify')
  async paymentCallback(
    @Req() req: Request,
    @Body() body: any,
    @Res() res: Response,
  ) {
    this.logger.log(`[UPI1] Deposit callback: ${JSON.stringify(body)}`);

    try {
      const isValid = this.paymentService.verifyCallbackSignature(body);
      if (!isValid) {
        this.logger.warn('[UPI1] Deposit callback — invalid signature');
        return res.status(HttpStatus.BAD_REQUEST).send('fail');
      }

      // NekPay callback field is `mchOrderNo` (camelCase) — this is OUR order number stored as UTR
      // gateway's own orderNo (e.g. 1000124...) is NOT what we store
      const ourOrderNo =
        body.mchOrderNo || body.mch_order_no || body.merOrderNo;

      this.logger.log(
        `[UPI1] Deposit callback verified — ourOrderNo: ${ourOrderNo}, tradeResult: ${body.tradeResult}`,
      );

      // tradeResult "1" = success
      if (body.tradeResult === '1' || body.trade_result === '1') {
        await this.creditDeposit(
          ourOrderNo,
          parseFloat(
            body.amount || body.trade_amount || body.tradeAmount || '0',
          ),
        );
      }

      return res.status(HttpStatus.OK).send('success');
    } catch (error) {
      this.logger.error(`[UPI1] Callback error: ${error.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('fail');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CREATE PAYOUT  (UPI 1 / NekPay)
  //  All withdrawals are now MANUAL — creates a PENDING record for admin to approve.
  //  No gateway dispatch happens here anymore.
  // ─────────────────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('payout')
  async createPayout(
    @Body() transferData: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(
        `[UPI1] Manual payout request — transferId: ${transferData.mch_transferId}`,
      );

      const userId: number = (req as any).user?.id || transferData.userId;
      const amount = parseFloat(transferData.transfer_amount);

      if (!userId || !amount || amount <= 0) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ success: false, message: 'Invalid userId or amount' });
      }

      // ── Server-side minimum withdrawal enforcement ────────────────
      try {
        const cfg = await this.prisma.systemConfig.findUnique({
          where: { key: 'MIN_WITHDRAWAL' },
        });
        const parsed = cfg ? parseFloat(cfg.value) : NaN;
        const minWithdrawal = !isNaN(parsed) && parsed > 0 ? parsed : 500;
        if (amount < minWithdrawal) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            message: `Minimum withdrawal amount is ₹${minWithdrawal}`,
          });
        }
      } catch {
        /* fall through with default enforced below */
        if (amount < 500) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            message: 'Minimum withdrawal amount is ₹500',
          });
        }
      }

      // Check balance
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.balance < amount) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ success: false, message: 'Insufficient balance' });
      }

      // Deduct balance and create PENDING withdrawal record for admin approval
      const transferId = transferData.mch_transferId || `WD${Date.now()}`;
      const existing = await this.prisma.transaction
        .findUnique({ where: { utr: transferId } })
        .catch(() => null);
      if (!existing) {
        await this.prisma.$transaction([
          this.prisma.user.update({
            where: { id: userId },
            data: { balance: { decrement: amount } },
          }),
          this.prisma.transaction.create({
            data: {
              userId,
              amount,
              type: 'WITHDRAWAL',
              status: 'PENDING',
              paymentMethod: 'UPI Gateway 1',
              utr: transferId,
              remarks: 'Pending admin approval',
              paymentDetails: {
                method: 'UPI',
                holderName: transferData.receive_name,
                upiId: transferData.receive_account,
                currency: 'INR',
                transferId,
              } as any,
            },
          }),
        ]);
        this.logger.log(
          `[UPI1] PENDING withdrawal created — userId: ${userId}, amount: ${amount}`,
        );
      }

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Withdrawal request submitted — pending admin approval.',
      });
    } catch (error) {
      this.logger.error(`[UPI1] Payout error: ${error.message}`);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          message: 'Failed to create withdrawal request',
        });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PAYOUT CALLBACK  (UPI 1 / NekPay)
  //  tradeResult "1" = success, "2" = failed → refund if failed.
  // ─────────────────────────────────────────────────────────────────────────
  @Public()
  @Post('payout/notify')
  async payoutCallback(
    @Req() req: Request,
    @Body() body: any,
    @Res() res: Response,
  ) {
    this.logger.log(`[UPI1] Payout callback: ${JSON.stringify(body)}`);

    try {
      const isValid = this.paymentService.verifyPayoutCallbackSignature(body);
      if (!isValid) {
        this.logger.warn('[UPI1] Payout callback — invalid signature');
        return res.status(HttpStatus.BAD_REQUEST).send('fail');
      }

      const transferId: string = body.merTransferId || body.mch_transferId;
      this.logger.log(
        `[UPI1] Payout verified — transferId: ${transferId}, tradeResult: ${body.tradeResult}`,
      );

      const txn = await this.prisma.transaction.findUnique({
        where: { utr: transferId },
      });
      if (txn && txn.status === 'PENDING') {
        if (body.tradeResult === '1') {
          // Success — mark APPROVED (balance already deducted)
          await this.prisma.transaction.update({
            where: { id: txn.id },
            data: { status: 'APPROVED' },
          });
          this.logger.log(`[UPI1] Withdrawal APPROVED — ${transferId}`);
        } else {
          // Failed — refund balance and mark REJECTED
          await this.prisma.$transaction([
            this.prisma.user.update({
              where: { id: txn.userId },
              data: { balance: { increment: txn.amount } },
            }),
            this.prisma.transaction.update({
              where: { id: txn.id },
              data: {
                status: 'REJECTED',
                remarks: `Gateway tradeResult: ${body.tradeResult}`,
              },
            }),
          ]);
          this.logger.warn(
            `[UPI1] Withdrawal REJECTED & refunded — ${transferId}`,
          );
        }
      }

      return res.status(HttpStatus.OK).send('success');
    } catch (error) {
      this.logger.error(`[UPI1] Payout callback error: ${error.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('fail');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  HELPER: credit deposit on successful callback
  // ─────────────────────────────────────────────────────────────────────────
  private async creditDeposit(orderNo: string, gatewayAmount: number) {
    try {
      const txn = await this.prisma.transaction.findUnique({
        where: { utr: orderNo },
      });
      if (!txn) {
        this.logger.warn(`[UPI1] No transaction found for orderNo: ${orderNo}`);
        return;
      }
      if (txn.status !== 'PENDING') {
        this.logger.warn(
          `[UPI1] Transaction already ${txn.status} — skip credit`,
        );
        return;
      }

      // SECURITY: credit amount is pinned to the stored PENDING txn amount,
      // not the webhook body. Even with a valid HMAC, accepting body.amount
      // would let a valid signed payload for a small deposit be re-played
      // or mirror-posted with an inflated amount field to over-credit.
      // If the gateway reports a mismatched amount we log and refuse.
      if (
        gatewayAmount > 0 &&
        Math.abs(gatewayAmount - txn.amount) > 0.01
      ) {
        this.logger.warn(
          `[UPI1] Amount mismatch — stored ₹${txn.amount}, gateway reported ₹${gatewayAmount}. Refusing credit.`,
        );
        return;
      }
      const creditAmount = txn.amount;

      // Check if this is the user's first deposit (for referral + bonus purposes)
      const previousDeposits = await this.prisma.transaction.count({
        where: { userId: txn.userId, type: 'DEPOSIT', status: 'APPROVED' },
      });

      // ── Atomic credit with PENDING→APPROVED guard ─────────────────────
      // Use updateMany with a status predicate so that only ONE caller can
      // transition PENDING→APPROVED. This closes the race where a
      // cancellation (PENDING→REJECTED) and a late webhook race each other,
      // and also blocks double-credit from a replayed webhook.
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
          `[UPI1] creditDeposit skipped — transaction no longer PENDING (orderNo: ${orderNo})`,
        );
        return;
      }

      this.logger.log(
        `[UPI1] Deposit APPROVED — userId: ${txn.userId}, amount: ${creditAmount}, orderNo: ${orderNo}`,
      );

      // ── Track total deposited ──────────────────────────────────────────
      try {
        await this.usersService.setWageringOnFirstDeposit(
          txn.userId,
          creditAmount,
        );
      } catch (e) {
        this.logger.error(
          `[UPI1] totalDeposited update failed (non-fatal): ${e.message}`,
        );
      }

      // ── Apply bonus if stored at deposit time ──────────────────────────
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
            `[UPI1] Bonus redeemed — userId: ${txn.userId}, code: ${bonusCode}`,
          );
        } catch (e) {
          this.logger.error(
            `[UPI1] Bonus redemption failed (non-fatal): ${e.message}`,
          );
        }
      }

      // ── Default 1x deposit wagering lock if no bonus applied it ───────
      if (!depositWageringApplied) {
        try {
          await this.bonusService.applyDepositWagering(
            txn.userId,
            creditAmount,
            1,
          );
        } catch (e) {
          this.logger.error(
            `[UPI1] Deposit wagering lock failed (non-fatal): ${e.message}`,
          );
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
          `[UPI1] Referral reward failed (non-fatal): ${e.message}`,
        );
      }

      // ── Deposit confirmation email ───────────────────────────────────
      try {
        const user = await this.prisma.user.findUnique({ where: { id: txn.userId }, select: { email: true, username: true } });
        if (user?.email) {
          this.emailService.sendDepositSuccess(user.email, user.username || user.email, creditAmount.toFixed(2), 'INR').catch(() => {});
        }
      } catch (e) {
        this.logger.error(`[UPI1] Deposit email failed (non-fatal): ${e.message}`);
      }
    } catch (e) {
      this.logger.error(`[UPI1] creditDeposit failed: ${e.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ADMIN: MANUAL DEPOSIT
  //  Admin credits a user's balance directly without a payment gateway.
  //  Creates an APPROVED transaction immediately.
  // ─────────────────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('admin/manual-deposit')
  async adminManualDeposit(
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const adminUser = (req as any).user;
      // Allow only admins
      if (
        !adminUser ||
        (adminUser.role !== 'ADMIN' && adminUser.role !== 'SUPERADMIN')
      ) {
        return res
          .status(HttpStatus.FORBIDDEN)
          .json({ success: false, message: 'Admin access required' });
      }

      const { userId, amount, method, utr, remarks, wallet, currency } = body;
      const numAmount = parseFloat(amount);

      if (!userId || !numAmount || numAmount <= 0) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({
            success: false,
            message: 'userId and a positive amount are required',
          });
      }

      // Wallet routing: accept explicit `wallet` flag, otherwise infer from
      // method / currency so legacy callers that only pass a method label
      // still route Crypto deposits to `cryptoBalance` instead of the INR
      // `balance`.
      const isCrypto =
        String(wallet || '').toLowerCase() === 'crypto' ||
        String(currency || '').toUpperCase() === 'CRYPTO' ||
        String(currency || '').toUpperCase() === 'USD' ||
        String(method || '').toLowerCase().includes('crypto');

      const user = await this.prisma.user.findUnique({
        where: { id: Number(userId) },
      });
      if (!user) {
        return res
          .status(HttpStatus.NOT_FOUND)
          .json({ success: false, message: 'User not found' });
      }

      // Generate unique UTR if not provided
      const utrRef = (utr || '').trim() || `ADMIN${Date.now()}`;

      // Create APPROVED transaction & credit the correct wallet atomically.
      const [, txn] = await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: Number(userId) },
          data: isCrypto
            ? ({ cryptoBalance: { increment: numAmount } } as any)
            : { balance: { increment: numAmount } },
        }),
        this.prisma.transaction.create({
          data: {
            userId: Number(userId),
            amount: numAmount,
            type: 'DEPOSIT',
            status: 'APPROVED',
            paymentMethod: method || (isCrypto ? 'Crypto (Manual)' : 'Manual Deposit (Admin)'),
            utr: utrRef,
            remarks:
              remarks ||
              `Manual deposit by admin (${adminUser.username || adminUser.email || 'admin'})`,
            paymentDetails: {
              gateway: 'admin_manual',
              addedBy: adminUser.id,
              adminNote: remarks || '',
              wallet: isCrypto ? 'crypto' : 'fiat',
              currency: isCrypto ? 'USD' : 'INR',
              depositCurrency: isCrypto ? 'CRYPTO' : 'INR',
            } as any,
          },
        }),
      ]);

      // ── Track total deposited (INR analytics field — fiat only) ────────
      if (!isCrypto) {
        try {
          await this.usersService.setWageringOnFirstDeposit(
            Number(userId),
            numAmount,
          );
        } catch (e) {
          this.logger.error(
            `[ADMIN] totalDeposited update failed (non-fatal): ${e.message}`,
          );
        }
      }

      this.logger.log(
        `[ADMIN] Manual deposit — userId: ${userId}, amount: ${numAmount}, utr: ${utrRef}, by admin: ${adminUser.id}`,
      );
      return res.status(HttpStatus.OK).json({
        success: true,
        message: `Deposited ₹${numAmount} to ${user.username || user.email}`,
        transactionId: txn.id,
      });
    } catch (error) {
      this.logger.error(`[ADMIN] Manual deposit error: ${error.message}`);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          message: error.message || 'Failed to process manual deposit',
        });
    }
  }
}
