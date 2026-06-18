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
import { IntentsService } from './intents.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/intents')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class IntentsController {
  constructor(private readonly intentsService: IntentsService) {}

  @Get()
  findAll() {
    return this.intentsService.findAll();
  }

  @Get('categories')
  getCategories() {
    return this.intentsService.getCategories();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.intentsService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.intentsService.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.intentsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.intentsService.remove(id);
  }

  @Post(':id/phrases')
  addPhrase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { phrase: string; language?: string },
  ) {
    return this.intentsService.addPhrase(id, body.phrase, body.language);
  }

  @Delete(':id/phrases/:phraseId')
  removePhrase(@Param('phraseId', ParseIntPipe) phraseId: number) {
    return this.intentsService.removePhrase(phraseId);
  }

  @Post(':id/phrases/bulk')
  bulkAddPhrases(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { phrases: { phrase: string; language?: string }[] },
  ) {
    return this.intentsService.bulkAddPhrases(id, body.phrases);
  }

  @Patch(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.intentsService.toggle(id);
  }
}
