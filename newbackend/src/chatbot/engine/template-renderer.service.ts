import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class TemplateRendererService {
  constructor(private readonly prisma: PrismaService) {}

  async render(templateContent: string, userId: number): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        balance: true,
        cryptoBalance: true,
        vipTier: true,
        createdAt: true,
      },
    });

    if (!user) {
      return templateContent;
    }

    const data: Record<string, any> = {
      username: user.username ?? '',
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      balance: user.balance?.toString() ?? '0',
      cryptoBalance: user.cryptoBalance?.toString() ?? '0',
      vipTier: user.vipTier ?? '',
      userId: user.id.toString(),
    };

    return this.renderWithData(templateContent, data);
  }

  renderWithData(
    templateContent: string,
    data: Record<string, any>,
  ): string {
    let result = templateContent;

    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      result = result.split(placeholder).join(String(value ?? ''));
    }

    return result;
  }
}
