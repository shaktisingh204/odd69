import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LottoService } from './lotto.service';
import { LottoController } from './lotto.controller';
import { OriginalsModule } from '../originals/originals.module';
import { BonusModule } from '../bonus/bonus.module';
import {
  LottoGame,
  LottoGameSchema,
} from '../originals/schemas/lotto-game.schema';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    MongooseModule.forFeature([
      { name: LottoGame.name, schema: LottoGameSchema },
    ]),
  ],
  controllers: [LottoController],
  providers: [LottoService],
  exports: [LottoService],
})
export class LottoModule {}
