import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SecurityTokenGuard } from '../../auth/security-token.guard';
import { SettleMatchDto } from '../dto/settle-match.dto';
import { MatchSettlementService } from '../services/match-settlement.service';

@Controller('match')
@UseGuards(SecurityTokenGuard)
export class MatchSettlementController {
    constructor(private readonly matchSettlementService: MatchSettlementService) { }

    @Post('settle')
    async settle(@Body() dto: SettleMatchDto) {
        return this.matchSettlementService.settleMatch(dto);
    }
}
