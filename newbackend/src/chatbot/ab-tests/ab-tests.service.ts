import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AbTestsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.chatbotABTest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const test = await this.prisma.chatbotABTest.findUnique({
      where: { id },
    });
    if (!test) throw new NotFoundException(`A/B Test #${id} not found`);
    return test;
  }

  async create(data: {
    name: string;
    description?: string;
    variants: any;
    status?: string;
  }) {
    return this.prisma.chatbotABTest.create({ data });
  }

  async update(
    id: number,
    data: Partial<Parameters<typeof this.create>[0]>,
  ) {
    await this.findOne(id);
    return this.prisma.chatbotABTest.update({ where: { id }, data });
  }

  async start(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotABTest.update({
      where: { id },
      data: {
        status: 'running',
        startDate: new Date(),
      },
    });
  }

  async stop(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotABTest.update({
      where: { id },
      data: {
        status: 'completed',
        endDate: new Date(),
      },
    });
  }
}
