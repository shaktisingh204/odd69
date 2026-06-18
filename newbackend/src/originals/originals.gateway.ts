import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MinesService } from '../mines/mines.service';
import { DiceService } from '../dice/dice.service';
import { GGRService } from './ggr.service';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events.gateway';
import { OriginalsAdminService } from './originals-admin.service';
import { PlinkoService } from '../plinko/plinko.service';
import { OriginalsSession, OriginalsSessionDocument } from './schemas/originals-session.schema';
import { OriginalsEngagementEvent, OriginalsEngagementEventDocument } from './schemas/originals-engagement-event.schema';
import { MinesGame, MinesGameDocument } from './schemas/mines-game.schema';
import { DiceGame, DiceGameDocument } from './schemas/dice-game.schema';

interface AuthedSocket extends Socket {
  userId?: number;
  username?: string;
  role?: string;
}

@WebSocketGateway({ namespace: '/originals', cors: { origin: '*' } })
export class OriginalsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OriginalsGateway.name);
  private socketUsers = new Map<string, { userId: number; username: string; role: string }>();

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => MinesService))
    private readonly minesService: MinesService,
    @Inject(forwardRef(() => DiceService))
    private readonly diceService: DiceService,
    @Inject(forwardRef(() => PlinkoService))
    private readonly plinkoService: PlinkoService,
    private readonly ggrService: GGRService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
    private readonly originalsAdminService: OriginalsAdminService,
    @InjectModel(OriginalsSession.name)
    private readonly sessionModel: Model<OriginalsSessionDocument>,
    @InjectModel(OriginalsEngagementEvent.name)
    private readonly engagementModel: Model<OriginalsEngagementEventDocument>,
    @InjectModel(MinesGame.name)
    private readonly minesGameModel: Model<MinesGameDocument>,
    @InjectModel(DiceGame.name)
    private readonly diceGameModel: Model<DiceGameDocument>,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async handleConnection(client: AuthedSocket) {
    const token = (client.handshake.auth?.token as string) || (client.handshake.query?.token as string) || '';
    if (token) {
      try {
        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET not configured');
        const payload: any = jwt.verify(token, secret);
        const userInfo = {
          userId: Number(payload.sub),
          username: payload.username || 'Player',
          role: (payload.role || 'user').toLowerCase(),
        };
        this.socketUsers.set(client.id, userInfo);
        client.userId = userInfo.userId;
        client.username = userInfo.username;
        client.role = userInfo.role;
        // Register session (MongoDB)
        await this.sessionModel.create({
          gameKey: 'lobby', userId: userInfo.userId,
          socketId: client.id, isActive: true, connectedAt: new Date(),
        });
      } catch { /* anonymous */ }
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    this.socketUsers.delete(client.id);
    await this.sessionModel.updateMany(
      { socketId: client.id, isActive: true },
      { $set: { isActive: false, disconnectedAt: new Date() } },
    );
  }

  // ── Lobby ─────────────────────────────────────────────────────────────────

  @SubscribeMessage('join-originals')
  async handleJoinOriginals(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: { game: string }) {
    const gameKey = data?.game || 'mines';
    const room = `originals:${gameKey}:lobby`;
    client.join(room);
    if (this.socketUsers.has(client.id)) {
      await this.sessionModel.updateMany(
        { socketId: client.id, isActive: true },
        { $set: { gameKey } },
      );
    }
    client.emit('originals:stats', { activePlayers: await this.getActivePlayers(gameKey) });
    return { status: 'joined', room };
  }

  @SubscribeMessage('leave-originals')
  handleLeaveOriginals(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: { game: string }) {
    client.leave(`originals:${data?.game || 'mines'}:lobby`);
  }

  // ── Mines: Start ──────────────────────────────────────────────────────────

  @SubscribeMessage('mines:start')
  async handleMinesStart(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { betAmount: number; mineCount: number; clientSeed?: string; walletType?: 'fiat'|'crypto'; useBonus?: boolean },
  ) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) { client.emit('mines:error', { message: 'Unauthorized. Please log in.' }); return; }
    if (!(await this.originalsAdminService.canUserPlayOriginals(userInfo.userId))) {
      client.emit('mines:error', { message: 'Zeero Originals access is not enabled for your account.' });
      return;
    }

    const config = await this.ggrService.getConfig('mines');
    if (config?.maintenanceMode) { client.emit('mines:error', { message: config.maintenanceMessage || 'Game under maintenance.' }); return; }
    if (!config?.isActive)        { client.emit('mines:error', { message: 'Game is currently disabled.' }); return; }
    if (data.betAmount < (config?.minBet ?? 10))    { client.emit('mines:error', { message: `Minimum bet ₹${config?.minBet ?? 10}` }); return; }
    if (data.betAmount > (config?.maxBet ?? 100000)) { client.emit('mines:error', { message: `Maximum bet ₹${config?.maxBet ?? 100000}` }); return; }

    try {
      const result = await this.minesService.startGame(userInfo.userId, {
        betAmount: data.betAmount, mineCount: data.mineCount,
        clientSeed: data.clientSeed, walletType: data.walletType ?? 'fiat', useBonus: data.useBonus ?? false,
      });
      client.join(`originals:mines:game:${result.gameId}`);
      client.emit('mines:started', result);

      const user = await this.prisma.user.findUnique({ where: { id: userInfo.userId }, select: { balance: true } });
      if (user) this.eventsGateway.emitBalanceUpdate(userInfo.userId, user.balance);

      this.server.to('originals:mines:lobby').emit('originals:live-bet', {
        type: 'bet_placed', username: this.mask(userInfo.username),
        betAmount: data.betAmount, mineCount: data.mineCount, ts: Date.now(),
      });
    } catch (err: any) {
      client.emit('mines:error', { message: err?.message || 'Failed to start game' });
    }
  }

  // ── Mines: Reveal ─────────────────────────────────────────────────────────

  @SubscribeMessage('mines:reveal')
  async handleMinesReveal(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { gameId: string; tileIndex: number },
  ) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) { client.emit('mines:error', { message: 'Unauthorized' }); return; }

    try {
      const result = await this.minesService.revealTile(userInfo.userId, data);
      const config = await this.ggrService.getConfig('mines');

      if (result.hit) {
        client.emit('mines:game-over', {
          hit: true, tileIndex: data.tileIndex,
          minePositions: result.minePositions, serverSeed: result.serverSeed, revealedTiles: result.revealedTiles,
        });
        await this.ggrService.updateSnapshot('mines', 0, 0, false);
        await this.broadcastGGRToAdmin();

        const user = await this.prisma.user.findUnique({ where: { id: userInfo.userId }, select: { balance: true } });
        if (user) this.eventsGateway.emitBalanceUpdate(userInfo.userId, user.balance);

        this.server.to('originals:mines:lobby').emit('originals:live-bet', { type: 'loss', username: this.mask(userInfo.username), ts: Date.now() });
        await this.checkEngagement(userInfo.userId, 'mines', data.gameId, null, config);
      } else {
        const nearMiss = config?.nearMissEnabled
          ? await this.detectNearMiss(data.gameId, data.tileIndex, result.revealedTiles as number[])
          : false;
        client.emit('mines:tile-result', {
          hit: false, tileIndex: data.tileIndex, revealedTiles: result.revealedTiles,
          multiplier: result.multiplier, potentialPayout: result.potentialPayout, nearMiss,
        });
      }
    } catch (err: any) {
      client.emit('mines:error', { message: err?.message || 'Error revealing tile' });
    }
  }

  // ── Mines: Cashout ────────────────────────────────────────────────────────

  @SubscribeMessage('mines:cashout')
  async handleMinesCashout(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { gameId: string },
  ) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) { client.emit('mines:error', { message: 'Unauthorized' }); return; }

    try {
      const result = await this.minesService.cashout(userInfo.userId, data);
      const config = await this.ggrService.getConfig('mines');
      client.emit('mines:cashout-success', result);
      client.leave(`originals:mines:game:${data.gameId}`);

      await this.ggrService.updateSnapshot('mines', 0, 0, true);
      await this.broadcastGGRToAdmin();

      const user = await this.prisma.user.findUnique({ where: { id: userInfo.userId }, select: { balance: true } });
      if (user) this.eventsGateway.emitBalanceUpdate(userInfo.userId, user.balance);

      const bigWinThreshold = config?.bigWinThreshold ?? 10;
      if (result.multiplier >= bigWinThreshold) {
        await this.engagementModel.create({
          gameKey: 'mines', userId: userInfo.userId, gameId: data.gameId,
          eventType: 'BIG_WIN', metadata: { multiplier: result.multiplier, payout: result.payout },
        });
        this.server.emit('originals:big-win', {
          username: this.mask(userInfo.username), multiplier: result.multiplier,
          payout: result.payout, game: 'Zeero Mines', ts: Date.now(),
        });
      }

      this.server.to('originals:mines:lobby').emit('originals:live-bet', {
        type: 'cashout', username: this.mask(userInfo.username),
        multiplier: result.multiplier, payout: result.payout, ts: Date.now(),
      });
      await this.checkEngagement(userInfo.userId, 'mines', data.gameId, result.multiplier, config);
    } catch (err: any) {
      client.emit('mines:error', { message: err?.message || 'Cashout failed' });
    }
  }

  // ── Mines: Reconnect ──────────────────────────────────────────────────────

  @SubscribeMessage('mines:active')
  async handleMinesActive(@ConnectedSocket() client: AuthedSocket) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) return;
    const activeGame = await this.minesService.getActiveGame(userInfo.userId);
    if (activeGame) {
      client.join(`originals:mines:game:${activeGame.gameId}`);
      client.emit('mines:reconnected', activeGame);
    } else {
      client.emit('mines:no-active', {});
    }
  }

  // ── Dice: Roll ──────────────────────────────────────────────────────────────

  @SubscribeMessage('dice:roll')
  async handleDiceRoll(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { betAmount: number; target: number; direction: 'over' | 'under'; clientSeed?: string; walletType?: 'fiat' | 'crypto'; useBonus?: boolean },
  ) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) { client.emit('dice:error', { message: 'Unauthorized. Please log in.' }); return; }
    if (!(await this.originalsAdminService.canUserPlayOriginals(userInfo.userId))) {
      client.emit('dice:error', { message: 'Zeero Originals access is not enabled for your account.' });
      return;
    }

    const config = await this.ggrService.getConfig('dice').catch(() => null);
    if (config?.maintenanceMode) { client.emit('dice:error', { message: config.maintenanceMessage || 'Game under maintenance.' }); return; }
    if (!config?.isActive)        { client.emit('dice:error', { message: 'Game is currently disabled.' }); return; }
    if (data.betAmount < (config?.minBet ?? 10))    { client.emit('dice:error', { message: `Minimum bet ₹${config?.minBet ?? 10}` }); return; }
    if (data.betAmount > (config?.maxBet ?? 100000)) { client.emit('dice:error', { message: `Maximum bet ₹${config?.maxBet ?? 100000}` }); return; }

    try {
      const result = await this.diceService.playDice(userInfo.userId, {
        betAmount: data.betAmount, target: data.target, direction: data.direction,
        clientSeed: data.clientSeed, walletType: data.walletType ?? 'fiat', useBonus: data.useBonus ?? false,
      });
      client.emit('dice:result', result);
      await this.ggrService.updateSnapshot('dice', 0, 0, result.status === 'WON').catch(() => undefined);

      const user = await this.prisma.user.findUnique({ where: { id: userInfo.userId }, select: { balance: true } });
      if (user) this.eventsGateway.emitBalanceUpdate(userInfo.userId, user.balance);

      this.server.to('originals:dice:lobby').emit('originals:live-bet', {
        type: result.status === 'WON' ? 'cashout' : 'loss',
        game: 'dice', username: this.mask(userInfo.username),
        betAmount: data.betAmount, multiplier: result.multiplier,
        payout: result.payout, roll: result.roll, ts: Date.now(),
      });
    } catch (err: any) {
      client.emit('dice:error', { message: err?.message || 'Dice roll failed' });
    }
  }

  // ── Dice: History ───────────────────────────────────────────────────────────

  @SubscribeMessage('dice:history')
  async handleDiceHistory(@ConnectedSocket() client: AuthedSocket) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) return;
    const history = await this.diceService.getHistory(userInfo.userId, 30);
    client.emit('dice:history', history);
  }

  // ── Plinko: Play ───────────────────────────────────────────────────────────

  @SubscribeMessage('plinko:play')
  async handlePlinkoPlay(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { betAmount: number; rows: number; risk: 'low' | 'medium' | 'high'; clientSeed?: string; walletType?: 'fiat' | 'crypto'; useBonus?: boolean },
  ) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) { client.emit('plinko:error', { message: 'Unauthorized. Please log in.' }); return; }
    if (!(await this.originalsAdminService.canUserPlayOriginals(userInfo.userId))) {
      client.emit('plinko:error', { message: 'Zeero Originals access is not enabled for your account.' });
      return;
    }

    const config = await this.ggrService.getConfig('plinko').catch(() => null);
    if (config?.maintenanceMode) { client.emit('plinko:error', { message: config.maintenanceMessage || 'Game under maintenance.' }); return; }
    if (!config?.isActive) { client.emit('plinko:error', { message: 'Game is currently disabled.' }); return; }
    if (data.betAmount < (config?.minBet ?? 10)) { client.emit('plinko:error', { message: `Minimum bet ₹${config?.minBet ?? 10}` }); return; }
    if (data.betAmount > (config?.maxBet ?? 25000)) { client.emit('plinko:error', { message: `Maximum bet ₹${config?.maxBet ?? 25000}` }); return; }

    try {
      const result = await this.plinkoService.playPlinko(userInfo.userId, {
        betAmount: data.betAmount,
        rows: data.rows,
        risk: data.risk,
        clientSeed: data.clientSeed,
        walletType: data.walletType ?? 'fiat',
        useBonus: data.useBonus ?? false,
      });
      client.emit('plinko:result', result);
      await this.ggrService.updateSnapshot('plinko', 0, 0, result.status === 'WON').catch(() => undefined);
      await this.broadcastGGRToAdmin();

      const user = await this.prisma.user.findUnique({ where: { id: userInfo.userId }, select: { balance: true } });
      if (user) this.eventsGateway.emitBalanceUpdate(userInfo.userId, user.balance);

      const config = await this.ggrService.getConfig('plinko').catch(() => null);
      const bigWinThreshold = config?.bigWinThreshold ?? 15;
      if (result.multiplier >= bigWinThreshold) {
        await this.engagementModel.create({
          gameKey: 'plinko', userId: userInfo.userId, gameId: result.gameId,
          eventType: 'BIG_WIN', metadata: { multiplier: result.multiplier, payout: result.payout },
        });
        this.server.emit('originals:big-win', {
          username: this.mask(userInfo.username), multiplier: result.multiplier,
          payout: result.payout, game: 'Zeero Plinko', ts: Date.now(),
        });
      }

      this.server.to('originals:plinko:lobby').emit('originals:live-bet', {
        type: result.status === 'WON' ? 'cashout' : 'loss',
        game: 'plinko',
        username: this.mask(userInfo.username),
        betAmount: data.betAmount,
        multiplier: result.multiplier,
        payout: result.payout,
        slotIndex: result.slotIndex,
        risk: result.risk,
        rows: result.rows,
        ts: Date.now(),
      });
    } catch (err: any) {
      client.emit('plinko:error', { message: err?.message || 'Plinko drop failed' });
    }
  }

  // ── Plinko: History ───────────────────────────────────────────────────────

  @SubscribeMessage('plinko:history')
  async handlePlinkoHistory(@ConnectedSocket() client: AuthedSocket) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) return;
    const history = await this.plinkoService.getHistory(userInfo.userId, 30);
    client.emit('plinko:history', history);
  }

  // ── Admin Room ────────────────────────────────────────────────────────────

  @SubscribeMessage('admin:join-originals')
  async handleAdminJoin(@ConnectedSocket() client: AuthedSocket) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo || !['super_admin','tech_master','manager'].includes(userInfo.role)) {
      client.emit('mines:error', { message: 'Admin access required' }); return;
    }
    client.join('originals:admin');
    await this.broadcastGGRToAdmin();
  }


  // ── Helpers ───────────────────────────────────────────────────────────────

  private mask(username: string): string {
    if (!username || username.length <= 3) return '***';
    return username.slice(0, 2) + '*'.repeat(username.length - 3) + username.slice(-1);
  }

  private async getActivePlayers(gameKey: string): Promise<number> {
    return this.sessionModel.countDocuments({ gameKey, isActive: true });
  }

  private async detectNearMiss(gameId: string, tileIndex: number, revealedTiles: number[]): Promise<boolean> {
    const game = await this.minesGameModel.findById(gameId).lean();
    if (!game) return false;
    const row = Math.floor(tileIndex / 5), col = tileIndex % 5;
    const adjacent: number[] = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < 5 && c >= 0 && c < 5) adjacent.push(r * 5 + c);
    }
    return adjacent.some((t) => game.minePositions.includes(t));
  }

  private async checkEngagement(userId: number, gameKey: string, gameId: string, multiplier: number | null, config: any) {
    const window = config?.streakWindow ?? 5;
    const recent = await this.minesGameModel.find({ userId, status: { $ne: 'ACTIVE' } }).sort({ createdAt: -1 }).limit(window).lean();
    if (recent.length < 3) return;
    const wins   = recent.filter((g) => g.status === 'CASHEDOUT').length;
    const losses = recent.filter((g) => g.status === 'LOST').length;
    if (wins >= window) {
      await this.engagementModel.create({ gameKey, userId, gameId, eventType: 'WIN_STREAK', metadata: { streak: wins } });
    } else if (losses >= window) {
      await this.engagementModel.create({ gameKey, userId, gameId, eventType: 'LOSS_STREAK', metadata: { streak: losses } });
      const entry = [...this.socketUsers.entries()].find(([, u]) => u.userId === userId);
      if (entry) this.server.to(entry[0]).emit('originals:engagement', { type: 'comeback_offer', message: "You're on a tough run — your luck can turn any moment! 🎯" });
    }
  }

  private async broadcastGGRToAdmin() {
    const [minesStats, plinkoStats, diceStats] = await Promise.all([
      this.ggrService.getLiveGGRStats('mines'),
      this.ggrService.getLiveGGRStats('plinko'),
      this.ggrService.getLiveGGRStats('dice'),
    ]);
    const activePlayers = await this.sessionModel.countDocuments({ isActive: true });
    this.server.to('originals:admin').emit('admin:ggr-update', {
      mines: { ...minesStats }, plinko: { ...plinkoStats }, dice: { ...diceStats },
      activePlayers,
    });
  }

  emitToUser(userId: number, event: string, data: any) {
    const entry = [...this.socketUsers.entries()].find(([, u]) => u.userId === userId);
    if (entry) this.server.to(entry[0]).emit(event, data);
  }
}
