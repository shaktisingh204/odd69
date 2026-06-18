import { Module } from '@nestjs/common';
import { SegmentsController } from './segments.controller';
import { SegmentsService } from './segments.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [SegmentsController],
  providers: [SegmentsService, PrismaService],
  exports: [SegmentsService],
})
export class SegmentsModule {}
