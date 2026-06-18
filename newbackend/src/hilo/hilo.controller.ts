import { Controller, Post, Get, Body, Req, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  HiloService,
  StartHiloDto,
  ActionHiloDto,
  CashoutHiloDto,
} from './hilo.service';

@Controller('originals/hilo')
@UseGuards(JwtAuthGuard)
export class HiloController {
  constructor(private readonly hiloService: HiloService) {}

  @Post('start')
  start(@Req() req: any, @Body() dto: StartHiloDto) {
    return this.hiloService.start(req.user.id, dto);
  }

  @Post('action')
  action(@Req() req: any, @Body() dto: ActionHiloDto) {
    return this.hiloService.action(req.user.id, dto);
  }

  @Post('cashout')
  cashout(@Req() req: any, @Body() dto: CashoutHiloDto) {
    return this.hiloService.cashout(req.user.id, dto);
  }

  @Get('active')
  active(@Req() req: any) {
    return this.hiloService.getActive(req.user.id);
  }

  @Get('history')
  history(@Req() req: any, @Query('limit') limit?: string) {
    return this.hiloService.getHistory(req.user.id, limit ? Number(limit) : 20);
  }
}
