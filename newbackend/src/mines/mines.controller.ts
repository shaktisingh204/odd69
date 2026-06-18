import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MinesService } from './mines.service';
import { StartMinesDto } from './dto/start-mines.dto';
import { RevealTileDto } from './dto/reveal-tile.dto';
import { CashoutDto } from './dto/cashout.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('mines')
export class MinesController {
  constructor(private readonly minesService: MinesService) {}

  @Post('start')
  startGame(@Req() req: any, @Body() dto: StartMinesDto) {
    return this.minesService.startGame(req.user.id, dto);
  }

  @Post('reveal')
  revealTile(@Req() req: any, @Body() dto: RevealTileDto) {
    return this.minesService.revealTile(req.user.id, dto);
  }

  @Post('cashout')
  cashout(@Req() req: any, @Body() dto: CashoutDto) {
    return this.minesService.cashout(req.user.id, dto);
  }

  @Get('active')
  getActiveGame(@Req() req: any) {
    return this.minesService.getActiveGame(req.user.id);
  }

  @Get('history')
  getHistory(@Req() req: any) {
    return this.minesService.getHistory(req.user.id);
  }
}
