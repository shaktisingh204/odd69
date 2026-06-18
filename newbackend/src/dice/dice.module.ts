import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiceService } from './dice.service';
import { OriginalsModule } from '../originals/originals.module';
import { DiceGame, DiceGameSchema } from '../originals/schemas/dice-game.schema';
import { BonusModule } from '../bonus/bonus.module';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    MongooseModule.forFeature([
      { name: DiceGame.name, schema: DiceGameSchema },
    ]),
  ],
  providers: [DiceService],
  exports: [DiceService],
})
export class DiceModule {}
