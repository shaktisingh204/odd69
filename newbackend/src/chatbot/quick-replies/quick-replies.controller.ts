import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { QuickRepliesService } from './quick-replies.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/quick-replies')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class QuickRepliesController {
  constructor(private readonly quickRepliesService: QuickRepliesService) {}

  @Get()
  findAll() {
    return this.quickRepliesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.quickRepliesService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.quickRepliesService.create(data);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.quickRepliesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.quickRepliesService.remove(id);
  }

  @Post(':setId/replies')
  addReply(@Param('setId', ParseIntPipe) setId: number, @Body() data: any) {
    return this.quickRepliesService.addReply(setId, data);
  }

  @Patch(':setId/replies/:replyId')
  updateReply(
    @Param('setId', ParseIntPipe) setId: number,
    @Param('replyId', ParseIntPipe) replyId: number,
    @Body() data: any,
  ) {
    return this.quickRepliesService.updateReply(replyId, data);
  }

  @Delete(':setId/replies/:replyId')
  removeReply(
    @Param('setId', ParseIntPipe) setId: number,
    @Param('replyId', ParseIntPipe) replyId: number,
  ) {
    return this.quickRepliesService.removeReply(replyId);
  }
}
