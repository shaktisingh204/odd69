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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@clickhouse/client");
let AnalyticsService = class AnalyticsService {
    client;
    constructor() {
        this.client = (0, client_1.createClient)({
            url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
            username: process.env.CLICKHOUSE_USER || 'default',
            password: process.env.CLICKHOUSE_PASSWORD || '',
            database: process.env.CLICKHOUSE_DB || 'default',
        });
    }
    async onModuleInit() {
        try {
            await this.client.ping();
            console.log('Connected to ClickHouse');
        }
        catch (e) {
            console.warn('Failed to connect to ClickHouse:', e.message);
        }
    }
    async logEvent(eventName, data) {
        try {
            await this.client.insert({
                table: 'events',
                values: [
                    { event_name: eventName, data: JSON.stringify(data), created_at: new Date() }
                ],
                format: 'JSONEachRow',
            });
        }
        catch (e) {
            console.error('Failed to log event to ClickHouse:', e);
        }
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map