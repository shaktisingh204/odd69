import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { LimboGateway } from './limbo.gateway';
import { LimboService } from './limbo.service';
import { LimboBet, LimboBetSchema } from './schemas/limbo-bet.schema';
import { LimboRound, LimboRoundSchema } from './schemas/limbo-round.schema';
import { BonusModule } from '../bonus/bonus.module';
import { OriginalsModule } from '../originals/originals.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => BonusModule),
    OriginalsModule,
    MongooseModule.forFeature([
      { name: LimboRound.name, schema: LimboRoundSchema },
      { name: LimboBet.name, schema: LimboBetSchema },
    ]),
  ],
  providers: [LimboGateway, LimboService],
  exports: [LimboService],
})
export class LimboModule {}
