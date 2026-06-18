import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JackpotService } from './jackpot.service';
import { JackpotController } from './jackpot.controller';
import { OriginalsModule } from '../originals/originals.module';
import { BonusModule } from '../bonus/bonus.module';
import {
  JackpotGame,
  JackpotGameSchema,
} from '../originals/schemas/jackpot-game.schema';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    MongooseModule.forFeature([
      { name: JackpotGame.name, schema: JackpotGameSchema },
    ]),
  ],
  controllers: [JackpotController],
  providers: [JackpotService],
  exports: [JackpotService],
})
export class JackpotModule {}
