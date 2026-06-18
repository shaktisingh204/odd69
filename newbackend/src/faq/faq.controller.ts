import { Controller, Get } from '@nestjs/common';
import { FaqService } from './faq.service';
import { Public } from '../auth/public.decorator';

@Controller('faq')
export class FaqController {
    constructor(private readonly faqService: FaqService) {}

    @Public()
    @Get()
    async getActiveFaqs() {
        return await this.faqService.getActiveFaqs();
    }
}
