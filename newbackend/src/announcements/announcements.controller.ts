import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { Public } from '../auth/public.decorator';
import { SecurityTokenGuard } from '../auth/security-token.guard';

@Controller('announcements')
export class AnnouncementsController {
    constructor(private readonly announcementsService: AnnouncementsService) { }

    // ─── PUBLIC: Used by the frontend to show site-wide banners ─────────────
    @Public()
    @Get()
    findAll(@Query('active') active: string) {
        const onlyActive = active !== 'false';
        return this.announcementsService.findAll(onlyActive);
    }

    @Public()
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.announcementsService.findOne(id);
    }

    // ─── ADMIN: Protected by X-Admin-Token header ────────────────────────────
    @UseGuards(SecurityTokenGuard)
    @Post()
    create(@Body() dto: any) {
        return this.announcementsService.create(dto);
    }

    @UseGuards(SecurityTokenGuard)
    @Put(':id')
    update(@Param('id') id: string, @Body() dto: any) {
        return this.announcementsService.update(id, dto);
    }

    @UseGuards(SecurityTokenGuard)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.announcementsService.remove(id);
    }
}
