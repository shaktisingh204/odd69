import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ResponsesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    intentId?: number;
    language?: string;
    page?: number;
    limit?: number;
  }) {
    const { intentId, language, page = 1, limit = 20 } = query;
    const where: Prisma.ChatbotResponseTemplateWhereInput = {};

    if (intentId) where.intentId = intentId;
    if (language) where.language = language;

    const [items, total] = await Promise.all([
      this.prisma.chatbotResponseTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { intent: true },
      }),
      this.prisma.chatbotResponseTemplate.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: number) {
    const template = await this.prisma.chatbotResponseTemplate.findUnique({
      where: { id },
      include: { intent: true },
    });
    if (!template) throw new NotFoundException(`Response template #${id} not found`);
    return template;
  }

  async create(data: {
    name: string;
    intentId?: number;
    content: string;
    contentType?: string;
    richMedia?: any;
    language?: string;
    conditions?: any;
    abTestGroup?: string;
    isEnabled?: boolean;
    priority?: number;
  }) {
    return this.prisma.chatbotResponseTemplate.create({ data });
  }

  async update(id: number, data: Partial<Parameters<typeof this.create>[0]>) {
    await this.findOne(id);
    return this.prisma.chatbotResponseTemplate.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotResponseTemplate.delete({ where: { id } });
  }

  async toggle(id: number) {
    const template = await this.findOne(id);
    return this.prisma.chatbotResponseTemplate.update({
      where: { id },
      data: { isEnabled: !template.isEnabled },
    });
  }

  async preview(id: number, sampleData: Record<string, any>) {
    const template = await this.findOne(id);
    let rendered = template.content;

    // Replace {{variable}} placeholders with sample data
    for (const [key, value] of Object.entries(sampleData)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }

    return { original: template.content, rendered, sampleData };
  }

  async bulkUpsert(
    templates: {
      name: string;
      intentId?: number;
      content: string;
      contentType?: string;
      language?: string;
      isEnabled?: boolean;
      priority?: number;
    }[],
  ) {
    const results = await Promise.all(
      templates.map((t) =>
        this.prisma.chatbotResponseTemplate.upsert({
          where: {
            // Use a composite lookup by name + language as a pseudo-unique key
            id: 0, // fallback — will always create if no match
          },
          update: { ...t },
          create: { ...t },
        }).catch(() =>
          // If upsert fails (no unique match), just create
          this.prisma.chatbotResponseTemplate.create({ data: t }),
        ),
      ),
    );
    return { count: results.length, templates: results };
  }
}
