import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ColorService } from './color.service';
import { ColorController } from './color.controller';
import { OriginalsModule } from '../originals/originals.module';
import { BonusModule } from '../bonus/bonus.module';
import {
  ColorGame,
  ColorGameSchema,
} from '../originals/schemas/color-game.schema';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    MongooseModule.forFeature([
      { name: ColorGame.name, schema: ColorGameSchema },
    ]),
  ],
  controllers: [ColorController],
  providers: [ColorService],
  exports: [ColorService],
})
export class ColorModule {}
