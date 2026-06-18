import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Categories ──────────────────────────────────────────────────────

  async findAllCategories() {
    return this.prisma.knowledgeCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { children: true, _count: { select: { articles: true } } },
    });
  }

  async createCategory(data: {
    name: string;
    slug: string;
    description?: string;
    parentId?: number;
    sortOrder?: number;
  }) {
    return this.prisma.knowledgeCategory.create({ data });
  }

  async updateCategory(
    id: number,
    data: Partial<Parameters<typeof this.createCategory>[0]>,
  ) {
    const cat = await this.prisma.knowledgeCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException(`Category #${id} not found`);
    return this.prisma.knowledgeCategory.update({ where: { id }, data });
  }

  async removeCategory(id: number) {
    const cat = await this.prisma.knowledgeCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException(`Category #${id} not found`);
    return this.prisma.knowledgeCategory.delete({ where: { id } });
  }

  // ─── Articles ────────────────────────────────────────────────────────

  async findAllArticles(query: {
    categoryId?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { categoryId, search, page = 1, limit = 20 } = query;
    const where: Prisma.KnowledgeArticleWhereInput = {};

    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.knowledgeArticle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { category: true },
      }),
      this.prisma.knowledgeArticle.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOneArticle(id: number) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
      include: { category: true, versions: { orderBy: { version: 'desc' } } },
    });
    if (!article) throw new NotFoundException(`Article #${id} not found`);
    return article;
  }

  async createArticle(data: {
    title: string;
    content: string;
    categoryId?: number;
    tags?: string[];
    priority?: number;
    isPublished?: boolean;
    metadata?: any;
    createdBy?: number;
  }) {
    return this.prisma.knowledgeArticle.create({ data });
  }

  async updateArticle(
    id: number,
    data: Partial<Parameters<typeof this.createArticle>[0]>,
  ) {
    const article = await this.findOneArticle(id);

    // Create a version snapshot before updating
    await this.prisma.knowledgeArticleVersion.create({
      data: {
        articleId: id,
        title: article.title,
        content: article.content,
        version: article.version,
      },
    });

    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }

  async removeArticle(id: number) {
    await this.findOneArticle(id);
    return this.prisma.knowledgeArticle.delete({ where: { id } });
  }

  // ─── Versions ────────────────────────────────────────────────────────

  async getArticleVersions(articleId: number) {
    return this.prisma.knowledgeArticleVersion.findMany({
      where: { articleId },
      orderBy: { version: 'desc' },
    });
  }

  async restoreArticleVersion(articleId: number, versionId: number) {
    const version = await this.prisma.knowledgeArticleVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.articleId !== articleId) {
      throw new NotFoundException(`Version #${versionId} not found for article #${articleId}`);
    }

    const article = await this.findOneArticle(articleId);

    // Save current state as a version before restoring
    await this.prisma.knowledgeArticleVersion.create({
      data: {
        articleId,
        title: article.title,
        content: article.content,
        version: article.version,
      },
    });

    return this.prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: {
        title: version.title,
        content: version.content,
        version: { increment: 1 },
      },
    });
  }

  // ─── Search / Import / Export ────────────────────────────────────────

  async searchArticles(query: string) {
    return this.prisma.knowledgeArticle.findMany({
      where: {
        isPublished: true,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { tags: { hasSome: [query] } },
        ],
      },
      orderBy: { priority: 'desc' },
      take: 20,
      include: { category: true },
    });
  }

  async importArticles(
    data: {
      title: string;
      content: string;
      categoryId?: number;
      tags?: string[];
    }[],
  ) {
    return this.prisma.knowledgeArticle.createMany({ data });
  }

  async exportArticles() {
    return this.prisma.knowledgeArticle.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
