import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SupportService } from './support.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class SupportGateway {
    @WebSocketServer()
    server: Server;

    constructor(private readonly supportService: SupportService) { }

    @SubscribeMessage('joinSupport')
    handleJoinSupport(@ConnectedSocket() client: Socket, @MessageBody() data: { userId: number }) {
        client.join(`support_user_${data.userId}`);
        return { event: 'joinedSupport', data: `Joined support_user_${data.userId}` };
    }

    @SubscribeMessage('adminJoinSupport')
    handleAdminJoinSupport(@ConnectedSocket() client: Socket) {
        client.join('support_admin');
        return { event: 'joinedAdminSupport', data: 'Joined support_admin' };
    }

    // Socket-based message sending (used by user website)
    @SubscribeMessage('sendMessage')
    async handleMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: { ticketId: number; message: string; sender: 'USER' | 'ADMIN' }) {
        const savedMessage = await this.supportService.addMessage(payload.ticketId, payload.message, payload.sender);
        const ticket = await this.supportService.getTicket(payload.ticketId);
        if (ticket) {
            this.server.to(`support_user_${ticket.userId}`).emit('newMessage', savedMessage);
            this.server.to('support_admin').emit('newMessage', { ...savedMessage, userId: ticket.userId });
        }
        return savedMessage;
    }

    // Broadcast-only: used after message is already saved via HTTP/server action
    @SubscribeMessage('broadcastSupportMessage')
    async handleBroadcast(@ConnectedSocket() client: Socket, @MessageBody() payload: { ticketId: number; message: any }) {
        const ticket = await this.supportService.getTicket(payload.ticketId);
        if (ticket) {
            this.server.to(`support_user_${ticket.userId}`).emit('newMessage', payload.message);
            this.server.to('support_admin').emit('newMessage', { ...payload.message, userId: ticket.userId });
        }
    }

    // Public method: called by controller after saving message via HTTP
    async broadcastMessage(ticketId: number, message: any) {
        const ticket = await this.supportService.getTicket(ticketId);
        if (ticket) {
            this.server.to(`support_user_${ticket.userId}`).emit('newMessage', message);
            this.server.to('support_admin').emit('newMessage', { ...message, userId: ticket.userId });
        }
    }
}
