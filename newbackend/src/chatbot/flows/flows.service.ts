import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class FlowsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.chatbotFlow.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const flow = await this.prisma.chatbotFlow.findUnique({
      where: { id },
    });
    if (!flow) throw new NotFoundException(`Flow #${id} not found`);
    return flow;
  }

  async create(data: any) {
    return this.prisma.chatbotFlow.create({ data });
  }

  async update(id: number, data: any) {
    await this.findOne(id);
    return this.prisma.chatbotFlow.update({
      where: { id },
      data: { ...data, isDraft: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotFlow.delete({ where: { id } });
  }

  async publish(id: number) {
    const flow = await this.findOne(id);
    await this.prisma.chatbotFlowVersion.create({
      data: {
        flowId: id,
        version:
          (await this.prisma.chatbotFlowVersion.count({
            where: { flowId: id },
          })) + 1,
        nodes: flow.nodes as any,
        variables: flow.variables as any,
      },
    });
    return this.prisma.chatbotFlow.update({
      where: { id },
      data: { isPublished: true, isDraft: false },
    });
  }

  async unpublish(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotFlow.update({
      where: { id },
      data: { isPublished: false },
    });
  }

  async getVersions(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotFlowVersion.findMany({
      where: { flowId: id },
      orderBy: { version: 'desc' },
    });
  }

  async restoreVersion(flowId: number, versionId: number) {
    await this.findOne(flowId);
    const version = await this.prisma.chatbotFlowVersion.findUnique({
      where: { id: versionId },
    });
    if (!version)
      throw new NotFoundException(`Flow version #${versionId} not found`);

    return this.prisma.chatbotFlow.update({
      where: { id: flowId },
      data: {
        nodes: version.nodes as any,
        variables: version.variables as any,
        isDraft: true,
      },
    });
  }

  async duplicate(id: number) {
    const flow = await this.findOne(id);
    const { id: _id, createdAt, updatedAt, ...rest } = flow;
    return this.prisma.chatbotFlow.create({
      data: {
        ...rest,
        name: `${flow.name} (Copy)`,
        isPublished: false,
        isDraft: true,
      },
    });
  }

  async getTemplates() {
    return this.prisma.chatbotFlowTemplate.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createFromTemplate(templateId: number) {
    const template = await this.prisma.chatbotFlowTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template)
      throw new NotFoundException(`Flow template #${templateId} not found`);

    return this.prisma.chatbotFlow.create({
      data: {
        name: template.name,
        description: template.description,
        triggerType: 'keyword',
        nodes: template.nodes as any,
        variables: template.variables as any,
        isDraft: true,
        isPublished: false,
      },
    });
  }
}
