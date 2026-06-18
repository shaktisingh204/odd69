import { Controller, Post, Get, Body, Req, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JackpotService, PlayJackpotDto } from './jackpot.service';

@Controller('originals/jackpot')
@UseGuards(JwtAuthGuard)
export class JackpotController {
  constructor(private readonly jackpotService: JackpotService) {}

  @Post('play')
  play(@Req() req: any, @Body() dto: PlayJackpotDto) {
    return this.jackpotService.play(req.user.id, dto);
  }

  @Get('history')
  history(@Req() req: any, @Query('limit') limit?: string) {
    return this.jackpotService.getHistory(
      req.user.id,
      limit ? Number(limit) : 20,
    );
  }
}
