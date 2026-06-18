import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyStreakDocument = FantasyStreak & Document;

/**
 * Per-user daily login/check-in streak for fantasy.
 */
@Schema({ timestamps: true, collection: 'fantasy_streaks' })
export class FantasyStreak {
  @Prop({ required: true, unique: true, index: true })
  userId: number;

  @Prop({ default: 0 })
  currentStreak: number;

  @Prop({ default: 0 })
  longestStreak: number;

  /** YYYY-MM-DD of last successful claim */
  @Prop({ default: '' })
  lastClaimDate: string;

  @Prop({ default: 0 })
  totalDaysClaimed: number;

  @Prop({ default: 0 })
  lifetimeRewardAmount: number;
}

export const FantasyStreakSchema = SchemaFactory.createForClass(FantasyStreak);

// --- Admin-tunable reward schedule (one doc) ---
export type FantasyStreakRewardDocument = FantasyStreakReward & Document;

@Schema({ timestamps: true, collection: 'fantasy_streak_rewards' })
export class FantasyStreakReward {
  @Prop({ default: 'default', unique: true })
  key: string;

  /** Array of per-day rewards (index 0 = day 1). Wraps around after length. */
  @Prop({
    type: [{
      day: Number,
      amount: Number,
      type: { type: String, enum: ['bonus', 'cash', 'powerup'], default: 'bonus' },
      powerupType: String,
    }],
    default: [
      { day: 1, amount: 5,  type: 'bonus' },
      { day: 2, amount: 10, type: 'bonus' },
      { day: 3, amount: 15, type: 'bonus' },
      { day: 4, amount: 20, type: 'bonus' },
      { day: 5, amount: 30, type: 'bonus' },
      { day: 6, amount: 50, type: 'bonus' },
      { day: 7, amount: 100, type: 'bonus' },
    ],
  })
  schedule: Array<{ day: number; amount: number; type: string; powerupType?: string }>;

  @Prop({ default: true })
  isActive: boolean;
}

export const FantasyStreakRewardSchema = SchemaFactory.createForClass(FantasyStreakReward);
