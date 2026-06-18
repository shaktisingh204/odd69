import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BonusDocument = Bonus & Document;

@Schema({ timestamps: true })
export class Bonus {
    @Prop({ required: true, unique: true })
    code: string;

    /** Where the bonus is wagered: casino games or sports bets */
    @Prop({ required: true, enum: ['CASINO', 'SPORTS'] })
    type: string;

    /** Which game type wagering counts for: casino bets, sports bets, or both */
    @Prop({ default: 'BOTH', enum: ['CASINO', 'SPORTS', 'BOTH'] })
    applicableTo: string;

    /** Days user has after claiming this bonus to complete wagering (admin-set) */
    @Prop({ default: 30 })
    expiryDays: number;

    /** Which deposit currency triggers this bonus */
    @Prop({ default: 'INR', enum: ['CRYPTO', 'INR', 'BOTH'] })
    currency: string;

    @Prop({ required: true })
    title: string;

    @Prop()
    description: string;

    @Prop()
    imageUrl: string;

    @Prop({ default: 0 })
    amount: number; // Flat bonus amount (for NO_DEPOSIT type)

    @Prop({ default: 0 })
    percentage: number; // Match percentage (for DEPOSIT type)

    @Prop({ default: 0 })
    minDeposit: number;

    @Prop({ default: 0 })
    minDepositFiat: number;

    @Prop({ default: 0 })
    minDepositCrypto: number;

    @Prop({ default: 0 })
    maxBonus: number;

    @Prop({ default: 1 })
    wageringRequirement: number; // e.g. 10x, 30x (multiplier on bonus amount)

    @Prop({ default: 1 })
    depositWagerMultiplier: number; // e.g. 1x (how many times deposit must be wagered to unlock withdrawal)

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    validFrom: Date;

    @Prop()
    validUntil: Date;

    @Prop({ default: 0 })
    usageLimit: number;

    @Prop({ default: 0 })
    usageCount: number;

    /** Show this bonus as an option on the registration form */
    @Prop({ default: false })
    showOnSignup: boolean;

    /**
     * If true: bonus is credited only when user makes their first deposit (DEPOSIT type).
     * If false (NO_DEPOSIT type): bonus is credited immediately upon registration.
     */
    @Prop({ default: true })
    forFirstDepositOnly: boolean;
}

export const BonusSchema = SchemaFactory.createForClass(Bonus);
