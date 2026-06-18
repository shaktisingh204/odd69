import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PendingDepositBonusDocument = PendingDepositBonus & Document;

@Schema({ timestamps: true })
export class PendingDepositBonus {
    /** Prisma user id (numeric) */
    @Prop({ required: true, unique: true })
    userId: number;

    /** The bonus code to apply on first deposit */
    @Prop({ required: true })
    bonusCode: string;
}

export const PendingDepositBonusSchema = SchemaFactory.createForClass(PendingDepositBonus);
