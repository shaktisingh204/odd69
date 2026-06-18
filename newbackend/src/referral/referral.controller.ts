import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SecurityTokenGuard } from '../auth/security-token.guard';

@Controller('referral')
export class ReferralController {
    constructor(private readonly referralService: ReferralService) { }

    // ── User-facing (JWT required) ─────────────────────────────────────────────

    @UseGuards(JwtAuthGuard)
    @Get('stats')
    async getStats(@Req() req) {
        return this.referralService.getReferralStats(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('apply')
    async applyCode(@Req() req, @Body('code') code: string) {
        return this.referralService.applyReferral(req.user.userId, code);
    }

    @UseGuards(JwtAuthGuard)
    @Post('generate')
    async generateCode(@Req() req) {
        const code = await this.referralService.createReferralCodeForUser(req.user.userId);
        return { code };
    }

    // ── Admin: Reward Rules — X-Admin-Token required ──────────────────────────

    @UseGuards(SecurityTokenGuard)
    @Get('rewards')
    async getRewards() {
        return this.referralService.getRewardRules();
    }

    @UseGuards(SecurityTokenGuard)
    @Get('rewards/all')
    async getAllRewards() {
        return this.referralService.getAllRewardRules();
    }

    @UseGuards(SecurityTokenGuard)
    @Post('reward')
    async createReward(@Body() body: any) {
        return this.referralService.createRewardRule(body);
    }

    @UseGuards(SecurityTokenGuard)
    @Patch('reward/:id/toggle')
    async toggleReward(@Param('id') id: string) {
        return this.referralService.toggleRewardRule(Number(id));
    }

    @UseGuards(SecurityTokenGuard)
    @Delete('reward/:id')
    async deleteReward(@Param('id') id: string) {
        return this.referralService.deleteRewardRule(Number(id));
    }

    // ── Admin: Users / History / Stats — X-Admin-Token required ──────────────

    @UseGuards(SecurityTokenGuard)
    @Get('admin/users')
    async getAdminUsers(@Query('page') page = 1, @Query('limit') limit = 20, @Query('search') search = '') {
        return this.referralService.getAdminReferralUsers(Number(page), Number(limit), search);
    }

    @UseGuards(SecurityTokenGuard)
    @Get('admin/history')
    async getAdminHistory(@Query('page') page = 1, @Query('limit') limit = 20) {
        return this.referralService.getAdminReferralHistory(Number(page), Number(limit));
    }

    @UseGuards(SecurityTokenGuard)
    @Get('admin/stats')
    async getAdminStats() {
        return this.referralService.getAffiliateGlobalStats();
    }
}
