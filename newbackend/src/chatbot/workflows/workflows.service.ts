import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma.service';
import {
  WorkflowExecutionLog,
  WorkflowExecutionLogDocument,
} from '../schemas/workflow-execution-log.schema';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(WorkflowExecutionLog.name)
    private readonly workflowExecutionLogModel: Model<WorkflowExecutionLogDocument>,
  ) {}

  async findAll() {
    return this.prisma.chatbotWorkflow.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const workflow = await this.prisma.chatbotWorkflow.findUnique({
      where: { id },
    });
    if (!workflow) throw new NotFoundException(`Workflow #${id} not found`);
    return workflow;
  }

  async create(data: {
    name: string;
    description?: string;
    triggerType: string;
    triggerConfig: any;
    actions: any;
    conditions?: any;
    isEnabled?: boolean;
    schedule?: string;
  }) {
    return this.prisma.chatbotWorkflow.create({ data });
  }

  async update(
    id: number,
    data: Partial<Parameters<typeof this.create>[0]>,
  ) {
    await this.findOne(id);
    return this.prisma.chatbotWorkflow.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotWorkflow.delete({ where: { id } });
  }

  async toggle(id: number) {
    const workflow = await this.findOne(id);
    return this.prisma.chatbotWorkflow.update({
      where: { id },
      data: { isEnabled: !workflow.isEnabled },
    });
  }

  async getLogs(workflowId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.workflowExecutionLogModel
        .find({ workflowId })
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.workflowExecutionLogModel.countDocuments({ workflowId }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async execute(workflowId: number) {
    const workflow = await this.findOne(workflowId);

    const log = await this.workflowExecutionLogModel.create({
      workflowId,
      triggeredBy: 'manual',
      status: 'running',
      steps: [],
      startedAt: new Date(),
    });

    try {
      const actions = workflow.actions as any[];
      const steps: Record<string, any>[] = [];

      for (const action of actions) {
        const step: Record<string, any> = {
          action: action.type,
          startedAt: new Date(),
        };

        try {
          // Process each action type
          switch (action.type) {
            case 'send_message':
              step.result = { sent: true, message: action.payload?.message };
              break;
            case 'update_status':
              step.result = { updated: true, status: action.payload?.status };
              break;
            case 'assign_agent':
              step.result = {
                assigned: true,
                agentId: action.payload?.agentId,
              };
              break;
            case 'add_tag':
              step.result = { tagged: true, tag: action.payload?.tag };
              break;
            default:
              step.result = { executed: true };
              break;
          }

          step.status = 'completed';
          step.completedAt = new Date();
        } catch (error) {
          step.status = 'failed';
          step.error = error.message;
          step.completedAt = new Date();
        }

        steps.push(step);
      }

      await this.workflowExecutionLogModel.updateOne(
        { _id: log._id },
        {
          $set: {
            status: 'completed',
            steps,
            completedAt: new Date(),
          },
        },
      );

      return { success: true, logId: log._id, steps };
    } catch (error) {
      this.logger.error(
        `Workflow #${workflowId} execution failed`,
        error.stack,
      );

      await this.workflowExecutionLogModel.updateOne(
        { _id: log._id },
        {
          $set: {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          },
        },
      );

      return { success: false, logId: log._id, error: error.message };
    }
  }
}
