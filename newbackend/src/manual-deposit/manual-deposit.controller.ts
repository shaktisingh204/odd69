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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma.service';
import { Request, Response } from 'express';
import { getGatewayRetryState } from '../payment/payment-retry.util';

type ManualUpiAccount = {
  id: string;
  upiId: string;
  qrImageUrl: string;
};

const buildManualUpiAccountTag = (upiId: string) =>
  `Manual UPI${upiId.trim() ? ` · ${upiId.trim()}` : ''}`;

const parseManualUpiAccountsFromMap = (
  map: Record<string, string>,
): ManualUpiAccount[] => {
  const rawAccounts = map['MANUAL_UPI_ACCOUNTS'] || '';
  if (rawAccounts) {
    try {
      const parsed = JSON.parse(rawAccounts);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const account = entry as Partial<ManualUpiAccount>;
            const upiId = String(account.upiId || '').trim();
            if (!upiId) return null;
            return {
              id:
                String(account.id || '').trim() ||
                `manual-upi-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 8)}`,
              upiId,
              qrImageUrl: String(account.qrImageUrl || '').trim(),
            };
          })
          .filter(Boolean) as ManualUpiAccount[];
        if (normalized.length) return normalized;
      }
    } catch {
      // ignore parse errors and fall back to legacy keys
    }
  }

  const legacyUpiId = (map['MANUAL_UPI_ID'] || '').trim();
  if (!legacyUpiId) return [];

  return [
    {
      id: 'legacy-manual-upi',
      upiId: legacyUpiId,
      qrImageUrl: (map['MANUAL_QR_URL'] || '').trim(),
    },
  ];
};

@Controller('manual-deposit')
export class ManualDepositController {
  private readonly logger = new Logger(ManualDepositController.name);

  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('retry-state')
  async getRetryState(@Req() req: Request, @Res() res: Response) {
    try {
      const userId: number = (req as any).user?.userId || (req as any).user?.id;
      if (!userId) {
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ success: false, message: 'Not authenticated' });
      }

      const retryState = await getGatewayRetryState(this.prisma, userId);
      return res.status(HttpStatus.OK).json(retryState);
    } catch (error) {
      this.logger.error(`[ManualDeposit] retry-state error: ${error.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to load retry state',
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  //  RESET GATEWAY RETRY — explicitly cancel all stale PENDING gateway txns
  //  Called when user dismisses the "pending gateway" banner or arrives via
  //  the "Make Another Deposit" button after a manual payment.
  // ──────────────────────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('reset-gateway-retry')
  async resetGatewayRetry(@Req() req: Request, @Res() res: Response) {
    try {
      const userId: number = (req as any).user?.userId || (req as any).user?.id;
      if (!userId) {
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ success: false, message: 'Not authenticated' });
      }

      const GATEWAY_LABELS = ['UPI Gateway 1', 'UPI Gateway 2', 'UPI Gateway 3'];
      const stale = await this.prisma.transaction.findMany({
        where: {
          userId,
          type: 'DEPOSIT',
          status: 'PENDING',
          paymentMethod: { in: GATEWAY_LABELS },
        },
      });

      if (stale.length > 0) {
        await this.prisma.transaction.updateMany({
          where: { id: { in: stale.map((t) => t.id) } },
          data: {
            status: 'REJECTED',
            remarks: 'User dismissed pending gateway payment — auto-cancelled',
          },
        });
        this.logger.log(
          `[ManualDeposit] Gateway retry reset (dismiss) — cancelled ${stale.length} txn(s) for userId: ${userId}`,
        );
      }

      return res.status(HttpStatus.OK).json({ success: true, cancelled: stale.length });
    } catch (error) {
      this.logger.error(`[ManualDeposit] reset-gateway-retry error: ${error.message}`);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PUBLIC CONFIG — returns UPI ID + QR URL + support contacts
  //  Sourced from SystemConfig keys:
  //    MANUAL_UPI_ID   — the UPI VPA users pay to (e.g. example@upi)
  //    MANUAL_QR_URL   — optional hosted QR image URL
  // ─────────────────────────────────────────────────────────────────────────
  @Public()
  @Get('config')
  async getConfig(@Res() res: Response) {
    try {
      const rows = await this.prisma.systemConfig.findMany({
        where: {
          key: {
            in: [
              'MANUAL_UPI_ACCOUNTS',
              'MANUAL_UPI_ID',
              'MANUAL_QR_URL',
              'CONTACT_SETTINGS',
            ],
          },
        },
      });

      const map: Record<string, string> = {};
      rows.forEach((r) => {
        map[r.key] = r.value;
      });

      const accounts = parseManualUpiAccountsFromMap(map);
      const selectedAccount =
        accounts.length > 0
          ? accounts[Math.floor(Math.random() * accounts.length)]
          : null;
      const upiId = selectedAccount?.upiId || '';
      const qrImageUrl = selectedAccount?.qrImageUrl || '';

      let whatsappNumber = '';
      let telegramHandle = '';
      let telegramLink = '';
      try {
        const contact = map['CONTACT_SETTINGS']
          ? JSON.parse(map['CONTACT_SETTINGS'])
          : {};
        whatsappNumber = contact.whatsappNumber || '';
        telegramHandle = contact.telegramHandle || '';
        telegramLink = contact.telegramLink || '';
      } catch {
        // ignore parse errors
      }

      return res.status(HttpStatus.OK).json({
        accountId: selectedAccount?.id || '',
        accountTag: selectedAccount
          ? buildManualUpiAccountTag(selectedAccount.upiId)
          : '',
        accountCount: accounts.length,
        upiId,
        qrImageUrl,
        whatsappNumber,
        telegramHandle,
        telegramLink,
      });
    } catch (error) {
      this.logger.error(`[ManualDeposit] config fetch error: ${error.message}`);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ upiId: '', qrImageUrl: '' });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  SUBMIT — user claims they have paid and submits amount + UTR
  //  Creates a PENDING transaction that admin must approve
  // ─────────────────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('submit')
  async submitManualDeposit(
    @Body()
    body: {
      amount: number;
      utr: string;
      bonusCode?: string;
      accountId?: string;
      upiId?: string;
      accountTag?: string;
    },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const userId: number = (req as any).user?.userId || (req as any).user?.id;
      const { amount, utr, bonusCode, accountId, upiId, accountTag } = body;

      if (!userId) {
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ success: false, message: 'Not authenticated' });
      }
      if (!amount || parseFloat(String(amount)) <= 0) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ success: false, message: 'Invalid amount' });
      }
      if (!utr || !utr.trim()) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'UTR / Transaction ID is required',
        });
      }

      const numAmount = parseFloat(String(amount));
      const cleanUtr = utr.trim().toUpperCase();
      const effectiveBonusCode =
        (bonusCode || '').trim().toUpperCase() || undefined;
      const configRows = await this.prisma.systemConfig.findMany({
        where: {
          key: {
            in: ['MANUAL_UPI_ACCOUNTS', 'MANUAL_UPI_ID', 'MANUAL_QR_URL'],
          },
        },
      });
      const configMap: Record<string, string> = {};
      configRows.forEach((row) => {
        configMap[row.key] = row.value;
      });
      const manualAccounts = parseManualUpiAccountsFromMap(configMap);
      const matchedManualAccount =
        manualAccounts.find((account) => account.id === (accountId || '').trim()) ||
        manualAccounts.find((account) => account.upiId === (upiId || '').trim()) ||
        null;
      const effectiveUpiId =
        matchedManualAccount?.upiId || (upiId || '').trim() || undefined;
      const effectiveAccountTag =
        matchedManualAccount?.upiId
          ? buildManualUpiAccountTag(matchedManualAccount.upiId)
          : (accountTag || '').trim() ||
            (effectiveUpiId ? buildManualUpiAccountTag(effectiveUpiId) : 'Manual UPI');

      // Check for duplicate UTR
      const existing = await this.prisma.transaction.findUnique({
        where: { utr: cleanUtr },
      });
      if (existing) {
        return res.status(HttpStatus.CONFLICT).json({
          success: false,
          message:
            'This UTR has already been submitted. Please contact support if this is an error.',
        });
      }

      const txn = await this.prisma.transaction.create({
        data: {
          userId,
          amount: numAmount,
          type: 'DEPOSIT',
          status: 'PENDING',
          paymentMethod: effectiveAccountTag,
          utr: cleanUtr,
          remarks: `${effectiveAccountTag} deposit — awaiting admin approval`,
          paymentDetails: {
            gateway: 'manual_upi',
            requiresAdminReview: true,
            accountId: matchedManualAccount?.id || (accountId || '').trim() || null,
            accountTag: effectiveAccountTag,
            upiId: effectiveUpiId || null,
            qrImageUrl: matchedManualAccount?.qrImageUrl || null,
            utr: cleanUtr,
            submittedAt: new Date().toISOString(),
            ...(effectiveBonusCode ? { bonusCode: effectiveBonusCode } : {}),
          } as any,
        },
      });

      this.logger.log(
        `[ManualDeposit] PENDING created — userId: ${userId}, amount: ${numAmount}, utr: ${cleanUtr}, txnId: ${txn.id}`,
      );

      // ── Reset gateway retry state ─────────────────────────────────────────
      // Cancel all stale PENDING gateway transactions so the next deposit
      // opens the gateway flow again (not the forced-manual screen).
      // We mark them REJECTED with a clear audit reason — no balance impact
      // because gateway PENDING txns have NOT debited the user yet.
      const GATEWAY_LABELS = ['UPI Gateway 1', 'UPI Gateway 2', 'UPI Gateway 3'];
      try {
        const staleGatewayTxns = await this.prisma.transaction.findMany({
          where: {
            userId,
            type: 'DEPOSIT',
            status: 'PENDING',
            paymentMethod: { in: GATEWAY_LABELS },
          },
        });

        if (staleGatewayTxns.length > 0) {
          const staleIds = staleGatewayTxns.map((t) => t.id);
          await this.prisma.transaction.updateMany({
            where: { id: { in: staleIds } },
            data: {
              status: 'REJECTED',
              remarks: `Auto-cancelled: user completed manual deposit (UTR: ${cleanUtr}, txnId: ${txn.id})`,
            },
          });
          this.logger.log(
            `[ManualDeposit] Reset gateway retry — cancelled ${staleGatewayTxns.length} stale PENDING gateway txn(s) for userId: ${userId}`,
          );
        }
      } catch (resetError) {
        // Non-fatal — log but don't fail the successful manual submission
        this.logger.error(
          `[ManualDeposit] Gateway retry reset failed (non-fatal): ${resetError.message}`,
        );
      }

      return res.status(HttpStatus.OK).json({
        success: true,
        message:
          'Your payment has been submitted and is pending approval (usually 5–15 minutes).',
        transactionId: txn.id,
      });
    } catch (error) {
      this.logger.error(`[ManualDeposit] submit error: ${error.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to submit payment',
      });
    }
  }
}
