import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { RedisService } from '../redis/redis.service';
import { SportsService } from './sports.service';

@Injectable()
@WebSocketGateway({
  namespace: '/sports',
  cors: {
    origin: '*',
  },
})
export class SportsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SportsGateway.name);

  constructor(
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => SportsService))
    private readonly sportsService: SportsService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.debug(`Sports socket connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.debug(`Sports socket disconnected: ${client.id}`);
    await this.cleanupClientSubscriptions(client.id);
  }

  @SubscribeMessage('join-sports-lobby')
  handleJoinSportsLobby(client: Socket) {
    client.join('sports:lobby');
    return { status: 'success', room: 'sports:lobby' };
  }

  @SubscribeMessage('leave-sports-lobby')
  handleLeaveSportsLobby(client: Socket) {
    client.leave('sports:lobby');
    return { status: 'success' };
  }

  @SubscribeMessage('join-match')
  async handleJoinMatch(client: Socket, matchId: string) {
    if (!matchId) return;
    const roomName = `match:${matchId}`;
    client.join(roomName);

    const redis = this.redisService.getClient();
    await redis.zadd(`viewers:${matchId}`, Date.now(), client.id);
    await redis.sadd(`sports_socket_matches:${client.id}`, matchId);

    this.sportsService.ensureMarketImported(matchId).catch((err) => {
      this.logger.warn(`Auto-import failed for ${matchId}: ${err.message}`);
    });

    try {
      const cached = await redis.get(`odds:${matchId}`);
      if (cached) {
        const rawMarkets: any[] = JSON.parse(cached);
        if (Array.isArray(rawMarkets) && rawMarkets.length > 0) {
          const socketMarkets = rawMarkets.map((market: any) => {
            const mname: string = market?.mname ?? '';
            const mid = market?.mid != null ? String(market.mid) : `${matchId}_${mname}`;
            const isSuspended = market?.status === 'SUSPENDED';

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

          client.emit('sports-match-data', {
            messageType: 'odds',
            eventId: matchId,
            data: socketMarkets,
          });
        }
      }
    } catch {
      // Best-effort seed only.
    }

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

          client.emit('sports-match-data', {
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
      // Best-effort seed only.
    }

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

    const redis = this.redisService.getClient();
    await redis.zrem(`viewers:${matchId}`, client.id);
    await redis.srem(`sports_socket_matches:${client.id}`, matchId);

    const count = await redis.zcard(`viewers:${matchId}`);
    if (count === 0) {
      await redis.set(`last_viewed:${matchId}`, Date.now());
    }

    return { status: 'success', left: `match:${matchId}` };
  }

  emitLobbyData(payload: any) {
    this.server.to('sports:lobby').emit('sports-lobby-data', payload);
  }

  emitMatchData(matchId: string, payload: any) {
    this.server.to(`match:${matchId}`).emit('sports-match-data', payload);
  }

  private async cleanupClientSubscriptions(socketId: string) {
    const redis = this.redisService.getClient();
    const matches = await redis.smembers(`sports_socket_matches:${socketId}`);

    for (const matchId of matches) {
      await redis.zrem(`viewers:${matchId}`, socketId);
      const count = await redis.zcard(`viewers:${matchId}`);
      if (count === 0) {
        await redis.set(`last_viewed:${matchId}`, Date.now());
      }
    }

    await redis.del(`sports_socket_matches:${socketId}`);
  }
}
