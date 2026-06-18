import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { EventsGateway } from '../events.gateway';
import { SportsService } from './sports.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class SportsSocketService implements OnModuleInit {
    private readonly logger = new Logger(SportsSocketService.name);
    private ws: WebSocket;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private reconnectInterval: NodeJS.Timeout | null = null;
    private subscribedMarkets = new Set<string>();

    constructor(
        @Inject(forwardRef(() => EventsGateway))
        private readonly eventsGateway: EventsGateway,
        @Inject(forwardRef(() => SportsService))
        private readonly sportsService: SportsService
    ) { }

    async onModuleInit() {
        this.connect();
    }

    private connect() {
        this.logger.log('Sports Socket Service connection disabled (provider changed)');
    }

    private startHeartbeat() {
        // Disabled
    }

    private stopHeartbeat() {
        // Disabled
    }


    private sendHeartbeat() {
        // Disabled
    }

    public subscribe(marketIds: string[]) {
        this.logger.log(`Subscribe disabled for markets: ${marketIds.length}`);
    }

    private resubscribe() {
        this.logger.log('Resubscribe disabled');
    }

    public unsubscribe(marketIds: string[]) {
        this.logger.log(`Unsubscribe disabled for markets: ${marketIds.length}`);
    }

    private marketCache = new Map<string, any>();

    public getLiveOdds(marketId: string) {
        return this.marketCache.get(String(marketId));
    }

    private handleMessage(data: WebSocket.Data) {
        try {
            const message = data.toString();
            // Parse for validity
            const parsed = JSON.parse(message);

            // LOGGING as requested
            if (parsed.ip !== undefined || parsed.ms !== undefined) {
                this.logger.log(`Socket Update: IP=${parsed.ip}, MS=${parsed.ms}, Data=${JSON.stringify(parsed)}`);
            }

            // CACHE UPDATE LOGIC
            // Store by ID. IDs can be in `id`, `mid`, `market_id`, `eid` (for scores)
            // For odds, usually `id` or `mid` is the key.
            // Match Odds / Bookmaker / Session / Fancy
            if (parsed.id) {
                this.marketCache.set(String(parsed.id), parsed);
            }
            // Some updates like match_odds might have data array
            if (Array.isArray(parsed.data)) {
                parsed.data.forEach((item: any) => {
                    const id = item.id || item.mid || item.market_id || item.bmi; // bmi for match_odds sometimes?
                    if (id) {
                        this.marketCache.set(String(id), item);
                    }
                    // For match_odds, it might be structured differently. 
                    // Let's rely on what we see in `SportsMainContent`: `bmi` or `mid`
                    // In `updateOddsFromSocket`, we see `bmi`.
                    if (item.bmi) {
                        this.marketCache.set(String(item.bmi), item);
                    }
                });
            }

            // Handle 'ip' (Is Play) -> Update Match Status
            if (parsed.ip !== undefined) {
                // parsed.id might be the event_id or market_id?
                // Usually socket updates send an ID. Let's assume parsed.id is match_id or market_id relates to it.
                // If the user didn't specify structure, I'll log and assume parsed.id exists.
                if (parsed.id) {
                    // Check if it's an event update (ip usually is at event level)
                    this.sportsService.updateMatchStatusFromSocket(parsed.id, parsed.ip);
                }
            }

            // Handle 'ms' (Market Status) -> Update Market
            if (parsed.ms !== undefined && parsed.id) {
                this.sportsService.updateMarketStatusFromSocket(parsed.id, parsed.ms);
            }

            // Handle 'match_odds' (Runners/Odds)
            if ((parsed.messageType === 'match_odds' || parsed.messageType === 'odds') && Array.isArray(parsed.data)) {
                this.sportsService.updateOddsFromSocket(parsed.data);
            }

            // Handle 'session_odds'
            if (parsed.messageType === 'session_odds' && Array.isArray(parsed.data)) {
                this.sportsService.updateSessionOddsFromSocket(parsed.data);
            }

            // Handle 'fancy_odds'
            if (parsed.messageType === 'fancy_odds' && Array.isArray(parsed.data)) {
                this.sportsService.updateFancyOddsFromSocket(parsed.data);
            }

            // Handle 'fancy' (New structured fancy/session data with RT array)
            if (parsed.messageType === 'fancy' && Array.isArray(parsed.data)) {
                this.sportsService.handleFancySocketMessage(parsed.data);
            }

            // Handle 'bookmaker_odds' (often just 'bm' or 'bookmaker')
            if ((parsed.messageType === 'bookmaker_odds' || parsed.messageType === 'bm_odds') && Array.isArray(parsed.data)) {
                this.sportsService.updateBookmakerOddsFromSocket(parsed.data);
            }

            // Catch-all logger for UNHANDLED types
            const handledTypes = ['match_odds', 'odds', 'session_odds', 'fancy_odds', 'bookmaker_odds', 'bm_odds', 'fancy'];
            if (parsed.messageType && !handledTypes.includes(parsed.messageType)) {
                this.logger.warn(`Unhandled socket message type: ${parsed.messageType}. Data: ${JSON.stringify(parsed).substring(0, 200)}...`);
            }

            // Handle 'ms' (Market Status) -> Update Market
            if (parsed.ms !== undefined && parsed.id) {
                this.sportsService.updateMarketStatusFromSocket(parsed.id, parsed.ms);
            }

            // Broadcast to all clients
            this.eventsGateway.server.emit('socket-data', parsed);

        } catch (error) {
            this.logger.error(`Error handling message: ${error.message}`);
        }
    }

    private scheduleReconnect() {
        if (!this.reconnectInterval) {
            this.reconnectInterval = setInterval(() => {
                this.logger.log('Attempting to reconnect...');
                this.connect();
            }, 5000);
        }
    }

    private clearReconnectInterval() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }
}
