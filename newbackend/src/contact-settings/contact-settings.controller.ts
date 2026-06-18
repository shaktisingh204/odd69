import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ContactSettingsService } from './contact-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { Public } from '../auth/public.decorator';

@Controller('contact-settings')
export class ContactSettingsController {
    constructor(private readonly service: ContactSettingsService) { }

    /** Public endpoint — website reads this to build the contact cards */
    @Public()
    @Get()
    async get() {
        return this.service.get();
    }

    /** Admin-only update */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
    @Patch()
    async update(@Body() body: any) {
        return this.service.update(body);
    }
}
