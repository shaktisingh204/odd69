import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/conversations')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.findAll({
      status,
      channel,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('search')
  search(
    @Query('q') q?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('userId') userId?: string,
  ) {
    return this.conversationsService.search({
      q,
      dateFrom,
      dateTo,
      userId: userId ? parseInt(userId, 10) : undefined,
    });
  }

  @Get(':sessionId')
  findOne(@Param('sessionId') sessionId: string) {
    return this.conversationsService.findOne(sessionId);
  }

  @Get(':sessionId/messages')
  getMessages(
    @Param('sessionId') sessionId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.getMessages(
      sessionId,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post(':sessionId/takeover')
  takeover(
    @Param('sessionId') sessionId: string,
    @Body('adminId') adminId: number,
  ) {
    return this.conversationsService.takeover(sessionId, adminId);
  }

  @Post(':sessionId/release')
  release(@Param('sessionId') sessionId: string) {
    return this.conversationsService.release(sessionId);
  }

  @Post(':sessionId/close')
  close(@Param('sessionId') sessionId: string) {
    return this.conversationsService.close(sessionId);
  }

  @Post(':sessionId/tag')
  addTag(
    @Param('sessionId') sessionId: string,
    @Body('tag') tag: string,
  ) {
    return this.conversationsService.addTag(sessionId, tag);
  }

  @Delete(':sessionId/tag/:tag')
  removeTag(
    @Param('sessionId') sessionId: string,
    @Param('tag') tag: string,
  ) {
    return this.conversationsService.removeTag(sessionId, tag);
  }

  @Post('bulk-close')
  bulkClose(@Body('sessionIds') sessionIds: string[]) {
    return this.conversationsService.bulkClose(sessionIds);
  }

  @Post('bulk-tag')
  bulkTag(@Body() body: { sessionIds: string[]; tags: string[] }) {
    return this.conversationsService.bulkTag(body.sessionIds, body.tags);
  }
}
