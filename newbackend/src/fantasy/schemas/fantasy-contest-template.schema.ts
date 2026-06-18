import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyContestTemplateDocument = FantasyContestTemplate & Document;

/**
 * Reusable blueprint for spinning up contests automatically when a new match
 * syncs in, or in bulk from the admin panel.
 */
@Schema({ timestamps: true, collection: 'fantasy_contest_templates' })
export class FantasyContestTemplate {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  type: string;  // mega | head2head | winner_takes_all | practice | small

  @Prop({ required: true })
  entryFee: number;

  @Prop({ required: true })
  totalPrize: number;

  @Prop({ required: true })
  maxSpots: number;

  @Prop({ default: 1 })
  multiEntry: number;

  @Prop({ default: false })
  isGuaranteed: boolean;

  @Prop({
    type: [{
      rankFrom: Number,
      rankTo: Number,
      prize: Number,
      percentOfPool: Number,
    }],
    default: [],
  })
  prizeBreakdown: Array<{ rankFrom: number; rankTo: number; prize: number; percentOfPool?: number }>;

  /** Which cricket formats this template applies to during auto-creation */
  @Prop({ type: [String], default: ['T20', 'ODI', 'Test'] })
  autoFormats: string[];

  /** Auto-create contests for every new synced match? */
  @Prop({ default: false })
  autoAttach: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  icon: string;

  @Prop()
  accent: string;
}

export const FantasyContestTemplateSchema = SchemaFactory.createForClass(FantasyContestTemplate);
