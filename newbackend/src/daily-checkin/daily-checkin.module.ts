import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyCheckinController } from './daily-checkin.controller';
import { DailyCheckinService } from './daily-checkin.service';
import { DailyCheckinConfig, DailyCheckinConfigSchema } from './schemas/daily-checkin-config.schema';
import { DailyCheckinClaim, DailyCheckinClaimSchema } from './schemas/daily-checkin-claim.schema';
import { PrismaModule } from '../prisma.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: DailyCheckinConfig.name, schema: DailyCheckinConfigSchema },
            { name: DailyCheckinClaim.name, schema: DailyCheckinClaimSchema },
        ]),
        PrismaModule,
    ],
    controllers: [DailyCheckinController],
    providers: [DailyCheckinService],
    exports: [DailyCheckinService],
})
export class DailyCheckinModule {}
