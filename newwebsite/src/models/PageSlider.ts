import mongoose, { Schema, Document } from 'mongoose';

// ─── Minimal PageSlider model (mirrors newadmin/src/models/MongoModels.ts) ─────
// Only contains what the website needs to read from the page_sliders collection.

export interface ISlide {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    badge: string;
    tag: string;
    imageUrl: string;
    mobileImageUrl: string;
    charImage: string;
    gradient: string;
    overlayOpacity: number;
    overlayGradient: string;
    textColor: string;
    textAlign: 'left' | 'center' | 'right';
    ctaText: string;
    ctaLink: string;
    ctaStyle: string;
    gameCode: string;
    gameProvider: string;
    ctaSecondaryText: string;
    ctaSecondaryLink: string;
    isActive: boolean;
    order: number;
}

export interface IPageSlider extends Document {
    page: 'HOME' | 'CASINO' | 'SPORTS';
    isActive: boolean;
    heightDesktop: number;
    heightMobile: number;
    autoplay: boolean;
    autoplayInterval: number;
    transitionEffect: 'fade' | 'slide';
    borderRadius: number;
    slides: ISlide[];
}

const SlideSubSchema = new Schema({
    id:               { type: String },
    title:            { type: String, default: '' },
    subtitle:         { type: String, default: '' },
    description:      { type: String, default: '' },
    badge:            { type: String, default: '' },
    tag:              { type: String, default: '' },
    imageUrl:         { type: String, default: '' },
    mobileImageUrl:   { type: String, default: '' },
    charImage:        { type: String, default: '' },
    gradient:         { type: String, default: '' },
    overlayOpacity:   { type: Number, default: 40 },
    overlayGradient:  { type: String, default: '' },
    textColor:        { type: String, default: '#ffffff' },
    textAlign:        { type: String, default: 'left' },
    ctaText:          { type: String, default: '' },
    ctaLink:          { type: String, default: '/' },
    ctaStyle:         { type: String, default: 'gold' },
    gameCode:         { type: String, default: '' },
    gameProvider:     { type: String, default: '' },
    ctaSecondaryText: { type: String, default: '' },
    ctaSecondaryLink: { type: String, default: '' },
    isActive:         { type: Boolean, default: true },
    order:            { type: Number, default: 0 },
}, { _id: false });

const PageSliderSchema: Schema = new Schema({
    page:             { type: String, required: true, unique: true, enum: ['HOME', 'CASINO', 'SPORTS'] },
    isActive:         { type: Boolean, default: true },
    heightDesktop:    { type: Number, default: 460 },
    heightMobile:     { type: Number, default: 220 },
    autoplay:         { type: Boolean, default: true },
    autoplayInterval: { type: Number, default: 5000 },
    transitionEffect: { type: String, default: 'fade' },
    borderRadius:     { type: Number, default: 16 },
    slides:           { type: [SlideSubSchema], default: [] },
}, { timestamps: true, collection: 'page_sliders' });

export const PageSlider = mongoose.models.PageSlider ||
    mongoose.model<IPageSlider>('PageSlider', PageSliderSchema);
