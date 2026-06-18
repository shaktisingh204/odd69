import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { Public } from '../auth/public.decorator';
import { SecurityTokenGuard } from '../auth/security-token.guard';

@Controller('promotions')
export class PromotionsController {
    constructor(private readonly promotionsService: PromotionsService) { }

    // ─── PUBLIC: Used by the /promotions frontend page ──────────────────────
    @Public()
    @Get('app-home')
    findForApp() {
        return this.promotionsService.findForApp();
    }

    @Public()
    @Get()
    findAll(
        @Query('active') active: string,
        @Query('category') category: string,
    ) {
        const onlyActive = active !== 'false';
        if (category && category !== 'ALL') {
            return this.promotionsService.findByCategory(category, onlyActive);
        }
        return this.promotionsService.findAll(onlyActive);
    }

    @Public()
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.promotionsService.findOne(id);
    }

    // ─── ADMIN: Protected by X-Admin-Token header ────────────────────────────
    @UseGuards(SecurityTokenGuard)
    @Post()
    create(@Body() dto: any) {
        return this.promotionsService.create(dto);
    }

    @UseGuards(SecurityTokenGuard)
    @Put(':id')
    update(@Param('id') id: string, @Body() dto: any) {
        return this.promotionsService.update(id, dto);
    }

    @UseGuards(SecurityTokenGuard)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.promotionsService.remove(id);
    }
}
