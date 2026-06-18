import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SecurityTokenGuard } from '../auth/security-token.guard';
import { HomeCategoryService } from './home-category.service';
import { CreateHomeCategoryDto } from './dto/create-home-category.dto';
import { UpdateHomeCategoryDto } from './dto/update-home-category.dto';

@Controller('home-category')
export class HomeCategoryController {
    constructor(private readonly homeCategoryService: HomeCategoryService) { }

    @UseGuards(SecurityTokenGuard)
    @Post()
    create(@Body() createHomeCategoryDto: CreateHomeCategoryDto) {
        console.log('HomeCategory Create Called with:', JSON.stringify(createHomeCategoryDto));
        return this.homeCategoryService.create(createHomeCategoryDto);
    }

    @Public()
    @Get()
    findAll() {
        console.log('HomeCategory FindAll Called');
        return this.homeCategoryService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.homeCategoryService.findOne(id);
    }

    @UseGuards(SecurityTokenGuard)
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateHomeCategoryDto: UpdateHomeCategoryDto) {
        return this.homeCategoryService.update(id, updateHomeCategoryDto);
    }

    @UseGuards(SecurityTokenGuard)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.homeCategoryService.remove(id);
    }
}
