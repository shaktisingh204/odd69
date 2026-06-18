import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HiloService } from './hilo.service';
import { HiloController } from './hilo.controller';
import { OriginalsModule } from '../originals/originals.module';
import { BonusModule } from '../bonus/bonus.module';
import {
  HiloGame,
  HiloGameSchema,
} from '../originals/schemas/hilo-game.schema';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    MongooseModule.forFeature([{ name: HiloGame.name, schema: HiloGameSchema }]),
  ],
  controllers: [HiloController],
  providers: [HiloService],
  exports: [HiloService],
})
export class HiloModule {}
