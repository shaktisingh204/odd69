import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { PrismaService } from '../../prisma.service';
import {
  WorkflowExecutionLog,
  WorkflowExecutionLogSchema,
} from '../schemas/workflow-execution-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkflowExecutionLog.name, schema: WorkflowExecutionLogSchema },
    ]),
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, PrismaService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
