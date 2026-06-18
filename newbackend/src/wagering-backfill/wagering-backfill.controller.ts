import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { WageringBackfillService } from './wagering-backfill.service';

@Controller('admin/wagering-backfill')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
export class WageringBackfillController {
    constructor(private readonly backfillService: WageringBackfillService) { }

    /**
     * POST /admin/wagering-backfill/run
     * Manually trigger the wagering backfill for all users.
     * Useful to run once after deploying the casino fix to credit old bets.
     */
    @Post('run')
    async run() {
        const result = await this.backfillService.runBackfill();
        return {
            message: 'Wagering backfill complete',
            ...result,
        };
    }
}
