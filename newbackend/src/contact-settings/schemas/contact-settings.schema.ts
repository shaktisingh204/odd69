import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContactSettingsDocument = ContactSettings & Document;

@Schema({ timestamps: true })
export class ContactSettings {
    @Prop({ default: '' })
    whatsappNumber: string; // e.g. '919876543210' (E.164 without '+')

    @Prop({ default: 'Support' })
    whatsappLabel: string;

    @Prop({ default: 'Hi, I need help with my account.' })
    whatsappDefaultMessage: string;

    @Prop({ default: '' })
    telegramHandle: string; // e.g. '@ZeeroSupport'

    @Prop({ default: '' })
    telegramLink: string; // e.g. 'https://t.me/ZeeroSupport'

    @Prop({ default: 'support@zeero.bet' })
    emailAddress: string;

    @Prop({ default: true })
    whatsappEnabled: boolean;

    @Prop({ default: true })
    telegramEnabled: boolean;

    @Prop({ default: true })
    emailEnabled: boolean;
}

export const ContactSettingsSchema = SchemaFactory.createForClass(ContactSettings);
