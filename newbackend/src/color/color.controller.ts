import { Controller, Post, Get, Body, Req, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ColorService, PlayColorDto } from './color.service';

@Controller('originals/color')
@UseGuards(JwtAuthGuard)
export class ColorController {
  constructor(private readonly colorService: ColorService) {}

  @Post('play')
  play(@Req() req: any, @Body() dto: PlayColorDto) {
    return this.colorService.play(req.user.id, dto);
  }

  @Get('history')
  history(@Req() req: any, @Query('limit') limit?: string) {
    return this.colorService.getHistory(req.user.id, limit ? Number(limit) : 20);
  }
}
