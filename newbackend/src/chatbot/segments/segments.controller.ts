import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SegmentsService } from './segments.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/segments')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Get()
  findAll() {
    return this.segmentsService.findAll();
  }

  @Get('blacklist')
  getBlacklist() {
    return this.segmentsService.getBlacklist();
  }

  @Post('blacklist')
  addToBlacklist(@Body() body: { userId: number; reason?: string }) {
    return this.segmentsService.addToBlacklist(body.userId, body.reason);
  }

  @Delete('blacklist/:userId')
  removeFromBlacklist(@Param('userId', ParseIntPipe) userId: number) {
    return this.segmentsService.removeFromBlacklist(userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.segmentsService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.segmentsService.create(data);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.segmentsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.segmentsService.remove(id);
  }

  @Get(':id/users')
  previewUsers(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    return this.segmentsService.previewUsers(id, limit ? parseInt(limit, 10) : undefined);
  }
}
