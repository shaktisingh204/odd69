import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportGateway } from './support.gateway';

@Module({
    controllers: [SupportController],
    providers: [SupportService, SupportGateway],
    exports: [SupportService],
})
export class SupportModule { }
