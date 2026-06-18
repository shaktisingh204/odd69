import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SupportService {
    constructor(private prisma: PrismaService) { }

    async createTicket(userId: number, subject: string, category?: string) {
        const fullSubject = category ? `[${category}] ${subject}` : subject;
        return this.prisma.supportTicket.create({
            data: {
                userId,
                subject: fullSubject,
                status: 'OPEN'
            }
        });
    }

    async getTickets(userId?: number) {
        if (userId) {
            return this.prisma.supportTicket.findMany({
                where: { userId },
                include: {
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                },
                orderBy: { updatedAt: 'desc' }
            });
        }
        return this.prisma.supportTicket.findMany({
            include: {
                user: { select: { username: true, id: true } },
                messages: { orderBy: { createdAt: 'desc' }, take: 1 }
            },
            orderBy: { updatedAt: 'desc' }
        });
    }

    async getTicket(ticketId: number) {
        return this.prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                user: { select: { username: true, id: true } }
            }
        });
    }

    async addMessage(ticketId: number, message: string, sender: 'USER' | 'ADMIN') {
        const msg = await this.prisma.supportMessage.create({
            data: { ticketId, message, sender }
        });

        await this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: { updatedAt: new Date() }
        });

        return msg;
    }

    async closeTicket(ticketId: number) {
        return this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: { status: 'CLOSED', updatedAt: new Date() }
        });
    }

    async reopenTicket(ticketId: number) {
        return this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: { status: 'OPEN', updatedAt: new Date() }
        });
    }

    async getStats() {
        const [total, open, closed] = await Promise.all([
            this.prisma.supportTicket.count(),
            this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
            this.prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
        ]);
        return { total, open, closed };
    }
}
