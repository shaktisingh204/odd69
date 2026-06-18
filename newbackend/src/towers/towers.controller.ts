import { Controller, Post, Get, Body, Req, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  TowersService,
  StartTowersDto,
  PickTowersDto,
  CashoutTowersDto,
} from './towers.service';

@Controller('originals/towers')
@UseGuards(JwtAuthGuard)
export class TowersController {
  constructor(private readonly towersService: TowersService) {}

  @Post('start')
  start(@Req() req: any, @Body() dto: StartTowersDto) {
    return this.towersService.start(req.user.id, dto);
  }

  @Post('pick')
  pick(@Req() req: any, @Body() dto: PickTowersDto) {
    return this.towersService.pick(req.user.id, dto);
  }

  @Post('cashout')
  cashout(@Req() req: any, @Body() dto: CashoutTowersDto) {
    return this.towersService.cashout(req.user.id, dto);
  }

  @Get('active')
  active(@Req() req: any) {
    return this.towersService.getActive(req.user.id);
  }

  @Get('history')
  history(@Req() req: any, @Query('limit') limit?: string) {
    return this.towersService.getHistory(
      req.user.id,
      limit ? Number(limit) : 20,
    );
  }
}
