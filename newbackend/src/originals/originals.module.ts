import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OriginalsGateway } from './originals.gateway';
import { OriginalsAdminService } from './originals-admin.service';
import { OriginalsAdminController } from './originals-admin.controller';
import { OriginalsAccessController } from './originals-access.controller';
import { OriginalsPublicController } from './originals-public.controller';
import { GGRService } from './ggr.service';
import { MinesModule } from '../mines/mines.module';
import { DiceModule } from '../dice/dice.module';
import { PlinkoModule } from '../plinko/plinko.module';
import { EventsModule } from '../events.module';

// Schemas
import { MinesGame, MinesGameSchema } from './schemas/mines-game.schema';
import { OriginalsConfig, OriginalsConfigSchema } from './schemas/originals-config.schema';
import { OriginalsSession, OriginalsSessionSchema } from './schemas/originals-session.schema';
import { OriginalsGGRSnapshot, OriginalsGGRSnapshotSchema } from './schemas/originals-ggr-snapshot.schema';
import { OriginalsEngagementEvent, OriginalsEngagementEventSchema } from './schemas/originals-engagement-event.schema';
import { DiceGame, DiceGameSchema } from './schemas/dice-game.schema';
import { PlinkoGame, PlinkoGameSchema } from './schemas/plinko-game.schema';
import { KenoGame, KenoGameSchema } from './schemas/keno-game.schema';
import { HiloGame, HiloGameSchema } from './schemas/hilo-game.schema';
import { RouletteGame, RouletteGameSchema } from './schemas/roulette-game.schema';
import { WheelGame, WheelGameSchema } from './schemas/wheel-game.schema';
import { CoinflipGame, CoinflipGameSchema } from './schemas/coinflip-game.schema';
import { TowersGame, TowersGameSchema } from './schemas/towers-game.schema';
import { ColorGame, ColorGameSchema } from './schemas/color-game.schema';
import { LottoGame, LottoGameSchema } from './schemas/lotto-game.schema';
import { JackpotGame, JackpotGameSchema } from './schemas/jackpot-game.schema';

const MONGOOSE_FEATURES = MongooseModule.forFeature([
  { name: MinesGame.name,                schema: MinesGameSchema },
  { name: OriginalsConfig.name,          schema: OriginalsConfigSchema },
  { name: OriginalsSession.name,         schema: OriginalsSessionSchema },
  { name: OriginalsGGRSnapshot.name,     schema: OriginalsGGRSnapshotSchema },
  { name: OriginalsEngagementEvent.name, schema: OriginalsEngagementEventSchema },
  { name: DiceGame.name,                 schema: DiceGameSchema },
  { name: PlinkoGame.name,               schema: PlinkoGameSchema },
  { name: KenoGame.name,                 schema: KenoGameSchema },
  { name: HiloGame.name,                 schema: HiloGameSchema },
  { name: RouletteGame.name,             schema: RouletteGameSchema },
  { name: WheelGame.name,                schema: WheelGameSchema },
  { name: CoinflipGame.name,             schema: CoinflipGameSchema },
  { name: TowersGame.name,               schema: TowersGameSchema },
  { name: ColorGame.name,                schema: ColorGameSchema },
  { name: LottoGame.name,                schema: LottoGameSchema },
  { name: JackpotGame.name,              schema: JackpotGameSchema },
]);

@Module({
  imports: [
    MONGOOSE_FEATURES,
    forwardRef(() => MinesModule),
    forwardRef(() => DiceModule),
    forwardRef(() => PlinkoModule),
    forwardRef(() => EventsModule),
  ],
  controllers: [OriginalsAdminController, OriginalsAccessController, OriginalsPublicController],
  providers: [OriginalsGateway, OriginalsAdminService, GGRService],
  exports: [GGRService, OriginalsAdminService, MONGOOSE_FEATURES],
})
export class OriginalsModule {}
