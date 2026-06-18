import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatbotGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinChatbotMonitor')
  handleJoinMonitor(@ConnectedSocket() client: Socket) {
    client.join('chatbot:monitor');
    return { event: 'joinedChatbotMonitor', data: true };
  }

  @SubscribeMessage('leaveChatbotMonitor')
  handleLeaveMonitor(@ConnectedSocket() client: Socket) {
    client.leave('chatbot:monitor');
    return { event: 'leftChatbotMonitor', data: true };
  }

  broadcastBotResponse(conversationId: string, message: any) {
    this.server.to('chatbot:monitor').emit('botResponse', { conversationId, message });
  }

  broadcastEscalation(conversationId: string, data: any) {
    this.server.to('chatbot:monitor').emit('botEscalation', { conversationId, ...data });
  }

  broadcastConversationUpdate(conversationId: string, status: string) {
    this.server.to('chatbot:monitor').emit('botConversationUpdate', { conversationId, status });
  }

  broadcastTyping(conversationId: string) {
    this.server.to('chatbot:monitor').emit('botTyping', { conversationId });
  }
}
