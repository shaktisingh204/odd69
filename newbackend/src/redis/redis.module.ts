import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { RedisService } from './redis.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: 'REDIS_CLIENT',
            useFactory: (configService: ConfigService) => {
                return new Redis({
                    host: configService.get<string>('REDIS_HOST') || 'localhost',
                    port: configService.get<number>('REDIS_PORT') || 6379,
                });
            },
            inject: [ConfigService],
        },
        // Dedicated Redis for the sportradar-proxy data plane. Falls back to
        // the main Redis when PROXY_REDIS_HOST is unset, so existing
        // deployments continue to work unchanged. Point this at a separate
        // instance to isolate proxy reads from primary application traffic.
        {
            provide: 'PROXY_REDIS_CLIENT',
            useFactory: (configService: ConfigService) => {
                const log = new Logger('ProxyRedis');
                const host =
                    configService.get<string>('PROXY_REDIS_HOST') ||
                    configService.get<string>('REDIS_HOST') ||
                    'localhost';
                const port =
                    parseInt(configService.get<string>('PROXY_REDIS_PORT') || '', 10) ||
                    configService.get<number>('REDIS_PORT') ||
                    6379;
                const password =
                    configService.get<string>('PROXY_REDIS_PASSWORD') ||
                    configService.get<string>('REDIS_PASSWORD') ||
                    undefined;
                const db =
                    parseInt(configService.get<string>('PROXY_REDIS_DB') || '', 10) ||
                    parseInt(configService.get<string>('REDIS_DB') || '', 10) ||
                    0;
                const client = new Redis({ host, port, password, db });
                client.on('error', (e) =>
                    log.warn(`proxy redis error: ${e?.message ?? e}`),
                );
                return client;
            },
            inject: [ConfigService],
        },
        RedisService,
    ],
    exports: ['REDIS_CLIENT', 'PROXY_REDIS_CLIENT', RedisService],
})
export class RedisModule { }
