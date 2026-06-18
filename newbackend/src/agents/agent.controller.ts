import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentController {
    constructor(private readonly agentService: AgentService) { }

    @Get('downline')
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MASTER, Role.AGENT)
    async getMyDownline(@Req() req) {
        return this.agentService.getAgentDownline(req.user.userId);
    }

    @Get('stats')
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MASTER, Role.AGENT)
    async getMyStats(@Req() req) {
        return this.agentService.getStats(req.user.userId);
    }

    @Post('create')
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MASTER)
    async createAgent(@Req() req, @Body() body: any) {
        return this.agentService.createAgent(body, req.user.userId);
    }
}
