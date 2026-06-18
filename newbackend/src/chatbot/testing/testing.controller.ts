import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TestingService } from './testing.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/testing')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class TestingController {
  constructor(private readonly testingService: TestingService) {}

  @Post('simulate')
  simulate(
    @Body() body: { message: string; sessionId?: string; userId?: number },
  ) {
    return this.testingService.simulate(
      body.message,
      body.sessionId,
      body.userId,
    );
  }

  @Post('simulate/reset')
  resetSimulation(@Body() body: { sessionId: string }) {
    return this.testingService.resetSimulation(body.sessionId);
  }

  @Post('match-intent')
  matchIntent(@Body() body: { input: string }) {
    return this.testingService.matchIntent(body.input);
  }

  @Post('extract-entities')
  extractEntities(@Body() body: { input: string }) {
    return this.testingService.extractEntities(body.input);
  }

  @Post('evaluate-rules')
  evaluateRules(@Body() body: { input: string }) {
    return this.testingService.evaluateRules(body.input);
  }

  @Post('render-template')
  renderTemplate(
    @Body() body: { templateId: number; data?: Record<string, any> },
  ) {
    return this.testingService.renderTemplate(body.templateId, body.data);
  }
}
