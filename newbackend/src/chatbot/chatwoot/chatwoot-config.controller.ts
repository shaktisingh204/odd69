import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { ChatwootService } from './chatwoot.service';
import { ChatwootSyncService } from './chatwoot-sync.service';

@Controller('chatbot/chatwoot')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class ChatwootConfigController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatwootService: ChatwootService,
    private readonly syncService: ChatwootSyncService,
  ) {}

  @Get('config')
  async getConfig() {
    const config = await this.prisma.chatwootConfig.findFirst();
    return config || {};
  }

  @Patch('config')
  async updateConfig(
    @Body()
    body: {
      instanceUrl?: string;
      apiToken?: string;
      accountId?: number;
      agentBotToken?: string;
      webhookSecret?: string;
      autoSyncUsers?: boolean;
      defaultInboxId?: number;
      isEnabled?: boolean;
    },
  ) {
    const existing = await this.prisma.chatwootConfig.findFirst();

    if (existing) {
      return this.prisma.chatwootConfig.update({
        where: { id: existing.id },
        data: body,
      });
    }

    // Create new config (requires mandatory fields)
    return this.prisma.chatwootConfig.create({
      data: {
        instanceUrl: body.instanceUrl || '',
        apiToken: body.apiToken || '',
        accountId: body.accountId || 0,
        agentBotToken: body.agentBotToken,
        webhookSecret: body.webhookSecret,
        autoSyncUsers: body.autoSyncUsers ?? false,
        defaultInboxId: body.defaultInboxId,
        isEnabled: body.isEnabled ?? true,
      },
    });
  }

  @Post('test-connection')
  async testConnection() {
    return this.chatwootService.testConnection();
  }

  @Post('sync-users')
  async syncUsers() {
    return this.syncService.bulkSyncUsers();
  }

  @Get('sync-status')
  async getSyncStatus() {
    return this.syncService.getSyncStatus();
  }
}
