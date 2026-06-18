import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { PushNotificationsService } from './push-notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';


@Controller('push-notifications')
export class PushNotificationsController {
    constructor(
        private readonly pushService: PushNotificationsService,
    ) {}

    // ─── Config endpoints (admin-only) ────────────────────────

    /**
     * GET /push-notifications/config
     * Admin-only — returns full config
     */
    @Get('config')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
    async getConfig() {
        return this.pushService.getConfig();
    }

    /**
     * PATCH /push-notifications/config
     * Admin-only — update OneSignal App ID and/or REST API Key
     */
    @Patch('config')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
    async updateConfig(
        @Body() body: { appId?: string; restApiKey?: string },
    ) {
        return this.pushService.updateConfig(body);
    }

    // ─── Device registration ────────────────────────────────

    /**
     * POST /push-notifications/register-device
     * Registers a OneSignal player ID for the authenticated user.
     */
    @Post('register-device')
    @UseGuards(JwtAuthGuard)
    async registerDevice(
        @Request() req: any,
        @Body() body: { playerId: string },
    ) {
        return this.pushService.registerDevice(req.user.id, body.playerId);
    }

    // ─── Send & History ─────────────────────────────────────

    /**
     * POST /push-notifications/send
     * Sends a push notification from admin.
     */
    @Post('send')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async sendPush(
        @Request() req: any,
        @Body() body: {
            title: string;
            body: string;
            imageUrl?: string;
            deepLink?: string;
            segment?: string;
            userIds?: number[];
        },
    ) {
        return this.pushService.sendPush({
            ...body,
            sentBy: req.user.id,
        });
    }

    /**
     * GET /push-notifications/history
     * Lists all sent push notifications for admin.
     */
    @Get('history')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    async getHistory(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.pushService.getPushHistory(
            Number(page) || 1,
            Number(limit) || 20,
        );
    }
}

