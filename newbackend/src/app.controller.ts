import { Controller, Get, Header } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { MaintenanceService } from './maintenance/maintenance.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly maintenanceService: MaintenanceService,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('settings/public')
  // Public system config is the same for every visitor, so it's safe to
  // cache at the Cloudflare edge and in the Next.js Data Cache.
  //   max-age=30           → browser keeps it 30 s (covers tab switches)
  //   s-maxage=60          → Cloudflare caches the response for 60 s
  //   stale-while-revalidate=300
  //                        → CF serves stale for 5 min while refreshing,
  //                          so Postgres is hit at most once per 60 s per
  //                          edge PoP instead of on every pageload.
  @Header(
    'Cache-Control',
    'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
  )
  async getPublicSettings() {
    const configs = await this.prisma.systemConfig.findMany();
    const configMap = configs.reduce((acc: Record<string, string>, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    const maintenanceConfig = await this.maintenanceService.getPublicConfig();

    return {
      ...configMap,
      MAINTENANCE_MODE: String(maintenanceConfig.platform.enabled),
      MAINTENANCE_MESSAGE:
        maintenanceConfig.platform.message ||
        configMap.MAINTENANCE_MESSAGE ||
        '',
      MAINTENANCE_CONFIG:
        configMap.MAINTENANCE_CONFIG || JSON.stringify(maintenanceConfig),
      maintenanceConfig,
    };
  }
}
