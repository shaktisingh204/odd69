import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class EntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.chatbotEntity.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { synonyms: true } } },
    });
  }

  async findOne(id: number) {
    const entity = await this.prisma.chatbotEntity.findUnique({
      where: { id },
      include: { synonyms: true },
    });
    if (!entity) throw new NotFoundException(`Entity #${id} not found`);
    return entity;
  }

  async create(data: {
    name: string;
    displayName: string;
    type: string;
    pattern?: string;
    values?: any;
  }) {
    return this.prisma.chatbotEntity.create({ data });
  }

  async update(id: number, data: Partial<Parameters<typeof this.create>[0]>) {
    await this.findOne(id);
    return this.prisma.chatbotEntity.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotEntity.delete({ where: { id } });
  }

  async getSynonyms(entityId: number) {
    await this.findOne(entityId);
    return this.prisma.chatbotSynonym.findMany({
      where: { entityId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addSynonym(entityId: number, data: { value: string; synonyms: string[] }) {
    await this.findOne(entityId);
    return this.prisma.chatbotSynonym.create({
      data: { entityId, ...data },
    });
  }

  async updateSynonym(synId: number, data: { value?: string; synonyms?: string[] }) {
    const syn = await this.prisma.chatbotSynonym.findUnique({ where: { id: synId } });
    if (!syn) throw new NotFoundException(`Synonym #${synId} not found`);
    return this.prisma.chatbotSynonym.update({ where: { id: synId }, data });
  }

  async removeSynonym(synId: number) {
    const syn = await this.prisma.chatbotSynonym.findUnique({ where: { id: synId } });
    if (!syn) throw new NotFoundException(`Synonym #${synId} not found`);
    return this.prisma.chatbotSynonym.delete({ where: { id: synId } });
  }

  async testExtraction(text: string) {
    const entities = await this.prisma.chatbotEntity.findMany({
      include: { synonyms: true },
    });

    const matches: { entityName: string; value: string; position: number }[] = [];

    for (const entity of entities) {
      // Test regex pattern if defined
      if (entity.pattern) {
        try {
          const regex = new RegExp(entity.pattern, 'gi');
          let match: RegExpExecArray | null;
          while ((match = regex.exec(text)) !== null) {
            matches.push({
              entityName: entity.name,
              value: match[0],
              position: match.index,
            });
          }
        } catch {
          // Skip invalid patterns
        }
      }

      // Test synonym matches
      for (const syn of entity.synonyms) {
        const allValues = [syn.value, ...syn.synonyms];
        for (const v of allValues) {
          const idx = text.toLowerCase().indexOf(v.toLowerCase());
          if (idx !== -1) {
            matches.push({
              entityName: entity.name,
              value: v,
              position: idx,
            });
          }
        }
      }
    }

    return { text, matches };
  }
}
