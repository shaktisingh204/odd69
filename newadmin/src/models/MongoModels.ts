import mongoose, { Schema, Document } from 'mongoose';

export interface IBet extends Document {
    userId: number;
    eventId: string;
    matchId?: string;
    eventName: string;
    marketId: string;
    marketName: string;
    selectionId: string;
    selectionName: string;
    selectedTeam?: string;
    odds: number;
    stake: number;
    originalStake?: number;
    potentialWin: number;
    originalPotentialWin?: number;
    status: string;
    betType: string;
    walletType?: string;
    betSource?: string;
    bonusStakeAmount?: number;
    walletStakeAmount?: number;
    cashoutEnabled?: boolean;
    cashoutValue?: number;
    cashedOutAt?: Date;
    lastPartialCashoutAt?: Date;
    gtype?: string;
    mname?: string;
    nat?: string;
    computedMarketName?: string;
    provider?: string;
    srEventId?: string;
    srSportId?: string;
    srMarketFullId?: string;
    srRunnerId?: string;
    srRunnerName?: string;
    srMarketName?: string;
    srMarketStatus?: string;
    settledReason?: string;
    settledAt?: Date;
    partialCashoutValue?: number;
    partialCashoutCount?: number;
    snapshot: any;
    createdAt: Date;
    updatedAt: Date;
}

const BetSchema: Schema = new Schema({
    userId: { type: Number, required: true, index: true },
    eventId: { type: String, required: true, index: true },
    matchId: { type: String, index: true },
    eventName: { type: String },
    marketId: { type: String, required: true },
    marketName: { type: String },
    selectionId: { type: String, required: true },
    selectionName: { type: String },
    selectedTeam: { type: String },
    odds: { type: Number, required: true },
    stake: { type: Number, required: true },
    originalStake: { type: Number },
    potentialWin: { type: Number, required: true },
    originalPotentialWin: { type: Number },
    status: { type: String, default: 'PENDING', index: true },
    betType: { type: String, default: 'back' },
    walletType: { type: String, default: 'fiat' },
    betSource: { type: String, default: 'balance' },
    bonusStakeAmount: { type: Number, default: 0 },
    walletStakeAmount: { type: Number, default: 0 },
    cashoutEnabled: { type: Boolean, default: true },
    cashoutValue: { type: Number },
    cashedOutAt: { type: Date },
    lastPartialCashoutAt: { type: Date },
    gtype: { type: String },
    mname: { type: String },
    nat: { type: String },
    computedMarketName: { type: String },
    provider: { type: String, default: 'diamond' },
    srEventId: { type: String, index: true },
    srSportId: { type: String },
    srMarketFullId: { type: String, index: true },
    srRunnerId: { type: String },
    srRunnerName: { type: String },
    srMarketName: { type: String },
    srMarketStatus: { type: String },
    settledReason: { type: String },
    settledAt: { type: Date },
    partialCashoutValue: { type: Number, default: 0 },
    partialCashoutCount: { type: Number, default: 0 },
    snapshot: { type: Schema.Types.Mixed },
}, { timestamps: true });

BetSchema.index({ userId: 1, status: 1 });

export const Bet = mongoose.models.Bet || mongoose.model<IBet>('Bet', BetSchema);

// --- Casino Game ---

export interface ICasinoGame extends Document {
    provider: string;
    domain: string;
    name: string;
    type: string;
    subType: string;
    category: string;
    rtp: string;
    gameCode: string;
    gameId: string;
    remarks: string;
    image: string;
    icon: string;
    isActive: boolean;
    playCount: number;
    priority: number;
    isPopular: boolean;
    isNewGame: boolean;
}

const CasinoGameSchema: Schema = new Schema({
    provider: { type: String, required: true, index: true },
    domain: { type: String },
    name: { type: String, required: true },
    type: { type: String },
    subType: { type: String },
    category: { type: String },
    rtp: { type: String },
    gameCode: { type: String, required: true, unique: true },
    gameId: { type: String },
    remarks: { type: String },
    image: { type: String },
    icon: { type: String },
    isActive: { type: Boolean, default: true },
    playCount: { type: Number, default: 0 },
    priority: { type: Number, default: 0 },
    isPopular: { type: Boolean, default: false },
    isNewGame: { type: Boolean, default: false },
}, { timestamps: true });

export const CasinoGame = mongoose.models.CasinoGame || mongoose.model<ICasinoGame>('CasinoGame', CasinoGameSchema);

// --- Promo Card ---

export interface IPromoCard extends Document {
    title: string;
    subtitle: string;
    description: string;
    termsAndConditions: string;
    category: string;
    tag: string;
    promoCode: string;
    minDeposit: number;
    bonusPercentage: number;
    expiryDate: Date;
    buttonText: string;
    buttonLink: string;
    bgImage: string;
    charImage: string;
    gradient: string;
    isActive: boolean;
    isFeatured: boolean;
    order: number;
}

const PromoCardSchema: Schema = new Schema({
    title: { type: String, required: true },
    subtitle: { type: String },
    description: { type: String },
    termsAndConditions: { type: String },
    category: { type: String, default: 'ALL', enum: ['ALL', 'CASINO', 'SPORTS', 'LIVE', 'VIP'] },
    tag: { type: String, default: 'CASINO' },
    promoCode: { type: String },
    minDeposit: { type: Number, default: 0 },
    bonusPercentage: { type: Number, default: 0 },
    expiryDate: { type: Date },
    buttonText: { type: String, default: 'CLAIM NOW' },
    buttonLink: { type: String },
    bgImage: { type: String },
    charImage: { type: String },
    gradient: { type: String },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
}, { timestamps: true });

export const PromoCard = mongoose.models.PromoCard || mongoose.model<IPromoCard>('PromoCard', PromoCardSchema);


// --- Promotion (Promotions Page) ---
// Separate from PromoCard (homepage sliders). These are the rich cards on /promotions.

export interface IPromotion extends Document {
    title: string;
    subtitle: string;
    description: string;
    termsAndConditions: string;
    category: string;       // ALL | CASINO | SPORTS | LIVE | VIP
    promoCode: string;
    minDeposit: number;
    bonusPercentage: number;
    expiryDate: Date;
    buttonText: string;
    buttonLink: string;
    bgImage: string;
    charImage: string;
    gradient: string;
    badgeLabel: string;     // e.g. "HOT", "NEW", "EXCLUSIVE"
    isActive: boolean;
    isFeatured: boolean;
    order: number;
}

const PromotionSchema: Schema = new Schema({
    title: { type: String, required: true },
    subtitle: { type: String },
    description: { type: String },
    termsAndConditions: { type: String },
    category: { type: String, default: 'ALL', enum: ['ALL', 'CASINO', 'SPORTS', 'LIVE', 'VIP'] },
    promoCode: { type: String },
    minDeposit: { type: Number, default: 0 },
    bonusPercentage: { type: Number, default: 0 },
    expiryDate: { type: Date },
    buttonText: { type: String, default: 'CLAIM NOW' },
    buttonLink: { type: String, default: '/register' },
    bgImage: { type: String },
    charImage: { type: String },
    gradient: { type: String, default: 'linear-gradient(135deg, #E37D32, #AE5910)' },
    badgeLabel: { type: String },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
}, { timestamps: true });

export const Promotion = mongoose.models.Promotion || mongoose.model<IPromotion>('Promotion', PromotionSchema);


// --- Sport ---

export interface ISport extends Document {
    sport_id: string;
    sport_name: string;
    market_count: number;
    isVisible: boolean;
    minBet: number;
    maxBet: number;
}

const SportSchema: Schema = new Schema({
    sport_id: { type: String, required: true, unique: true },
    sport_name: { type: String, required: true },
    market_count: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true },
    minBet: { type: Number, default: 100 },
    maxBet: { type: Number, default: 100000 },
}, { timestamps: true });

export const Sport = mongoose.models.Sport || mongoose.model<ISport>('Sport', SportSchema);

// --- Event ---

export interface IEvent extends Document {
    event_id: string;
    event_name: string;
    competition_id: string;
    open_date: string;
    timezone: string;
    match_status: string;
    home_team: string;
    away_team: string;
    score1: string;
    score2: string;
    match_info: string;
    isVisible: boolean;
}

const EventSchema: Schema = new Schema({
    event_id: { type: String, required: true, unique: true },
    event_name: { type: String, required: true },
    competition_id: { type: String, required: true, index: true },
    open_date: { type: String, required: true },
    timezone: { type: String },
    match_status: { type: String },
    home_team: { type: String },
    away_team: { type: String },
    score1: { type: String },
    score2: { type: String },
    match_info: { type: String },
    isVisible: { type: Boolean, default: true },
}, { timestamps: true });
EventSchema.index({ open_date: 1 });

export const Event = mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);

// --- Competition ---

export interface ICompetition extends Document {
    competition_id: string;
    competition_name: string;
    sport_id: string;
    country_code: string;
    market_count: number;
    isVisible: boolean;
}

const CompetitionSchema: Schema = new Schema({
    competition_id: { type: String, required: true, unique: true },
    competition_name: { type: String, required: true },
    sport_id: { type: String, required: true, index: true },
    country_code: { type: String },
    market_count: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true },
}, { timestamps: true });

export const Competition = mongoose.models.Competition || mongoose.model<ICompetition>('Competition', CompetitionSchema);

// --- Casino Category ---

export interface ICasinoCategory extends Document {
    name: string;
    slug: string;
    icon: string;               // Lucide icon name
    pageType: 'casino' | 'live';
    priority: number;
    isActive: boolean;
    image: string;
}

const CasinoCategorySchema: Schema = new Schema({
    name:     { type: String, required: true, unique: true },
    slug:     { type: String, required: true, unique: true },
    icon:     { type: String, default: 'Gamepad2' },
    pageType: { type: String, default: 'casino', enum: ['casino', 'live'] },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    image:    { type: String },
}, { timestamps: true });
CasinoCategorySchema.index({ priority: -1 });

export const CasinoCategory = mongoose.models.CasinoCategory || mongoose.model<ICasinoCategory>('CasinoCategory', CasinoCategorySchema);

// --- Casino Provider ---

export interface ICasinoProvider extends Document {
    name: string;
    code: string;
    priority: number;
    isActive: boolean;
    image: string;
}

const CasinoProviderSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    image: { type: String },
}, { timestamps: true });
CasinoProviderSchema.index({ priority: -1 });

export const CasinoProvider = mongoose.models.CasinoProvider || mongoose.model<ICasinoProvider>('CasinoProvider', CasinoProviderSchema);

// --- Bonus ---

export interface IBonus extends Document {
    code: string;
    type: string;
    title: string;
    description: string;
    imageUrl: string;
    amount: number;
    percentage: number;
    minDeposit: number;
    minDepositFiat: number;
    minDepositCrypto: number;
    maxBonus: number;
    wageringRequirement: number;
    isActive: boolean;
    validFrom: Date;
    validUntil: Date;
    usageLimit: number;
    usageCount: number;
    showOnSignup: boolean;
    forFirstDepositOnly: boolean;
    // Wagering split fields
    applicableTo: string;       // 'CASINO' | 'SPORTS' | 'BOTH'
    expiryDays: number;         // Days user has after activation to complete wagering
    currency: string;           // 'INR' | 'CRYPTO' | 'BOTH'
    depositWagerMultiplier: number; // Deposit wagering multiplier (1x default)
    displayCategory: string;    // UI grouping category
}

const BonusSchema: Schema = new Schema({
    code: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: ['CASINO', 'SPORTS'] },
    title: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String },
    amount: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    minDeposit: { type: Number, default: 0 },
    minDepositFiat: { type: Number, default: 0 },
    minDepositCrypto: { type: Number, default: 0 },
    maxBonus: { type: Number, default: 0 },
    wageringRequirement: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    validFrom: { type: Date },
    validUntil: { type: Date },
    usageLimit: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 },
    showOnSignup: { type: Boolean, default: false },
    forFirstDepositOnly: { type: Boolean, default: true },
    // Wagering split fields — MUST be declared or Mongoose silently strips them
    applicableTo: { type: String, default: 'BOTH', enum: ['CASINO', 'SPORTS', 'BOTH'] },
    expiryDays: { type: Number, default: 30 },
    currency: { type: String, default: 'INR', enum: ['INR', 'CRYPTO', 'BOTH'] },
    depositWagerMultiplier: { type: Number, default: 1 },
    displayCategory: { type: String, default: 'ALL' },
}, { timestamps: true });

export const Bonus = mongoose.models.Bonus || mongoose.model<IBonus>('Bonus', BonusSchema);

// --- TopEvent (Popular events shown on the Popular tab) ---

export interface ITopEvent extends Document {
    event_id: string;
    event_name: string;
    added_at: Date;
}

const TopEventSchema: Schema = new Schema({
    event_id: { type: String, required: true, unique: true },
    event_name: { type: String },
    added_at: { type: Date, default: Date.now },
});

export const TopEvent = mongoose.models.TopEvent || mongoose.model<ITopEvent>('TopEvent', TopEventSchema);

// --- HomeEvent (Events pinned to appear in the Home Page sports section) ---

export interface IHomeEvent extends Document {
    event_id: string;
    event_name: string;
    added_at: Date;
}

const HomeEventSchema: Schema = new Schema({
    event_id: { type: String, required: true, unique: true },
    event_name: { type: String },
    added_at: { type: Date, default: Date.now },
});

export const HomeEvent = mongoose.models.HomeEvent || mongoose.model<IHomeEvent>('HomeEvent', HomeEventSchema);

// --- HomeCasinoGame (Casino games pinned to appear in the Home Page casino section) ---

export interface IHomeCasinoGame extends Document {
    gameCode: string;
    name: string;
    provider: string;
    image: string;
    order: number;
    added_at: Date;
}

const HomeCasinoGameSchema: Schema = new Schema({
    gameCode: { type: String, required: true, unique: true },
    name: { type: String },
    provider: { type: String },
    image: { type: String },
    order: { type: Number, default: 0 },
    added_at: { type: Date, default: Date.now },
});

export const HomeCasinoGame = mongoose.models.HomeCasinoGame || mongoose.model<IHomeCasinoGame>('HomeCasinoGame', HomeCasinoGameSchema);

// --- TopCasinoGame (Casino games pinned as "Top Games" on the casino page) ---

export interface ITopCasinoGame extends Document {
    gameCode: string;
    name: string;
    provider: string;
    image: string;
    order: number;
    added_at: Date;
}

const TopCasinoGameSchema: Schema = new Schema({
    gameCode: { type: String, required: true, unique: true },
    name: { type: String },
    provider: { type: String },
    image: { type: String },
    order: { type: Number, default: 0 },
    added_at: { type: Date, default: Date.now },
});

export const TopCasinoGame = mongoose.models.TopCasinoGame || mongoose.model<ITopCasinoGame>('TopCasinoGame', TopCasinoGameSchema);

// ─── CasinoSectionGame — unified model for all curated casino tabs ─────────────
// section values: 'popular'|'new'|'slots'|'live'|'table'|'crash'|'home'|'top'

export interface ICasinoSectionGame extends Document {
    section: string;
    gameCode: string;
    name: string;
    provider: string;
    image: string;
    order: number;
    added_at: Date;
}

const CasinoSectionGameSchema: Schema = new Schema({
    section: { type: String, required: true, index: true },
    gameCode: { type: String, required: true },
    name: { type: String },
    provider: { type: String },
    image: { type: String },
    order: { type: Number, default: 0 },
    added_at: { type: Date, default: Date.now },
});
CasinoSectionGameSchema.index({ section: 1, gameCode: 1 }, { unique: true });

export const CasinoSectionGame = mongoose.models.CasinoSectionGame || mongoose.model<ICasinoSectionGame>('CasinoSectionGame', CasinoSectionGameSchema);

// ─── CasinoSectionConfig — admin-editable display settings per section ─────────

export interface ICasinoSectionConfig extends Document {
    section: string;
    label: string;
    icon: string;                // Lucide icon name, e.g. 'Flame'
    pageType: 'casino' | 'live';
    isVisible: boolean;
    isCustom: boolean;
    order: number;
}

const CasinoSectionConfigSchema: Schema = new Schema({
    section:   { type: String, required: true, unique: true, index: true },
    label:     { type: String, required: true },
    icon:      { type: String, default: 'Gamepad2' },
    pageType:  { type: String, default: 'casino', enum: ['casino', 'live'] },
    isVisible: { type: Boolean, default: true },
    isCustom:  { type: Boolean, default: false },
    order:     { type: Number, default: 0 },
}, { timestamps: true });

export const CasinoSectionConfig = mongoose.models.CasinoSectionConfig ||
    mongoose.model<ICasinoSectionConfig>('CasinoSectionConfig', CasinoSectionConfigSchema);

// ─── SportPageSection — admin-configurable sports page layout sections ────────
//  Stored as ordered rows. sectionId values match the frontend section identifiers.
//  e.g. 'hero', 'sport_badges', 'leagues', 'pinned_matches', 'top_matches', 'sport_groups'

export interface ISportPageSection extends Document {
    sectionId: string;       // unique key matching frontend section
    label: string;           // human-readable label
    icon: string;            // emoji or lucide icon name
    isVisible: boolean;      // whether to render on frontend
    sortOrder: number;       // render position (1-based)
    isLocked: boolean;       // if true, cannot be moved (hero is always first)
}

const SportPageSectionSchema: Schema = new Schema({
    sectionId:  { type: String, required: true, unique: true },
    label:      { type: String, required: true },
    icon:       { type: String, default: '📦' },
    isVisible:  { type: Boolean, default: true },
    sortOrder:  { type: Number, default: 0 },
    isLocked:   { type: Boolean, default: false },
}, { timestamps: true, collection: 'sport_page_sections' });

export const SportPageSection = mongoose.models.SportPageSection ||
    mongoose.model<ISportPageSection>('SportPageSection', SportPageSectionSchema);

// ─── Announcement ─────────────────────────────────────────────────────────────

export interface IAnnouncement extends Document {
    title: string;
    message: string;
    type: 'INFO' | 'WARNING' | 'SUCCESS' | 'PROMO';
    isActive: boolean;
    isPinned: boolean;
    startAt?: Date;
    endAt?: Date;
    order: number;
}

const AnnouncementSchema: Schema = new Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'INFO', enum: ['INFO', 'WARNING', 'SUCCESS', 'PROMO'] },
    isActive: { type: Boolean, default: true },
    isPinned: { type: Boolean, default: false },
    startAt: { type: Date },
    endAt: { type: Date },
    order: { type: Number, default: 0 },
}, { timestamps: true });

AnnouncementSchema.index({ isActive: 1, isPinned: -1, order: 1 });

export const Announcement = mongoose.models.Announcement || mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);

// ─── FAQ (Help Center) ────────────────────────────────────────────────────────

export interface IFaqMedia {
    type: 'image' | 'video' | 'youtube' | 'link';
    url: string;
    caption?: string;
}

export interface IFaq extends Document {
    question: string;
    answer: string;
    category: string;
    media: IFaqMedia[];
    isActive: boolean;
    order: number;
}

const FaqMediaSchema: Schema = new Schema({
    type: { type: String, required: true, enum: ['image', 'video', 'youtube', 'link'] },
    url: { type: String, required: true },
    caption: { type: String },
}, { _id: false });

const FaqSchema: Schema = new Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, required: true, index: true },
    media: { type: [FaqMediaSchema], default: [] },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
}, { timestamps: true });

FaqSchema.index({ isActive: 1, order: 1 });

export const Faq = mongoose.models.Faq || mongoose.model<IFaq>('Faq', FaqSchema);

// ─── Zeero Originals ─────────────────────────────────────────────────────────
// These must match the exact collection names used by the backend (NestJS + Mongoose)

// --- OriginalsConfig ---
export interface IOriginalsConfig extends Document {
    gameKey: string;
    accessMode: 'ALL' | 'ALLOW_LIST';
    allowedUserIds: number[];
    isActive: boolean;
    maintenanceMode: boolean;
    maintenanceMessage: string;
    minBet: number;
    maxBet: number;
    maxWin: number;
    houseEdgePercent: number;
    maxMultiplier: number;
    targetGgrPercent: number;
    ggrWindowHours: number;
    ggrBiasStrength: number;
    perUserGgrOverrides: Record<string, number>;
    engagementMode: string;
    nearMissEnabled: boolean;
    bigWinThreshold: number;
    streakWindow: number;
    displayRtpPercent: number;
    thumbnailUrl: string;
    gameName: string;
    gameDescription: string;
    fakePlayerMin: number;
    fakePlayerMax: number;
    updatedBy: number;
}

const OriginalsConfigSchema: Schema = new Schema({
    gameKey:             { type: String, required: true, unique: true },
    accessMode:          { type: String, default: 'ALLOW_LIST' },
    allowedUserIds:      { type: [Number], default: [] },
    isActive:            { type: Boolean, default: true },
    maintenanceMode:     { type: Boolean, default: false },
    maintenanceMessage:  { type: String },
    minBet:              { type: Number, default: 10 },
    maxBet:              { type: Number, default: 100000 },
    maxWin:              { type: Number, default: 1000000 },
    houseEdgePercent:    { type: Number, default: 1.0 },
    maxMultiplier:       { type: Number, default: 500 },
    targetGgrPercent:    { type: Number, default: 5.0 },
    ggrWindowHours:      { type: Number, default: 24 },
    ggrBiasStrength:     { type: Number, default: 0.20 },
    perUserGgrOverrides: { type: Schema.Types.Mixed, default: {} },
    engagementMode:      { type: String, default: 'SOFT' },
    nearMissEnabled:     { type: Boolean, default: true },
    bigWinThreshold:     { type: Number, default: 10 },
    streakWindow:        { type: Number, default: 5 },
    displayRtpPercent:   { type: Number, default: 95.0 },
    thumbnailUrl:        { type: String },
    gameName:            { type: String },
    gameDescription:     { type: String },
    fakePlayerMin:       { type: Number, default: 200 },
    fakePlayerMax:       { type: Number, default: 300 },
    updatedBy:           { type: Number },
}, { timestamps: true, collection: 'originals_configs' });

export const OriginalsConfig = mongoose.models.OriginalsConfig ||
    mongoose.model<IOriginalsConfig>('OriginalsConfig', OriginalsConfigSchema);

// --- MinesGame ---
export interface IMinesGame extends Document {
    userId: number;
    betAmount: number;
    mineCount: number;
    minePositions: number[];
    revealedTiles: number[];
    status: string;
    payout: number;
    multiplier: number;
    serverSeed: string;
    clientSeed: string;
    serverSeedHash: string;
    walletType: string;
    usedBonus: boolean;
    bonusAmount: number;
    currency: string;
    biasWeight: number;
    createdAt: Date;
}

const MinesGameSchema: Schema = new Schema({
    userId:         { type: Number, required: true, index: true },
    betAmount:      { type: Number, required: true },
    mineCount:      { type: Number, required: true },
    minePositions:  { type: [Number], required: true },
    revealedTiles:  { type: [Number], default: [] },
    status:         { type: String, default: 'ACTIVE', index: true },
    payout:         { type: Number, default: 0 },
    multiplier:     { type: Number, default: 1 },
    serverSeed:     { type: String },
    clientSeed:     { type: String },
    serverSeedHash: { type: String },
    walletType:     { type: String, default: 'fiat' },
    usedBonus:      { type: Boolean, default: false },
    bonusAmount:    { type: Number, default: 0 },
    currency:       { type: String, default: 'INR' },
    biasWeight:     { type: Number, default: 0 },
}, { timestamps: true, collection: 'mines_games' });

MinesGameSchema.index({ userId: 1, status: 1 });

export const MinesGame = mongoose.models.MinesGame ||
    mongoose.model<IMinesGame>('MinesGame', MinesGameSchema);

// --- PlinkoGame ---
export interface IPlinkoGame extends Document {
    userId: number;
    betAmount: number;
    rows: number;
    risk: string;
    path: number[];
    slotIndex: number;
    multiplier: number;
    payout: number;
    status: string;
    serverSeed: string;
    clientSeed: string;
    serverSeedHash: string;
    walletType: string;
    usedBonus: boolean;
    bonusAmount: number;
    currency: string;
    createdAt: Date;
}

const PlinkoGameSchema: Schema = new Schema({
    userId:         { type: Number, required: true, index: true },
    betAmount:      { type: Number, required: true },
    rows:           { type: Number, required: true },
    risk:           { type: String, required: true },
    path:           { type: [Number], required: true },
    slotIndex:      { type: Number, required: true },
    multiplier:     { type: Number, required: true },
    payout:         { type: Number, default: 0 },
    status:         { type: String, required: true, index: true },
    serverSeed:     { type: String, required: true },
    clientSeed:     { type: String },
    serverSeedHash: { type: String, required: true },
    walletType:     { type: String, default: 'fiat' },
    usedBonus:      { type: Boolean, default: false },
    bonusAmount:    { type: Number, default: 0 },
    currency:       { type: String, default: 'INR' },
}, { timestamps: true, collection: 'plinko_games' });

PlinkoGameSchema.index({ userId: 1, createdAt: -1 });
PlinkoGameSchema.index({ createdAt: -1 });

export const PlinkoGame = mongoose.models.PlinkoGame ||
    mongoose.model<IPlinkoGame>('PlinkoGame', PlinkoGameSchema);

// --- OriginalsGGRSnapshot ---
export interface IOriginalsGGRSnapshot extends Document {
    gameKey: string;
    windowStart: Date;
    windowEnd: Date;
    totalWagered: number;
    totalPaidOut: number;
    totalGames: number;
    totalWins: number;
    totalLosses: number;
    ggrPercent: number;
    snapshotAt: Date;
}

const OriginalsGGRSnapshotSchema: Schema = new Schema({
    gameKey:      { type: String, required: true, index: true },
    windowStart:  { type: Date },
    windowEnd:    { type: Date },
    totalWagered: { type: Number, default: 0 },
    totalPaidOut: { type: Number, default: 0 },
    totalGames:   { type: Number, default: 0 },
    totalWins:    { type: Number, default: 0 },
    totalLosses:  { type: Number, default: 0 },
    ggrPercent:   { type: Number, default: 0 },
    snapshotAt:   { type: Date, default: Date.now, index: true },
}, { collection: 'originals_ggr_snapshots' });

export const OriginalsGGRSnapshot = mongoose.models.OriginalsGGRSnapshot ||
    mongoose.model<IOriginalsGGRSnapshot>('OriginalsGGRSnapshot', OriginalsGGRSnapshotSchema);

// --- OriginalsSession ---
export interface IOriginalsSession extends Document {
    userId: number;
    gameKey: string;
    socketId: string;
    isActive: boolean;
    connectedAt: Date;
    disconnectedAt: Date;
}

const OriginalsSessionSchema: Schema = new Schema({
    userId:         { type: Number, required: true, index: true },
    gameKey:        { type: String, required: true },
    socketId:       { type: String },
    isActive:       { type: Boolean, default: true },
    connectedAt:    { type: Date, default: Date.now },
    disconnectedAt: { type: Date },
}, { timestamps: true, collection: 'originals_sessions' });

export const OriginalsSession = mongoose.models.OriginalsSession ||
    mongoose.model<IOriginalsSession>('OriginalsSession', OriginalsSessionSchema);

// --- OriginalsEngagementEvent ---
export interface IOriginalsEngagementEvent extends Document {
    userId: number;
    gameKey: string;
    gameId: string;
    eventType: string;
    metadata: any;
    createdAt: Date;
}

const OriginalsEngagementEventSchema: Schema = new Schema({
    userId:    { type: Number, required: true, index: true },
    gameKey:   { type: String, required: true },
    gameId:    { type: String },
    eventType: { type: String, required: true },
    metadata:  { type: Schema.Types.Mixed },
}, { timestamps: true, collection: 'originals_engagement_events' });

export const OriginalsEngagementEvent = mongoose.models.OriginalsEngagementEvent ||
    mongoose.model<IOriginalsEngagementEvent>('OriginalsEngagementEvent', OriginalsEngagementEventSchema);

// --- AviatorRound ---
export interface IAviatorRound extends Document {
    roundId: number;
    serverSeed: string;
    serverSeedHash: string;
    crashPoint: number;
    status: string;
    startedAt: Date;
    crashedAt: Date;
    totalWagered: number;
    totalPaidOut: number;
}

const AviatorRoundSchema: Schema = new Schema({
    roundId:        { type: Number, required: true, unique: true },
    serverSeed:     { type: String },
    serverSeedHash: { type: String },
    crashPoint:     { type: Number },
    status:         { type: String, default: 'BETTING', index: true },
    startedAt:      { type: Date },
    crashedAt:      { type: Date },
    totalWagered:   { type: Number, default: 0 },
    totalPaidOut:   { type: Number, default: 0 },
}, { timestamps: true, collection: 'aviator_rounds' });

export const AviatorRound = mongoose.models.AviatorRound ||
    mongoose.model<IAviatorRound>('AviatorRound', AviatorRoundSchema);

// --- AviatorBet ---
export interface IAviatorBet extends Document {
    roundId: number;
    userId: number;
    betAmount: number;
    status: string;
    cashedOutMultiplier: number;
    payout: number;
    autoCashoutAt: number;
    walletType: string;
    currency: string;
    createdAt: Date;
}

const AviatorBetSchema: Schema = new Schema({
    roundId:             { type: Number, required: true, index: true },
    userId:              { type: Number, required: true, index: true },
    betAmount:           { type: Number, required: true },
    status:              { type: String, default: 'ACTIVE' },
    cashedOutMultiplier: { type: Number, default: 0 },
    payout:              { type: Number, default: 0 },
    autoCashoutAt:       { type: Number, default: 0 },
    walletType:          { type: String, default: 'fiat' },
    currency:            { type: String, default: 'INR' },
}, { timestamps: true, collection: 'aviator_bets' });

export const AviatorBet = mongoose.models.AviatorBet ||
    mongoose.model<IAviatorBet>('AviatorBet', AviatorBetSchema);

// ─── Notification (in-app notifications) ──────────────────────────────────────

export interface INotification extends Document {
    userId: number;
    title: string;
    body: string;
    deepLink?: string;
    isRead: boolean;
    createdAt: Date;
}

const NotificationSchema: Schema = new Schema({
    userId:   { type: Number, required: true, index: true },
    title:    { type: String, required: true },
    body:     { type: String, required: true },
    deepLink: { type: String },
    isRead:   { type: Boolean, default: false },
}, { timestamps: true, collection: 'notifications' });

NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.models.Notification ||
    mongoose.model<INotification>('Notification', NotificationSchema);

// ─── PushNotification (admin audit log) ───────────────────────────────────────

export interface IPushNotification extends Document {
    title: string;
    body: string;
    imageUrl?: string;
    deepLink?: string;
    segment?: string;
    targetUserIds: number[];
    sentBy: number;
    sentCount: number;
    onesignalId?: string;
    createdAt: Date;
}

const PushNotificationSchema: Schema = new Schema({
    title:         { type: String, required: true },
    body:          { type: String, required: true },
    imageUrl:      { type: String },
    deepLink:      { type: String },
    segment:       { type: String },
    targetUserIds: { type: [Number], default: [] },
    sentBy:        { type: Number, default: 0 },
    sentCount:     { type: Number, default: 0 },
    onesignalId:   { type: String },
}, { timestamps: true, collection: 'push_notifications' });

PushNotificationSchema.index({ createdAt: -1 });

export const PushNotification = mongoose.models.PushNotification ||
    mongoose.model<IPushNotification>('PushNotification', PushNotificationSchema);

// ─── WhatsApp Campaign Log ─────────────────────────────────────────────────────

export interface IWhatsAppCampaignLog extends Document {
    campaignName: string;
    type: 'BULK' | 'AUTO_WELCOME' | 'AUTO_DEPOSIT' | 'AUTO_WITHDRAWAL';
    templateName: string;
    segment: string;
    // Advanced targeting
    minBalance?: number;
    maxBalance?: number;
    startDate?: Date;
    endDate?: Date;
    customPhones?: string[];
    // Variable mapping
    variables: { bodyParams: string[]; headerParam?: string };
    // Progress tracking
    targetUserIds: number[];
    totalUsers: number;
    sentCount: number;
    failedCount: number;
    failedPhones: string[];     // for retry
    speedLimit: number;         // msg/min
    wabaId: string;
    sentBy: number;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
    errorMessage?: string;
    createdAt: Date;
}

const WhatsAppCampaignLogSchema: Schema = new Schema({
    campaignName:  { type: String, required: true },
    type:          { type: String, required: true, enum: ['BULK', 'AUTO_WELCOME', 'AUTO_DEPOSIT', 'AUTO_WITHDRAWAL'] },
    templateName:  { type: String, required: true },
    segment:       { type: String, default: 'ALL' },
    minBalance:    { type: Number },
    maxBalance:    { type: Number },
    startDate:     { type: Date },
    endDate:       { type: Date },
    customPhones:  { type: [String], default: [] },
    variables:     { type: Object, default: { bodyParams: [], headerParam: '' } },
    targetUserIds: { type: [Number], default: [] },
    totalUsers:    { type: Number, default: 0 },
    sentCount:     { type: Number, default: 0 },
    failedCount:   { type: Number, default: 0 },
    failedPhones:  { type: [String], default: [] },
    speedLimit:    { type: Number, default: 60 },
    wabaId:        { type: String },
    sentBy:        { type: Number, default: 0 },
    status:        { type: String, default: 'PENDING', enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL'] },
    errorMessage:  { type: String },
}, { timestamps: true, collection: 'whatsapp_campaign_logs' });

WhatsAppCampaignLogSchema.index({ createdAt: -1 });
WhatsAppCampaignLogSchema.index({ type: 1, status: 1 });

export const WhatsAppCampaignLog = mongoose.models.WhatsAppCampaignLog ||
    mongoose.model<IWhatsAppCampaignLog>('WhatsAppCampaignLog', WhatsAppCampaignLogSchema);

// ─── WhatsApp Config (credentials + auto-message templates) ───────────────────

export interface IWhatsAppConfig extends Document {
    key: string;   // always 'WHATSAPP_CONFIG'
    accessToken: string;
    appId: string;
    wabaId: string;
    phoneNumberId: string;
    isActive: boolean;
    // Auto-message templates
    welcomeTemplate: string;
    welcomeEnabled: boolean;
    depositTemplate: string;
    depositEnabled: boolean;
    withdrawalTemplate: string;
    withdrawalEnabled: boolean;
    updatedAt: Date;
}

const WhatsAppConfigSchema: Schema = new Schema({
    key:                { type: String, required: true, unique: true },
    accessToken:        { type: String, default: '' },
    appId:              { type: String, default: '' },
    wabaId:             { type: String, default: '' },
    phoneNumberId:      { type: String, default: '' },
    isActive:           { type: Boolean, default: false },
    welcomeTemplate:    { type: String, default: 'welcome_message' },
    welcomeEnabled:     { type: Boolean, default: false },
    depositTemplate:    { type: String, default: 'deposit_success' },
    depositEnabled:     { type: Boolean, default: false },
    withdrawalTemplate: { type: String, default: 'withdrawal_success' },
    withdrawalEnabled:  { type: Boolean, default: false },
}, { timestamps: true, collection: 'whatsapp_configs' });

export const WhatsAppConfig = mongoose.models.WhatsAppConfig ||
    mongoose.model<IWhatsAppConfig>('WhatsAppConfig', WhatsAppConfigSchema);

// ─── Promo Team (Sports Refunding) ──────────────────────────────────────────

export interface IPromoTeam extends Document {
    eventId: string;
    eventName: string;
    matchDate: Date;
    sportId: string;
    teams: string[];
    teamName?: string; // optional — promo is now match-based, not team-based
    refundPercentage: number;
    walletTarget: string;
    cardTitle: string;
    cardDescription: string;
    cardGradient: string;
    cardBgImage: string;
    cardBadge: string;
    showOnPromotionsPage: boolean;
    promoCardId?: string;
    isActive: boolean;
    refundIssued: boolean;
    refundIssuedAt?: Date;
    refundedBetCount: number;
    totalRefundedAmount: number;
    order: number;
}

const PromoTeamSchema: Schema = new Schema({
    eventId: { type: String, required: true },
    eventName: String,
    matchDate: Date,
    sportId: String,
    teams: [String],
    teamName: { type: String, required: false }, // optional — match-based promo
    refundPercentage: { type: Number, required: true, min: 0, max: 100 },
    walletTarget: { type: String, default: 'fiat', enum: ['fiat', 'crypto'] },
    cardTitle: String,
    cardDescription: String,
    cardGradient: { type: String, default: 'linear-gradient(135deg, rgba(16,185,129,0.7), rgba(6,78,59,0.3))' },
    cardBgImage: String,
    cardBadge: String,
    showOnPromotionsPage: { type: Boolean, default: true },
    promoCardId: String,
    isActive: { type: Boolean, default: true },
    refundIssued: { type: Boolean, default: false },
    refundIssuedAt: Date,
    refundedBetCount: { type: Number, default: 0 },
    totalRefundedAmount: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
}, { timestamps: true, collection: 'promo_teams' });

export const PromoTeam = mongoose.models.PromoTeam ||
    mongoose.model<IPromoTeam>('PromoTeam', PromoTeamSchema);

// --- TeamIcon (team logo/icon uploaded to Cloudflare) ---

export interface ITeamIcon extends Document {
    team_name: string;       // normalised team name (lowercase)
    display_name: string;    // original casing for UI
    icon_url: string;        // Cloudflare delivery URL
    sport_id: string;        // optional sport association
}

const TeamIconSchema: Schema = new Schema({
    team_name:    { type: String, required: true, unique: true, index: true },
    display_name: { type: String, required: true },
    icon_url:     { type: String, required: true },
    sport_id:     { type: String, default: '' },
}, { timestamps: true, collection: 'team_icons' });

export const TeamIcon = mongoose.models.TeamIcon ||
    mongoose.model<ITeamIcon>('TeamIcon', TeamIconSchema);

// --- FantasyPlayerImage (IPL player headshots uploaded to Cloudflare) ---

export interface IFantasyPlayerImage extends Document {
    normalizedName: string;   // lowercase, punctuation-stripped, Mohd→Mohammed
    aliases: string[];        // other normalized variants to match against
    displayName: string;      // original "Shubman Gill"
    teamCode: string;         // GT, MI, CSK…
    teamName: string;         // Gujarat Titans
    iplImageId: string;       // e.g. "62" (from IPLHeadshot2026/62.png)
    sourceUrl: string;        // original iplt20.com image URL (for re-sync)
    cfImageId: string;        // Cloudflare Images id
    cfUrl: string;            // Cloudflare delivery URL
}

const FantasyPlayerImageSchema: Schema = new Schema({
    normalizedName: { type: String, required: true, unique: true, index: true },
    aliases:        { type: [String], default: [], index: true },
    displayName:    { type: String, required: true },
    teamCode:       { type: String, required: true, index: true },
    teamName:       { type: String, required: true },
    iplImageId:     { type: String, required: true },
    sourceUrl:      { type: String, required: true },
    cfImageId:      { type: String, required: true },
    cfUrl:          { type: String, required: true },
}, { timestamps: true, collection: 'fantasy_player_images' });

export const FantasyPlayerImage = mongoose.models.FantasyPlayerImage ||
    mongoose.model<IFantasyPlayerImage>('FantasyPlayerImage', FantasyPlayerImageSchema);

// --- IPLScrapeJob (background bulk scrape of iplt20.com) ---

export interface IIPLScrapeJob extends Document {
    status: 'pending' | 'running' | 'completed' | 'failed';
    totalTeams: number;
    completedTeams: number;
    currentTeam?: string;
    teams: any[];
    stats: {
        teamsLogoUploaded: number;
        teamsLogoExisting: number;
        playersUploaded: number;
        playersExisting: number;
        playersFailed: number;
    };
    error?: string;
    startedAt: Date;
    completedAt?: Date;
}

const IPLScrapeJobSchema: Schema = new Schema({
    status:          { type: String, required: true, default: 'pending', index: true },
    totalTeams:      { type: Number, required: true, default: 10 },
    completedTeams:  { type: Number, required: true, default: 0 },
    currentTeam:     { type: String },
    teams:           { type: [Schema.Types.Mixed], default: [] },
    stats: {
        teamsLogoUploaded: { type: Number, default: 0 },
        teamsLogoExisting: { type: Number, default: 0 },
        playersUploaded:   { type: Number, default: 0 },
        playersExisting:   { type: Number, default: 0 },
        playersFailed:     { type: Number, default: 0 },
    },
    error:       { type: String },
    startedAt:   { type: Date, required: true, default: () => new Date() },
    completedAt: { type: Date },
}, { timestamps: true, collection: 'ipl_scrape_jobs' });

export const IPLScrapeJob = mongoose.models.IPLScrapeJob ||
    mongoose.model<IIPLScrapeJob>('IPLScrapeJob', IPLScrapeJobSchema);

// ─── MatchCashbackPromotion (Sports Promotions — direct admin access) ─────────

export interface IMatchCashbackPromotion extends Document {
    matchId: string;
    promotionType: string;
    eventName?: string;
    matchDate?: Date;
    sportId?: string;
    teams: string[];
    refundPercentage: number;
    benefitType: string;
    walletType: string;
    maxRefundAmount?: number;
    isActive: boolean;
    showOnPromotionsPage: boolean;
    cardTitle?: string;
    cardDescription?: string;
    cardGradient?: string;
    cardBgImage?: string;
    cardBadge?: string;
    order: number;
    triggerConfig?: {
        eventType?: string;
        triggerMode?: string;
        oversWindow?: number;
        leadThreshold?: number;
        minuteThreshold?: number;
        periodLabel?: string;
        qualifyingSelections?: string[];
        scoreSnapshot?: string;
        triggerNote?: string;
        isTriggered?: boolean;
        triggeredAt?: Date;
    } | null;
    refundedBetCount: number;
    totalRefundAmount: number;
    lastSettledAt?: Date;
    conditionSummary?: string;
    createdAt: Date;
    updatedAt: Date;
}

const SPORTS_PROMOTION_TYPES = [
    'MATCH_LOSS_CASHBACK',
    'FIRST_OVER_SIX_CASHBACK',
    'LEAD_MARGIN_PAYOUT',
    'LATE_LEAD_REFUND',
    'PERIOD_LEAD_PAYOUT',
];

const SPORTS_PROMOTION_BENEFIT_TYPES = ['REFUND', 'PAYOUT_AS_WIN'];
const CASHBACK_WALLET_TYPES = ['main_wallet', 'bonus_wallet'];

const MatchCashbackPromotionSchema: Schema = new Schema({
    matchId:              { type: String, required: true, index: true },
    promotionType:        { type: String, required: true, enum: SPORTS_PROMOTION_TYPES, default: 'MATCH_LOSS_CASHBACK' },
    eventName:            { type: String },
    matchDate:            { type: Date },
    sportId:              { type: String },
    teams:                { type: [String], default: [] },
    refundPercentage:     { type: Number, required: true, min: 0, max: 100 },
    benefitType:          { type: String, required: true, enum: SPORTS_PROMOTION_BENEFIT_TYPES, default: 'REFUND' },
    walletType:           { type: String, required: true, enum: CASHBACK_WALLET_TYPES, default: 'main_wallet' },
    maxRefundAmount:      { type: Number, min: 0 },
    isActive:             { type: Boolean, default: true, index: true },
    showOnPromotionsPage: { type: Boolean, default: true },
    cardTitle:            { type: String },
    cardDescription:      { type: String },
    cardGradient:         { type: String, default: 'linear-gradient(135deg, rgba(16,185,129,0.7), rgba(6,78,59,0.3))' },
    cardBgImage:          { type: String },
    cardBadge:            { type: String, default: 'SPORTS PROMO' },
    order:                { type: Number, default: 0 },
    triggerConfig:        { type: Schema.Types.Mixed, default: null },
    refundedBetCount:     { type: Number, default: 0 },
    totalRefundAmount:    { type: Number, default: 0 },
    lastSettledAt:        { type: Date },
    conditionSummary:     { type: String },
}, { timestamps: true, collection: 'match_cashback_promotions' });

MatchCashbackPromotionSchema.index({ matchId: 1, promotionType: 1, isActive: 1 });
MatchCashbackPromotionSchema.index({ showOnPromotionsPage: 1, isActive: 1, matchDate: 1, order: 1 });

export const MatchCashbackPromotion = mongoose.models.MatchCashbackPromotion ||
    mongoose.model<IMatchCashbackPromotion>('MatchCashbackPromotion', MatchCashbackPromotionSchema);

// ─── UserTrafficEvent — signup attribution from UTM params ───────────────────

export interface IUserTrafficEvent extends Document {
    userId: number;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    utm_term: string | null;
    referrerUrl: string | null;
    landingPage: string | null;
    ip: string | null;
    userAgent: string | null;
    createdAt: Date;
}

const UserTrafficEventSchema: Schema = new Schema({
    userId:       { type: Number, required: true, index: true },
    utm_source:   { type: String, default: null },
    utm_medium:   { type: String, default: null },
    utm_campaign: { type: String, default: null },
    utm_content:  { type: String, default: null },
    utm_term:     { type: String, default: null },
    referrerUrl:  { type: String, default: null },
    landingPage:  { type: String, default: null },
    ip:           { type: String, default: null },
    userAgent:    { type: String, default: null },
}, { timestamps: true, collection: 'user_traffic_events' });

UserTrafficEventSchema.index({ utm_source: 1 });
UserTrafficEventSchema.index({ utm_campaign: 1 });
UserTrafficEventSchema.index({ createdAt: -1 });
UserTrafficEventSchema.index({ ip: 1 });


export const UserTrafficEvent = mongoose.models.UserTrafficEvent ||
    mongoose.model<IUserTrafficEvent>('UserTrafficEvent', UserTrafficEventSchema);

// ─── DailyCheckinConfig ───────────────────────────────────────────────────────
// Singleton document (configKey: "default") — all settings for the
// daily / weekly / monthly / custom check-in reward system.

export interface IDailyCheckinConfig extends Document {
    configKey: string;               // always "default"

    // Master toggle
    enabled: boolean;

    // Schedule type
    scheduleType: 'daily' | 'weekly' | 'monthly' | 'custom'; // "custom" uses customIntervalDays
    customIntervalDays: number;       // Only used when scheduleType = "custom"

    // Reward mode
    rewardMode: 'fixed' | 'random';  // fixed → per-day table; random → min/max per day

    // Fixed reward schedule (7-day cycle)
    fixedRewards: number[];           // [day1, day2, …, day7] amounts in INR

    // Random reward range per day (7-day cycle)
    randomMin: number[];              // min amount for each day
    randomMax: number[];              // max amount for each day

    // Currency & wallet target
    currency: 'INR' | 'USD';
    walletTarget: 'MAIN' | 'BONUS';   // Which wallet gets credited

    // Deposit requirement
    requiresDeposit: boolean;
    minDepositAmount: number;         // Min historical deposit to qualify

    // Streak & cycle
    streakResetOnMiss: boolean;       // Whether missing a day resets streak to 0
    cycleDays: number;                // e.g. 7 — after N days cycle restarts

    // Bonus multiplier for milestones
    milestoneMultipliers: Record<string, number>; // e.g. { "7": 2, "30": 5 }

    // Limits
    maxDailyClaimsPerUser: number;    // Usually 1
    maxTotalRewardPerUser: number;    // 0 = unlimited

    // Active window (optional date range)
    activeFrom: Date | null;
    activeTo: Date | null;

    // Audit
    updatedBy: string;
    note: string;
}

const DailyCheckinConfigSchema: Schema = new Schema({
    configKey:              { type: String, required: true, unique: true, default: 'default' },
    enabled:                { type: Boolean, default: true },
    scheduleType:           { type: String, default: 'daily', enum: ['daily', 'weekly', 'monthly', 'custom'] },
    customIntervalDays:     { type: Number, default: 1 },
    rewardMode:             { type: String, default: 'fixed', enum: ['fixed', 'random'] },
    fixedRewards:           { type: [Number], default: [10, 20, 30, 50, 75, 100, 200] },
    randomMin:              { type: [Number], default: [5, 10, 15, 25, 35, 50, 100] },
    randomMax:              { type: [Number], default: [20, 40, 60, 100, 150, 200, 500] },
    currency:               { type: String, default: 'INR', enum: ['INR', 'USD'] },
    walletTarget:           { type: String, default: 'MAIN', enum: ['MAIN', 'BONUS'] },
    requiresDeposit:        { type: Boolean, default: true },
    minDepositAmount:       { type: Number, default: 0 },
    streakResetOnMiss:      { type: Boolean, default: false },
    cycleDays:              { type: Number, default: 7 },
    milestoneMultipliers:   { type: Schema.Types.Mixed, default: { '7': 2, '30': 5 } },
    maxDailyClaimsPerUser:  { type: Number, default: 1 },
    maxTotalRewardPerUser:  { type: Number, default: 0 },
    activeFrom:             { type: Date, default: null },
    activeTo:               { type: Date, default: null },
    updatedBy:              { type: String, default: 'admin' },
    note:                   { type: String, default: '' },
    // NEW FEATURES
    spinWheelEnabled:       { type: Boolean, default: true },
    spinWheelSlices:        { type: [Schema.Types.Mixed], default: [] },
    vipMultiplierEnabled:   { type: Boolean, default: true },
    vipTierMultipliers:     { type: Schema.Types.Mixed, default: { BRONZE: 1, SILVER: 1.5, GOLD: 2, PLATINUM: 3, DIAMOND: 5 } },
    luckyJackpotEnabled:    { type: Boolean, default: true },
    luckyJackpotChancePercent: { type: Number, default: 2 },
    luckyJackpotAmount:     { type: Number, default: 5000 },
    weeklyMegaRewardEnabled: { type: Boolean, default: true },
    weeklyMegaRewardAmount: { type: Number, default: 1000 },
    weeklyMegaStreakRequired: { type: Number, default: 7 },
    monthlyGrandPrizeEnabled: { type: Boolean, default: true },
    monthlyGrandPrizeAmount: { type: Number, default: 10000 },
    monthlyGrandPrizeStreakRequired: { type: Number, default: 30 },
    achievementsEnabled:    { type: Boolean, default: true },
    achievements:           { type: [Schema.Types.Mixed], default: [] },
    referralBonusEnabled:   { type: Boolean, default: true },
    referralBonusPercent:   { type: Number, default: 20 },
    referralBonusMaxPerDay: { type: Number, default: 500 },
    leaderboardEnabled:     { type: Boolean, default: true },
    leaderboardTopN:        { type: Number, default: 10 },
    faqs:                   { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true, collection: 'daily_checkin_configs' });

export const DailyCheckinConfig = mongoose.models.DailyCheckinConfig ||
    mongoose.model<IDailyCheckinConfig>('DailyCheckinConfig', DailyCheckinConfigSchema);

// ─── DailyCheckinClaim ────────────────────────────────────────────────────────
export interface IDailyCheckinClaim extends Document {
    userId: number;
    username: string;
    cycleDay: number;
    streak: number;
    baseReward: number;
    vipMultiplier: number;
    milestoneMultiplier: number;
    referralBonus: number;
    jackpotAmount: number;
    totalReward: number;
    walletTarget: string;
    rewardType: string;
    spinWheelSlice: string | null;
    achievementsUnlocked: string[];
    weeklyMegaClaimed: boolean;
    weeklyMegaAmount: number;
    monthlyGrandClaimed: boolean;
    monthlyGrandAmount: number;
    currency: string;
    claimDate: string;
}

const DailyCheckinClaimSchema: Schema = new Schema({
    userId:              { type: Number, required: true, index: true },
    username:            { type: String, required: true },
    cycleDay:            { type: Number, required: true },
    streak:              { type: Number, required: true },
    baseReward:          { type: Number, required: true },
    vipMultiplier:       { type: Number, default: 1 },
    milestoneMultiplier: { type: Number, default: 1 },
    referralBonus:       { type: Number, default: 0 },
    jackpotAmount:       { type: Number, default: 0 },
    totalReward:         { type: Number, required: true },
    walletTarget:        { type: String, default: 'MAIN' },
    rewardType:          { type: String, default: 'fixed' },
    spinWheelSlice:      { type: String, default: null },
    achievementsUnlocked: { type: [String], default: [] },
    weeklyMegaClaimed:   { type: Boolean, default: false },
    weeklyMegaAmount:    { type: Number, default: 0 },
    monthlyGrandClaimed: { type: Boolean, default: false },
    monthlyGrandAmount:  { type: Number, default: 0 },
    currency:            { type: String, default: 'INR' },
    claimDate:           { type: String, required: true, index: true },
}, { timestamps: true, collection: 'daily_checkin_claims' });

DailyCheckinClaimSchema.index({ userId: 1, claimDate: 1 }, { unique: true });

export const DailyCheckinClaim = mongoose.models.DailyCheckinClaim ||
    mongoose.model<IDailyCheckinClaim>('DailyCheckinClaim', DailyCheckinClaimSchema);

// ─── BetfairSport (betfair_sports — seeded by Sportradar) ─────────────────────

export interface IBetfairSport extends Document {
    sportId: string;       // "sr:sport:21"
    name: string;          // "Cricket"
    isActive: boolean;
    isTab: boolean;
    isDefault: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

const BetfairSportSchema: Schema = new Schema({
    sportId:   { type: String, required: true, unique: true, index: true },
    name:      { type: String, required: true },
    isActive:  { type: Boolean, default: true },
    isTab:     { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true, collection: 'betfair_sports' });

BetfairSportSchema.index({ sortOrder: 1 });

export const BetfairSport = mongoose.models.BetfairSport ||
    mongoose.model<IBetfairSport>('BetfairSport', BetfairSportSchema);

// ─── BetfairEvent (betfair_events — synced from Sportradar events-catalogue) ──

export interface IBetfairEvent extends Document {
    eventId: string;
    sportId: string;
    competitionId: string;
    competitionName: string;
    countryCode: string;
    eventName: string;
    homeTeam: string;
    awayTeam: string;
    marketStartTime: string;
    inplay: boolean;
    status: string;   // OPEN | CLOSED | COMPLETED
    isVisible: boolean;
    isPinned: boolean;
    primaryMarketId: string;
    primaryMarketType: string;
    team1Image?: string;
    team2Image?: string;
    createdAt: Date;
    updatedAt: Date;
}

const BetfairEventSchema: Schema = new Schema({
    eventId:          { type: String, required: true, unique: true, index: true },
    sportId:          { type: String, required: true, index: true },
    competitionId:    { type: String, required: true, index: true },
    competitionName:  { type: String, required: true },
    countryCode:      { type: String, default: '' },
    eventName:        { type: String, required: true },
    homeTeam:         { type: String, default: '' },
    awayTeam:         { type: String, default: '' },
    marketStartTime:  { type: String, default: '' },
    inplay:           { type: Boolean, default: false, index: true },
    status:           { type: String, default: 'OPEN' }, // OPEN | CLOSED | COMPLETED
    isVisible:        { type: Boolean, default: true, index: true },
    isPinned:         { type: Boolean, default: false, index: true },
    primaryMarketId:  { type: String, default: '' },
    primaryMarketType:{ type: String, default: 'MATCH_ODDS' },
    team1Image:       { type: String, default: '' },
    team2Image:       { type: String, default: '' },
}, { timestamps: true, collection: 'betfair_events' });

BetfairEventSchema.index({ sportId: 1, inplay: 1, isVisible: 1 });
BetfairEventSchema.index({ competitionId: 1 });
BetfairEventSchema.index({ marketStartTime: 1 });

export const BetfairEvent = mongoose.models.BetfairEvent ||
    mongoose.model<IBetfairEvent>('BetfairEvent', BetfairEventSchema);

// ─── BetfairMarket (betfair_markets — synced from Sportradar market odds) ──────

export interface IBetfairMarketRunner {
    selectionId: number;
    runnerName: string;
    handicap: number;
    status: string; // ACTIVE | SUSPENDED | WINNER | LOSER
    lastPriceTraded: number;
    totalMatched: number;
    availableToBack: { price: number; size: number }[];
    availableToLay:  { price: number; size: number }[];
}

export interface IBetfairMarket extends Document {
    marketId: string;
    eventId: string;
    sportId: string;
    competitionId: string;
    marketName: string;
    marketType: string;
    bettingType: string;
    marketStartTime: string;
    status: string;  // OPEN | SUSPENDED | CLOSED
    inplay: boolean;
    stopBet: boolean;
    numberOfRunners: number;
    numberOfActiveRunners: number;
    runners: IBetfairMarketRunner[];
    isVisible: boolean;
    oddsUpdatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const RunnerSubSchema = new Schema({
    selectionId:      { type: Number },
    runnerName:       { type: String, default: '' },
    handicap:         { type: Number, default: 0 },
    status:           { type: String, default: 'ACTIVE' },
    lastPriceTraded:  { type: Number, default: 0 },
    totalMatched:     { type: Number, default: 0 },
    availableToBack:  [{ price: Number, size: Number }],
    availableToLay:   [{ price: Number, size: Number }],
}, { _id: false });

const BetfairMarketSchema: Schema = new Schema({
    marketId:              { type: String, required: true, unique: true, index: true },
    eventId:               { type: String, required: true, index: true },
    sportId:               { type: String, required: true, index: true },
    competitionId:         { type: String, required: true, index: true },
    marketName:            { type: String, required: true },
    marketType:            { type: String, required: true },
    bettingType:           { type: String, default: 'ODDS' },
    marketStartTime:       { type: String, default: '' },
    status:                { type: String, default: 'OPEN' },
    inplay:                { type: Boolean, default: false, index: true },
    stopBet:               { type: Boolean, default: false },
    numberOfRunners:       { type: Number, default: 0 },
    numberOfActiveRunners: { type: Number, default: 0 },
    runners:               { type: [RunnerSubSchema], default: [] },
    isVisible:             { type: Boolean, default: true },
    oddsUpdatedAt:         { type: Date, default: null },
}, { timestamps: true, collection: 'betfair_markets' });

BetfairMarketSchema.index({ eventId: 1, status: 1 });
BetfairMarketSchema.index({ sportId: 1, inplay: 1, status: 1 });

export const BetfairMarket = mongoose.models.BetfairMarket ||
    mongoose.model<IBetfairMarket>('BetfairMarket', BetfairMarketSchema);

// ─── SportLeague (sport_leagues — seeded from Redis, admin manages imageUrl) ───

export interface ISportLeague extends Document {
    competitionId: string;
    competitionName: string;
    sportId: string;
    sportName: string;
    imageUrl: string;
    isVisible: boolean;
    order: number;
    eventCount: number;
    liveCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const SportLeagueSchema: Schema = new Schema({
    competitionId:   { type: String, required: true, unique: true, index: true },
    competitionName: { type: String, required: true },
    sportId:         { type: String, required: true, index: true },
    sportName:       { type: String, default: '' },
    imageUrl:        { type: String, default: '' },
    isVisible:       { type: Boolean, default: true },
    order:           { type: Number, default: 0 },
    eventCount:      { type: Number, default: 0 },
    liveCount:       { type: Number, default: 0 },
}, { timestamps: true, collection: 'sport_leagues' });

SportLeagueSchema.index({ isVisible: 1, order: 1 });
SportLeagueSchema.index({ sportId: 1 });

export const SportLeague = mongoose.models.SportLeague ||
    mongoose.model<ISportLeague>('SportLeague', SportLeagueSchema);

// ─── AdminLoginLog (Moved from Prisma to MongoDB per user request) ───────

export interface IAdminLoginLog extends Document {
    adminId: number;
    email: string;
    ipAddress: string;
    userAgent: string;
    createdAt: Date;
}

const AdminLoginLogSchema: Schema = new Schema({
    adminId:   { type: Number, required: true, index: true },
    email:     { type: String, required: true },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
}, { timestamps: true, collection: 'admin_login_logs' });

AdminLoginLogSchema.index({ createdAt: -1 });

export const AdminLoginLog = mongoose.models.AdminLoginLog ||
    mongoose.model<IAdminLoginLog>('AdminLoginLog', AdminLoginLogSchema);

// ─── PageSlider — admin-managed hero sliders for HOME / CASINO / SPORTS ───────

export interface ISlide {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    badge: string;            // eyebrow badge pill
    tag: string;              // gold tag pill (like PromoCard.tag)
    imageUrl: string;
    mobileImageUrl: string;
    charImage: string;        // right-side character/mascot image
    gradient: string;
    overlayOpacity: number;
    overlayGradient: string;  // e.g. left-to-right dark gradient for text readability
    textColor: string;
    textAlign: 'left' | 'center' | 'right';
    ctaText: string;
    ctaLink: string;
    ctaStyle: string;
    gameCode: string;         // if set, CTA launches this casino game directly
    gameProvider: string;     // provider for gameCode
    ctaSecondaryText: string;
    ctaSecondaryLink: string;
    isActive: boolean;
    order: number;
}

export interface IPageSlider extends Document {
    page: 'HOME' | 'CASINO' | 'SPORTS';
    isActive: boolean;
    heightDesktop: number;   // px
    heightMobile: number;    // px
    autoplay: boolean;
    autoplayInterval: number; // ms
    transitionEffect: 'fade' | 'slide';
    borderRadius: number;    // px
    slides: ISlide[];
    updatedAt: Date;
    createdAt: Date;
}

const SlideSubSchema = new Schema({
    id:                 { type: String, required: true },
    title:              { type: String, default: '' },
    subtitle:           { type: String, default: '' },
    description:        { type: String, default: '' },
    badge:              { type: String, default: '' },
    tag:                { type: String, default: '' },
    imageUrl:           { type: String, default: '' },
    mobileImageUrl:     { type: String, default: '' },
    charImage:          { type: String, default: '' },
    gradient:           { type: String, default: 'linear-gradient(135deg, #1a0f05 0%, #2d1a0a 100%)' },
    overlayOpacity:     { type: Number, default: 40, min: 0, max: 100 },
    overlayGradient:    { type: String, default: '' },
    textColor:          { type: String, default: '#ffffff' },
    textAlign:          { type: String, default: 'left', enum: ['left', 'center', 'right'] },
    ctaText:            { type: String, default: '' },
    ctaLink:            { type: String, default: '/' },
    ctaStyle:           { type: String, default: 'gold' },
    gameCode:           { type: String, default: '' },
    gameProvider:       { type: String, default: '' },
    ctaSecondaryText:   { type: String, default: '' },
    ctaSecondaryLink:   { type: String, default: '' },
    isActive:           { type: Boolean, default: true },
    order:              { type: Number, default: 0 },
}, { _id: false });

const PageSliderSchema: Schema = new Schema({
    page:               { type: String, required: true, unique: true, enum: ['HOME', 'CASINO', 'SPORTS'] },
    isActive:           { type: Boolean, default: true },
    heightDesktop:      { type: Number, default: 460 },
    heightMobile:       { type: Number, default: 220 },
    autoplay:           { type: Boolean, default: true },
    autoplayInterval:   { type: Number, default: 5000 },
    transitionEffect:   { type: String, default: 'fade', enum: ['fade', 'slide'] },
    borderRadius:       { type: Number, default: 16 },
    slides:             { type: [SlideSubSchema], default: [] },
}, { timestamps: true, collection: 'page_sliders' });

PageSliderSchema.index({ page: 1 });

export const PageSlider = mongoose.models.PageSlider ||
    mongoose.model<IPageSlider>('PageSlider', PageSliderSchema);

// ─── Fantasy ──────────────────────────────────────────────────────────────────
// Mirror of the NestJS backend fantasy schemas. Field names must stay in sync
// with /newbackend/src/fantasy/schemas/*.ts

// Fantasy Match
const FantasyMatchSchema: Schema = new Schema({
    externalMatchId:        { type: Number, required: true, unique: true, index: true },
    title:                  { type: String, required: true },
    subtitle:               { type: String },
    competitionId:          { type: Number, index: true },
    competitionTitle:       { type: String },
    format:                 { type: String },
    teamA:                  { type: Schema.Types.Mixed },
    teamB:                  { type: Schema.Types.Mixed },
    venue:                  { type: String },
    startDate:              { type: Date, index: true },
    status:                 { type: Number, default: 1, index: true }, // 1=upcoming 2=live 3=completed
    statusNote:             { type: String },
    scoreA:                 { type: Schema.Types.Mixed, default: {} },
    scoreB:                 { type: Schema.Types.Mixed, default: {} },
    result:                 { type: String },
    shortTitle:             { type: String },
    matchNumber:            { type: String },
    statusStr:              { type: String },
    toss:                   { type: Schema.Types.Mixed, default: {} },
    competition:            { type: Schema.Types.Mixed, default: {} },
    playing11Announced:     { type: Boolean, default: false },
    squads:                 { type: [Schema.Types.Mixed], default: [] },
    fantasyPoints:          { type: Schema.Types.Mixed, default: {} },
    fantasyPointsBreakdown: { type: Schema.Types.Mixed, default: {} },
    lastSyncedAt:           { type: Date },
    pointsLastSyncedAt:     { type: Date },
}, { timestamps: true, collection: 'fantasy_matches' });
FantasyMatchSchema.index({ status: 1, startDate: -1 });

export const FantasyMatch = mongoose.models.FantasyMatch ||
    mongoose.model('FantasyMatch', FantasyMatchSchema);

// Fantasy Contest
const FantasyContestSchema: Schema = new Schema({
    matchId:        { type: Number, required: true, index: true }, // externalMatchId
    title:          { type: String, required: true },
    type:           { type: String, required: true },  // mega | head2head | winner_takes_all | practice
    entryFee:       { type: Number, required: true },
    totalPrize:     { type: Number, required: true },
    maxSpots:       { type: Number, required: true },
    filledSpots:    { type: Number, default: 0 },
    prizeBreakdown: { type: [Schema.Types.Mixed], default: [] },
    isActive:       { type: Boolean, default: true },
    isAutoCreated:  { type: Boolean, default: false },
    icon:           { type: String },
    accent:         { type: String },
}, { timestamps: true, collection: 'fantasy_contests' });
FantasyContestSchema.index({ matchId: 1, isActive: 1 });

export const FantasyContest = mongoose.models.FantasyContest ||
    mongoose.model('FantasyContest', FantasyContestSchema);

// Fantasy Team (user-built playing XI)
const FantasyTeamSchema: Schema = new Schema({
    userId:         { type: Number, required: true, index: true },
    matchId:        { type: Number, required: true, index: true },
    teamName:       { type: String, required: true },
    players:        { type: [Schema.Types.Mixed], required: true },
    captainId:      { type: Number, required: true },
    viceCaptainId:  { type: Number, required: true },
    totalCredits:   { type: Number, default: 0 },
    totalPoints:    { type: Number, default: 0 },
    playerPoints:   { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: 'fantasy_teams' });
FantasyTeamSchema.index({ userId: 1, matchId: 1 });

export const FantasyTeam = mongoose.models.FantasyTeam ||
    mongoose.model('FantasyTeam', FantasyTeamSchema);

// Fantasy Entry (join a contest with a team)
const FantasyEntrySchema: Schema = new Schema({
    userId:      { type: Number, required: true, index: true },
    contestId:   { type: String, required: true, index: true },
    teamId:      { type: String, required: true, index: true },
    matchId:     { type: Number, required: true, index: true },
    entryFee:    { type: Number, required: true },
    status:      { type: String, default: 'pending' }, // pending | settled | refunded
    rank:        { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    winnings:    { type: Number, default: 0 },
}, { timestamps: true, collection: 'fantasy_entries' });
FantasyEntrySchema.index({ userId: 1, matchId: 1 });
FantasyEntrySchema.index({ contestId: 1, totalPoints: -1 });

export const FantasyEntry = mongoose.models.FantasyEntry ||
    mongoose.model('FantasyEntry', FantasyEntrySchema);

// Fantasy Points System (one doc per format)
const FantasyPointsSystemSchema: Schema = new Schema({
    format:                 { type: String, required: true, unique: true }, // T20 | ODI | Test
    run:                    { type: Number, default: 1 },
    boundary:               { type: Number, default: 1 },
    six:                    { type: Number, default: 2 },
    halfCentury:            { type: Number, default: 4 },
    century:                { type: Number, default: 8 },
    duck:                   { type: Number, default: -2 },
    wicket:                 { type: Number, default: 25 },
    bowlingThreeWickets:    { type: Number, default: 8 },
    bowlingFiveWickets:     { type: Number, default: 16 },
    maiden:                 { type: Number, default: 12 },
    economyBonusBelow6:     { type: Number, default: -1 },
    economyPenaltyAbove10:  { type: Number, default: 1 },
    catch_points:           { type: Number, default: 8 },
    stumping:               { type: Number, default: 12 },
    runOut:                 { type: Number, default: 6 },
    playerOfTheMatch:       { type: Number, default: 4 },
    captainMultiplier:      { type: Number, default: 2 },
    viceCaptainMultiplier:  { type: Number, default: 1.5 },
    playing11Bonus:         { type: Number, default: 4 },
}, { timestamps: true, collection: 'fantasy_points_system' });

export const FantasyPointsSystem = mongoose.models.FantasyPointsSystem ||
    mongoose.model('FantasyPointsSystem', FantasyPointsSystemSchema);

// ─── Fantasy Extras ───────────────────────────────────────────────────────────

const FantasyConfigSchema: Schema = new Schema({
    key: { type: String, default: 'singleton', unique: true },
    creditCap: { type: Number, default: 100 },
    squadSize: { type: Number, default: 11 },
    maxPlayersFromOneTeam: { type: Number, default: 7 },
    minKeepers: { type: Number, default: 1 }, maxKeepers: { type: Number, default: 8 },
    minBatsmen: { type: Number, default: 3 }, maxBatsmen: { type: Number, default: 8 },
    minAllrounders: { type: Number, default: 1 }, maxAllrounders: { type: Number, default: 4 },
    minBowlers: { type: Number, default: 3 }, maxBowlers: { type: Number, default: 8 },
    maxTeamsPerMatch: { type: Number, default: 20 },
    defaultMultiEntryCap: { type: Number, default: 20 },
    platformFeePercent: { type: Number, default: 15 },
    maxBonusUsePercent: { type: Number, default: 100 },
    minWalletBalanceForJoin: { type: Number, default: 0 },
    signupBonus: { type: Number, default: 50 },
    firstJoinBonus: { type: Number, default: 25 },
    referrerBonus: { type: Number, default: 10 },
    refereeBonus: { type: Number, default: 5 },
    allowPrivateContests: { type: Boolean, default: true },
    allowTeamCloning:    { type: Boolean, default: true },
    allowMultiEntry:     { type: Boolean, default: true },
    allowPowerups:       { type: Boolean, default: true },
    allowPromocodes:     { type: Boolean, default: true },
    allowStreakRewards:  { type: Boolean, default: true },
    lockOffsetMinutes:   { type: Number, default: 15 },
    isMaintenanceMode:   { type: Boolean, default: false },
    maintenanceMessage:  { type: String, default: '' },
}, { timestamps: true, collection: 'fantasy_config' });
export const FantasyConfig = mongoose.models.FantasyConfig || mongoose.model('FantasyConfig', FantasyConfigSchema);

const FantasyPromocodeSchema: Schema = new Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, default: '' },
    discountPercent: { type: Number, default: 0 },
    flatOff: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
    minEntryFee: { type: Number, default: 0 },
    maxUsesTotal: { type: Number, default: 0 },
    maxUsesPerUser: { type: Number, default: 1 },
    usesSoFar: { type: Number, default: 0 },
    allowedMatches: { type: [Number], default: [] },
    allowedContestTypes: { type: [String], default: [] },
    userSegment: { type: [Number], default: [] },
    validFrom: { type: Date },
    validTo: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    firstTimeUserOnly: { type: Boolean, default: false },
}, { timestamps: true, collection: 'fantasy_promocodes' });
export const FantasyPromocode = mongoose.models.FantasyPromocode || mongoose.model('FantasyPromocode', FantasyPromocodeSchema);

const FantasyContestTemplateSchema: Schema = new Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, required: true },
    entryFee: { type: Number, required: true },
    totalPrize: { type: Number, required: true },
    maxSpots: { type: Number, required: true },
    multiEntry: { type: Number, default: 1 },
    isGuaranteed: { type: Boolean, default: false },
    prizeBreakdown: { type: [Schema.Types.Mixed], default: [] },
    autoFormats: { type: [String], default: ['T20', 'ODI', 'Test'] },
    autoAttach: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    icon: { type: String }, accent: { type: String },
}, { timestamps: true, collection: 'fantasy_contest_templates' });
export const FantasyContestTemplate = mongoose.models.FantasyContestTemplate || mongoose.model('FantasyContestTemplate', FantasyContestTemplateSchema);

const FantasyStreakSchema: Schema = new Schema({
    userId: { type: Number, required: true, unique: true, index: true },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastClaimDate: { type: String, default: '' },
    totalDaysClaimed: { type: Number, default: 0 },
    lifetimeRewardAmount: { type: Number, default: 0 },
}, { timestamps: true, collection: 'fantasy_streaks' });
export const FantasyStreak = mongoose.models.FantasyStreak || mongoose.model('FantasyStreak', FantasyStreakSchema);

const FantasyStreakRewardSchema: Schema = new Schema({
    key: { type: String, default: 'default', unique: true },
    schedule: { type: [Schema.Types.Mixed], default: [] },
    isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'fantasy_streak_rewards' });
export const FantasyStreakReward = mongoose.models.FantasyStreakReward || mongoose.model('FantasyStreakReward', FantasyStreakRewardSchema);

const FantasyPowerupSchema: Schema = new Schema({
    userId: { type: Number, required: true, index: true },
    type: { type: String, required: true },
    count: { type: Number, default: 1 },
    source: { type: String, default: '' },
    expiresAt: { type: Date },
}, { timestamps: true, collection: 'fantasy_powerups' });
export const FantasyPowerup = mongoose.models.FantasyPowerup || mongoose.model('FantasyPowerup', FantasyPowerupSchema);

const FantasyPlayerCreditOverrideSchema: Schema = new Schema({
    matchId: { type: Number, required: true, index: true },
    playerId: { type: Number, required: true, index: true },
    newCredit: { type: Number, required: true },
    reason: { type: String, default: '' },
    adminUsername: { type: String },
}, { timestamps: true, collection: 'fantasy_player_credit_overrides' });
FantasyPlayerCreditOverrideSchema.index({ matchId: 1, playerId: 1 }, { unique: true });
export const FantasyPlayerCreditOverride = mongoose.models.FantasyPlayerCreditOverride || mongoose.model('FantasyPlayerCreditOverride', FantasyPlayerCreditOverrideSchema);

const FantasyNotificationSchema: Schema = new Schema({
    userId: { type: Number, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    matchId: { type: Number }, contestId: { type: String }, link: { type: String },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
}, { timestamps: true, collection: 'fantasy_notifications' });
export const FantasyNotification = mongoose.models.FantasyNotification || mongoose.model('FantasyNotification', FantasyNotificationSchema);

const FantasyActivityLogSchema: Schema = new Schema({
    action: { type: String, required: true, index: true },
    adminUsername: { type: String },
    actorIp: { type: String },
    targetType: { type: String }, targetId: { type: String },
    payload: { type: Schema.Types.Mixed, default: {} },
    note: { type: String, default: '' },
}, { timestamps: true, collection: 'fantasy_activity_logs' });
FantasyActivityLogSchema.index({ createdAt: -1 });
export const FantasyActivityLog = mongoose.models.FantasyActivityLog || mongoose.model('FantasyActivityLog', FantasyActivityLogSchema);

const FantasyBonusRuleSchema: Schema = new Schema({
    trigger: { type: String, required: true, unique: true },
    displayName: { type: String, default: 'Bonus' },
    description: { type: String, default: '' },
    kind: { type: String, default: 'flat', enum: ['flat', 'percent'] },
    amount: { type: Number, default: 0 },
    maxPayout: { type: Number, default: 0 },
    minSpend: { type: Number, default: 0 },
    wageringMultiplier: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'fantasy_bonus_rules' });
export const FantasyBonusRule = mongoose.models.FantasyBonusRule || mongoose.model('FantasyBonusRule', FantasyBonusRuleSchema);

const FantasyReferralSchema: Schema = new Schema({
    referrerId: { type: Number, required: true, index: true },
    refereeId: { type: Number, required: true, unique: true, index: true },
    status: { type: String, default: 'pending' },
    totalEarned: { type: Number, default: 0 },
    events: { type: [Schema.Types.Mixed], default: [] },
    referralCode: { type: String },
}, { timestamps: true, collection: 'fantasy_referrals' });
export const FantasyReferral = mongoose.models.FantasyReferral || mongoose.model('FantasyReferral', FantasyReferralSchema);
