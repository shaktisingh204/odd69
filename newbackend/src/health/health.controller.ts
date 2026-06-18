import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('health')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HealthController {
    constructor(private readonly healthService: HealthService) { }

    @Get('status')
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
    async getHealth() {
        return this.healthService.checkHealth();
    }

    @Get('stats')
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
    async getStats() {
        return this.healthService.getSystemStats();
    }

    @Get('audit-logs')
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
    async getAuditLogs() {
        // Find latest audit logs
        // Need to access prisma.auditLog
        // HealthService needs to expose a method or accessor
        return this.healthService.getAuditLogs();
    }
}
