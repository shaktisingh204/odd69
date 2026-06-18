import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class GreetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.chatbotGreeting.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const greeting = await this.prisma.chatbotGreeting.findUnique({
      where: { id },
    });
    if (!greeting)
      throw new NotFoundException(`Greeting #${id} not found`);
    return greeting;
  }

  async create(data: any) {
    return this.prisma.chatbotGreeting.create({ data });
  }

  async update(id: number, data: any) {
    await this.findOne(id);
    return this.prisma.chatbotGreeting.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotGreeting.delete({ where: { id } });
  }

  async toggle(id: number) {
    const greeting = await this.findOne(id);
    return this.prisma.chatbotGreeting.update({
      where: { id },
      data: { isEnabled: !greeting.isEnabled },
    });
  }
}
