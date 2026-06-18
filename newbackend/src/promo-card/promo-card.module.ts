import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromoCardController } from './promo-card.controller';
import { PromoCardService } from './promo-card.service';
import { PromoCard, PromoCardSchema } from './schemas/promo-card.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PromoCard.name, schema: PromoCardSchema }]),
  ],
  controllers: [PromoCardController],
  providers: [PromoCardService]
})
export class PromoCardModule { }
