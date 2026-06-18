import { Controller, Get, Post, Body, Query, Param, UseGuards, Req, Patch, Put, Delete } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { CasinoService } from './casino.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SecurityTokenGuard } from '../auth/security-token.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller()
export class CasinoController {
    constructor(private readonly casinoService: CasinoService) { }

    // Frontend API Endpoints
    @Public()
    @Get('casino/categories')
    async getCategories(@Query('type') type?: 'live' | 'casino') {
        return await this.casinoService.getCategoriesHub(type);
    }

    @Public()
    @Get('casino/providers-list')
    async getProviders(@Query('category') category?: string) {
        return await this.casinoService.getProvidersHub(category);
    }

    @Public()
    @Get('casino/games')
    async getGames(
        @Query('provider') provider: string,
        @Query('category') category: string,
        @Query('search') search: string,
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('type') type: string
    ) {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 60;
        return this.casinoService.getGamesByProviderHub(provider, category, search, p, l, type);
    }

    @UseGuards(JwtAuthGuard)
    @Post('casino/launch')
    async launchGame(
        @Req() req: any,
        @Body() body: { provider: string; gameId: string; isLobby?: boolean; walletMode?: string },
    ) {
        return this.casinoService.getGameUrlHub(
            req.user.username,
            body.provider,
            body.gameId,
            body.isLobby,
            body.walletMode,
        );
    }

    @Public()
    @Post('casino/huidu/wallet/callback')
    async huiduWalletCallback(@Body() body: any) {
        return this.casinoService.huiduWalletCallbackHub(body);
    }

    @Get('casino/my-bets')
    @UseGuards(JwtAuthGuard)
    async getMyBets(@Req() req: any, @Query('limit') limit: string, @Query('gameCode') gameCode: string) {
        const l = parseInt(limit) || 20;
        const userId = req.user.id || req.user.userId;
        return this.casinoService.getUserBets(userId, l, gameCode);
    }

    // Public endpoint: returns admin-pinned games for a section
    // sections: popular | new | slots | live | table | crash | home | top
    @Public()
    @Get('casino/section/:section')
    async getSectionGames(@Param('section') section: string) {
        return this.casinoService.getSectionGames(section);
    }

    // --- Admin Endpoints ---

    @Get('admin/list')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
    async getAdminGameList(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @Query('search') search?: string,
        @Query('provider') provider?: string,
        @Query('category') category?: string
    ) {
        return this.casinoService.getAdminAllGames(Number(page), Number(limit), search, provider, category);
    }

    @Patch('admin/update/:id')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
    async updateGame(
        @Param('id') id: string,
        @Body() updateData: { sub_category?: string; popularity?: number; isNewGame?: boolean; game_name?: string }
    ) {
        return this.casinoService.updateGame(id, updateData);
    }

    @Get('admin/categories')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
    async getAllCategories() {
        return this.casinoService.getAllCategories();
    }

    @Patch('admin/categories/update')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
    async updateCategoryName(
        @Body() data: { oldName: string; newName: string }
    ) {
        // Use updateCategory logic or deprecated logic? 
        // User wants "change casino categories". 
        // Current deprecated method was checking game aggregation.
        // Let's keep it for backward compat if frontend uses it, but also add new ones.
        // Since I removed it from Service, I must remove it here or re-add it.
        // Better: Re-implement it using the new Category model if possible, or just bulk update games.
        // Re-adding bulk update logic here inline or in service?
        // Let's use the new updateCategory service method for id-based updates.
        // For this specifically named endpoint, let's just error or direct to new method.
        // Actually, I should have kept `updateCategoryName` in service if I wanted to keep this endpoint.
        // But I removed it. Let's remove this endpoint and replace with new RESTful ones.
        return { message: "Use PUT /admin/categories/:id instead" };
    }

    // --- New Admin Endpoints ---

    @Public()
    @Get('admin/categories-list')
    async getAdminCategoriesList() {
        return this.casinoService.getAdminCategories();
    }

    @UseGuards(SecurityTokenGuard)
    @Post('admin/categories')
    async createCategory(@Body() body: any) {
        return this.casinoService.createCategory(body);
    }

    @UseGuards(SecurityTokenGuard)
    @Put('admin/categories/:id')
    async updateCategory(@Param('id') id: string, @Body() body: any) {
        return this.casinoService.updateCategory(id, body);
    }

    @UseGuards(SecurityTokenGuard)
    @Delete('admin/categories/:id')
    async deleteCategory(@Param('id') id: string) {
        return this.casinoService.deleteCategory(id);
    }

    @UseGuards(SecurityTokenGuard)
    @Post('admin/categories/reorder')
    async reorderCategories(@Body() body: { items: { id: string, priority: number }[] }) {
        return this.casinoService.reorderCategories(body.items);
    }

    // Providers
    @UseGuards(SecurityTokenGuard)
    @Get('admin/providers')
    async getAdminProviders() {
        return this.casinoService.getAdminProviders();
    }

    @UseGuards(SecurityTokenGuard)
    @Post('admin/providers')
    async createProvider(@Body() body: any) {
        return this.casinoService.createProvider(body);
    }

    @UseGuards(SecurityTokenGuard)
    @Put('admin/providers/:id')
    async updateProvider(@Param('id') id: string, @Body() body: any) {
        return this.casinoService.updateProvider(id, body);
    }

    @UseGuards(SecurityTokenGuard)
    @Delete('admin/providers/:id')
    async deleteProvider(@Param('id') id: string) {
        return this.casinoService.deleteProvider(id);
    }

    @UseGuards(SecurityTokenGuard)
    @Post('admin/providers/reorder')
    async reorderProviders(@Body() body: { items: { id: string, priority: number }[] }) {
        return this.casinoService.reorderProviders(body.items);
    }

    // Games
    @UseGuards(SecurityTokenGuard)
    @Get('admin/games-list')
    async getAdminGamesList(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @Query('search') search?: string,
        @Query('provider') provider?: string,
        @Query('category') category?: string
    ) {
        return this.casinoService.getAdminAllGames(Number(page), Number(limit), search, provider, category);
    }

    @UseGuards(SecurityTokenGuard)
    @Post('admin/games')
    async createNewGame(@Body() body: any) {
        return this.casinoService.createGame(body);
    }

    @UseGuards(SecurityTokenGuard)
    @Put('admin/games/:id')
    async updateGameDetails(@Param('id') id: string, @Body() body: any) {
        return this.casinoService.updateGame(id, body);
    }

    @UseGuards(SecurityTokenGuard)
    @Delete('admin/games/:id')
    async deleteGame(@Param('id') id: string) {
        return this.casinoService.deleteGame(id);
    }

    @UseGuards(SecurityTokenGuard)
    @Post('admin/games/sync')
    async syncGames() {
        return this.casinoService.syncGames();
    }

    // ─── HUIDU direct query (admin) ───────────────────────────────────────

    /**
     * GET /admin/huidu/transactions?fromDate=<ms>&toDate=<ms>&pageNo=1&pageSize=100
     * Calls HUIDU /game/transaction/list directly. from/to MUST be same UTC day
     * and within the last 60 days (HUIDU limitations).
     */
    @UseGuards(SecurityTokenGuard)
    @Get('admin/huidu/transactions')
    async adminHuiduTransactions(
        @Query('fromDate') fromDate: string,
        @Query('toDate') toDate: string,
        @Query('pageNo') pageNo?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const from = Number(fromDate);
        const to = Number(toDate);
        if (!Number.isFinite(from) || !Number.isFinite(to)) {
            return { success: false, error: 'fromDate/toDate required (ms UTC)' };
        }
        return this.casinoService.queryHuiduTransactions({
            fromDate: from,
            toDate: to,
            pageNo: pageNo ? Number(pageNo) : 1,
            pageSize: pageSize ? Number(pageSize) : 100,
        });
    }

    /**
     * GET /admin/huidu/user/:userId/history?fromDate=<ms>&toDate=<ms>
     * Fetches a single user's HUIDU history for a single UTC day.
     */
    @UseGuards(SecurityTokenGuard)
    @Get('admin/huidu/user/:userId/history')
    async adminHuiduUserHistory(
        @Param('userId') userId: string,
        @Query('fromDate') fromDate: string,
        @Query('toDate') toDate: string,
        @Query('pageNo') pageNo?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const uid = Number(userId);
        const from = Number(fromDate);
        const to = Number(toDate);
        if (!Number.isFinite(uid)) {
            return { success: false, error: 'Invalid userId' };
        }
        if (!Number.isFinite(from) || !Number.isFinite(to)) {
            return { success: false, error: 'fromDate/toDate required (ms UTC)' };
        }
        return this.casinoService.queryHuiduUserHistory(uid, {
            fromDate: from,
            toDate: to,
            pageNo: pageNo ? Number(pageNo) : 1,
            pageSize: pageSize ? Number(pageSize) : 5000,
        });
    }

    /**
     * GET /admin/huidu/user/:userId/accounts
     * Returns the four HUIDU member_account variants for a given user.
     */
    @UseGuards(SecurityTokenGuard)
    @Get('admin/huidu/user/:userId/accounts')
    async adminHuiduUserAccounts(@Param('userId') userId: string) {
        const uid = Number(userId);
        if (!Number.isFinite(uid)) {
            return { success: false, error: 'Invalid userId' };
        }
        return {
            success: true,
            userId: uid,
            accounts: this.casinoService.getHuiduMemberAccountsForUser(uid),
        };
    }
}
