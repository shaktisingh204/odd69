import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Promotion, PromotionDocument } from './schemas/promotion.schema';

@Injectable()
export class PromotionsService {
    constructor(
        @InjectModel(Promotion.name) private promotionModel: Model<PromotionDocument>,
    ) { }

    async create(dto: any): Promise<Promotion> {
        const created = new this.promotionModel(dto);
        return created.save();
    }

    async findAll(onlyActive = false): Promise<Promotion[]> {
        const filter = onlyActive ? { isActive: true } : {};
        return this.promotionModel.find(filter).sort({ order: 1 }).exec();
    }

    async findByCategory(category: string, onlyActive = true): Promise<Promotion[]> {
        const filter: any = onlyActive ? { isActive: true } : {};
        if (category && category !== 'ALL') {
            filter.$or = [{ category }, { category: 'ALL' }];
        }
        return this.promotionModel.find(filter).sort({ order: 1 }).exec();
    }

    async findOne(id: string): Promise<Promotion> {
        return this.promotionModel.findById(id).exec();
    }

    async update(id: string, dto: any): Promise<Promotion> {
        return this.promotionModel
            .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
            .exec();
    }

    async findForApp(): Promise<Promotion[]> {
        return this.promotionModel
            .find({ isActive: true, showInApp: true })
            .sort({ order: 1 })
            .exec();
    }

    async remove(id: string): Promise<Promotion> {
        return this.promotionModel.findByIdAndDelete(id).exec();
    }
}
