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
import { ResponsesService } from './responses.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/responses')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class ResponsesController {
  constructor(private readonly responsesService: ResponsesService) {}

  @Get()
  findAll(
    @Query('intentId') intentId?: string,
    @Query('language') language?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.responsesService.findAll({
      intentId: intentId ? +intentId : undefined,
      language,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.responsesService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.responsesService.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.responsesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.responsesService.remove(id);
  }

  @Patch(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.responsesService.toggle(id);
  }

  @Post(':id/preview')
  preview(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, any>) {
    return this.responsesService.preview(id, body);
  }

  @Post('bulk')
  bulkUpsert(@Body() body: { templates: any[] }) {
    return this.responsesService.bulkUpsert(body.templates);
  }
}
