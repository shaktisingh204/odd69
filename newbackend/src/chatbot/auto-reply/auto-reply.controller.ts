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
import { AutoReplyService } from './auto-reply.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/auto-reply')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class AutoReplyController {
  constructor(private readonly autoReplyService: AutoReplyService) {}

  @Get()
  findAll() {
    return this.autoReplyService.findAll();
  }

  @Get('fallbacks')
  findFallbacks() {
    return this.autoReplyService.findFallbacks();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.autoReplyService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.autoReplyService.create(data);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.autoReplyService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.autoReplyService.remove(id);
  }

  @Patch(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.autoReplyService.toggle(id);
  }

  @Post('reorder')
  reorder(@Body() items: { id: number; priority: number }[]) {
    return this.autoReplyService.reorder(items);
  }

  @Post(':id/test')
  testRule(@Param('id', ParseIntPipe) id: number, @Body('input') input: string) {
    return this.autoReplyService.testRule(id, input);
  }
}
