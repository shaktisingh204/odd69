import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { Promotion, PromotionSchema } from './schemas/promotion.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Promotion.name, schema: PromotionSchema }]),
    ],
    controllers: [PromotionsController],
    providers: [PromotionsService],
})
export class PromotionsModule { }
