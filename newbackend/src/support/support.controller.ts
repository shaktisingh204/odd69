import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportGateway } from './support.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
    constructor(
        private readonly supportService: SupportService,
        private readonly supportGateway: SupportGateway,
    ) { }

    // ─── User Endpoints ──────────────────────────────────────────────────────

    // User: Get My Tickets
    @Get('my-tickets')
    async getMyTickets(@Req() req) {
        return this.supportService.getTickets(req.user.userId);
    }

    // User: Create Ticket
    @Post('create')
    async createTicket(@Req() req, @Body() body: { subject: string; category?: string; message?: string }) {
        const ticket = await this.supportService.createTicket(req.user.userId, body.subject, body.category);
        // If an opening message was provided, add it immediately
        if (body.message?.trim()) {
            const msg = await this.supportService.addMessage(ticket.id, body.message.trim(), 'USER');
            // Broadcast the opening message to admin
            await this.supportGateway.broadcastMessage(ticket.id, msg);
        }
        return ticket;
    }

    // Common: Get Messages for a Ticket
    @Get('ticket/:id')
    async getTicketMessages(@Param('id') id: string) {
        return this.supportService.getTicket(parseInt(id));
    }

    // Common: Send Message (HTTP) — saves + broadcasts via socket
    @Post('message')
    async sendMessage(
        @Req() req,
        @Body() body: { ticketId: number; message: string }
    ) {
        const adminRoles: Role[] = [Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER, Role.MASTER, Role.AGENT];
        const sender: 'USER' | 'ADMIN' = adminRoles.includes(req.user.role) ? 'ADMIN' : 'USER';
        const msg = await this.supportService.addMessage(body.ticketId, body.message, sender);
        // Broadcast to connected socket clients
        await this.supportGateway.broadcastMessage(body.ticketId, msg);
        return msg;
    }

    // ─── Admin Endpoints ─────────────────────────────────────────────────────

    // Admin: Get All Tickets
    @Get('admin/tickets')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER, Role.MASTER, Role.AGENT)
    async getAllTickets() {
        return this.supportService.getTickets();
    }

    // Admin: Get Stats
    @Get('admin/stats')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER, Role.MASTER, Role.AGENT)
    async getStats() {
        return this.supportService.getStats();
    }

    // Admin: Close Ticket
    @Patch('admin/ticket/:id/close')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER, Role.MASTER, Role.AGENT)
    async closeTicket(@Param('id') id: string) {
        return this.supportService.closeTicket(parseInt(id));
    }

    // Admin: Reopen Ticket
    @Patch('admin/ticket/:id/reopen')
    @UseGuards(RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER, Role.MASTER, Role.AGENT)
    async reopenTicket(@Param('id') id: string) {
        return this.supportService.reopenTicket(parseInt(id));
    }
}
