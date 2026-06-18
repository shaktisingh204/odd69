import { OnModuleInit } from '@nestjs/common';
export declare class AnalyticsService implements OnModuleInit {
    private client;
    constructor();
    onModuleInit(): Promise<void>;
    logEvent(eventName: string, data: any): Promise<void>;
}
