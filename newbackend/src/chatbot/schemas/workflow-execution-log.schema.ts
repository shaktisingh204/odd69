import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class WorkflowExecutionLog {
  @Prop({ required: true })
  workflowId: number;

  @Prop({ required: true })
  triggeredBy: string;

  @Prop()
  userId: number;

  @Prop({ default: 'running', enum: ['running', 'completed', 'failed'] })
  status: string;

  @Prop({ type: [Object], default: [] })
  steps: Record<string, any>[];

  @Prop()
  error: string;

  @Prop({ default: Date.now })
  startedAt: Date;

  @Prop()
  completedAt: Date;
}

export type WorkflowExecutionLogDocument = WorkflowExecutionLog & Document;
export const WorkflowExecutionLogSchema =
  SchemaFactory.createForClass(WorkflowExecutionLog);

WorkflowExecutionLogSchema.index({ workflowId: 1 });
WorkflowExecutionLogSchema.index({ status: 1 });
WorkflowExecutionLogSchema.index({ startedAt: -1 });
