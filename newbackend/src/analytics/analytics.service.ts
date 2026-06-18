import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient } from '@clickhouse/client';

@Injectable()
export class AnalyticsService implements OnModuleInit {
    private client;

    constructor() {
        this.client = createClient({
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
        } catch (e) {
            console.warn('Failed to connect to ClickHouse:', e.message);
        }
    }

    async logEvent(eventName: string, data: any) {
        try {
            await this.client.insert({
                table: 'events',
                values: [
                    { event_name: eventName, data: JSON.stringify(data), created_at: new Date() }
                ],
                format: 'JSONEachRow',
            });
        } catch (e) {
            console.error('Failed to log event to ClickHouse:', e);
        }
    }
}
