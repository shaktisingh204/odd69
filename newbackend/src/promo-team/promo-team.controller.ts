import {
    Controller, Get, Post, Put, Delete,
    Param, Body, UseGuards,
} from '@nestjs/common';
import { PromoTeamService } from './promo-team.service';
import { SecurityTokenGuard } from '../auth/security-token.guard';
import { Public } from '../auth/public.decorator';

@Controller('promo-team')
export class PromoTeamController {
    constructor(private readonly promoTeamService: PromoTeamService) { }

    // ── PUBLIC ──────────────────────────────────────────────────────────────

    /** GET /promo-team/active — active promo team configs (website display) */
    @Public()
    @Get('active')
    findActivePublic() {
        return this.promoTeamService.findActivePublic();
    }

    // ── ADMIN (X-Admin-Token protected) ──────────────────────────────────────

    @UseGuards(SecurityTokenGuard)
    @Get()
    findAll() {
        return this.promoTeamService.findAll();
    }

    @UseGuards(SecurityTokenGuard)
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.promoTeamService.findOne(id);
    }

    @UseGuards(SecurityTokenGuard)
    @Post()
    create(@Body() dto: any) {
        return this.promoTeamService.create(dto);
    }

    @UseGuards(SecurityTokenGuard)
    @Put(':id')
    update(@Param('id') id: string, @Body() dto: any) {
        return this.promoTeamService.update(id, dto);
    }

    @UseGuards(SecurityTokenGuard)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.promoTeamService.remove(id);
    }
}
