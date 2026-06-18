import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Announcement, AnnouncementDocument } from './schemas/announcement.schema';

@Injectable()
export class AnnouncementsService {
    constructor(
        @InjectModel(Announcement.name) private announcementModel: Model<AnnouncementDocument>,
    ) { }

    async create(dto: any): Promise<Announcement> {
        const created = new this.announcementModel(dto);
        return created.save();
    }

    async findAll(onlyActive = false): Promise<Announcement[]> {
        const now = new Date();
        const filter: any = {};
        if (onlyActive) {
            filter.isActive = true;
            filter.$or = [
                { startAt: { $exists: false } },
                { startAt: null },
                { startAt: { $lte: now } },
            ];
            filter.$and = [
                {
                    $or: [
                        { endAt: { $exists: false } },
                        { endAt: null },
                        { endAt: { $gte: now } },
                    ],
                },
            ];
        }
        return this.announcementModel
            .find(filter)
            .sort({ isPinned: -1, order: 1 })
            .exec();
    }

    async findOne(id: string): Promise<Announcement> {
        return this.announcementModel.findById(id).exec();
    }

    async update(id: string, dto: any): Promise<Announcement> {
        return this.announcementModel
            .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
            .exec();
    }

    async remove(id: string): Promise<Announcement> {
        return this.announcementModel.findByIdAndDelete(id).exec();
    }
}
