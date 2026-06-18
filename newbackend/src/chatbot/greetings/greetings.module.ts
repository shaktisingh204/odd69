import { Module } from '@nestjs/common';
import { GreetingsController } from './greetings.controller';
import { GreetingsService } from './greetings.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [GreetingsController],
  providers: [GreetingsService, PrismaService],
  exports: [GreetingsService],
})
export class GreetingsModule {}
