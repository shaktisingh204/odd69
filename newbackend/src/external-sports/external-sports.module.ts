import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExternalSportsController } from './external-sports.controller';
import { TurnkeyReplicaController } from './turnkey-replica.controller';
import {
    OddsApiController,
    OddsSportsLegacyController,
    OddsEventsLegacyController,
} from './odds-api.controller';
import { OddsApiSyncService } from './odds-api-sync.service';
import { SportsModule } from '../sports/sports.module';

@Module({
    imports: [
        SportsModule,
        HttpModule.register({
            timeout: 15000,
            maxRedirects: 3,
        }),
    ],
    controllers: [
        ExternalSportsController,
        TurnkeyReplicaController,
        OddsApiController,
        OddsSportsLegacyController,   // handles GET /api/odds-sports
        OddsEventsLegacyController,   // handles GET /api/odds-events?sport=X
    ],
    providers: [OddsApiSyncService],
    exports: [OddsApiSyncService],
})
export class ExternalSportsModule { }
