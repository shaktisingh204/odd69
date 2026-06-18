import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PromoCard, PromoCardDocument } from './schemas/promo-card.schema';

@Injectable()
export class PromoCardService {
    constructor(
        @InjectModel(PromoCard.name) private promoCardModel: Model<PromoCardDocument>,
    ) { }

    async create(createPromoCardDto: any): Promise<PromoCard> {
        const createdCard = new this.promoCardModel(createPromoCardDto);
        return createdCard.save();
    }

    async findAll(onlyActive: boolean = false): Promise<PromoCard[]> {
        const filter = onlyActive ? { isActive: true } : {};
        return this.promoCardModel.find(filter).sort({ order: 1 }).exec();
    }

    async findOne(id: string): Promise<PromoCard> {
        return this.promoCardModel.findById(id).exec();
    }

    async update(id: string, updatePromoCardDto: any): Promise<PromoCard> {
        return this.promoCardModel
            .findByIdAndUpdate(id, updatePromoCardDto, { returnDocument: 'after' })
            .exec();
    }

    async remove(id: string): Promise<PromoCard> {
        return this.promoCardModel.findByIdAndDelete(id).exec();
    }
}
