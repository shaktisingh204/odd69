import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type NavigationDocument = Navigation & Document;

@Schema({ timestamps: true })
export class Navigation {
    @Prop({ required: true, unique: true, default: 'sidebar' })
    key: string;

    @Prop({ type: MongooseSchema.Types.Mixed })
    tree: any[];
}

export const NavigationSchema = SchemaFactory.createForClass(Navigation);
