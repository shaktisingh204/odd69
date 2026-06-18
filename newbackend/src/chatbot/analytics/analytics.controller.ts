import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/analytics')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboard() {
    return this.analyticsService.getDashboard();
  }

  @Get('conversations')
  getConversationVolume(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('granularity') granularity?: 'hour' | 'day' | 'week' | 'month',
  ) {
    return this.analyticsService.getConversationVolume(
      dateFrom,
      dateTo,
      granularity,
    );
  }

  @Get('intents')
  getIntentAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getIntentAnalytics(dateFrom, dateTo);
  }

  @Get('flows')
  getFlowAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getFlowAnalytics(dateFrom, dateTo);
  }

  @Get('satisfaction')
  getSatisfaction(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getSatisfaction(dateFrom, dateTo);
  }

  @Get('responses')
  getResponseAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getResponseAnalytics(dateFrom, dateTo);
  }

  @Get('escalations')
  getEscalationAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getEscalationAnalytics(dateFrom, dateTo);
  }

  @Get('resolution')
  getResolution(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getResolution(dateFrom, dateTo);
  }

  @Get('response-time')
  getResponseTime(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getResponseTime(dateFrom, dateTo);
  }

  @Get('export')
  exportData(
    @Query('type') type: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.exportData(type, dateFrom, dateTo);
  }
}
