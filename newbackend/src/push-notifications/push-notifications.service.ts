import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushNotificationLog, PushNotificationDocument } from '../notifications/schemas/push-notification.schema';

const ONESIGNAL_CONFIG_KEY = 'ONESIGNAL_CONFIG';

export interface OneSignalConfig {
    appId: string;
    restApiKey: string;
}

interface SendPushDto {
    title: string;
    body: string;
    imageUrl?: string;
    deepLink?: string;
    segment?: string;
    userIds?: number[];
    sentBy: number;
}

@Injectable()
export class PushNotificationsService {
    private readonly logger = new Logger(PushNotificationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly notificationsService: NotificationsService,
        @InjectModel(PushNotificationLog.name)
        private readonly pushLogModel: Model<PushNotificationDocument>,
    ) {}

    // ─── Config management (stored in SystemConfig / PostgreSQL) ───

    async getConfig(): Promise<OneSignalConfig> {
        try {
            const record = await this.prisma.systemConfig.findUnique({
                where: { key: ONESIGNAL_CONFIG_KEY },
            });
            if (record?.value) {
                const parsed = JSON.parse(record.value);
                if (parsed.appId && parsed.restApiKey) return parsed;
            }
        } catch {}
        return {
            appId: this.configService.get<string>('ONESIGNAL_APP_ID', ''),
            restApiKey: this.configService.get<string>('ONESIGNAL_REST_API_KEY', ''),
        };
    }

    async updateConfig(dto: Partial<OneSignalConfig>): Promise<OneSignalConfig> {
        const current = await this.getConfig();
        const merged = { ...current, ...dto };
        await this.prisma.systemConfig.upsert({
            where: { key: ONESIGNAL_CONFIG_KEY },
            update: { value: JSON.stringify(merged) },
            create: { key: ONESIGNAL_CONFIG_KEY, value: JSON.stringify(merged) },
        });
        this.logger.log('OneSignal config updated');
        return merged;
    }

    // ─── Device registration (PostgreSQL) ────────────────────

    async registerDevice(userId: number, playerId: string) {
        await (this.prisma.user as any).update({
            where: { id: userId },
            data: { onesignalPlayerId: playerId },
        });
        this.logger.log(`Registered OneSignal player ${playerId} for user ${userId}`);
        return { success: true };
    }

    // ─── Send push ──────────────────────────────────────────

    async sendPush(dto: SendPushDto) {
        const { title, body, imageUrl, deepLink, segment, userIds, sentBy } = dto;
        const config = await this.getConfig();

        // 1. Resolve target users
        const targetUsers = await this.resolveTargetUsers(segment, userIds);
        const playerIds = targetUsers
            .filter((u: any) => u.onesignalPlayerId)
            .map((u: any) => u.onesignalPlayerId as string);
        const targetUserIds = targetUsers.map((u: any) => u.id);

        // 2. Send via OneSignal REST API
        let onesignalId: string | undefined;
        if (playerIds.length > 0 && config.appId && config.restApiKey) {
            try {
                onesignalId = await this.callOneSignalApi(config, title, body, imageUrl, deepLink, playerIds);
            } catch (err) {
                this.logger.error(`OneSignal API call failed: ${err.message}`);
            }
        } else if (!config.appId || !config.restApiKey) {
            this.logger.warn('OneSignal credentials not configured — skipping push delivery');
        }

        // 3. Create in-app notifications (MongoDB)
        const notifPromises = targetUserIds.map((uid: number) =>
            this.notificationsService.create({ userId: uid, title, body, deepLink }).catch(err =>
                this.logger.error(`Failed to create notification for user ${uid}: ${err.message}`),
            ),
        );
        await Promise.allSettled(notifPromises);

        // 4. Save PushNotification audit record (MongoDB)
        const pushRecord = await this.pushLogModel.create({
            title,
            body,
            imageUrl: imageUrl || undefined,
            deepLink: deepLink || undefined,
            segment: segment || 'ALL',
            targetUserIds,
            sentBy,
            sentCount: targetUserIds.length,
            onesignalId: onesignalId || undefined,
        });

        this.logger.log(`Push sent: "${title}" to ${targetUserIds.length} users (${playerIds.length} devices)`);

        return {
            success: true,
            id: pushRecord._id?.toString(),
            sentCount: targetUserIds.length,
            deliveredToDevices: playerIds.length,
            onesignalId,
        };
    }

    async getPushHistory(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [records, total] = await Promise.all([
            this.pushLogModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            this.pushLogModel.countDocuments(),
        ]);
        return {
            records,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    // ─── Private helpers ──────────────────────────────────────

    private async resolveTargetUsers(segment?: string, userIds?: number[]) {
        if (userIds && userIds.length > 0) {
            return (this.prisma.user as any).findMany({ where: { id: { in: userIds } } });
        }

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        let where: any = {};
        switch (segment) {
            case 'VIP':     where = { balance: { gte: 100000 } }; break;
            case 'NEW':     where = { createdAt: { gte: sevenDaysAgo } }; break;
            case 'ACTIVE':  where = { updatedAt: { gte: sevenDaysAgo } }; break;
            case 'CHURNED': where = { updatedAt: { lt: thirtyDaysAgo } }; break;
            default:        where = {}; break;
        }

        return (this.prisma.user as any).findMany({ where });
    }

    private async callOneSignalApi(
        config: OneSignalConfig, title: string, body: string,
        imageUrl?: string, deepLink?: string, playerIds?: string[],
    ): Promise<string | undefined> {
        const payload: any = {
            app_id: config.appId,
            headings: { en: title },
            contents: { en: body },
            include_subscription_ids: playerIds,
        };
        if (imageUrl) { payload.big_picture = imageUrl; payload.ios_attachments = { id: imageUrl }; }
        if (deepLink) { payload.url = deepLink; payload.data = { deepLink }; }

        const response = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${config.restApiKey}` },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`OneSignal API ${response.status}: ${errBody}`);
        }
        return (await response.json()).id;
    }
}
