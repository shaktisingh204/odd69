import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { Announcement, AnnouncementSchema } from './schemas/announcement.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Announcement.name, schema: AnnouncementSchema }]),
    ],
    controllers: [AnnouncementsController],
    providers: [AnnouncementsService],
})
export class AnnouncementsModule { }
