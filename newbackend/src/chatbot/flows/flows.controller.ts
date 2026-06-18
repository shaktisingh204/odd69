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
import { FlowsService } from './flows.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/flows')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  findAll() {
    return this.flowsService.findAll();
  }

  @Get('templates')
  getTemplates() {
    return this.flowsService.getTemplates();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.flowsService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.flowsService.create(data);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.flowsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.flowsService.remove(id);
  }

  @Post(':id/publish')
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.flowsService.publish(id);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id', ParseIntPipe) id: number) {
    return this.flowsService.unpublish(id);
  }

  @Get(':id/versions')
  getVersions(@Param('id', ParseIntPipe) id: number) {
    return this.flowsService.getVersions(id);
  }

  @Post(':id/restore/:versionId')
  restoreVersion(
    @Param('id', ParseIntPipe) flowId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.flowsService.restoreVersion(flowId, versionId);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id', ParseIntPipe) id: number) {
    return this.flowsService.duplicate(id);
  }

  @Post('from-template/:templateId')
  createFromTemplate(@Param('templateId', ParseIntPipe) templateId: number) {
    return this.flowsService.createFromTemplate(templateId);
  }
}
