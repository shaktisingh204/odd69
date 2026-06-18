import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CasinoService } from './casino.service';
import { CasinoController } from './casino.controller';
import { UsersModule } from '../users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Casino, CasinoSchema } from './schemas/casino.schema';
import { CasinoGame, CasinoGameSchema } from './schemas/casino-game.schema';
import { CasinoProvider, CasinoProviderSchema } from './schemas/casino-provider.schema';
import { CasinoCategory, CasinoCategorySchema } from './schemas/casino-category.schema';
import { CasinoSectionGame, CasinoSectionGameSchema } from './schemas/casino-section-game.schema';
import { HuiduCryptoService } from './huidu-crypto.service';
import { HuiduApiService } from './huidu-api.service';
import { BonusModule } from '../bonus/bonus.module';

@Module({
  imports: [
    UsersModule,
    BonusModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: Casino.name, schema: CasinoSchema },
      { name: CasinoGame.name, schema: CasinoGameSchema },
      { name: CasinoProvider.name, schema: CasinoProviderSchema },
      { name: CasinoCategory.name, schema: CasinoCategorySchema },
      { name: CasinoSectionGame.name, schema: CasinoSectionGameSchema },
    ]),
  ],
  providers: [CasinoService, HuiduCryptoService, HuiduApiService],
  controllers: [CasinoController],
  exports: [HuiduCryptoService, HuiduApiService]
})
export class CasinoModule { }
