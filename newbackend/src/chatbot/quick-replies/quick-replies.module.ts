import { Module } from '@nestjs/common';
import { QuickRepliesController } from './quick-replies.controller';
import { QuickRepliesService } from './quick-replies.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [QuickRepliesController],
  providers: [QuickRepliesService, PrismaService],
  exports: [QuickRepliesService],
})
export class QuickRepliesModule {}
