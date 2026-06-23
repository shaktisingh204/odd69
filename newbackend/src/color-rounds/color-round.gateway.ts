import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { Logger, OnModuleInit } from '@nestjs/common';
import {
  ColorRoundService,
  COLOR_ROOMS,
  PlaceColorBetDto,
} from './color-round.service';
import { ColorRoom } from './schemas/color-round.schema';
import { ColorBetType } from './schemas/color-bet.schema';

interface AuthedSocket extends Socket {
  userId?: number;
  username?: string;
}

@WebSocketGateway({ namespace: '/color', cors: { origin: '*' } })
export class ColorRoundGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ColorRoundGateway.name);
  private socketUsers = new Map<string, { userId: number; username: string }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly colorService: ColorRoundService,
  ) {}

  onModuleInit() {
    // Wire service callbacks → socket broadcasts before starting the loops.
    this.colorService.onBetting((p) => {
      this.server.emit('color:round-open', {
        room: p.room,
        period: p.period,
        serverSeedHash: p.serverSeedHash,
        endsIn: p.endsIn, // ms until draw
        lockIn: p.lockIn, // ms until betting locks
      });
    });

    this.colorService.onLock((p) => {
      this.server.emit('color:lock', { room: p.room, period: p.period });
    });

    this.colorService.onResult((p) => {
      // Public result (no per-user payouts in the broadcast).
      this.server.emit('color:result', {
        room: p.room,
        period: p.period,
        result: p.result,
        resultColors: p.resultColors,
        size: p.size,
        serverSeed: p.serverSeed, // revealed
        serverSeedHash: p.serverSeedHash,
      });

      // Targeted win notification to each winning player's sockets.
      for (const [socketId, u] of this.socketUsers) {
        const wins = p.winners.filter((w) => w.userId === u.userId);
        if (wins.length === 0) continue;
        const totalPayout = wins.reduce((s, w) => s + w.payout, 0);
        this.server.to(socketId).emit('color:win', {
          room: p.room,
          period: p.period,
          result: p.result,
          resultColors: p.resultColors,
          size: p.size,
          payout: totalPayout,
          bets: wins.map((w) => ({ betId: w.betId, payout: w.payout })),
        });
      }
    });

    // Start the 4 room loops.
    this.colorService.startLoops();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async handleConnection(client: AuthedSocket) {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string) ||
      '';
    if (token) {
      try {
        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET not configured');
        const payload: any = jwt.verify(token, secret);
        const userInfo = {
          userId: Number(payload.sub),
          username: payload.username || 'Player',
        };
        this.socketUsers.set(client.id, userInfo);
        client.userId = userInfo.userId;
        client.username = userInfo.username;
      } catch {
        /* anonymous — can still watch */
      }
    }

    // Current state of all 4 rooms.
    client.emit('color:state', { rooms: this.colorService.getAllStates() });

    // Recent shared history per room.
    const history: Record<string, any[]> = {};
    for (const room of COLOR_ROOMS) {
      history[room] = await this.colorService.getHistory(room, 30);
    }
    client.emit('color:history', { history });
  }

  handleDisconnect(client: AuthedSocket) {
    this.socketUsers.delete(client.id);
  }

  // ── Place Bet ─────────────────────────────────────────────────────────────

  @SubscribeMessage('color:bet')
  async handleBet(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    data: {
      room: ColorRoom;
      betType: ColorBetType;
      selection: string;
      amount: number;
      walletType?: 'fiat' | 'crypto';
      useBonus?: boolean;
    },
  ) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) {
      client.emit('color:error', { message: 'Unauthorized. Please log in.' });
      return;
    }

    try {
      const dto: PlaceColorBetDto = {
        room: data.room,
        betType: data.betType,
        selection: data.selection,
        amount: data.amount,
        walletType: data.walletType ?? 'fiat',
        useBonus: data.useBonus ?? false,
      };
      const result = await this.colorService.placeBet(userInfo.userId, dto);
      client.emit('color:bet-placed', result);

      // Anonymized live bets feed (masked username) to reinforce the shared round.
      this.server.emit('color:player-bet', {
        room: result.room,
        period: result.period,
        username: this.mask(userInfo.username),
        betType: result.betType,
        selection: result.selection,
        amount: result.amount,
      });
    } catch (err: any) {
      client.emit('color:error', { message: err?.message || 'Failed to place bet' });
    }
  }

  // ── History / My bets ───────────────────────────────────────────────────────

  @SubscribeMessage('color:get-history')
  async handleGetHistory(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { room: ColorRoom },
  ) {
    const room = COLOR_ROOMS.includes(data?.room) ? data.room : '30s';
    const history = await this.colorService.getHistory(room, 30);
    client.emit('color:history-data', { room, history });
    return { room, history };
  }

  @SubscribeMessage('color:get-state')
  handleGetState(@ConnectedSocket() client: AuthedSocket) {
    const rooms = this.colorService.getAllStates();
    client.emit('color:state', { rooms });
    return { rooms };
  }

  @SubscribeMessage('color:get-my-bets')
  async handleGetMyBets(@ConnectedSocket() client: AuthedSocket) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) {
      client.emit('color:error', { message: 'Unauthorized. Please log in.' });
      return;
    }
    const bets = await this.colorService.getMyBets(userInfo.userId, 30);
    client.emit('color:my-bets', { bets });
    return { bets };
  }

  private mask(username: string): string {
    if (!username || username.length <= 3) return '***';
    return (
      username.slice(0, 2) + '*'.repeat(username.length - 3) + username.slice(-1)
    );
  }
}
