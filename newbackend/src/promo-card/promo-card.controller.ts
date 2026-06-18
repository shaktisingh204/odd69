import { Controller, Get, Post, Body, Param, Delete, Put, Query, UseGuards } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PromoCardService } from './promo-card.service';
import { SecurityTokenGuard } from '../auth/security-token.guard';

@Controller('promo-cards')
export class PromoCardController {
    constructor(private readonly promoCardService: PromoCardService) { }

    @UseGuards(SecurityTokenGuard)
    @Post()
    create(@Body() createPromoCardDto: any) {
        return this.promoCardService.create(createPromoCardDto);
    }

    @Public()
    @Get()
    findAll(@Query('active') active: string) {
        const onlyActive = active === 'true';
        return this.promoCardService.findAll(onlyActive);
    }

    @Public()
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.promoCardService.findOne(id);
    }

    @UseGuards(SecurityTokenGuard)
    @Put(':id')
    update(@Param('id') id: string, @Body() updatePromoCardDto: any) {
        return this.promoCardService.update(id, updatePromoCardDto);
    }

    @UseGuards(SecurityTokenGuard)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.promoCardService.remove(id);
    }
}
