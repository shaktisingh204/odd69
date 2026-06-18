import { Module } from '@nestjs/common';
import { AbTestsController } from './ab-tests.controller';
import { AbTestsService } from './ab-tests.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [AbTestsController],
  providers: [AbTestsService, PrismaService],
  exports: [AbTestsService],
})
export class AbTestsModule {}
