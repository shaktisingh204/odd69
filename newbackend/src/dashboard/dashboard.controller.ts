import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('stats')
    @Roles('TECH_MASTER', 'SUPER_ADMIN', 'MANAGER')
    async getStats() {
        return this.dashboardService.getStats();
    }

    @Get('alerts')
    @Roles('TECH_MASTER', 'SUPER_ADMIN', 'MANAGER')
    async getAlerts() {
        return this.dashboardService.getAlerts();
    }

    @Get('reports')
    @Roles('TECH_MASTER', 'SUPER_ADMIN', 'MANAGER')
    async getReports() {
        const financial = await this.dashboardService.getFinancialReport();
        const players = await this.dashboardService.getPlayerReport();
        return { financial, players };
    }
}
