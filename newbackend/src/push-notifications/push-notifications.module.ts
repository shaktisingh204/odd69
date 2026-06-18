import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PushNotificationsService } from './push-notifications.service';
import { PushNotificationsController } from './push-notifications.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushNotificationLog, PushNotificationLogSchema } from '../notifications/schemas/push-notification.schema';

@Module({
    imports: [
        NotificationsModule,
        MongooseModule.forFeature([
            { name: PushNotificationLog.name, schema: PushNotificationLogSchema },
        ]),
    ],
    controllers: [PushNotificationsController],
    providers: [PushNotificationsService],
})
export class PushNotificationsModule {}
