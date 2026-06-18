import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type BookedBetDocument = BookedBet & Document;

@Schema({ timestamps: true })
export class BookedBet {
  @Prop({ required: true, unique: true, index: true })
  bookingId: string;

  // The array of bet payload objects
  @Prop({ type: [MongooseSchema.Types.Mixed], required: true, default: [] })
  bets: any[];

  // Time to live (optional). Let's set it to expire in 7 days (604800 seconds).
  @Prop({ type: Date, default: Date.now, expires: 604800 })
  createdAt: Date;
}

export const BookedBetSchema = SchemaFactory.createForClass(BookedBet);
