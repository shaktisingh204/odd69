import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OriginalsConfigDocument = OriginalsConfig & Document;

export type EngagementMode = 'OFF' | 'SOFT' | 'AGGRESSIVE';
export type OriginalsAccessMode = 'ALL' | 'ALLOW_LIST';

@Schema({ collection: 'originals_configs', timestamps: true })
export class OriginalsConfig {
  @Prop({ required: true, unique: true }) gameKey: string;
  @Prop({ default: 'ALLOW_LIST' }) accessMode: OriginalsAccessMode;
  @Prop({ type: [Number], default: [] }) allowedUserIds: number[];
  @Prop({ default: true }) isActive: boolean;
  @Prop({ default: false }) maintenanceMode: boolean;
  @Prop() maintenanceMessage: string;
  @Prop({ default: 10 }) minBet: number;
  @Prop({ default: 100000 }) maxBet: number;
  @Prop({ default: 1000000 }) maxWin: number;
  @Prop({ default: 1.0 }) houseEdgePercent: number;
  @Prop({ default: 500 }) maxMultiplier: number;
  @Prop({ default: 5.0 }) targetGgrPercent: number;
  @Prop({ default: 24 }) ggrWindowHours: number;
  @Prop({ default: 0.2 }) ggrBiasStrength: number;
  @Prop({ type: Object, default: {} }) perUserGgrOverrides: Record<string, number>;
  @Prop({ default: 'SOFT' }) engagementMode: EngagementMode;
  @Prop({ default: true }) nearMissEnabled: boolean;
  @Prop({ default: 10.0 }) bigWinThreshold: number;
  @Prop({ default: 5 }) streakWindow: number;
  @Prop({ default: 95.0 }) displayRtpPercent: number;
  // Home page display
  @Prop() thumbnailUrl: string;
  @Prop() gameName: string;
  @Prop() gameDescription: string;
  @Prop({ default: 200 }) fakePlayerMin: number;
  @Prop({ default: 300 }) fakePlayerMax: number;
  @Prop() updatedBy: number;
}

export const OriginalsConfigSchema = SchemaFactory.createForClass(OriginalsConfig);
OriginalsConfigSchema.index({ gameKey: 1 }, { unique: true });
