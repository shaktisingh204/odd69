import { Module } from '@nestjs/common';
import { ContactSettingsController } from './contact-settings.controller';
import { ContactSettingsService } from './contact-settings.service';

@Module({
    controllers: [ContactSettingsController],
    providers: [ContactSettingsService],
    exports: [ContactSettingsService],
})
export class ContactSettingsModule { }
