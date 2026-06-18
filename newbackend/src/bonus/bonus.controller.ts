import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Query, Request, Req, BadRequestException } from '@nestjs/common';
import { BonusService } from './bonus.service';
import { SecurityTokenGuard } from '../auth/security-token.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN ROUTES — /admin/bonus  (SecurityTokenGuard)
// ─────────────────────────────────────────────────────────────────────────────

@Controller('admin/bonus')
@UseGuards(SecurityTokenGuard)
export class BonusAdminController {
    constructor(private readonly bonusService: BonusService) { }

    @Post()
    create(@Body() dto: any) { return this.bonusService.create(dto); }

    @Get()
    findAll() { return this.bonusService.findAll(); }

    @Get('stats')
    getStats() { return this.bonusService.getBonusStats(); }

    @Get('redemptions')
    getRedemptions(
        @Query('page') page = '1',
        @Query('limit') limit = '20',
        @Query('status') status?: string,
        @Query('bonusId') bonusId?: string,
        @Query('search') search?: string,
    ) {
        return this.bonusService.getAllRedemptions(+page, +limit, status, bonusId, search);
    }

    @Get(':id')
    findOne(@Param('id') id: string) { return this.bonusService.findOne(id); }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: any) { return this.bonusService.update(id, dto); }

    @Delete(':id')
    remove(@Param('id') id: string) { return this.bonusService.remove(id); }

    @Put(':id/toggle')
    toggle(@Param('id') id: string) { return this.bonusService.toggleActive(id); }

    // Redemption management
    @Post('redemptions/:userBonusId/forfeit')
    adminForfeit(@Param('userBonusId') id: string, @Request() req: any) {
        return this.bonusService.adminForfeitBonus(+id, req.user?.id || 0);
    }

    @Post('redemptions/:userBonusId/complete')
    adminComplete(@Param('userBonusId') id: string, @Request() req: any) {
        return this.bonusService.adminCompleteBonus(+id, req.user?.id || 0);
    }

    /**
     * POST /admin/bonus/give
     * Body:
     *   - template grant: { userId, bonusCode, customAmount? }
     *   - direct wallet grant: { userId, bonusType, amount, title?, wageringRequirement? }
     */
    @Post('give')
    adminGive(
        @Body()
        body: {
            userId: number;
            bonusCode?: string;
            customAmount?: number;
            bonusType?: 'FIAT_BONUS' | 'CASINO_BONUS' | 'SPORTS_BONUS' | 'CRYPTO_BONUS';
            amount?: number;
            title?: string;
            wageringRequirement?: number;
        },
        @Request() req: any,
    ) {
        // SECURITY: reject negative/non-numeric amounts before they reach the
        // service. Without this, an admin (or leaked admin token) could issue
        // a negative bonus which silently debits the user's wallet.
        const customAmount = body.customAmount == null ? undefined : Number(body.customAmount);
        const amount = body.amount == null ? undefined : Number(body.amount);
        if (customAmount !== undefined && (!Number.isFinite(customAmount) || customAmount < 0)) {
            throw new BadRequestException('customAmount must be a non-negative number');
        }
        if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
            throw new BadRequestException('amount must be a non-negative number');
        }
        const wageringRequirement = body.wageringRequirement == null ? undefined : Number(body.wageringRequirement);
        if (wageringRequirement !== undefined && (!Number.isFinite(wageringRequirement) || wageringRequirement < 0)) {
            throw new BadRequestException('wageringRequirement must be a non-negative number');
        }
        return this.bonusService.adminGiveBonus(req.user?.id || 0, body.userId, {
            ...body,
            customAmount,
            amount,
            wageringRequirement,
        });
    }

    @Post('emit-wallet-update')
    emitWalletUpdate(@Body() body: { userId: number }) {
        this.bonusService.emitWalletRefresh(body.userId);
        return { success: true };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  USER ROUTES — /bonus  (JwtAuthGuard)
// ─────────────────────────────────────────────────────────────────────────────

@Controller('bonus')
@UseGuards(JwtAuthGuard)
export class BonusController {
    constructor(private readonly bonusService: BonusService) { }

    /**
     * Validate a promo code before deposit (returns preview + conflict info)
     * POST /bonus/validate  { code, depositAmount, depositCurrency }
     */
    @Post('validate')
    async validateCode(
        @Body() body: { code: string; depositAmount?: number; depositCurrency?: 'INR' | 'CRYPTO' },
        @Request() req: any,
    ) {
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
        const depositAmount = body.depositAmount || 0;
        return this.bonusService.validatePromoCode(body.code, req.user.userId, depositAmount, body.depositCurrency, ip);
    }

    /**
     * Get current user's active bonuses split by type
     * GET /bonus/active  → { casino: UserBonus|null, sports: UserBonus|null }
     */
    @Get('active')
    getActiveBonus(@Request() req: any) {
        return this.bonusService.getUserActiveBonuses(req.user.userId);
    }

    /**
     * Get current user's full bonus history
     * GET /bonus/history
     */
    @Get('history')
    getBonusHistory(@Request() req: any) {
        return this.bonusService.getUserBonusHistory(req.user.userId);
    }

    /**
     * Forfeit (alias of /revoke) — called by the frontend
     * POST /bonus/forfeit  { type: 'CASINO' | 'SPORTS' }
     */
    @Post('forfeit')
    forfeitBonus(@Body() body: { type: 'CASINO' | 'SPORTS' }, @Request() req: any) {
        return this.bonusService.forfeitActiveBonusByType(req.user.userId, body.type, 'User forfeited via profile');
    }

    /**
     * Revoke (forfeit) an active bonus by game type
     * POST /bonus/revoke  { type: 'CASINO' | 'SPORTS' }
     */
    @Post('revoke')
    revokeBonus(@Body() body: { type: 'CASINO' | 'SPORTS' }, @Request() req: any) {
        return this.bonusService.forfeitActiveBonusByType(req.user.userId, body.type, 'User revoked via profile');
    }

    /**
     * Toggle bonus isEnabled (select / deselect without forfeiting)
     * POST /bonus/toggle  { type: 'CASINO' | 'SPORTS' }
     */
    @Post('toggle')
    toggleBonus(@Body() body: { type: 'CASINO' | 'SPORTS' }, @Request() req: any) {
        return this.bonusService.toggleBonusEnabled(req.user.userId, body.type);
    }

    /**
     * List all publicly active bonus templates (for Promotions page)
     * GET /bonus/promotions  (public — no auth needed)
     */
    @Public()
    @Get('promotions')
    getActivePromotions() {
        return this.bonusService.findAll().then(bonuses =>
            bonuses.filter((b: any) => b.isActive)
        );
    }

    /**
     * Get signup-eligible bonus options (shown on registration form)
     * GET /bonus/signup-options  (public — no auth needed)
     */
    @Public()
    @Get('signup-options')
    getSignupOptions() {
        return this.bonusService.getSignupBonuses();
    }

    /**
     * Redeem a NO_DEPOSIT signup bonus immediately after registration
     * POST /bonus/redeem-signup  { bonusId }
     */
    @Post('redeem-signup')
    redeemSignupBonus(@Body() body: { bonusCode: string }, @Request() req: any) {
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
        return this.bonusService.redeemSignupBonus(req.user.userId, body.bonusCode, ip);
    }

    /**
     * Save a pending deposit bonus (forFirstDepositOnly) — replaces localStorage
     * POST /bonus/pending  { bonusCode }
     */
    @Post('pending')
    savePendingBonus(@Body() body: { bonusCode: string }, @Request() req: any) {
        return this.bonusService.savePendingDepositBonus(req.user.userId, body.bonusCode);
    }

    /**
     * Get the current user's pending deposit bonus
     * GET /bonus/pending
     */
    @Get('pending')
    getPendingBonus(@Request() req: any) {
        return this.bonusService.getPendingDepositBonus(req.user.userId);
    }

    /**
     * Clear the pending deposit bonus (called after deposit is submitted)
     * DELETE /bonus/pending
     */
    @Delete('pending')
    clearPendingBonus(@Request() req: any) {
        return this.bonusService.clearPendingDepositBonus(req.user.userId);
    }
}
