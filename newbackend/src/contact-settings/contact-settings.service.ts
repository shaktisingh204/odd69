import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const CONTACT_KEY = 'CONTACT_SETTINGS';

const DEFAULTS = {
    whatsappNumber: '',
    whatsappLabel: 'Support',
    whatsappDefaultMessage: 'Hi, I need help with my account.',
    telegramHandle: '',
    telegramLink: '',
    telegramChannelLink: '',
    emailAddress: '',
    whatsappEnabled: true,
    telegramEnabled: true,
    emailEnabled: true,
};

@Injectable()
export class ContactSettingsService {
    constructor(private readonly prisma: PrismaService) { }

    /** Read from the SystemConfig row — same store the admin uses */
    async get(): Promise<typeof DEFAULTS> {
        try {
            const record = await this.prisma.systemConfig.findUnique({ where: { key: CONTACT_KEY } });
            const parsed = record?.value ? JSON.parse(record.value) : {};
            return { ...DEFAULTS, ...parsed };
        } catch {
            return DEFAULTS;
        }
    }

    /** Upsert into SystemConfig — same store the admin uses */
    async update(dto: Partial<typeof DEFAULTS>): Promise<typeof DEFAULTS> {
        const current = await this.get();
        const merged = { ...current, ...dto };
        await this.prisma.systemConfig.upsert({
            where: { key: CONTACT_KEY },
            update: { value: JSON.stringify(merged) },
            create: { key: CONTACT_KEY, value: JSON.stringify(merged) },
        });
        return merged;
    }
}
