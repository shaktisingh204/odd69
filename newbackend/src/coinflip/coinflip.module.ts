import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoinflipService } from './coinflip.service';
import { CoinflipController } from './coinflip.controller';
import { OriginalsModule } from '../originals/originals.module';
import { BonusModule } from '../bonus/bonus.module';
import {
  CoinflipGame,
  CoinflipGameSchema,
} from '../originals/schemas/coinflip-game.schema';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    MongooseModule.forFeature([
      { name: CoinflipGame.name, schema: CoinflipGameSchema },
    ]),
  ],
  controllers: [CoinflipController],
  providers: [CoinflipService],
  exports: [CoinflipService],
})
export class CoinflipModule {}
