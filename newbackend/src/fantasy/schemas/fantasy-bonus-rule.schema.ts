import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyBonusRuleDocument = FantasyBonusRule & Document;

/**
 * Admin-configurable bonus rules. One doc per trigger.
 * Trigger examples:
 *   - signup                      — on user signup
 *   - firstjoin                   — on first ever paid contest join
 *   - firstjoin_weekly            — first join per ISO week
 *   - cashback_loss               — % cashback if entry is in bottom X%
 *   - referrer                    — credited to referrer when referee joins
 *   - referee                     — credited to referee on sign-up via link
 *   - birthday                    — on user's birthday
 *   - deposit_match               — n% match on next deposit used for fantasy
 */
@Schema({ timestamps: true, collection: 'fantasy_bonus_rules' })
export class FantasyBonusRule {
  @Prop({ required: true, unique: true })
  trigger: string;

  @Prop({ default: 'Bonus' })
  displayName: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'flat', enum: ['flat', 'percent'] })
  kind: string;

  @Prop({ default: 0 })
  amount: number;  // either flat amount or percent 0-100

  @Prop({ default: 0 })
  maxPayout: number; // 0 = no cap

  @Prop({ default: 0 })
  minSpend: number;

  @Prop({ default: 0 })
  wageringMultiplier: number;  // 0 = unlocked immediately

  @Prop({ default: true })
  isActive: boolean;
}

export const FantasyBonusRuleSchema = SchemaFactory.createForClass(FantasyBonusRule);
