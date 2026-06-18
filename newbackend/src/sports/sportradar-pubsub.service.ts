import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import Redis from 'ioredis';
import { EventsGateway } from '../events.gateway';
import { SportsGateway } from './sports.gateway';

const LIVE_UPDATE_CHANNEL = 'sportradar:live-update';

/**
 * Bridges the Rust sports-sync-rust daemon's Redis pub/sub notifications to
 * the Socket.IO clients. The daemon writes to Redis on every live-odds tick,
 * then publishes `{eventId, sportId}` to `sportradar:live-update`. This
 * service reads the canonical body from `sportradar:market:{eventId}` and
 * emits the same payloads the in-process `SportradarService.emitSportradarOdds`
 * used to send — so the front-end socket contract is unchanged.
 *
 * Runs unconditionally. When the Rust daemon isn't running no messages
 * arrive and this service stays idle.
 */
@Injectable()
export class SportradarPubsubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SportradarPubsubService.name);
  private subscriber: Redis | null = null;
  private reader: Redis | null = null;

  constructor(
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
    private readonly sportsGateway: SportsGateway,
  ) {}

  async onModuleInit() {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;
    const db = parseInt(process.env.REDIS_DB || '0', 10);

    // ioredis requires a dedicated connection per subscription. A second
    // client is used for the GET that hydrates the canonical body.
    this.subscriber = new Redis({ host, port, password, db });
    this.reader = new Redis({ host, port, password, db });

    this.subscriber.on('error', (e) =>
      this.logger.warn(`subscriber error: ${e?.message ?? e}`),
    );
    this.reader.on('error', (e) =>
      this.logger.warn(`reader error: ${e?.message ?? e}`),
    );

    await this.subscriber.subscribe(LIVE_UPDATE_CHANNEL);
    this.subscriber.on('message', (channel, raw) => {
      if (channel !== LIVE_UPDATE_CHANNEL) return;
      this.handleMessage(raw).catch((e) =>
        this.logger.debug(`handleMessage failed: ${e?.message ?? e}`),
      );
    });

    this.logger.log(
      `Subscribed to ${LIVE_UPDATE_CHANNEL} — fanning Rust live-odds updates to sockets.`,
    );
  }

  async onModuleDestroy() {
    try {
      await this.subscriber?.unsubscribe(LIVE_UPDATE_CHANNEL);
    } catch {
      // swallow on shutdown
    }
    this.subscriber?.disconnect();
    this.reader?.disconnect();
  }

  // ──────────────────────────────────────────────────────────────────────

  private async handleMessage(raw: string): Promise<void> {
    let msg: { eventId?: string; sportId?: string } = {};
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const eventId = msg.eventId;
    if (!eventId || !this.reader) return;

    // Hydrate the canonical body the Rust daemon wrote. We prefer the
    // list-market envelope (`sportradar:market:{id}`) because it has the
    // richest market detail; fall back to `sportradar:event:{id}` if the
    // market key got evicted between publish and read.
    const marketRaw = await this.reader
      .get(`sportradar:market:${eventId}`)
      .catch(() => null);
    let rawEvent: any | null = null;
    if (marketRaw) {
      try {
        const env = JSON.parse(marketRaw);
        if (env?.success && env?.event) rawEvent = env.event;
      } catch {
        // ignore
      }
    }
    if (!rawEvent) {
      const evRaw = await this.reader
        .get(`sportradar:event:${eventId}`)
        .catch(() => null);
      if (evRaw) {
        try {
          rawEvent = JSON.parse(evRaw);
        } catch {
          // ignore
        }
      }
    }
    if (!rawEvent) return;

    this.emitSportradarOdds(eventId, rawEvent);
  }

  /**
   * Mirrors `SportradarService.emitSportradarOdds()` so socket consumers see
   * the same payload shape whether sync is in-process or in Rust.
   */
  private emitSportradarOdds(eventId: string, rawEvent: any): void {
    if (!this.eventsGateway?.server && !this.sportsGateway?.server) return;

    const matchOdds: any[] = rawEvent?.markets?.matchOdds ?? [];

    const markets = matchOdds.map((m) => ({
      bmi: `${eventId}:${m.marketId}`,
      mid: `${eventId}:${m.marketId}`,
      eid: eventId,
      mname: m.marketName,
      mtype: m.marketType,
      ms: m.status === 'Active' ? 1 : 4,
      rt: (m.runners ?? []).flatMap((r: any) => [
        ...(r.backPrices ?? []).map((p: any) => ({
          ri: r.runnerId,
          ib: true,
          rt: p.price,
          bv: p.size,
          nat: r.runnerName,
        })),
        ...(r.layPrices ?? []).map((p: any) => ({
          ri: r.runnerId,
          ib: false,
          rt: p.price,
          bv: p.size,
          nat: r.runnerName,
        })),
      ]),
      runners: m.runners,
    }));

    const basePayload = {
      messageType: 'sportradar_odds',
      eventId,
      data: markets,
      score: { home: rawEvent.homeScore, away: rawEvent.awayScore },
    };
    const matchPayload = { ...basePayload, event: rawEvent };

    if (this.sportsGateway?.server) {
      this.sportsGateway.emitMatchData(eventId, matchPayload);
      this.sportsGateway.emitLobbyData(basePayload);
    }
    if (this.eventsGateway?.server) {
      this.eventsGateway.server
        .to(`match:${eventId}`)
        .emit('socket-data', matchPayload);
      this.eventsGateway.server.emit('socket-data', basePayload);
    }
  }
}
