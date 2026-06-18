import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { MatchCashbackPromotionsService } from '../services/match-cashback-promotions.service';

@Public()
@Controller('match-cashback/promotions')
export class PublicMatchCashbackPromotionsController {
    constructor(private readonly promotionsService: MatchCashbackPromotionsService) { }

    @Get('active')
    async findActive() {
        return this.promotionsService.findActivePublic();
    }
}
