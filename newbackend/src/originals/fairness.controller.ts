import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FairnessService } from './fairness.service';

@Controller('originals/fair')
@UseGuards(JwtAuthGuard)
export class FairnessController {
  constructor(private readonly fairnessService: FairnessService) {}

  private uid(req: any): number {
    return Number(req.user?.id ?? req.user?.userId);
  }

  /** Current provably-fair state (active hash, next hash, client seed, nonce, last revealed). */
  @Get('state')
  async getState(@Req() req: any) {
    return this.fairnessService.getState(this.uid(req));
  }

  /** Rotate the seed pair (reveals the retired server seed). Optional new client seed. */
  @Post('rotate')
  async rotate(@Req() req: any, @Body() body: any) {
    return this.fairnessService.rotate(this.uid(req), body?.clientSeed);
  }

  /** Set a new client seed without rotating the server seed. */
  @Post('client-seed')
  async setClientSeed(@Req() req: any, @Body() body: any) {
    return this.fairnessService.setClientSeed(this.uid(req), body?.clientSeed);
  }
}
