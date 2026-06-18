import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { Logger, OnModuleInit } from '@nestjs/common';
import { LimboService } from './limbo.service';
import { OriginalsAdminService } from '../originals/originals-admin.service';

interface AuthedSocket extends Socket {
  userId?: number;
  username?: string;
}

@WebSocketGateway({ namespace: '/limbo', cors: { origin: '*' } })
export class LimboGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(LimboGateway.name);
  private socketUsers = new Map<string, { userId: number; username: string }>();
  private currentMultiplier = 1.0;
  private currentRoundId = 0;
  private currentStatus: 'BETTING' | 'FLYING' | 'CRASHED' = 'BETTING';

  constructor(
    private readonly configService: ConfigService,
    private readonly limboService: LimboService,
    private readonly originalsAdminService: OriginalsAdminService,
  ) {}

  onModuleInit() {
    this.limboService.onBettingPhase((round) => {
      this.currentRoundId = round.roundId;
      this.currentMultiplier = 1.0;
      this.currentStatus = 'BETTING';
      this.server.emit('limbo:betting', round);
    });

    this.limboService.onRoundStart((round) => {
      this.currentStatus = 'FLYING';
      this.server.emit('limbo:start', round);
    });

    this.limboService.onMultiplierTick((roundId, multiplier) => {
      this.currentMultiplier = multiplier;
      this.server.emit('limbo:tick', { roundId, multiplier });
    });

    this.limboService.onCrash((roundId, crashPoint, winners) => {
      this.currentStatus = 'CRASHED';
      this.server.emit('limbo:crash', { roundId, crashPoint });
      // Notify individual winners
      for (const [socketId, u] of this.socketUsers) {
        const win = winners.find((w) => w.userId === u.userId);
        if (win) {
          this.server.to(socketId).emit('limbo:cashout-success', win);
        }
      }
    });

    this.limboService.startLoop().catch((e) => this.logger.error('Limbo loop error', e));
  }

  async handleConnection(client: AuthedSocket) {
    const token = (client.handshake.auth?.token as string) || (client.handshake.query?.token as string) || '';
    if (token) {
      try {
        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET not configured');
        const payload: any = jwt.verify(token, secret);
        const userInfo = { userId: Number(payload.sub), username: payload.username || 'Player' };
        this.socketUsers.set(client.id, userInfo);
        client.userId = userInfo.userId;
        client.username = userInfo.username;
      } catch { /* anonymous */ }
    }

    client.emit('limbo:state', {
      status: this.currentStatus,
      roundId: this.currentRoundId,
      multiplier: this.currentMultiplier,
    });

    const history = await this.limboService.getRoundHistory(30);
    client.emit('limbo:history', history);
  }

  handleDisconnect(client: AuthedSocket) {
    this.socketUsers.delete(client.id);
  }

  @SubscribeMessage('limbo:bet')
  async handleBet(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { roundId: number; betAmount: number; autoCashoutAt?: number; walletType?: string; useBonus?: boolean },
  ) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) { client.emit('limbo:error', { message: 'Unauthorized. Please log in.' }); return; }
    if (!(await this.originalsAdminService.canUserPlayOriginals(userInfo.userId))) {
      client.emit('limbo:error', { message: 'Zeero Originals access is not enabled for your account.' });
      return;
    }

    try {
      const result = await this.limboService.placeBet(
        userInfo.userId, data.roundId, data.betAmount,
        data.autoCashoutAt ?? 0, data.walletType ?? 'fiat', data.useBonus ?? false,
      );
      client.emit('limbo:bet-placed', result);

      this.server.emit('limbo:player-bet', {
        username: this.mask(userInfo.username),
        betAmount: data.betAmount,
      });
    } catch (err: any) {
      client.emit('limbo:error', { message: err?.message || 'Failed to place bet' });
    }
  }

  @SubscribeMessage('limbo:cashout')
  async handleCashout(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { roundId: number },
  ) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) { client.emit('limbo:error', { message: 'Unauthorized' }); return; }

    try {
      const result = await this.limboService.cashOut(userInfo.userId, data.roundId, this.currentMultiplier);
      client.emit('limbo:cashout-success', result);

      this.server.emit('limbo:player-cashout', {
        username: this.mask(userInfo.username),
        multiplier: this.currentMultiplier,
        payout: result.payout,
      });
    } catch (err: any) {
      client.emit('limbo:error', { message: err?.message || 'Cashout failed' });
    }
  }

  @SubscribeMessage('limbo:get-bets')
  async handleGetBets(@MessageBody() data: { roundId: number }) {
    return this.limboService.getRoundBets(data.roundId);
  }

  @SubscribeMessage('limbo:get-history')
  async handleGetHistory() {
    return this.limboService.getRoundHistory(30);
  }

  private mask(username: string): string {
    if (!username || username.length <= 3) return '***';
    return username.slice(0, 2) + '*'.repeat(username.length - 3) + username.slice(-1);
  }
}
