import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CasinoDocument = Casino & Document;

@Schema({ timestamps: true })
export class Casino {
    @Prop()
    game_id: number;

    @Prop()
    game_name: string;

    @Prop()
    casinoGameId: string;

    @Prop()
    provider: string;

    @Prop()
    sub_category: string;

    @Prop()
    description: string;

    @Prop()
    logo_round: string;

    @Prop()
    logo_square: string;

    @Prop()
    banner: string;

    @Prop()
    pid: string;

    @Prop()
    game_tag: string;

    @Prop()
    game_sub_type: string;

    @Prop({ default: 0 })
    popularity: number;

    @Prop({ default: false })
    isNewGame: boolean;
}

export const CasinoSchema = SchemaFactory.createForClass(Casino);
CasinoSchema.index({ provider: 1, game_code: 1 }); // Note: game_code might be pid or casinoGameId based on usage
CasinoSchema.index({ popularity: -1 });
