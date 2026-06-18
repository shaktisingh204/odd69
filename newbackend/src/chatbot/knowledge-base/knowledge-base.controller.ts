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
import { KnowledgeBaseService } from './knowledge-base.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('chatbot/kb')
@UseGuards(RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  // ─── Categories ──────────────────────────────────────────────────────

  @Get('categories')
  findAllCategories() {
    return this.kbService.findAllCategories();
  }

  @Post('categories')
  createCategory(@Body() body: { name: string; slug: string; description?: string; parentId?: number; sortOrder?: number }) {
    return this.kbService.createCategory(body);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.kbService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.kbService.removeCategory(id);
  }

  // ─── Articles ────────────────────────────────────────────────────────

  @Get('articles')
  findAllArticles(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.kbService.findAllArticles({
      categoryId: categoryId ? +categoryId : undefined,
      search,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('articles/:id')
  findOneArticle(@Param('id', ParseIntPipe) id: number) {
    return this.kbService.findOneArticle(id);
  }

  @Post('articles')
  createArticle(@Body() body: any) {
    return this.kbService.createArticle(body);
  }

  @Patch('articles/:id')
  updateArticle(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.kbService.updateArticle(id, body);
  }

  @Delete('articles/:id')
  removeArticle(@Param('id', ParseIntPipe) id: number) {
    return this.kbService.removeArticle(id);
  }

  // ─── Versions ────────────────────────────────────────────────────────

  @Get('articles/:id/versions')
  getArticleVersions(@Param('id', ParseIntPipe) id: number) {
    return this.kbService.getArticleVersions(id);
  }

  @Post('articles/:id/restore/:versionId')
  restoreArticleVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.kbService.restoreArticleVersion(id, versionId);
  }

  // ─── Search / Import / Export ────────────────────────────────────────

  @Get('search')
  searchArticles(@Query('q') q: string) {
    return this.kbService.searchArticles(q);
  }

  @Post('import')
  importArticles(@Body() body: any[]) {
    return this.kbService.importArticles(body);
  }

  @Get('export')
  exportArticles() {
    return this.kbService.exportArticles();
  }
}
