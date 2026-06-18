'use server'

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getAllTickets(status?: 'OPEN' | 'CLOSED') {
    try {
        const tickets = await prisma.supportTicket.findMany({
            where: status ? { status } : undefined,
            include: {
                user: { select: { username: true, id: true } },
                messages: { orderBy: { createdAt: 'desc' }, take: 1 }
            },
            orderBy: { updatedAt: 'desc' }
        });

        const safeTickets = tickets.map((t: any) => ({
            ...t,
            status: t.status as any,
            user: t.user ? { ...t.user, username: t.user.username || 'Unknown' } : undefined
        }));

        return { success: true, data: JSON.parse(JSON.stringify(safeTickets)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch tickets' };
    }
}

export async function getTicket(ticketId: number) {
    try {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                user: { select: { username: true, id: true } }
            }
        });
        if (!ticket) return { success: false, error: 'Ticket not found' };

        const safeTicket = {
            ...ticket,
            status: ticket.status as any,
            user: ticket.user ? { ...ticket.user, username: ticket.user.username || 'Unknown' } : undefined
        };

        return { success: true, data: JSON.parse(JSON.stringify(safeTicket)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch ticket' };
    }
}

export async function addMessage(ticketId: number, message: string, sender: 'USER' | 'ADMIN') {
    try {
        const msg = await prisma.supportMessage.create({
            data: { ticketId, message, sender: sender as any }
        });
        await prisma.supportTicket.update({
            where: { id: ticketId },
            data: { updatedAt: new Date() }
        });
        revalidatePath('/dashboard/support');
        return { success: true, data: JSON.parse(JSON.stringify(msg)) };
    } catch (error) {
        return { success: false, error: 'Failed to send message' };
    }
}

export async function closeTicket(ticketId: number) {
    try {
        await prisma.supportTicket.update({
            where: { id: ticketId },
            data: { status: 'CLOSED', updatedAt: new Date() }
        });
        revalidatePath('/dashboard/support');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to close ticket' };
    }
}

export async function reopenTicket(ticketId: number) {
    try {
        await prisma.supportTicket.update({
            where: { id: ticketId },
            data: { status: 'OPEN', updatedAt: new Date() }
        });
        revalidatePath('/dashboard/support');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to reopen ticket' };
    }
}

export async function getStats() {
    try {
        const [total, open, closed] = await Promise.all([
            prisma.supportTicket.count(),
            prisma.supportTicket.count({ where: { status: 'OPEN' } }),
            prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
        ]);
        return { success: true, data: { total, open, closed } };
    } catch {
        return { success: false, data: { total: 0, open: 0, closed: 0 } };
    }
}
