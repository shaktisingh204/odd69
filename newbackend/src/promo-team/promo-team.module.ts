import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromoTeam, PromoTeamSchema } from './schemas/promo-team.schema';
import { PromoTeamService } from './promo-team.service';
import { PromoTeamController } from './promo-team.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: PromoTeam.name, schema: PromoTeamSchema },
        ]),
    ],
    providers: [PromoTeamService],
    controllers: [PromoTeamController],
    exports: [PromoTeamService],
})
export class PromoTeamModule { }
