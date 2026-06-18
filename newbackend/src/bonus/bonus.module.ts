import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BonusService } from './bonus.service';
import { BonusController, BonusAdminController } from './bonus.controller';
import { Bonus, BonusSchema } from './schemas/bonus.schema';
import { Bet, BetSchema } from '../bets/schemas/bet.schema';
import { PendingDepositBonus, PendingDepositBonusSchema } from './schemas/pending-deposit-bonus.schema';
import { EventsModule } from '../events.module';
import { RedisModule } from '../redis/redis.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Bonus.name, schema: BonusSchema },
            { name: Bet.name, schema: BetSchema },
            { name: PendingDepositBonus.name, schema: PendingDepositBonusSchema },
        ]),
        forwardRef(() => EventsModule),
        RedisModule,
        EmailModule,
    ],
    controllers: [BonusController, BonusAdminController],
    providers: [BonusService],
    exports: [BonusService],
})
export class BonusModule { }

