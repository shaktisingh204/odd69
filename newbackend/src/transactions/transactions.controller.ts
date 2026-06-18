import { Controller, Post, Body, Get, Param, UseGuards, Request, BadRequestException, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/roles.guard';
import { SecurityTokenGuard } from '../auth/security-token.guard';
import { EmailService } from '../email/email.service';
// Since I haven't seen the exact location of JwtAuthGuard, I'll assume standard location or check.
// I'll assume standard structure for now.

// Checking auth.module.ts location from file list: src/auth/auth.module.ts
// Usually Guard is exported from there or a separate file.
// Let me double check `auth` folder content in previous `list_dir`.
// It had `auth.service.ts`, `auth.controller.ts`, `auth.module.ts`.
// I'll check `auth.controller.ts` to see how they use guards.

@Controller('transactions')
export class TransactionsController {
    constructor(
        private readonly transactionsService: TransactionsService,
        private readonly emailService: EmailService,
    ) { }

    @Post('deposit')
    @UseGuards(JwtAuthGuard)
    async deposit(@Request() req, @Body() body: { amount: number; paymentMethod: string; utr: string; proof?: string; currency: string; type: string }) {
        const userId = req.user.id;
        const { amount, paymentMethod, utr, proof, currency, type } = body;

        if (!amount || amount <= 0) {
            throw new BadRequestException('Invalid amount');
        }
        if (!paymentMethod) {
            throw new BadRequestException('Payment method is required');
        }
        if (!utr) {
            throw new BadRequestException('Transaction ID / UTR is required');
        }

        return this.transactionsService.createDeposit(userId, amount, paymentMethod, utr, currency, type, proof);
    }

    @Post('withdraw')
    @UseGuards(JwtAuthGuard)
    async withdraw(@Request() req, @Body() body: { userId?: number; amount: number; paymentDetails: any }) {
        // Enforce using the authenticated user's ID
        const userId = req.user.id;
        const { amount, paymentDetails } = body;
        return this.transactionsService.createWithdrawal(userId, amount, paymentDetails);
    }

    @Get('pending-deposit')
    @UseGuards(JwtAuthGuard)
    async getPendingDeposit(@Request() req) {
        const userId = req.user.id;
        return this.transactionsService.getLatestPendingDeposit(userId);
    }

    @Get('my/:userId')
    @UseGuards(JwtAuthGuard)
    async getMyTransactions(@Request() req, @Param('userId') userId: string) {
        // Enforce that a user can only read their own transactions.
        const requestedId = parseInt(userId);
        if (!Number.isFinite(requestedId) || requestedId !== req.user.id) {
            throw new BadRequestException('Forbidden');
        }
        return this.transactionsService.getUserTransactions(requestedId);
    }

    @Get('user/:userId')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async getUserTransactions(@Param('userId') userId: string) {
        return this.transactionsService.getUserTransactions(parseInt(userId));
    }

    @Get('all')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async getAllTransactions(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
        @Query('type') type: string,
        @Query('status') status: string,
        @Query('search') search: string
    ) {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 20;
        return this.transactionsService.getAllTransactions(p, l, type, status, search);
    }

    @Post('send-withdrawal-status-email')
    @UseGuards(SecurityTokenGuard)
    async sendWithdrawalStatusEmail(
        @Body() body: { step: string; email: string; username: string; amount: string; currency?: string },
    ) {
        const { step, email, username, amount, currency = 'INR' } = body;
        if (!step || !email || !username || !amount) {
            throw new BadRequestException('step, email, username, and amount are required');
        }

        let sent = false;
        switch (step) {
            case 'pending':
                sent = await this.emailService.sendWithdrawalPending(email, username, amount, currency);
                break;
            case 'processed':
                sent = await this.emailService.sendWithdrawalProcessed(email, username, amount, currency);
                break;
            case 'approved':
                sent = await this.emailService.sendWithdrawalApproved(email, username, amount, currency);
                break;
            case 'completed':
                sent = await this.emailService.sendWithdrawalSuccess(email, username, amount, currency);
                break;
            default:
                throw new BadRequestException(`Unknown step: ${step}`);
        }

        return { success: sent };
    }

    @Post(':id/process')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async process(@Param('id') id: string, @Body() body: { adminId: number; remarks?: string }) {
        return this.transactionsService.processWithdrawal(parseInt(id), body.adminId, body.remarks);
    }

    @Post(':id/approve')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async approve(@Param('id') id: string, @Body() body: { adminId: number; remarks?: string }) {
        return this.transactionsService.approveTransaction(parseInt(id), body.adminId, body.remarks);
    }

    @Post(':id/approve-withdrawal')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async approveWithdrawal(@Param('id') id: string, @Body() body: { adminId: number; remarks?: string }) {
        return this.transactionsService.approveWithdrawal(parseInt(id), body.adminId, body.remarks);
    }

    @Post(':id/complete-withdrawal')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async completeWithdrawal(@Param('id') id: string, @Body() body: { adminId: number; remarks?: string; transactionId?: string }) {
        return this.transactionsService.completeWithdrawal(parseInt(id), body.adminId, body.remarks, body.transactionId);
    }

    @Post(':id/reject')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async reject(@Param('id') id: string, @Body() body: { adminId: number; remarks?: string }) {
        return this.transactionsService.rejectTransaction(parseInt(id), body.adminId, body.remarks);
    }
}
