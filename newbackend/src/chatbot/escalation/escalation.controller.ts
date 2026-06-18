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
import { EscalationService } from './escalation.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/escalation')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class EscalationController {
  constructor(private readonly escalationService: EscalationService) {}

  @Get('rules')
  findAll() {
    return this.escalationService.findAll();
  }

  @Get('rules/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.escalationService.findOne(id);
  }

  @Post('rules')
  create(@Body() data: any) {
    return this.escalationService.create(data);
  }

  @Patch('rules/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.escalationService.update(id, data);
  }

  @Delete('rules/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.escalationService.remove(id);
  }

  @Patch('rules/:id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.escalationService.toggle(id);
  }

  @Get('active')
  getActiveEscalations() {
    return this.escalationService.getActiveEscalations();
  }
}
