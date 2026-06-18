import { Controller, Post, Get, Body, Req, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KenoService, PlayKenoDto } from './keno.service';

@Controller('originals/keno')
@UseGuards(JwtAuthGuard)
export class KenoController {
  constructor(private readonly kenoService: KenoService) {}

  @Post('play')
  async play(@Req() req: any, @Body() dto: PlayKenoDto) {
    return this.kenoService.play(req.user.id, dto);
  }

  @Get('history')
  async history(@Req() req: any, @Query('limit') limit?: string) {
    return this.kenoService.getHistory(req.user.id, limit ? Number(limit) : 20);
  }
}
