import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class IntentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.chatbotIntent.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { trainingPhrases: true, responses: true } } },
    });
  }

  async findOne(id: number) {
    const intent = await this.prisma.chatbotIntent.findUnique({
      where: { id },
      include: { trainingPhrases: true, responses: true },
    });
    if (!intent) throw new NotFoundException(`Intent #${id} not found`);
    return intent;
  }

  async create(data: {
    name: string;
    displayName: string;
    description?: string;
    category?: string;
    confidenceThreshold?: number;
    isEnabled?: boolean;
    priority?: number;
  }) {
    return this.prisma.chatbotIntent.create({ data });
  }

  async update(id: number, data: Partial<Parameters<typeof this.create>[0]>) {
    await this.findOne(id);
    return this.prisma.chatbotIntent.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotIntent.delete({ where: { id } });
  }

  async addPhrase(intentId: number, phrase: string, language?: string) {
    await this.findOne(intentId);
    return this.prisma.chatbotTrainingPhrase.create({
      data: { intentId, phrase, language: language ?? 'en' },
    });
  }

  async removePhrase(phraseId: number) {
    const phrase = await this.prisma.chatbotTrainingPhrase.findUnique({
      where: { id: phraseId },
    });
    if (!phrase) throw new NotFoundException(`Phrase #${phraseId} not found`);
    return this.prisma.chatbotTrainingPhrase.delete({ where: { id: phraseId } });
  }

  async bulkAddPhrases(intentId: number, phrases: { phrase: string; language?: string }[]) {
    await this.findOne(intentId);
    return this.prisma.chatbotTrainingPhrase.createMany({
      data: phrases.map((p) => ({
        intentId,
        phrase: p.phrase,
        language: p.language ?? 'en',
      })),
    });
  }

  async toggle(id: number) {
    const intent = await this.findOne(id);
    return this.prisma.chatbotIntent.update({
      where: { id },
      data: { isEnabled: !intent.isEnabled },
    });
  }

  async getCategories() {
    const intents = await this.prisma.chatbotIntent.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return intents.map((i) => i.category);
  }
}
