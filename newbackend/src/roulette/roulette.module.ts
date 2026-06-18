import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RouletteService } from './roulette.service';
import { RouletteController } from './roulette.controller';
import { OriginalsModule } from '../originals/originals.module';
import { BonusModule } from '../bonus/bonus.module';
import {
  RouletteGame,
  RouletteGameSchema,
} from '../originals/schemas/roulette-game.schema';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    MongooseModule.forFeature([
      { name: RouletteGame.name, schema: RouletteGameSchema },
    ]),
  ],
  controllers: [RouletteController],
  providers: [RouletteService],
  exports: [RouletteService],
})
export class RouletteModule {}
