import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsGateway } from './events.gateway';
import { EventsModule } from './events.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth.module';
import { SportsModule } from './sports/sports.module';
import { PrismaModule } from './prisma.module';
import { CasinoModule } from './casino/casino.module';
import { UsersModule } from './users/users.module';
import { BetsModule } from './bets/bets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { RedisModule } from './redis/redis.module';
import { PromoCardModule } from './promo-card/promo-card.module';
import { UploadModule } from './upload/upload.module';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { HomeCategoryModule } from './home-category.module';
import { ReferralModule } from './referral/referral.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BonusModule } from './bonus/bonus.module';
import { RiskModule } from './risk/risk.module';
import { FinanceModule } from './finance/finance.module';
import { CrmModule } from './crm/crm.module';
import { AgentModule } from './agents/agent.module';
import { SupportModule } from './support/support.module';
import { HealthModule } from './health/health.module';
import { PaymentModule } from './payment/payment.module';
import { Payment1Module } from './payment1/payment1.module';
import { Payment2Module } from './payment2/payment2.module';
import { Payment0Module } from './payment0/payment0.module';
import { Payment3Module } from './payment3/payment3.module';
import { Payment4Module } from './payment4/payment4.module';
import { Payment5Module } from './payment5/payment5.module';
import { Payment6Module } from './payment6/payment6.module';
import { Payment7Module } from './payment7/payment7.module';
import { Payment9Module } from './payment9/payment9.module';
import { SportradarProxyModule } from './sportradar-proxy/sportradar-proxy.module';
import { VipModule } from './vip/vip.module';
import { PromotionsModule } from './promotions/promotions.module';

import { NowpaymentsModule } from './nowpayments/nowpayments.module';

import { ContactSettingsModule } from './contact-settings/contact-settings.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { WageringBackfillModule } from './wagering-backfill/wagering-backfill.module';
import { MinesModule } from './mines/mines.module';
import { OriginalsModule } from './originals/originals.module';
import { AviatorModule } from './aviator/aviator.module';
import { LimboModule } from './limbo/limbo.module';
import { KenoModule } from './keno/keno.module';
import { HiloModule } from './hilo/hilo.module';
import { RouletteModule } from './roulette/roulette.module';
import { WheelModule } from './wheel/wheel.module';
import { CoinflipModule } from './coinflip/coinflip.module';
import { TowersModule } from './towers/towers.module';
import { ColorModule } from './color/color.module';
import { LottoModule } from './lotto/lotto.module';
import { JackpotModule } from './jackpot/jackpot.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';
import { LivePulseModule } from './live-pulse/live-pulse.module';
import { ManualDepositModule } from './manual-deposit/manual-deposit.module';
import { PromoTeamModule } from './promo-team/promo-team.module';
import { MatchCashbackModule } from './match-cashback/match-cashback.module';
import { FaqModule } from './faq/faq.module';
import { ExternalSportsModule } from './external-sports/external-sports.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { DailyCheckinModule } from './daily-checkin/daily-checkin.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { FantasyModule } from './fantasy/fantasy.module';

import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    PrismaModule,
    MaintenanceModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', 'uploads'), // Serve files from 'uploads' folder
        serveRoot: '/uploads', // Access via https://kuberexchange/api/uploads/filename.jpg
      },
      {
        rootPath: join(__dirname, '..', 'uploads'), // Serve files from 'uploads' folder
        serveRoot: '/api/uploads', // Access via https://kuberexchange/api/api/uploads/filename.jpg
      },
    ),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    AnalyticsModule,
    AuthModule,
    SportsModule,
    CasinoModule,
    UsersModule,
    EventsModule,
    BetsModule,
    TransactionsModule,
    RedisModule,
    PromoCardModule,
    UploadModule,
    HomeCategoryModule,
    ReferralModule,
    DashboardModule,
    BonusModule,
    RiskModule,
    FinanceModule,
    FinanceModule,
    CrmModule,
    AgentModule,
    SupportModule,
    HealthModule,
    PaymentModule,
    Payment1Module,
    Payment2Module,
    Payment0Module,
    Payment3Module,
    Payment4Module,
    Payment5Module,
    Payment6Module,
    Payment7Module,
    Payment9Module,
    SportradarProxyModule,
    VipModule,
    PromotionsModule,
    AnnouncementsModule,

    NowpaymentsModule,
    ContactSettingsModule,
    WageringBackfillModule,
    MinesModule,
    OriginalsModule,
    AviatorModule,
    LimboModule,
    KenoModule,
    HiloModule,
    RouletteModule,
    WheelModule,
    CoinflipModule,
    TowersModule,
    ColorModule,
    LottoModule,
    JackpotModule,
    NotificationsModule,
    PushNotificationsModule,
    LivePulseModule,
    ManualDepositModule,
    PromoTeamModule,
    MatchCashbackModule,
    FaqModule,
    ExternalSportsModule,
    DailyCheckinModule,
    ChatbotModule,
    FantasyModule,
  ],

  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
