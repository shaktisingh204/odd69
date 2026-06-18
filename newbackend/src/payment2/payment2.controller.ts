import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  Logger,
  Req,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Payment2Service } from './payment2.service';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SecurityTokenGuard } from '../auth/security-token.guard';
import { BonusService } from '../bonus/bonus.service';
import { UsersService } from '../users/users.service';
import { ReferralService } from '../referral/referral.service';
import { EmailService } from '../email/email.service';
import { buildGatewayRetryContext } from '../payment/payment-retry.util';
import { assertMinDeposit } from '../payment/payment-limits.util';

/**
 * UPI 2 Gateway Controller
 *
 * API Response shape: { code: number, msg: string, data: object }
 *   code === 0  → success
 *   code !== 0  → failure (msg contains error reason)
 *
 * Async callback acknowledgement: respond with plain string "ok"
 *
 * Order States (orderState):
 *   0 = Initialization
 *   1 = Success
 *   2 = Fail
 *   3 = Processing
 *   4 = Closed / Rejected
 *   5 = Reversed / Refunded
 *   6 = Payment in progress
 */

@Controller('payment2')
export class Payment2Controller {
  private readonly logger = new Logger(Payment2Controller.name);

  constructor(
    private readonly payment2Service: Payment2Service,
    private readonly prisma: PrismaService,
    private configService: ConfigService,
    private readonly bonusService: BonusService,
    private readonly usersService: UsersService,
    private readonly referralService: ReferralService,
    private readonly emailService: EmailService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  //  HELPER: Forward a signed JSON payload to the gateway and parse response
  // ─────────────────────────────────────────────────────────────────────────

  private async callGateway(
    url: string,
    payload: Record<string, any>,
  ): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    this.logger.log(`[UPI2] Gateway response from ${url}: ${rawText}`);

    try {
      return JSON.parse(rawText);
    } catch {
      throw new Error(`Gateway returned non-JSON: ${rawText}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  COLLECTION — Create Deposit Order
  //  Gateway endpoint: POST /api/payIn
  //
  //  Request params: merchNo, orderNo, amount, currency, notifyUrl (opt), sign
  //  Response data:  { code_url: "<payment-link>" }
  // ─────────────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createPayment(
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const {
        orderNo,
        amount,
        currency = 'INR',
        notifyUrl,
        payType,
        bonusCode,
        promoCode,
      } = body;

      this.logger.log(
        `[UPI2] Creating deposit — orderNo: ${orderNo}, amount: ${amount}`,
      );

      const userId: number = (req as any).user?.id || body.userId;
      if (!userId) {
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ success: false, message: 'Not authenticated' });
      }

      const minErr = await assertMinDeposit(this.prisma, parseFloat(amount), { gatewayKey: 'MIN_DEPOSIT_UPI2' });
      if (minErr) {
        return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: minErr });
      }

      const retryContext = await buildGatewayRetryContext(
        this.prisma,
        userId,
        orderNo,
      );
      if (retryContext.manualRequired) {
        return res.status(HttpStatus.CONFLICT).json({
          success: false,
          manualRequired: true,
          message: retryContext.retryState.message,
          retryState: retryContext.retryState,
        });
      }

      const baseUrl = this.configService.get<string>('PAYMENT2_BASE_URL');
      if (!baseUrl) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'PAYMENT2_BASE_URL is not configured',
        });
      }

      // Include notifyUrl and payType (required by gateway to select channel)
      const defaultPayType =
        this.configService.get<string>('PAYMENT2_PAY_TYPE') || 'UPI';
      const orderData: Record<string, any> = {
        orderNo,
        amount: String(amount),
        currency,
        payType: payType || defaultPayType,
      };
      if (notifyUrl) orderData['notifyUrl'] = notifyUrl;

      const payload = this.payment2Service.createPaymentPayload(orderData);
      const gatewayData = await this.callGateway(
        `${baseUrl}/api/payIn`,
        payload,
      );

      if (gatewayData.code === 0) {
        // code_url is the UPI payment link to redirect/open for the user

        // ── Persist PENDING deposit so notify callback can credit the user ──
        const effectiveBonusCode =
          (bonusCode || promoCode || '').trim().toUpperCase() || undefined;
        if (userId && orderNo) {
          try {
            const existing = await this.prisma.transaction.findUnique({
              where: { utr: orderNo },
            });
            if (!existing) {
              await this.prisma.transaction.create({
                data: {
                  userId,
                  amount: parseFloat(body.amount),
                  type: 'DEPOSIT',
                  status: 'PENDING',
                  paymentMethod: 'UPI Gateway 2',
                  utr: orderNo,
                  remarks:
                    retryContext.gatewayRetryAttempt > 0
                      ? `Gateway retry ${retryContext.gatewayRetryAttempt} for pending payment ${retryContext.previousPendingUtr || retryContext.retryGroupId}`
                      : undefined,
                  // Store bonusCode so creditDeposit can redeem it on callback
                  paymentDetails: {
                    gateway: 'upi2',
                    gatewayRoute: 'UPI2',
                    depositCurrency: 'INR',
                    orderNo,
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
                `✅ [UPI2] DB: PENDING deposit CREATED — utr: ${orderNo}, userId: ${userId}, amount: ${body.amount}${effectiveBonusCode ? `, bonusCode: ${effectiveBonusCode}` : ''}`,
              );
            } else {
              this.logger.warn(
                `⚠️ [UPI2] DB: deposit already exists (utr: ${orderNo}) — skipped duplicate`,
              );
            }
          } catch (e) {
            this.logger.error(
              `❌ [UPI2] DB: failed to create PENDING deposit — ${e.message}`,
            );
          }
        } else {
          this.logger.error(
            `❌ [UPI2] DB: PENDING deposit NOT created — userId=${userId}, orderNo=${orderNo}. Check JWT auth.`,
          );
        }

        return res.status(HttpStatus.OK).json({
          success: true,
          payUrl: gatewayData.data?.code_url,
          data: gatewayData.data,
        });
      } else {
        this.logger.warn(
          `[UPI2] Deposit rejected: ${JSON.stringify(gatewayData)}`,
        );
        return res.status(HttpStatus.OK).json({
          success: false,
          message: gatewayData.msg || 'Gateway rejected the deposit',
          data: gatewayData.data,
        });
      }
    } catch (error) {
      this.logger.error(`[UPI2] Create deposit error: ${error.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to initiate UPI 2 deposit',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  COLLECTION — Async Callback (notify)
  //  Only successful orders trigger this for deposits.
  //  The gateway posts the `data` object directly (sign is inside).
  //  MUST respond with plain text "ok" to stop gateway retries.
  // ─────────────────────────────────────────────────────────────────────────

  @Public()
  @Post('notify')
  async paymentCallback(
    @Req() req: Request,
    @Body() body: any,
    @Res() res: Response,
  ) {
    this.logger.log(`[UPI2] Deposit callback: ${JSON.stringify(body)}`);

    try {
      // Gateway wraps payload as { code, msg, data:{...sign...} }
      // Fall back to raw body if data is absent (some gateways send flat bodies)
      const payload =
        body?.data && typeof body.data === 'object' ? body.data : body;

      const isValid = this.payment2Service.verifyCallbackSignature(payload);

      if (!isValid) {
        this.logger.warn(`[UPI2] Deposit callback — invalid signature`);
        return res.status(HttpStatus.BAD_REQUEST).send('fail');
      }

      const { orderNo, amount, realAmount, businessNo, orderState, merchNo } =
        payload;
      const state = Number(orderState);

      this.logger.log(
        `[UPI2] Deposit callback verified — orderNo: ${orderNo}, state: ${state}, ` +
          `amount: ${amount}, realAmount: ${realAmount}, UTR: ${businessNo}`,
      );

      // state 1 = Success → credit user balance
      if (state === 1) {
        await this.creditDeposit(
          orderNo,
          parseFloat(realAmount || amount || '0'),
        );
      }

      // Gateway requires "ok" string to stop retrying
      return res.status(HttpStatus.OK).send('ok');
    } catch (error) {
      this.logger.error(`[UPI2] Deposit callback error: ${error.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('fail');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  COLLECTION — Query Order Status
  //  Gateway endpoint: POST /api/payIn/query
  //  Params: merchNo, orderNo, sign
  // ─────────────────────────────────────────────────────────────────────────

  @UseGuards(SecurityTokenGuard)
  @Post('query')
  async queryDeposit(@Body() body: any, @Res() res: Response) {
    try {
      const baseUrl = this.configService.get<string>('PAYMENT2_BASE_URL');
      const payload = this.payment2Service.createPaymentPayload({
        orderNo: body.orderNo,
      });

      const gatewayData = await this.callGateway(
        `${baseUrl}/api/payIn/query`,
        payload,
      );

      return res.status(HttpStatus.OK).json({
        success: gatewayData.code === 0,
        message: gatewayData.msg,
        data: gatewayData.data,
      });
    } catch (error) {
      this.logger.error(`[UPI2] Query deposit error: ${error.message}`);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  COLLECTION — UPI ID Check
  //  Gateway endpoint: POST /api/upi/check
  //  Params: merchNo, upi, sign
  // ─────────────────────────────────────────────────────────────────────────

  @UseGuards(SecurityTokenGuard)
  @Post('upi/check')
  async checkUpi(@Body() body: any, @Res() res: Response) {
    try {
      const baseUrl = this.configService.get<string>('PAYMENT2_BASE_URL');
      const payload = this.payment2Service.createPaymentPayload({
        upi: body.upi,
      });
      const gatewayData = await this.callGateway(
        `${baseUrl}/api/upi/check`,
        payload,
      );

      return res.status(HttpStatus.OK).json({
        success: gatewayData.code === 0,
        message: gatewayData.msg,
        data: gatewayData.data,
      });
    } catch (error) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  COLLECTION — UTR Check
  //  Gateway endpoint: POST /api/utr/check
  //  Params: merchNo, utr, sign
  // ─────────────────────────────────────────────────────────────────────────

  @UseGuards(SecurityTokenGuard)
  @Post('utr/check')
  async checkUtr(@Body() body: any, @Res() res: Response) {
    try {
      const baseUrl = this.configService.get<string>('PAYMENT2_BASE_URL');
      const payload = this.payment2Service.createPaymentPayload({
        utr: body.utr,
      });
      const gatewayData = await this.callGateway(
        `${baseUrl}/api/utr/check`,
        payload,
      );

      return res.status(HttpStatus.OK).json({
        success: gatewayData.code === 0,
        message: gatewayData.msg,
        data: gatewayData.data,
      });
    } catch (error) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  COLLECTION — Bind UTR to Order (Manual Supplement)
  //  Gateway endpoint: POST /api/payIn/bind
  // ─────────────────────────────────────────────────────────────────────────

  @UseGuards(SecurityTokenGuard)
  @Post('bind')
  async bindUtr(@Body() body: any, @Res() res: Response) {
    try {
      const baseUrl = this.configService.get<string>('PAYMENT2_BASE_URL');
      const payload = this.payment2Service.createPaymentPayload({
        orderNo: body.orderNo,
        utr: body.utr,
      });
      const gatewayData = await this.callGateway(
        `${baseUrl}/api/payIn/bind`,
        payload,
      );

      return res.status(HttpStatus.OK).json({
        success: gatewayData.code === 0,
        message: gatewayData.msg,
        data: gatewayData.data,
      });
    } catch (error) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PAYOUT — Create Payout Order
  //  Gateway endpoint: POST /api/payOut
  //
  //  Request params:
  //    merchNo, orderNo, amount, currency, acctName (beneficiary name),
  //    acctCode (IFSC), acctNo (bank account or UPI ID), mobile, notifyUrl, sign
  // ─────────────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('payout')
  async createPayout(
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const {
        orderNo,
        amount,
        currency = 'INR',
        acctName,
        acctCode,
        acctNo,
        mobile,
        notifyUrl,
      } = body;

      this.logger.log(
        `[UPI2] Creating payout — orderNo: ${orderNo}, amount: ${amount}, acctNo: ${acctNo}`,
      );

      const userId: number = (req as any).user?.id || body.userId;
      const amountNum = parseFloat(String(amount));

      // ── Server-side minimum withdrawal enforcement ───────────────────────────
      try {
        const minCfg = await this.prisma.systemConfig.findUnique({
          where: { key: 'MIN_WITHDRAWAL' },
        });
        const parsedMin = minCfg ? parseFloat(minCfg.value) : NaN;
        const minWithdrawal = !isNaN(parsedMin) && parsedMin > 0 ? parsedMin : 500;
        if (!amountNum || amountNum < minWithdrawal) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            message: `Minimum withdrawal amount is ₹${minWithdrawal}`,
          });
        }
      } catch {
        if (!amountNum || amountNum < 500) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            message: 'Minimum withdrawal amount is ₹500',
          });
        }
      }

      // ── Fetch auto-approval limit from SystemConfig ──────────────────────────────
      let autoLimit = 1000;
      try {
        const cfg = await this.prisma.systemConfig.findUnique({
          where: { key: 'AUTO_WITHDRAW_FIAT_LIMIT' },
        });
        if (cfg) autoLimit = parseFloat(cfg.value) || 1000;
      } catch {
        /* use default */
      }

      // ── If above limit: hold for admin approval (do NOT call gateway) ──────────
      if (amountNum > autoLimit && userId && orderNo) {
        try {
          const existing = await this.prisma.transaction.findUnique({
            where: { utr: orderNo },
          });
          if (!existing) {
            await this.prisma.$transaction([
              this.prisma.user.update({
                where: { id: userId },
                data: { balance: { decrement: amountNum } },
              }),
              this.prisma.transaction.create({
                data: {
                  userId,
                  amount: amountNum,
                  type: 'WITHDRAWAL',
                  status: 'PENDING',
                  paymentMethod: 'UPI Gateway 2',
                  utr: orderNo,
                  remarks: 'Processing',
                  paymentDetails: {
                    gateway: 'upi2',
                    orderNo,
                    acctName,
                    acctNo,
                    acctCode,
                    mobile,
                    autoHold: true,
                    originalData: body,
                  } as any,
                },
              }),
            ]);
            this.logger.log(
              `[UPI2] Withdrawal HELD for admin approval — amount: ${amountNum}, userId: ${userId}`,
            );
          }
        } catch (e) {
          this.logger.warn(
            `[UPI2] Could not record held withdrawal: ${e.message}`,
          );
          return res
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .json({ success: false, message: 'Failed to record withdrawal' });
        }
        return res.status(HttpStatus.OK).json({
          success: true,
          held: true,
          message: 'Withdrawal submitted — processing',
        });
      }

      // ── Below limit: auto-process via gateway ──────────────────────────────
      const baseUrl = this.configService.get<string>('PAYMENT2_BASE_URL');
      if (!baseUrl) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'PAYMENT2_BASE_URL is not configured',
        });
      }

      const transferData: Record<string, any> = {
        orderNo,
        amount: String(amount),
        currency,
        acctName,
        acctCode,
        acctNo,
        mobile,
      };
      if (notifyUrl) transferData['notifyUrl'] = notifyUrl;

      const payload = this.payment2Service.createPayoutPayload(transferData);
      const gatewayData = await this.callGateway(
        `${baseUrl}/api/payOut`,
        payload,
      );

      if (gatewayData.code === 0) {
        if (userId && orderNo) {
          try {
            const existing = await this.prisma.transaction.findUnique({
              where: { utr: orderNo },
            });
            if (!existing) {
              await this.prisma.$transaction([
                this.prisma.user.update({
                  where: { id: userId },
                  data: { balance: { decrement: amountNum } },
                }),
                this.prisma.transaction.create({
                  data: {
                    userId,
                    amount: amountNum,
                    type: 'WITHDRAWAL',
                    status: 'PENDING',
                    paymentMethod: 'UPI Gateway 2',
                    utr: orderNo,
                    paymentDetails: {
                      gateway: 'upi2',
                      orderNo,
                      acctName,
                      acctNo,
                    } as any,
                  },
                }),
              ]);
              this.logger.log(
                `[UPI2] Withdrawal deducted & recorded — orderNo: ${orderNo}, userId: ${userId}`,
              );
            }
          } catch (e) {
            this.logger.warn(
              `[UPI2] Could not record withdrawal: ${e.message}`,
            );
          }
        }
        return res
          .status(HttpStatus.OK)
          .json({ success: true, data: gatewayData.data });
      } else {
        this.logger.warn(
          `[UPI2] Payout rejected: ${JSON.stringify(gatewayData)}`,
        );
        return res.status(HttpStatus.OK).json({
          success: false,
          message: gatewayData.msg || 'Gateway rejected the payout',
          data: gatewayData.data,
        });
      }
    } catch (error) {
      this.logger.error(`[UPI2] Create payout error: ${error.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to initiate UPI 2 payout',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ADMIN — Process an existing PENDING withdrawal via UPI 2 gateway
  //  Called from the admin panel "Approve" flow when admin picks UPI Gateway 2.
  //  On successful gateway acceptance the transaction moves to PROCESSING.
  //  The gateway webhook will later flip it to COMPLETED (or REJECTED + refund).
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
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ success: false, message: 'transactionId is required' });
      }

      const txn = await this.prisma.transaction.findUnique({
        where: { id: Number(transactionId) },
      });
      if (!txn) {
        return res
          .status(HttpStatus.NOT_FOUND)
          .json({ success: false, message: 'Transaction not found' });
      }
      if (txn.type !== 'WITHDRAWAL') {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ success: false, message: 'Not a withdrawal transaction' });
      }
      if (!['PENDING', 'PROCESSED'].includes(txn.status)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: `Transaction must be in PENDING or PROCESSED status (current: ${txn.status})`,
        });
      }

      const pd = (txn.paymentDetails as Record<string, any>) || {};
      const acctName =
        pd.acctName || pd.holderName || pd.receive_name || 'Beneficiary';
      const acctNo =
        pd.acctNo ||
        pd.upiId ||
        pd.receive_account ||
        pd.receiveAccount ||
        pd.accountNo;
      const acctCode = pd.acctCode || pd.ifsc || pd.ifscCode || '';
      const mobile = pd.mobile || '';
      if (!acctNo) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Beneficiary account number / UPI ID missing on transaction',
        });
      }

      // Reuse txn.utr as orderNo if already set (admin-hold path already wrote it);
      // otherwise generate a fresh reference.
      const orderNo = txn.utr || `UPI2W${txn.id}${Date.now()}`;

      const baseUrl = this.configService.get<string>('PAYMENT2_BASE_URL');
      if (!baseUrl) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'PAYMENT2_BASE_URL is not configured',
        });
      }

      const transferData: Record<string, any> = {
        orderNo,
        amount: String(txn.amount),
        currency: 'INR',
        acctName,
        acctCode,
        acctNo,
        mobile,
      };

      const payload = this.payment2Service.createPayoutPayload(transferData);
      const gatewayData = await this.callGateway(
        `${baseUrl}/api/payOut`,
        payload,
      );

      if (gatewayData.code === 0) {
        await this.prisma.transaction.update({
          where: { id: txn.id },
          data: {
            status: 'PROCESSING',
            paymentMethod: 'UPI Gateway 2',
            utr: orderNo,
            adminId: adminId ?? txn.adminId,
            remarks: remarks || 'Sent to UPI Gateway 2',
            paymentDetails: {
              ...pd,
              gateway: 'upi2',
              orderNo,
            } as any,
          },
        });
        this.logger.log(
          `[UPI2] Admin triggered payout — txn:${txn.id} orderNo:${orderNo}`,
        );
        return res
          .status(HttpStatus.OK)
          .json({ success: true, orderNo, data: gatewayData.data });
      }

      this.logger.warn(
        `[UPI2] Admin payout rejected by gateway: ${JSON.stringify(gatewayData)}`,
      );
      return res.status(HttpStatus.OK).json({
        success: false,
        message: gatewayData.msg || 'Gateway rejected the payout',
      });
    } catch (error) {
      this.logger.error(
        `[UPI2] adminProcessWithdrawal error: ${error.message}`,
      );
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PAYOUT — Async Callback
  //  Fired for BOTH success and failure.
  //  MUST respond with plain text "ok".
  // ─────────────────────────────────────────────────────────────────────────

  @Public()
  @Post('payout/notify')
  async payoutCallback(
    @Req() req: Request,
    @Body() body: any,
    @Res() res: Response,
  ) {
    this.logger.log(`[UPI2] Payout callback: ${JSON.stringify(body)}`);

    try {
      // Gateway wraps payload as { code, msg, data:{...sign...} }
      const payload =
        body?.data && typeof body.data === 'object' ? body.data : body;

      const isValid =
        this.payment2Service.verifyPayoutCallbackSignature(payload);

      if (!isValid) {
        this.logger.warn(`[UPI2] Payout callback — invalid signature`);
        return res.status(HttpStatus.BAD_REQUEST).send('fail');
      }

      const { orderNo, amount, orderState } = payload;
      const state = Number(orderState);

      this.logger.log(
        `[UPI2] Payout callback verified — orderNo: ${orderNo}, state: ${state}, amount: ${amount}`,
      );

      // state 1 = Success → approve withdrawal
      // state 2/4 = Failed → refund balance
      const txn = await this.prisma.transaction.findUnique({
        where: { utr: orderNo },
      });
      if (txn && ['PENDING', 'PROCESSED', 'APPROVED', 'PROCESSING'].includes(txn.status)) {
        if (state === 1) {
          await this.prisma.transaction.update({
            where: { id: txn.id },
            data: { status: 'COMPLETED' },
          });
          this.logger.log(`[UPI2] Withdrawal COMPLETED — ${orderNo}`);
        } else if ([2, 4].includes(state)) {
          await this.prisma.$transaction([
            this.prisma.user.update({
              where: { id: txn.userId },
              data: { balance: { increment: txn.amount } },
            }),
            this.prisma.transaction.update({
              where: { id: txn.id },
              data: { status: 'REJECTED', remarks: `Gateway state: ${state}` },
            }),
          ]);
          this.logger.warn(
            `[UPI2] Withdrawal REJECTED & refunded — ${orderNo}`,
          );
        }
      }

      return res.status(HttpStatus.OK).send('ok');
    } catch (error) {
      this.logger.error(`[UPI2] Payout callback error: ${error.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('fail');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PAYOUT — Query Payout Order Status
  //  Gateway endpoint: POST /api/payOut/query
  //  Params: merchNo, orderNo, sign
  // ─────────────────────────────────────────────────────────────────────────

  @UseGuards(SecurityTokenGuard)
  @Post('payout/query')
  async queryPayout(@Body() body: any, @Res() res: Response) {
    try {
      const baseUrl = this.configService.get<string>('PAYMENT2_BASE_URL');
      const payload = this.payment2Service.createPayoutPayload({
        orderNo: body.orderNo,
      });
      const gatewayData = await this.callGateway(
        `${baseUrl}/api/payOut/query`,
        payload,
      );

      return res.status(HttpStatus.OK).json({
        success: gatewayData.code === 0,
        message: gatewayData.msg,
        data: gatewayData.data,
      });
    } catch (error) {
      this.logger.error(`[UPI2] Query payout error: ${error.message}`);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  BALANCE INQUIRY
  //  Gateway endpoint: POST /api/balance
  //  Params: merchNo, timestamp (epoch ms), currency, sign
  // ─────────────────────────────────────────────────────────────────────────

  @UseGuards(SecurityTokenGuard)
  @Post('balance')
  async getBalance(@Body() body: any, @Res() res: Response) {
    try {
      const baseUrl = this.configService.get<string>('PAYMENT2_BASE_URL');
      const currency = body.currency || 'INR';
      const timestamp = String(Date.now());

      const payload = this.payment2Service.createPaymentPayload({
        currency,
        timestamp,
      });
      const gatewayData = await this.callGateway(
        `${baseUrl}/api/balance`,
        payload,
      );

      return res.status(HttpStatus.OK).json({
        success: gatewayData.code === 0,
        message: gatewayData.msg,
        data: gatewayData.data,
      });
    } catch (error) {
      this.logger.error(`[UPI2] Balance inquiry error: ${error.message}`);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  HELPER: credit a deposit transaction by UTR / orderNo
  // ─────────────────────────────────────────────────────────────────────────
  private async creditDeposit(orderNo: string, gatewayAmount: number) {
    try {
      const txn = await this.prisma.transaction.findUnique({
        where: { utr: orderNo },
      });
      if (!txn) {
        this.logger.warn(`[UPI2] No transaction for orderNo: ${orderNo}`);
        return;
      }
      if (txn.status !== 'PENDING') {
        this.logger.warn(`[UPI2] Already ${txn.status} — skip`);
        return;
      }

      // SECURITY: pin credit to the stored PENDING txn amount; never accept
      // the webhook body's amount field which could be replayed/tampered.
      if (
        gatewayAmount > 0 &&
        Math.abs(gatewayAmount - txn.amount) > 0.01
      ) {
        this.logger.warn(
          `[UPI2] Amount mismatch — stored ₹${txn.amount}, gateway reported ₹${gatewayAmount}. Refusing credit.`,
        );
        return;
      }
      const credit = txn.amount;
      const previousDeposits = await this.prisma.transaction.count({
        where: { userId: txn.userId, type: 'DEPOSIT', status: 'APPROVED' },
      });
      // Atomic PENDING→APPROVED guard to prevent race with cancellation and
      // double-credit from replayed webhooks.
      const creditApplied = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.transaction.updateMany({
          where: { id: txn.id, status: 'PENDING' },
          data: { status: 'APPROVED' },
        });
        if (updated.count === 0) return false;
        await tx.user.update({
          where: { id: txn.userId },
          data: { balance: { increment: credit } },
        });
        return true;
      });
      if (!creditApplied) {
        this.logger.warn(
          `[UPI2] creditDeposit skipped — not PENDING (orderNo: ${orderNo})`,
        );
        return;
      }
      this.logger.log(
        `[UPI2] Deposit APPROVED — userId: ${txn.userId}, amount: ${credit}`,
      );

      // ── Update wagering requirement (turnover tracking) ──────────────────
      try {
        await this.usersService.setWageringOnFirstDeposit(txn.userId, credit);
      } catch (e) {
        this.logger.error(
          `[UPI2] Wagering update failed (non-fatal): ${e.message}`,
        );
      }
      // ── Apply bonus if stored at deposit time ──────────────────────────
      const bonusCode = (txn.paymentDetails as any)?.bonusCode;
      let depositWageringApplied = false;
      if (bonusCode) {
        try {
          const result = await this.bonusService.redeemBonus(txn.userId, bonusCode, credit, {
            depositCurrency: 'INR',
            approvedDepositCountBeforeThisDeposit: previousDeposits,
          });
          if (result) {
            depositWageringApplied = true;
            this.logger.log(
              `[UPI2] Bonus redeemed — userId: ${txn.userId}, code: ${bonusCode}`,
            );
          } else {
            this.logger.warn(
              `[UPI2] Bonus code "${bonusCode}" not applied (validation failed) — userId: ${txn.userId}`,
            );
          }
        } catch (e) {
          this.logger.error(
            `[UPI2] Bonus redemption failed (non-fatal): ${e.message}`,
          );
        }
      }
      // Always apply deposit wagering lock (1x) if no bonus code was redeemed
      if (!depositWageringApplied) {
        try {
          await this.bonusService.applyDepositWagering(txn.userId, credit, 1);
        } catch (e) {
          this.logger.error(
            `[UPI2] Deposit wagering lock failed (non-fatal): ${e.message}`,
          );
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
          `[UPI2] Referral reward failed (non-fatal): ${e.message}`,
        );
      }

      // ── Deposit confirmation email ───────────────────────────────────
      try {
        const user = await this.prisma.user.findUnique({ where: { id: txn.userId }, select: { email: true, username: true } });
        if (user?.email) {
          this.emailService.sendDepositSuccess(user.email, user.username || user.email, credit.toFixed(2), 'INR').catch(() => {});
        }
      } catch (e) {
        this.logger.error(`[UPI2] Deposit email failed (non-fatal): ${e.message}`);
      }
    } catch (e) {
      this.logger.error(`[UPI2] creditDeposit error: ${e.message}`);
    }
  }
}
