import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { SecurityTokenGuard } from '../../auth/security-token.guard';
import { EventsGateway } from '../../events.gateway';
import { CreateMatchCashbackPromotionDto } from '../dto/create-match-cashback-promotion.dto';
import { SetPromotionTriggerDto } from '../dto/set-promotion-trigger.dto';
import { UpdateMatchCashbackPromotionDto } from '../dto/update-match-cashback-promotion.dto';
import { MatchCashbackPromotionsService } from '../services/match-cashback-promotions.service';

@Controller('admin/promotions')
@UseGuards(SecurityTokenGuard)
export class AdminMatchCashbackPromotionsController {
    constructor(
        private readonly promotionsService: MatchCashbackPromotionsService,
        private readonly eventsGateway: EventsGateway,
    ) { }

    @Post()
    async create(@Body() dto: CreateMatchCashbackPromotionDto) {
        return this.promotionsService.create(dto);
    }

    @Get()
    async findAll() {
        return this.promotionsService.findAll();
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateMatchCashbackPromotionDto) {
        return this.promotionsService.update(id, dto);
    }

    @Post(':id/toggle')
    async toggle(@Param('id') id: string, @Body() body: { isActive: boolean }) {
        return this.promotionsService.toggle(id, body.isActive);
    }

    @Post(':id/trigger-condition')
    async triggerCondition(@Param('id') id: string, @Body() dto: SetPromotionTriggerDto) {
        return this.promotionsService.setTriggerState(id, dto);
    }

    @Post('wallet-sync')
    async walletSync(@Body() body: { userIds?: Array<number | string> }) {
        const userIds = Array.isArray(body?.userIds) ? body.userIds : [];

        for (const userId of userIds) {
            this.eventsGateway.emitUserWalletUpdate(userId);
        }

        return {
            success: true,
            emitted: userIds.length,
        };
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.promotionsService.remove(id);
    }
}
