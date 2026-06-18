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
import { EntitiesService } from './entities.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/entities')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Get()
  findAll() {
    return this.entitiesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.entitiesService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.entitiesService.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.entitiesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.entitiesService.remove(id);
  }

  @Get(':id/synonyms')
  getSynonyms(@Param('id', ParseIntPipe) id: number) {
    return this.entitiesService.getSynonyms(id);
  }

  @Post(':id/synonyms')
  addSynonym(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { value: string; synonyms: string[] },
  ) {
    return this.entitiesService.addSynonym(id, body);
  }

  @Patch(':id/synonyms/:synId')
  updateSynonym(
    @Param('synId', ParseIntPipe) synId: number,
    @Body() body: { value?: string; synonyms?: string[] },
  ) {
    return this.entitiesService.updateSynonym(synId, body);
  }

  @Delete(':id/synonyms/:synId')
  removeSynonym(@Param('synId', ParseIntPipe) synId: number) {
    return this.entitiesService.removeSynonym(synId);
  }

  @Post('test')
  testExtraction(@Body() body: { text: string }) {
    return this.entitiesService.testExtraction(body.text);
  }
}
