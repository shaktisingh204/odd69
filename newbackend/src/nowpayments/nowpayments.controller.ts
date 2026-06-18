import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Req,
    Res,
    HttpStatus,
    Logger,
    UseGuards,
    Request,
    BadRequestException,
} from '@nestjs/common';
import { NowpaymentsService, NowPaymentsCurrencyCatalog } from './nowpayments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { Response } from 'express';

@Controller('nowpayments')
export class NowpaymentsController {
    private readonly logger = new Logger(NowpaymentsController.name);

    constructor(private readonly nowpaymentsService: NowpaymentsService) { }

    /**
     * Create a new crypto payment session.
     * Returns wallet address, exact crypto amount, and payment ID for polling.
     */
    @Post('create')
    @UseGuards(JwtAuthGuard)
    async createPayment(
        @Request() req,
        @Body()
        body: {
            amount: number;
            payCurrency: string;
            priceCurrency?: string;
            bonusCode?: string;
            promoCode?: string;
        },
    ) {
        // JWT strategy validate() returns { userId: payload.sub, username: payload.username }
        const userId = req.user?.userId || req.user?.sub || req.user?.id;
        const { amount, payCurrency, priceCurrency = 'usd', bonusCode, promoCode } = body;

        if (!userId) {
            throw new BadRequestException('User not authenticated');
        }
        if (!amount || amount <= 0) {
            throw new BadRequestException('Amount must be greater than 0');
        }
        if (!payCurrency) {
            throw new BadRequestException('payCurrency is required');
        }

        this.logger.log(`Creating crypto payment for user ${userId}: ${amount} ${priceCurrency} → ${payCurrency}`);

        try {
            const isSupportedCurrency = await this.nowpaymentsService.isSupportedPayCurrency(payCurrency);
            if (!isSupportedCurrency) {
                throw new BadRequestException(`Unsupported NOWPayments currency: ${payCurrency.toUpperCase()}`);
            }

            // Pre-validate against NOWPayments minimum amount
            const minAmount = await this.nowpaymentsService.getMinimumAmount(priceCurrency, payCurrency);
            if (minAmount > 0 && amount < minAmount) {
                throw new BadRequestException(
                    `Minimum deposit amount is $${minAmount.toFixed(2)} USD for ${payCurrency.toUpperCase()}. You entered $${amount}.`,
                );
            }

            const result = await this.nowpaymentsService.createPayment(
                userId,
                amount,
                priceCurrency,
                payCurrency,
                bonusCode || promoCode,
            );

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error(`createPayment failed for user ${userId}: ${error.message}`);
            throw error;
        }

    }

    /**
     * Poll payment status by paymentId (the NOWPayments payment_id).
     */
    @Get('status/:paymentId')
    @UseGuards(JwtAuthGuard)
    async getPaymentStatus(@Param('paymentId') paymentId: string) {
        const status = await this.nowpaymentsService.getPaymentStatus(paymentId);
        return {
            success: true,
            data: status,
        };
    }

    /**
     * Get list of available cryptos (curated popular list + NOWPayments availability).
     */
    @Get('currencies')
    @UseGuards(JwtAuthGuard)
    async getCurrencies(): Promise<{ success: true } & NowPaymentsCurrencyCatalog> {
        const catalog = await this.nowpaymentsService.getCurrencyCatalog();
        return {
            success: true,
            ...catalog,
        };
    }

    /**
     * Get estimated crypto amount for a given USD amount.
     */
    @Get('estimate/:toCurrency/:amount')
    @UseGuards(JwtAuthGuard)
    async getEstimate(
        @Param('toCurrency') toCurrency: string,
        @Param('amount') amount: string,
    ) {
        const estimated = await this.nowpaymentsService.getEstimatedAmount(
            'usd',
            toCurrency,
            parseFloat(amount),
        );
        return {
            success: true,
            estimated_amount: estimated,
            currency: toCurrency.toUpperCase(),
        };
    }

    /**
     * IPN (Instant Payment Notification) webhook from NOWPayments.
     * This endpoint is PUBLIC — NOWPayments calls it when payment status changes.
     */
    @Post('ipn')
    @Public()
    async ipnCallback(
        @Req() req,
        @Body() body: any,
        @Res() res: Response,
    ) {
        const signature = req.headers['x-nowpayments-sig'] as string;

        this.logger.log(`IPN received: payment_id=${body.payment_id}, status=${body.payment_status}`);

        if (!signature) {
            this.logger.warn('IPN request missing x-nowpayments-sig header');
            return res.status(HttpStatus.BAD_REQUEST).send('Missing signature');
        }

        const isValid = this.nowpaymentsService.verifyIpnSignature(body, signature);
        if (!isValid) {
            this.logger.warn('IPN signature verification failed');
            return res.status(HttpStatus.UNAUTHORIZED).send('Invalid signature');
        }

        try {
            await this.nowpaymentsService.handleIpnCallback(body);
        } catch (error) {
            this.logger.error(`IPN handling error: ${error.message}`);
            // Still return 200 to prevent NOWPayments from retrying on our internal error
        }

        return res.status(HttpStatus.OK).send('OK');
    }
}
