import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type MarketDocument = Market & Document;

@Schema({ timestamps: true })
export class Market {
    @Prop({ required: true, unique: true })
    market_id: string;

    @Prop({ required: true })
    market_name: string;

    @Prop({ required: true, index: true })
    event_id: string;

    @Prop()
    event_name: string;

    @Prop()
    runner1: string;

    @Prop()
    runner2: string;

    @Prop()
    draw: string;

    @Prop()
    start_time: Date;

    @Prop({ unique: true, sparse: true })
    sys_market_id: number;

    @Prop()
    is_market_data_delayed: boolean;

    @Prop({ type: MongooseSchema.Types.Mixed })
    description: any;

    @Prop({ type: MongooseSchema.Types.Mixed })
    runners_data: any;

    @Prop({ type: MongooseSchema.Types.Mixed })
    raw_response: any;

    @Prop({ default: false })
    is_active: boolean;

    @Prop()
    marketStatus: number;

    @Prop()
    status: string;

    @Prop({ type: [MongooseSchema.Types.Mixed] })
    marketOdds: any[];

    @Prop({ default: 0 })
    rc: number;

    @Prop({ default: 0 })
    gscode: number;

    @Prop({ default: 0 })
    m: number;

    @Prop({ default: 0 })
    oid: number;

    @Prop({ default: 'match' })
    gtype: string;

    @Prop()
    pmid: number;

    @Prop()
    rem: string;

    @Prop({ default: false })
    visible: boolean;

    @Prop()
    pid: number;

    @Prop()
    maxb: number;

    @Prop()
    sno: number;

    @Prop()
    dtype: number;

    @Prop()
    ocnt: number;

    @Prop()
    max: number;

    @Prop()
    min: number;

    @Prop({ default: false })
    biplay: boolean;

    @Prop()
    umaxbof: number;

    @Prop({ default: false })
    boplay: boolean;

    @Prop({ default: false })
    iplay: boolean;

    @Prop()
    btcnt: number;

    @Prop()
    company: string;
}

export const MarketSchema = SchemaFactory.createForClass(Market);

