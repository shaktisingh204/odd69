import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { SecurityTokenGuard } from './auth/security-token.guard';
import { HomeCategoryService } from './home-category.service';
import { CreateHomeCategoryDto } from './dto/create-home-category.dto';
import { UpdateHomeCategoryDto } from './dto/update-home-category.dto';

/**
 * Root-level HomeCategoryController (registered via HomeCategoryModule in app.module.ts).
 * All write/delete endpoints are secured with SecurityTokenGuard (X-Admin-Token).
 * Read endpoints are @Public so the frontend can fetch category config.
 */
@Controller('home-category')
export class HomeCategoryController {
  constructor(private readonly homeCategoryService: HomeCategoryService) {}

  @UseGuards(SecurityTokenGuard)
  @Post()
  create(@Body() createHomeCategoryDto: CreateHomeCategoryDto) {
    return this.homeCategoryService.create(createHomeCategoryDto);
  }

  @Public()
  @Get()
  findAll() {
    return this.homeCategoryService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.homeCategoryService.findOne(+id);
  }

  @UseGuards(SecurityTokenGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateHomeCategoryDto: UpdateHomeCategoryDto) {
    return this.homeCategoryService.update(+id, updateHomeCategoryDto);
  }

  @UseGuards(SecurityTokenGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.homeCategoryService.remove(+id);
  }
}
