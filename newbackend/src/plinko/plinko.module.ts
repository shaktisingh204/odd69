import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BonusModule } from '../bonus/bonus.module';
import { OriginalsModule } from '../originals/originals.module';
import { PlinkoService } from './plinko.service';
import { PlinkoGame, PlinkoGameSchema } from '../originals/schemas/plinko-game.schema';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    MongooseModule.forFeature([
      { name: PlinkoGame.name, schema: PlinkoGameSchema },
    ]),
  ],
  providers: [PlinkoService],
  exports: [PlinkoService],
})
export class PlinkoModule {}
