import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TowersService } from './towers.service';
import { TowersController } from './towers.controller';
import { OriginalsModule } from '../originals/originals.module';
import { BonusModule } from '../bonus/bonus.module';
import {
  TowersGame,
  TowersGameSchema,
} from '../originals/schemas/towers-game.schema';

@Module({
  imports: [
    forwardRef(() => OriginalsModule),
    forwardRef(() => BonusModule),
    MongooseModule.forFeature([
      { name: TowersGame.name, schema: TowersGameSchema },
    ]),
  ],
  controllers: [TowersController],
  providers: [TowersService],
  exports: [TowersService],
})
export class TowersModule {}
