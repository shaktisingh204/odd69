import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WheelService } from './wheel.service';
import { WheelController } from './wheel.controller';
import { OriginalsModule } from '../originals/originals.module';
import { BonusModule } from '../bonus/bonus.module';
import {
  WheelGame,
  WheelGameSchema,
} from '../originals/schemas/wheel-game.schema';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    MongooseModule.forFeature([
      { name: WheelGame.name, schema: WheelGameSchema },
    ]),
  ],
  controllers: [WheelController],
  providers: [WheelService],
  exports: [WheelService],
})
export class WheelModule {}
