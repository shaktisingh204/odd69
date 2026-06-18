import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyPointsSystemDocument = FantasyPointsSystem & Document;

/**
 * Configurable fantasy points system.
 * One document per format (T20, ODI, Test).
 * Admin can update these to change scoring rules.
 */
@Schema({ timestamps: true, collection: 'fantasy_points_system' })
export class FantasyPointsSystem {
  @Prop({ required: true, unique: true })
  format: string; // T20, ODI, Test

  // --- Batting ---
  @Prop({ default: 1 })
  run: number;

  @Prop({ default: 1 })
  boundary: number; // bonus per 4

  @Prop({ default: 2 })
  six: number; // bonus per 6

  @Prop({ default: 4 })
  halfCentury: number; // 50 runs bonus

  @Prop({ default: 8 })
  century: number; // 100 runs bonus

  @Prop({ default: -2 })
  duck: number; // 0 runs out (batting only, not bowlers)

  // --- Bowling ---
  @Prop({ default: 25 })
  wicket: number;

  @Prop({ default: 8 })
  bowlingThreeWickets: number; // 3-wicket haul bonus

  @Prop({ default: 16 })
  bowlingFiveWickets: number; // 5-wicket haul bonus

  @Prop({ default: 12 })
  maiden: number;

  @Prop({ default: -1 })
  economyBonusBelow6: number; // per over under 6 RPO (min 2 overs)

  @Prop({ default: 1 })
  economyPenaltyAbove10: number; // per over above 10 RPO

  // --- Fielding ---
  @Prop({ default: 8 })
  catch_points: number;

  @Prop({ default: 12 })
  stumping: number;

  @Prop({ default: 6 })
  runOut: number;

  // --- Bonus ---
  @Prop({ default: 4 })
  playerOfTheMatch: number;

  // --- Multipliers ---
  @Prop({ default: 2 })
  captainMultiplier: number;

  @Prop({ default: 1.5 })
  viceCaptainMultiplier: number;

  /** Starting 11 bonus */
  @Prop({ default: 4 })
  playing11Bonus: number;
}

export const FantasyPointsSystemSchema = SchemaFactory.createForClass(FantasyPointsSystem);
