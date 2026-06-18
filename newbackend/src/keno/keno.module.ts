import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KenoService } from './keno.service';
import { KenoController } from './keno.controller';
import { OriginalsModule } from '../originals/originals.module';
import { BonusModule } from '../bonus/bonus.module';
import {
  KenoGame,
  KenoGameSchema,
} from '../originals/schemas/keno-game.schema';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    MongooseModule.forFeature([{ name: KenoGame.name, schema: KenoGameSchema }]),
  ],
  controllers: [KenoController],
  providers: [KenoService],
  exports: [KenoService],
})
export class KenoModule {}
