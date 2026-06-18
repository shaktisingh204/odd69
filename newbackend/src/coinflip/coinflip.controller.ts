import { Controller, Post, Get, Body, Req, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoinflipService, PlayCoinflipDto } from './coinflip.service';

@Controller('originals/coinflip')
@UseGuards(JwtAuthGuard)
export class CoinflipController {
  constructor(private readonly coinflipService: CoinflipService) {}

  @Post('play')
  play(@Req() req: any, @Body() dto: PlayCoinflipDto) {
    return this.coinflipService.play(req.user.id, dto);
  }

  @Get('history')
  history(@Req() req: any, @Query('limit') limit?: string) {
    return this.coinflipService.getHistory(
      req.user.id,
      limit ? Number(limit) : 20,
    );
  }
}
