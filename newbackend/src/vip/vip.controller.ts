import {
    Controller, Get, Post, Patch, Body, Param, Query,
    UseGuards, Req, ParseIntPipe, DefaultValuePipe
} from '@nestjs/common';
import { VipService } from './vip.service';
import { CreateVipApplicationDto, ReviewVipApplicationDto, UpdateVipTierDto } from './dto/vip.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('vip')
@UseGuards(JwtAuthGuard)
export class VipController {
    constructor(private readonly vipService: VipService) { }

    // ═══════════════════════════════════════════════════════════════════════
    //  USER ENDPOINTS
    // ═══════════════════════════════════════════════════════════════════════

    @Post('apply')
    async apply(@Req() req, @Body() dto: CreateVipApplicationDto) {
        const ipAddress =
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.socket?.remoteAddress ||
            'unknown';
        const userAgent = req.headers['user-agent'] ?? '';
        return this.vipService.applyForVip(req.user.userId, dto, { ipAddress, userAgent });
    }

    @Get('my-application')
    async myApplication(@Req() req) {
        return this.vipService.getMyApplication(req.user.userId);
    }

    @Get('my-status')
    async myVipStatus(@Req() req) {
        return this.vipService.getMyVipStatus(req.user.userId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ADMIN ENDPOINTS
    // ═══════════════════════════════════════════════════════════════════════

    @Get('admin/applications')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async listApplications(
        @Query('status') status?: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    ) {
        return this.vipService.listApplications(status, page, Math.min(limit, 100));
    }

    @Get('admin/stats')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async stats() {
        return this.vipService.getStats();
    }

    @Get('admin/applications/:id')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async getApplication(@Param('id', ParseIntPipe) id: number) {
        return this.vipService.getApplication(id);
    }

    @Patch('admin/applications/:id/review')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async review(
        @Param('id', ParseIntPipe) id: number,
        @Req() req,
        @Body() dto: ReviewVipApplicationDto,
    ) {
        return this.vipService.reviewApplication(id, req.user.userId, dto);
    }

    @Get('admin/members')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async listMembers(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
        @Query('tier') tier?: string,
        @Query('search') search?: string,
    ) {
        return this.vipService.listVipMembers(page, Math.min(limit, 100), tier, search);
    }

    @Patch('admin/users/:id/tier')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async updateTier(
        @Param('id', ParseIntPipe) id: number,
        @Req() req,
        @Body() dto: UpdateVipTierDto,
    ) {
        return this.vipService.updateUserTier(id, dto, req.user.userId);
    }

    @Get('admin/tier-settings')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async getTierSettings() {
        return this.vipService.getVipTierSettings();
    }
}
