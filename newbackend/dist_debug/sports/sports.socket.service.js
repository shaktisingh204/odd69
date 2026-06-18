"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var SportsSocketService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SportsSocketService = void 0;
const common_1 = require("@nestjs/common");
const ws_1 = __importDefault(require("ws"));
const events_gateway_1 = require("../events.gateway");
const sports_service_1 = require("./sports.service");
let SportsSocketService = SportsSocketService_1 = class SportsSocketService {
    eventsGateway;
    sportsService;
    logger = new common_1.Logger(SportsSocketService_1.name);
    ws;
    SOCKET_URL = 'wss://socket.myzosh.com:8881';
    heartbeatInterval = null;
    reconnectInterval = null;
    constructor(eventsGateway, sportsService) {
        this.eventsGateway = eventsGateway;
        this.sportsService = sportsService;
    }
    onModuleInit() {
        this.connect();
    }
    connect() {
        const agentCode = process.env.AGENT_CODE || 'default_agent_code';
        const timestamp = Date.now();
        const url = `${this.SOCKET_URL}?token=${agentCode}-${timestamp}`;
        this.logger.log(`Connecting to socket: ${url}`);
        this.ws = new ws_1.default(url);
        this.ws.on('open', () => {
            this.logger.log('Connected to socket');
            this.startHeartbeat();
            this.subscribeToMarkets();
            this.clearReconnectInterval();
        });
        this.ws.on('message', (data) => {
            this.handleMessage(data);
        });
        this.ws.on('error', (error) => {
            this.logger.error('Socket error:', error);
        });
        this.ws.on('close', (code, reason) => {
            this.logger.warn(`Socket closed: ${code} - ${reason}`);
            this.stopHeartbeat();
            this.scheduleReconnect();
        });
    }
    startHeartbeat() {
        this.stopHeartbeat();
        this.sendHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, 10000);
    }
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    sendHeartbeat() {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            try {
                const beat = JSON.stringify({ action: 'heartbeat', data: [] });
                this.ws.send(beat);
                this.logger.debug('Heartbeat sent');
            }
            catch (ex) {
                this.logger.error('Error sending heartbeat', ex);
            }
        }
    }
    async subscribeToMarkets() {
        try {
            const liveEvents = await this.sportsService.getLiveEvents();
            const marketIds = [];
            for (const event of liveEvents) {
                if (event.markets) {
                    for (const market of event.markets) {
                        if (market.id) {
                            marketIds.push(market.id.toString());
                        }
                    }
                }
            }
            if (marketIds.length > 0) {
                const payload = JSON.stringify({ action: 'set', markets: marketIds.join(',') });
                this.ws.send(payload);
                this.logger.log(`Subscribed to markets: ${marketIds.join(',')}`);
            }
            else {
                this.logger.warn('No active markets found to subscribe.');
            }
        }
        catch (error) {
            this.logger.error('Error subscribing to markets', error);
        }
    }
    handleMessage(data) {
        try {
            const message = data.toString();
            const parsed = JSON.parse(message);
            this.eventsGateway.server.emit('socket-data', parsed);
        }
        catch (error) {
            this.logger.error('Error handling message', error);
        }
    }
    scheduleReconnect() {
        if (!this.reconnectInterval) {
            this.reconnectInterval = setInterval(() => {
                this.logger.log('Attempting to reconnect...');
                this.connect();
            }, 5000);
        }
    }
    clearReconnectInterval() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }
};
exports.SportsSocketService = SportsSocketService;
exports.SportsSocketService = SportsSocketService = SportsSocketService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [events_gateway_1.EventsGateway,
        sports_service_1.SportsService])
], SportsSocketService);
//# sourceMappingURL=sports.socket.service.js.map