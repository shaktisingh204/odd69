import { Controller, Post, Get, Body, Req, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RouletteService, PlayRouletteDto } from './roulette.service';

@Controller('originals/roulette')
@UseGuards(JwtAuthGuard)
export class RouletteController {
  constructor(private readonly rouletteService: RouletteService) {}

  @Post('play')
  play(@Req() req: any, @Body() dto: PlayRouletteDto) {
    return this.rouletteService.play(req.user.id, dto);
  }

  @Get('history')
  history(@Req() req: any, @Query('limit') limit?: string) {
    return this.rouletteService.getHistory(
      req.user.id,
      limit ? Number(limit) : 20,
    );
  }
}
