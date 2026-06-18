import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AbTestsService } from './ab-tests.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/ab-tests')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class AbTestsController {
  constructor(private readonly abTestsService: AbTestsService) {}

  @Get()
  findAll() {
    return this.abTestsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.abTestsService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.abTestsService.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.abTestsService.update(id, body);
  }

  @Post(':id/start')
  start(@Param('id', ParseIntPipe) id: number) {
    return this.abTestsService.start(id);
  }

  @Post(':id/stop')
  stop(@Param('id', ParseIntPipe) id: number) {
    return this.abTestsService.stop(id);
  }
}
