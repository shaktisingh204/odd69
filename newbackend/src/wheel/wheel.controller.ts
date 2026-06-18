import { Controller, Post, Get, Body, Req, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WheelService, PlayWheelDto } from './wheel.service';

@Controller('originals/wheel')
@UseGuards(JwtAuthGuard)
export class WheelController {
  constructor(private readonly wheelService: WheelService) {}

  @Get('preview')
  preview(
    @Query('risk') risk: 'low' | 'medium' | 'high' = 'medium',
    @Query('segments') segments?: string,
  ) {
    const seg = Number(segments ?? 30);
    if (![10, 20, 30, 40, 50].includes(seg))
      throw new BadRequestException('Segments must be 10/20/30/40/50');
    if (!['low', 'medium', 'high'].includes(risk))
      throw new BadRequestException('Invalid risk');
    return this.wheelService.getWheelPreview(risk, seg as 10 | 20 | 30 | 40 | 50);
  }

  @Post('play')
  play(@Req() req: any, @Body() dto: PlayWheelDto) {
    return this.wheelService.play(req.user.id, dto);
  }

  @Get('history')
  history(@Req() req: any, @Query('limit') limit?: string) {
    return this.wheelService.getHistory(req.user.id, limit ? Number(limit) : 20);
  }
}
