import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Faq, FaqDocument } from './faq.schema';

@Injectable()
export class FaqService {
    private readonly logger = new Logger(FaqService.name);

    constructor(
        @InjectModel(Faq.name) private faqModel: Model<FaqDocument>,
    ) {}

    async getActiveFaqs() {
        try {
            const faqs = await this.faqModel
                .find({ isActive: true })
                .sort({ order: 1 })
                .exec();

            return { success: true, data: faqs };
        } catch (error) {
            this.logger.error(`Error fetching active FAQs: ${error.message}`);
            return { success: false, error: 'Failed to fetch FAQs' };
        }
    }
}
