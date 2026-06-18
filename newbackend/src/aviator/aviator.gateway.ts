import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { Logger, OnModuleInit } from '@nestjs/common';
import { AviatorService } from './aviator.service';
import { OriginalsAdminService } from '../originals/originals-admin.service';

interface AuthedSocket extends Socket {
  userId?: number;
  username?: string;
}

@WebSocketGateway({ namespace: '/aviator', cors: { origin: '*' } })
export class AviatorGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(AviatorGateway.name);
  private socketUsers = new Map<string, { userId: number; username: string }>();
  private currentMultiplier = 1.0;
  private currentRoundId = 0;
  private currentStatus: 'BETTING' | 'FLYING' | 'CRASHED' = 'BETTING';

  constructor(
    private readonly configService: ConfigService,
    private readonly aviatorService: AviatorService,
    private readonly originalsAdminService: OriginalsAdminService,
  ) {}

  onModuleInit() {
    // Register callbacks before starting loop
    this.aviatorService.onBettingPhase((round) => {
      this.currentRoundId = round.roundId;
      this.currentMultiplier = 1.0;
      this.currentStatus = 'BETTING';
      this.server.emit('aviator:betting', round);
    });

    this.aviatorService.onRoundStart((round) => {
      this.currentStatus = 'FLYING';
      this.server.emit('aviator:start', round);
    });

    this.aviatorService.onMultiplierTick((roundId, multiplier) => {
      this.currentMultiplier = multiplier;
      this.server.emit('aviator:tick', { roundId, multiplier });
    });

    this.aviatorService.onCrash((roundId, crashPoint, winners) => {
      this.currentStatus = 'CRASHED';
      this.server.emit('aviator:crash', { roundId, crashPoint });
      // Notify individual winners
      for (const [socketId, u] of this.socketUsers) {
        const win = winners.find((w) => w.userId === u.userId);
        if (win) {
          this.server.to(socketId).emit('aviator:cashout-success', win);
        }
      }
    });

    // Start the round loop
    this.aviatorService.startLoop().catch((e) => this.logger.error('Aviator loop error', e));
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

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

    // Send current game state to new client
    client.emit('aviator:state', {
      status: this.currentStatus,
      roundId: this.currentRoundId,
      multiplier: this.currentMultiplier,
    });

    // Send recent round history
    const history = await this.aviatorService.getRoundHistory(30);
    client.emit('aviator:history', history);
  }

  handleDisconnect(client: AuthedSocket) {
    this.socketUsers.delete(client.id);
  }

  // ── Place Bet ─────────────────────────────────────────────────────────────

  @SubscribeMessage('aviator:bet')
  async handleBet(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { roundId: number; betAmount: number; autoCashoutAt?: number; walletType?: string; useBonus?: boolean },
  ) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) { client.emit('aviator:error', { message: 'Unauthorized. Please log in.' }); return; }
    if (!(await this.originalsAdminService.canUserPlayOriginals(userInfo.userId))) {
      client.emit('aviator:error', { message: 'Zeero Originals access is not enabled for your account.' });
      return;
    }

    try {
      const result = await this.aviatorService.placeBet(
        userInfo.userId, data.roundId, data.betAmount,
        data.autoCashoutAt ?? 0, data.walletType ?? 'fiat', data.useBonus ?? false,
      );
      client.emit('aviator:bet-placed', result);

      // Broadcast anonymized bet to all
      this.server.emit('aviator:player-bet', {
        username: this.mask(userInfo.username),
        betAmount: data.betAmount,
      });
    } catch (err: any) {
      client.emit('aviator:error', { message: err?.message || 'Failed to place bet' });
    }
  }

  // ── Cashout ───────────────────────────────────────────────────────────────

  @SubscribeMessage('aviator:cashout')
  async handleCashout(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { roundId: number },
  ) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) { client.emit('aviator:error', { message: 'Unauthorized' }); return; }

    try {
      const result = await this.aviatorService.cashOut(userInfo.userId, data.roundId, this.currentMultiplier);
      client.emit('aviator:cashout-success', result);

      // Broadcast to all
      this.server.emit('aviator:player-cashout', {
        username: this.mask(userInfo.username),
        multiplier: this.currentMultiplier,
        payout: result.payout,
      });
    } catch (err: any) {
      client.emit('aviator:error', { message: err?.message || 'Cashout failed' });
    }
  }

  // ── Current Round Bets (for active bets table) ────────────────────────────

  @SubscribeMessage('aviator:get-bets')
  async handleGetBets(@MessageBody() data: { roundId: number }) {
    return this.aviatorService.getRoundBets(data.roundId);
  }

  @SubscribeMessage('aviator:get-history')
  async handleGetHistory() {
    return this.aviatorService.getRoundHistory(30);
  }

  private mask(username: string): string {
    if (!username || username.length <= 3) return '***';
    return username.slice(0, 2) + '*'.repeat(username.length - 3) + username.slice(-1);
  }
}
