import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AutoReplyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.chatbotAutoReplyRule.findMany({
      orderBy: { priority: 'asc' },
    });
  }

  async findOne(id: number) {
    const rule = await this.prisma.chatbotAutoReplyRule.findUnique({
      where: { id },
    });
    if (!rule) throw new NotFoundException(`Auto-reply rule #${id} not found`);
    return rule;
  }

  async create(data: any) {
    return this.prisma.chatbotAutoReplyRule.create({ data });
  }

  async update(id: number, data: any) {
    await this.findOne(id);
    return this.prisma.chatbotAutoReplyRule.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotAutoReplyRule.delete({ where: { id } });
  }

  async toggle(id: number) {
    const rule = await this.findOne(id);
    return this.prisma.chatbotAutoReplyRule.update({
      where: { id },
      data: { isEnabled: !rule.isEnabled },
    });
  }

  async reorder(items: { id: number; priority: number }[]) {
    return this.prisma.$transaction(
      items.map((item) =>
        this.prisma.chatbotAutoReplyRule.update({
          where: { id: item.id },
          data: { priority: item.priority },
        }),
      ),
    );
  }

  async testRule(id: number, input: string) {
    const rule = await this.findOne(id);

    switch (rule.conditionType) {
      case 'keyword': {
        const keywords = Array.isArray(rule.conditionValue)
          ? (rule.conditionValue as string[])
          : [rule.conditionValue as string];
        const lowerInput = input.toLowerCase();
        const matched = keywords.filter((kw) =>
          lowerInput.includes(String(kw).toLowerCase()),
        );
        return {
          matched: matched.length > 0,
          matchedKeywords: matched,
          input,
        };
      }
      case 'regex': {
        const pattern = new RegExp(rule.conditionValue as string, 'i');
        const match = pattern.exec(input);
        return {
          matched: !!match,
          match: match ? match[0] : null,
          groups: match ? match.groups || null : null,
          input,
        };
      }
      case 'intent': {
        return {
          matched: true,
          info: `Intent matching for "${rule.conditionValue}" — requires NLU engine evaluation`,
          input,
        };
      }
      default:
        return { matched: false, error: `Unknown conditionType: ${rule.conditionType}`, input };
    }
  }

  async findFallbacks() {
    return this.prisma.chatbotAutoReplyRule.findMany({
      where: { isFallback: true },
      orderBy: { priority: 'asc' },
    });
  }
}
