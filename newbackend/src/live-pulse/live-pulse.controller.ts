import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { LivePulseService } from './live-pulse.service';
import { Public } from '../auth/public.decorator';
import { SecurityTokenGuard } from '../auth/security-token.guard';

@Controller('live-pulse')
export class LivePulseController {
  constructor(private readonly livePulseService: LivePulseService) {}

  @Public()
  @Get()
  getLivePulse() {
    return this.livePulseService.getLivePulse();
  }

  @UseGuards(SecurityTokenGuard)
  @Post('reset-jackpot')
  resetJackpot(@Body() body: { amount: number }) {
    return this.livePulseService.resetJackpot(body.amount);
  }
}
