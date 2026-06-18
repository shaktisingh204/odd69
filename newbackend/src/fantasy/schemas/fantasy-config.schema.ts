import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyConfigDocument = FantasyConfig & Document;

/**
 * Singleton global fantasy platform configuration.
 * Always upsert to { _id: 'singleton' } so there is exactly one doc.
 */
@Schema({ timestamps: true, collection: 'fantasy_config' })
export class FantasyConfig {
  @Prop({ default: 'singleton', unique: true })
  key: string;

  // --- Team building constraints ---
  @Prop({ default: 100 })    creditCap: number;
  @Prop({ default: 11 })     squadSize: number;
  @Prop({ default: 7 })      maxPlayersFromOneTeam: number;
  @Prop({ default: 1 })      minKeepers: number;
  @Prop({ default: 8 })      maxKeepers: number;
  @Prop({ default: 3 })      minBatsmen: number;
  @Prop({ default: 8 })      maxBatsmen: number;
  @Prop({ default: 1 })      minAllrounders: number;
  @Prop({ default: 4 })      maxAllrounders: number;
  @Prop({ default: 3 })      minBowlers: number;
  @Prop({ default: 8 })      maxBowlers: number;

  // --- Entry & contest limits ---
  @Prop({ default: 20 })     maxTeamsPerMatch: number;
  @Prop({ default: 20 })     defaultMultiEntryCap: number;

  // --- Economy ---
  @Prop({ default: 15 })     platformFeePercent: number;
  @Prop({ default: 100 })    maxBonusUsePercent: number;  // % of entry fee that can come from bonus wallet
  @Prop({ default: 0 })      minWalletBalanceForJoin: number;

  // --- Bonuses ---
  @Prop({ default: 50 })     signupBonus: number;
  @Prop({ default: 25 })     firstJoinBonus: number;
  @Prop({ default: 10 })     referrerBonus: number;
  @Prop({ default: 5 })      refereeBonus: number;

  // --- Locks ---
  @Prop({ default: true })   allowPrivateContests: boolean;
  @Prop({ default: true })   allowTeamCloning: boolean;
  @Prop({ default: true })   allowMultiEntry: boolean;
  @Prop({ default: true })   allowPowerups: boolean;
  @Prop({ default: true })   allowPromocodes: boolean;
  @Prop({ default: true })   allowStreakRewards: boolean;

  // --- Scheduling ---
  @Prop({ default: 15 })     lockOffsetMinutes: number;  // minutes before match start when teams lock

  @Prop({ default: true })   isMaintenanceMode: boolean;
  @Prop({ default: '' })     maintenanceMessage: string;
}

export const FantasyConfigSchema = SchemaFactory.createForClass(FantasyConfig);
