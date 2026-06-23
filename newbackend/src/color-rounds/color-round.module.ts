import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ColorRoundGateway } from './color-round.gateway';
import { ColorRoundService } from './color-round.service';
import { ColorRound, ColorRoundSchema } from './schemas/color-round.schema';
import { ColorBet, ColorBetSchema } from './schemas/color-bet.schema';
import { BonusModule } from '../bonus/bonus.module';
import { OriginalsModule } from '../originals/originals.module';
import { EventsModule } from '../events.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => BonusModule),
    forwardRef(() => OriginalsModule),
    forwardRef(() => EventsModule),
    MongooseModule.forFeature([
      { name: ColorRound.name, schema: ColorRoundSchema },
      { name: ColorBet.name, schema: ColorBetSchema },
    ]),
  ],
  providers: [ColorRoundGateway, ColorRoundService],
  exports: [ColorRoundService],
})
export class ColorRoundModule {}
