import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { DailyCheckinService } from './daily-checkin.service';
import { Public } from '../auth/public.decorator';

@Controller('daily-checkin')
export class DailyCheckinController {
    constructor(private readonly dailyCheckinService: DailyCheckinService) {}

    /** PUBLIC — check if feature is enabled */
    @Public()
    @Get('config')
    getConfig() {
        return this.dailyCheckinService.getEnabledStatus();
    }

    /** PUBLIC — full config for frontend rendering */
    @Public()
    @Get('full-config')
    getFullConfig() {
        return this.dailyCheckinService.getFullConfig();
    }

    /** Authenticated — get user's daily reward status */
    @Get('status')
    getUserStatus(@Req() req: any) {
        return this.dailyCheckinService.getUserStatus(req.user.userId);
    }

    /** Authenticated — claim today's reward */
    @Post('claim')
    claimReward(
        @Req() req: any,
        @Body() body: { useSpinWheel?: boolean },
    ) {
        return this.dailyCheckinService.claimReward(
            req.user.userId,
            body?.useSpinWheel ?? false,
        );
    }

    /** Authenticated — user's reward history */
    @Get('history')
    getHistory(
        @Req() req: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.dailyCheckinService.getRewardHistory(
            req.user.userId,
            Number(page) || 1,
            Number(limit) || 20,
        );
    }

    /** PUBLIC — leaderboard */
    @Public()
    @Get('leaderboard')
    getLeaderboard(@Query('limit') limit?: string) {
        return this.dailyCheckinService.getLeaderboard(Number(limit) || 10);
    }

    /** Admin — all claims */
    @Get('admin/claims')
    getAllClaims(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
    ) {
        return this.dailyCheckinService.getAllClaims(
            Number(page) || 1,
            Number(limit) || 50,
            search,
        );
    }

    /** Admin — stats */
    @Get('admin/stats')
    getStats() {
        return this.dailyCheckinService.getStats();
    }
}
