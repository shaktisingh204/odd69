import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Payment7Controller } from './payment7.controller';
import { Payment7Service } from './payment7.service';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [ConfigModule, EmailModule],
    controllers: [Payment7Controller],
    providers: [Payment7Service],
    exports: [Payment7Service],
})
export class Payment7Module {}
