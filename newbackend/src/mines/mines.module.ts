import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MinesController } from './mines.controller';
import { MinesService } from './mines.service';
import { OriginalsModule } from '../originals/originals.module';
import { MinesGame, MinesGameSchema } from '../originals/schemas/mines-game.schema';
import { BonusModule } from '../bonus/bonus.module';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    // MinesService needs to inject MinesGame model directly
    MongooseModule.forFeature([
      { name: MinesGame.name, schema: MinesGameSchema },
    ]),
  ],
  controllers: [MinesController],
  providers: [MinesService],
  exports: [MinesService],
})
export class MinesModule {}
