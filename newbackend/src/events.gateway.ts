import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

import { RedisService } from './redis/redis.service';
import { SportsService } from './sports/sports.service';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // In-memory map of socketId → verified JWT payload (avoids re-decoding every message)
  private socketUsers = new Map<string, { userId: number; username: string; role: string; level: number }>();

  constructor(
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => SportsService))
    private readonly sportsService: SportsService,
    private readonly configService: ConfigService,
  ) { }

  // ─── Connection Lifecycle ──────────────────────────────────────────

  handleConnection(client: Socket) {
    // Attempt to verify JWT from handshake auth or query token
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string) ||
      '';

    if (token) {
      try {
        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET not configured');
        const payload: any = jwt.verify(token, secret);
        // JWT payload: { sub: userId, username, role }
        this.socketUsers.set(client.id, {
          userId: Number(payload.sub),
          username: payload.username || 'Guest',
          role: (payload.role || 'user').toLowerCase(),
          level: payload.level || 0,
        });
      } catch {
        // Token invalid — socket is anonymous, chat send will be blocked
      }
    }
  }

  async handleDisconnect(client: Socket) {
    this.socketUsers.delete(client.id);
    await this.cleanupClientSubscriptions(client.id);
  }

  // ─── Match Subscription & Viewer Tracking ─────────────────────────

  @SubscribeMessage('join-match')
  async handleJoinMatch(client: Socket, matchId: string) {
    if (!matchId) return;
    const roomName = `match:${matchId}`;
    client.join(roomName);

    const redis = this.redisService.getClient();
    await redis.zadd(`viewers:${matchId}`, Date.now(), client.id);
    await redis.sadd(`socket_matches:${client.id}`, matchId);

    this.sportsService.ensureMarketImported(matchId).catch(err => {
      console.error(`Auto-import failed for ${matchId}:`, err.message);
    });

    // ── INSTANT ODDS SEED ─────────────────────────────────────────────
    // Read current odds from Redis immediately and push to this client.
    // This seeds liveMarkets before the next 800ms sync cycle fires,
    // eliminating the "all suspended" flicker on page load.
    try {
      const cached = await redis.get(`odds:${matchId}`);
      if (cached) {
        const rawMarkets: any[] = JSON.parse(cached);
        if (Array.isArray(rawMarkets) && rawMarkets.length > 0) {
          const socketMarkets = rawMarkets.map((market: any) => {
            const mname: string = market?.mname ?? '';
            const mid = market?.mid != null ? String(market.mid) : `${matchId}_${mname}`;
            const isSuspended = market?.status === 'SUSPENDED';

            // Build runner array — same transform as TurnkeySyncService.processOddsChunk
            const runners: any[] = (market?.section ?? []).flatMap(
              (sel: any, idx: number) => {
                const selId = sel?.sid ?? sel?.selectionId ?? sel?.id ?? idx;
                const odds: any[] = Array.isArray(sel?.odds) ? sel.odds : [];
                return odds.map((o: any) => ({
                  ri: selId,
                  ib: o?.otype === 'back',
                  rt: o?.odds,
                  bv: o?.size,
                  nat: sel?.nat,
                }));
              },
            );

            return {
              bmi: mid,
              mid,
              eid: matchId,
              mname,
              gtype: market?.gtype,
              ms: isSuspended ? 4 : 1,
              rt: runners,
              section: market?.section,
            };
          });

          client.emit('socket-data', {
            messageType: 'odds',
            eventId: matchId,
            data: socketMarkets,
          });
        }
      }
    } catch {
      // Best-effort — never block the join response
    }

    // ── INSTANT SPORTRADAR SEED ────────────────────────────────────────
    // If this is an SR match, push the latest cached full event snapshot
    // immediately so the match-detail page does not need a manual refresh
    // while waiting for the next live socket tick.
    try {
      const cached = await redis.get(`sportradar:market:${matchId}`);
      if (cached) {
        const snapshot = JSON.parse(cached);
        const event = snapshot?.event;
        if (snapshot?.success && event) {
          const matchOdds: any[] = event?.markets?.matchOdds ?? [];
          const socketMarkets = matchOdds.map((market: any) => ({
            bmi: `${matchId}:${market.marketId}`,
            mid: `${matchId}:${market.marketId}`,
            eid: matchId,
            mname: market.marketName,
            mtype: market.marketType,
            ms: market.status === 'Active' ? 1 : 4,
            rt: (market.runners ?? []).flatMap((runner: any) => [
              ...(runner.backPrices ?? []).map((price: any) => ({
                ri: runner.runnerId,
                ib: true,
                rt: price.price,
                bv: price.size,
                nat: runner.runnerName,
              })),
              ...(runner.layPrices ?? []).map((price: any) => ({
                ri: runner.runnerId,
                ib: false,
                rt: price.price,
                bv: price.size,
                nat: runner.runnerName,
              })),
            ]),
            runners: market.runners,
          }));

          client.emit('socket-data', {
            messageType: 'sportradar_odds',
            eventId: matchId,
            data: socketMarkets,
            score: {
              home: event.homeScore,
              away: event.awayScore,
            },
            event,
          });
        }
      }
    } catch {
      // Best-effort — never block the join response
    }
    // ─────────────────────────────────────────────────────────────────

    return { status: 'success', joined: roomName };
  }

  @SubscribeMessage('match-heartbeat')
  async handleMatchHeartbeat(client: Socket, matchId: string) {
    if (!matchId) return;
    await this.redisService.getClient().zadd(`viewers:${matchId}`, Date.now(), client.id);
  }

  @SubscribeMessage('leave-match')
  async handleLeaveMatch(client: Socket, matchId: string) {
    if (!matchId) return;
    client.leave(`match:${matchId}`);

    await this.redisService.getClient().zrem(`viewers:${matchId}`, client.id);
    await this.redisService.getClient().srem(`socket_matches:${client.id}`, matchId);

    const count = await this.redisService.getClient().zcard(`viewers:${matchId}`);
    if (count === 0) {
      await this.redisService.getClient().set(`last_viewed:${matchId}`, Date.now());
    }
  }

  private async cleanupClientSubscriptions(socketId: string) {
    const redis = this.redisService.getClient();
    const matches = await redis.smembers(`socket_matches:${socketId}`);

    for (const matchId of matches) {
      await redis.zrem(`viewers:${matchId}`, socketId);
      const count = await redis.zcard(`viewers:${matchId}`);
      if (count === 0) {
        await redis.set(`last_viewed:${matchId}`, Date.now());
      }
    }
    await redis.del(`socket_matches:${socketId}`);
  }

  // ─── Odds API Sports Room ──────────────────────────────────────────
  // Clients on /sports page join this room to receive real-time
  // odds + score broadcasts from OddsApiSyncService.

  @SubscribeMessage('join-odds-sports')
  handleJoinOddsSports(client: Socket) {
    client.join('odds-sports');
    return { status: 'success', room: 'odds-sports' };
  }

  @SubscribeMessage('leave-odds-sports')
  handleLeaveOddsSports(client: Socket) {
    client.leave('odds-sports');
    return { status: 'success' };
  }

  // ─── Generic Events ────────────────────────────────────────────────

  @SubscribeMessage('events')
  handleEvent(client: Socket, data: any): string {
    return data;
  }

  @SubscribeMessage('subscribeToUserRoom')
  handleUserRoomSubscription(
    client: Socket,
    payload?: { userId?: string | number } | string | number,
  ) {
    const userInfo = this.socketUsers.get(client.id);
    if (!userInfo) {
      return { status: 'error', message: 'Unauthorized' };
    }

    const requestedUserId =
      typeof payload === 'object' && payload !== null
        ? payload.userId
        : payload;
    const normalizedRequestedUserId =
      typeof requestedUserId === 'string' ? Number(requestedUserId) || requestedUserId : requestedUserId;

    if (normalizedRequestedUserId && normalizedRequestedUserId !== userInfo.userId) {
      return { status: 'error', message: 'Cannot subscribe to another user room' };
    }

    const roomName = `user:${userInfo.userId}`;
    client.join(roomName);
    return { status: 'success', room: roomName };
  }

  // ─── Broadcast helpers ─────────────────────────────────────────────

  broadcastOddsUpdate(matchId: string, odds: any) {
    this.server.emit(`match:${matchId}:odds`, odds);
  }

  /** Broadcast live odds diffs to: (1) the specific match room, (2) global to update sports list */
  emitOddsUpdate(matchId: string, markets: any[]) {
    const payload = {
      messageType: 'odds',
      eventId: matchId,
      data: markets,
    };
    const sportsNamespace = this.server.of('/sports');
    // Targeted — only clients watching this match
    this.server.to(`match:${matchId}`).emit('socket-data', payload);
    // Global — so SportsMainContent list updates too
    this.server.emit('socket-data', payload);
    sportsNamespace.to(`match:${matchId}`).emit('sports-match-data', payload);
    sportsNamespace.to('sports:lobby').emit('sports-lobby-data', payload);
  }

  /** Broadcast a single market status change (suspended / active) */
  emitMarketStatus(matchId: string, marketId: string, ms: number) {
    const payload = { messageType: 'market_status', id: marketId, ms, eventId: matchId };
    const sportsNamespace = this.server.of('/sports');
    this.server.to(`match:${matchId}`).emit('socket-data', payload);
    this.server.emit('socket-data', payload);
    sportsNamespace.to(`match:${matchId}`).emit('sports-match-data', payload);
    sportsNamespace.to('sports:lobby').emit('sports-lobby-data', payload);
  }

  emitUserWalletUpdate(userId: string | number, payload: Record<string, any> = {}) {
    const normalizedUserId = typeof userId === 'string' ? Number(userId) || userId : userId;
    const data = { userId: normalizedUserId, ...payload };
    const roomName = `user:${normalizedUserId}`;

    this.server.to(roomName).emit('walletUpdate', data);
    this.server.to(roomName).emit('balanceUpdate', data);
  }

  emitBalanceUpdate(userId: string | number, newBalance: number) {
    this.emitUserWalletUpdate(userId, { balance: newBalance });
  }

  /** Broadcast live pulse data (jackpot, activities, online count) to all clients */
  emitLivePulse(data: { jackpotAmount: number; activities: any[]; onlineCount: number }) {
    this.server.emit('live-pulse', data);
  }

  /** Push a new in-app notification to a specific user's private room */
  emitNewNotification(userId: number, notification: { _id: string; title: string; body: string; createdAt: Date }) {
    const roomName = `user:${userId}`;
    this.server.to(roomName).emit('newNotification', notification);
  }
  /** Broadcast Odds API real-time update to the odds-sports room */
  emitOddsApiUpdate(sportKey: string, events: any[], syncedAt: string) {
    this.server.to('odds-sports').emit('odds-api-update', {
      sport_key: sportKey,
      events,
      synced_at: syncedAt,
    });
  }

  /** Broadcast Odds API scores update */
  emitOddsApiScores(sportKey: string, scores: any[], syncedAt: string) {
    this.server.to('odds-sports').emit('odds-api-scores', {
      sport_key: sportKey,
      scores,
      synced_at: syncedAt,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ExternalEventsGateway  —  Socket.IO namespace: /external
//  Used by partner / external websites to receive real-time sports data.
//  Authentication: static token checked on connect (env: EXTERNAL_API_TOKEN)
// ═══════════════════════════════════════════════════════════════════════════

@WebSocketGateway({
  namespace: '/external',
  cors: {
    origin: '*',
  },
})
export class ExternalEventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ExternalEventsGateway.name);

  // ------------------------------------------------------------------
  // Connection Lifecycle
  // ------------------------------------------------------------------

  handleConnection(client: Socket) {
    const token: string =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string) ||
      '';

    const validToken = process.env.EXTERNAL_API_TOKEN;

    if (!validToken) {
      this.logger.error('EXTERNAL_API_TOKEN is not set — rejecting external socket connection');
      client.disconnect(true);
      return;
    }

    if (!token || token !== validToken) {
      this.logger.warn(`External WS: invalid token, disconnecting ${client.id}`);
      client.emit('error', { message: 'Invalid or missing API token' });
      client.disconnect(true);
      return;
    }

    this.logger.log(`External client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`External client disconnected: ${client.id}`);
  }

  // ------------------------------------------------------------------
  // Match Room Subscriptions
  // ------------------------------------------------------------------

  /**
   * Client emits: join-match  with matchId string
   * Joins room `match:<matchId>` so it only receives targeted odds updates.
   */
  @SubscribeMessage('join-match')
  handleJoinMatch(client: Socket, matchId: string) {
    if (!matchId) return { status: 'error', message: 'matchId required' };
    client.join(`match:${matchId}`);
    this.logger.log(`External client ${client.id} joined match:${matchId}`);
    return { status: 'success', joined: `match:${matchId}` };
  }

  /**
   * Client emits: leave-match  with matchId string
   */
  @SubscribeMessage('leave-match')
  handleLeaveMatch(client: Socket, matchId: string) {
    if (!matchId) return;
    client.leave(`match:${matchId}`);
    return { status: 'success', left: `match:${matchId}` };
  }

  /**
   * Client emits: subscribe-all
   * Joins the global broadcast room to receive all events.
   */
  @SubscribeMessage('subscribe-all')
  handleSubscribeAll(client: Socket) {
    client.join('broadcast-all');
    return { status: 'success', room: 'broadcast-all' };
  }

  // ------------------------------------------------------------------
  // Broadcast helpers (called by SportsService)
  // ------------------------------------------------------------------

  /**
   * Broadcast live odds update to:
   *  1. Clients watching this specific match  (room: match:<matchId>)
   *  2. Clients subscribed to all events     (room: broadcast-all)
   */
  emitOddsUpdate(matchId: string, markets: any[]) {
    const payload = {
      messageType: 'odds',
      eventId: matchId,
      data: markets,
    };
    const sportsNamespace = this.server.of('/sports');
    this.server.to(`match:${matchId}`).emit('socket-data', payload);
    this.server.to('broadcast-all').emit('socket-data', payload);
    sportsNamespace.to(`match:${matchId}`).emit('sports-match-data', payload);
    sportsNamespace.to('sports:lobby').emit('sports-lobby-data', payload);
  }

  /**
   * Broadcast market status change (suspended / active).
   */
  emitMarketStatus(matchId: string, marketId: string, ms: number) {
    const payload = { messageType: 'market_status', id: marketId, ms, eventId: matchId };
    const sportsNamespace = this.server.of('/sports');
    this.server.to(`match:${matchId}`).emit('socket-data', payload);
    this.server.to('broadcast-all').emit('socket-data', payload);
    sportsNamespace.to(`match:${matchId}`).emit('sports-match-data', payload);
    sportsNamespace.to('sports:lobby').emit('sports-lobby-data', payload);
  }

  /**
   * Broadcast raw socket-data packet (for catch-all forwarding).
   */
  emitRaw(matchId: string, data: any) {
    const sportsNamespace = this.server.of('/sports');
    this.server.to(`match:${matchId}`).emit('socket-data', data);
    this.server.to('broadcast-all').emit('socket-data', data);
    sportsNamespace.to(`match:${matchId}`).emit('sports-match-data', data);
    sportsNamespace.to('sports:lobby').emit('sports-lobby-data', data);
  }
}
