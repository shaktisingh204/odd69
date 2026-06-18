import { Module } from '@nestjs/common';
import { AutoReplyController } from './auto-reply.controller';
import { AutoReplyService } from './auto-reply.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [AutoReplyController],
  providers: [AutoReplyService, PrismaService],
  exports: [AutoReplyService],
})
export class AutoReplyModule {}
