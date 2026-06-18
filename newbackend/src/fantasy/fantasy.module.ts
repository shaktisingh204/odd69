import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FantasyController } from './fantasy.controller';
import { FantasyService } from './fantasy.service';
import { FantasyExtrasService } from './fantasy-extras.service';

import { FantasyMatch, FantasyMatchSchema } from './schemas/fantasy-match.schema';
import { FantasyContest, FantasyContestSchema } from './schemas/fantasy-contest.schema';
import { FantasyTeam, FantasyTeamSchema } from './schemas/fantasy-team.schema';
import { FantasyEntry, FantasyEntrySchema } from './schemas/fantasy-entry.schema';
import { FantasyPointsSystem, FantasyPointsSystemSchema } from './schemas/fantasy-points-system.schema';

import { FantasyConfig, FantasyConfigSchema } from './schemas/fantasy-config.schema';
import { FantasyPromocode, FantasyPromocodeSchema, FantasyPromoUsage, FantasyPromoUsageSchema } from './schemas/fantasy-promocode.schema';
import { FantasyStreak, FantasyStreakSchema, FantasyStreakReward, FantasyStreakRewardSchema } from './schemas/fantasy-streak.schema';
import { FantasyContestTemplate, FantasyContestTemplateSchema } from './schemas/fantasy-contest-template.schema';
import { FantasyPowerup, FantasyPowerupSchema } from './schemas/fantasy-powerup.schema';
import { FantasyPlayerCreditOverride, FantasyPlayerCreditOverrideSchema } from './schemas/fantasy-player-credit-override.schema';
import { FantasyNotification, FantasyNotificationSchema } from './schemas/fantasy-notification.schema';
import { FantasyActivityLog, FantasyActivityLogSchema } from './schemas/fantasy-activity-log.schema';
import { FantasyBonusRule, FantasyBonusRuleSchema } from './schemas/fantasy-bonus-rule.schema';
import { FantasyReferral, FantasyReferralSchema } from './schemas/fantasy-referral.schema';
import { FantasyCompetition, FantasyCompetitionSchema } from './schemas/fantasy-competition.schema';
import { FantasyPlayerImage, FantasyPlayerImageSchema } from './schemas/fantasy-player-image.schema';

import { PrismaModule } from '../prisma.module';
import { EventsModule } from '../events.module';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FantasyMatch.name,        schema: FantasyMatchSchema },
      { name: FantasyContest.name,      schema: FantasyContestSchema },
      { name: FantasyTeam.name,         schema: FantasyTeamSchema },
      { name: FantasyEntry.name,        schema: FantasyEntrySchema },
      { name: FantasyPointsSystem.name, schema: FantasyPointsSystemSchema },

      { name: FantasyConfig.name,                 schema: FantasyConfigSchema },
      { name: FantasyPromocode.name,              schema: FantasyPromocodeSchema },
      { name: FantasyPromoUsage.name,             schema: FantasyPromoUsageSchema },
      { name: FantasyStreak.name,                 schema: FantasyStreakSchema },
      { name: FantasyStreakReward.name,           schema: FantasyStreakRewardSchema },
      { name: FantasyContestTemplate.name,        schema: FantasyContestTemplateSchema },
      { name: FantasyPowerup.name,                schema: FantasyPowerupSchema },
      { name: FantasyPlayerCreditOverride.name,   schema: FantasyPlayerCreditOverrideSchema },
      { name: FantasyNotification.name,           schema: FantasyNotificationSchema },
      { name: FantasyActivityLog.name,            schema: FantasyActivityLogSchema },
      { name: FantasyBonusRule.name,              schema: FantasyBonusRuleSchema },
      { name: FantasyReferral.name,               schema: FantasyReferralSchema },
      { name: FantasyCompetition.name,            schema: FantasyCompetitionSchema },
      { name: FantasyPlayerImage.name,            schema: FantasyPlayerImageSchema },
    ]),
    PrismaModule,
    EventsModule,
    ReferralModule,
  ],
  controllers: [FantasyController],
  providers: [FantasyService, FantasyExtrasService],
  exports: [FantasyService, FantasyExtrasService],
})
export class FantasyModule {}
