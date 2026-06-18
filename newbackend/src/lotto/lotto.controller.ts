import { Controller, Post, Get, Body, Req, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LottoService, PlayLottoDto } from './lotto.service';

@Controller('originals/lotto')
@UseGuards(JwtAuthGuard)
export class LottoController {
  constructor(private readonly lottoService: LottoService) {}

  @Post('play')
  play(@Req() req: any, @Body() dto: PlayLottoDto) {
    return this.lottoService.play(req.user.id, dto);
  }

  @Get('history')
  history(@Req() req: any, @Query('limit') limit?: string) {
    return this.lottoService.getHistory(req.user.id, limit ? Number(limit) : 20);
  }
}
