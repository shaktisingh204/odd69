import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AviatorGateway } from './aviator.gateway';
import { AviatorService } from './aviator.service';
import { AviatorRound, AviatorRoundSchema } from './schemas/aviator-round.schema';
import { AviatorBet, AviatorBetSchema } from './schemas/aviator-bet.schema';
import { BonusModule } from '../bonus/bonus.module';
import { OriginalsModule } from '../originals/originals.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => BonusModule),
    OriginalsModule,
    MongooseModule.forFeature([
      { name: AviatorRound.name, schema: AviatorRoundSchema },
      { name: AviatorBet.name,   schema: AviatorBetSchema },
    ]),
  ],
  providers: [AviatorGateway, AviatorService],
  exports: [AviatorService],
})
export class AviatorModule {}
