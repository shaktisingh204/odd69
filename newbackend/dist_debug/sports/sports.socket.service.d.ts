import { OnModuleInit } from '@nestjs/common';
import { EventsGateway } from '../events.gateway';
import { SportsService } from './sports.service';
export declare class SportsSocketService implements OnModuleInit {
    private readonly eventsGateway;
    private readonly sportsService;
    private readonly logger;
    private ws;
    private readonly SOCKET_URL;
    private heartbeatInterval;
    private reconnectInterval;
    constructor(eventsGateway: EventsGateway, sportsService: SportsService);
    onModuleInit(): void;
    private connect;
    private startHeartbeat;
    private stopHeartbeat;
    private sendHeartbeat;
    private subscribeToMarkets;
    private handleMessage;
    private scheduleReconnect;
    private clearReconnectInterval;
}
