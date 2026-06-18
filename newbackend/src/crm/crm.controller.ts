import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { CrmService } from './crm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('crm')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
export class CrmController {
    constructor(private readonly crmService: CrmService) { }

    @Get('segments')
    async getSegments() {
        return this.crmService.getCustomerSegments();
    }

    @Get('users')
    async getSegmentUsers(@Query('segment') segment: string, @Query('page') page: number) {
        return this.crmService.getSegmentUsers(segment, Number(page) || 1);
    }

    @Post('notify')
    async sendNotification(@Body() body: { segment: string, message: string }) {
        return this.crmService.sendNotification(body.segment, body.message);
    }
}
