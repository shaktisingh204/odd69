import { Controller, Get, UseGuards } from '@nestjs/common';
import { RiskService } from './risk.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('risk')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
export class RiskController {
    constructor(private readonly riskService: RiskService) { }

    @Get('exposure')
    async getExposure() {
        return this.riskService.getLiveExposure();
    }

    @Get('ticker')
    async getTicker() {
        return this.riskService.getBetTicker();
    }
}
