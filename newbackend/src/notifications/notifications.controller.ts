import {
    Controller,
    Get,
    Patch,
    Param,
    UseGuards,
    ParseIntPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    /** GET /notifications/my/:userId — fetch all notifications for a user */
    @Get('my/:userId')
    async getMyNotifications(@Param('userId', ParseIntPipe) userId: number) {
        return this.notificationsService.getForUser(userId);
    }

    /** GET /notifications/unread-count/:userId — badge count */
    @Get('unread-count/:userId')
    async getUnreadCount(@Param('userId', ParseIntPipe) userId: number) {
        return this.notificationsService.getUnreadCount(userId);
    }

    /** PATCH /notifications/:id/read — mark one notification as read (MongoDB _id is string) */
    @Patch(':id/read')
    async markRead(@Param('id') id: string) {
        return this.notificationsService.markRead(id);
    }

    /** PATCH /notifications/mark-all-read/:userId — mark all as read */
    @Patch('mark-all-read/:userId')
    async markAllRead(@Param('userId', ParseIntPipe) userId: number) {
        return this.notificationsService.markAllRead(userId);
    }
}
