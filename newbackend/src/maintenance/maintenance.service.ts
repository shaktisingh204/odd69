import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export const MAINTENANCE_CONFIG_KEY = 'MAINTENANCE_CONFIG';

export type MaintenanceScope = 'platform' | 'sports' | 'casino';

export type MaintenanceSectionState = {
  enabled: boolean;
  message: string;
};

export type MaintenanceConfig = Record<
  MaintenanceScope,
  MaintenanceSectionState
> & { allowedUsers: string[] };

const DEFAULT_MAINTENANCE_CONFIG: MaintenanceConfig = {
  platform: { enabled: false, message: '' },
  sports: { enabled: false, message: '' },
  casino: { enabled: false, message: '' },
  allowedUsers: [],
};

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  private readonly cacheTtlMs = 5_000;
  private cachedConfig: MaintenanceConfig | null = null;
  private cachedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async getConfig(forceRefresh = false): Promise<MaintenanceConfig> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.cachedConfig &&
      now - this.cachedAt < this.cacheTtlMs
    ) {
      return this.cachedConfig;
    }

    const [configRow, legacyModeRow, legacyMessageRow, allowedUsersRow] = await Promise.all([
      this.prisma.systemConfig.findUnique({
        where: { key: MAINTENANCE_CONFIG_KEY },
      }),
      this.prisma.systemConfig.findUnique({
        where: { key: 'MAINTENANCE_MODE' },
      }),
      this.prisma.systemConfig.findUnique({
        where: { key: 'MAINTENANCE_MESSAGE' },
      }),
      this.prisma.systemConfig.findUnique({
        where: { key: 'MAINTENANCE_ALLOWED_USERS' },
      }),
    ]);

    const parsed = this.parseConfig(configRow?.value);
    const legacyPlatformEnabled = legacyModeRow?.value === 'true';
    const legacyPlatformMessage = legacyMessageRow?.value || '';
    const allowedUsersStr = allowedUsersRow?.value || '';
    const allowedUsers = allowedUsersStr.split(',').filter(Boolean).map(u => u.trim());

    const merged: MaintenanceConfig = {
      platform: {
        enabled: parsed.platform.enabled || legacyPlatformEnabled,
        message: parsed.platform.message || legacyPlatformMessage,
      },
      sports: parsed.sports,
      casino: parsed.casino,
      allowedUsers,
    };

    this.cachedConfig = merged;
    this.cachedAt = now;
    return merged;
  }

  async assertScopeAvailable(
    scope: Exclude<MaintenanceScope, 'platform'>,
    fallbackMessage?: string,
    userId?: number,
  ): Promise<void> {
    const config = await this.getConfig();
    const globalMessage =
      config.platform.message ||
      fallbackMessage ||
      'Platform is under maintenance.';
    const scopedMessage =
      config[scope].message ||
      fallbackMessage ||
      `${this.labelForScope(scope)} is under maintenance.`;

    let isPlatformBlocked = config.platform.enabled;
    let isScopeBlocked = config[scope].enabled;

    if ((isPlatformBlocked || isScopeBlocked) && userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { username: true, email: true } });
      if (user) {
        const username = typeof user.username === 'string' ? user.username.toLowerCase() : '';
        const email = typeof user.email === 'string' ? user.email.toLowerCase() : '';
        const hasAccess = config.allowedUsers.some(u => {
          const search = u.toLowerCase();
          return search === username || search === email;
        });

        if (hasAccess) {
          isPlatformBlocked = false;
          isScopeBlocked = false;
        }
      }
    }

    if (isPlatformBlocked) {
      throw new ServiceUnavailableException(globalMessage);
    }

    if (isScopeBlocked) {
      throw new ServiceUnavailableException(scopedMessage);
    }
  }

  async isScopeEnabled(scope: MaintenanceScope): Promise<boolean> {
    const config = await this.getConfig();
    if (scope === 'platform') {
      return config.platform.enabled;
    }

    return config.platform.enabled || config[scope].enabled;
  }

  async getPublicConfig(): Promise<MaintenanceConfig> {
    return this.getConfig();
  }

  private parseConfig(rawValue?: string | null): MaintenanceConfig {
    if (!rawValue) {
      return DEFAULT_MAINTENANCE_CONFIG;
    }

    try {
      const parsed = JSON.parse(rawValue);
      return {
        platform: this.normalizeSection(parsed?.platform),
        sports: this.normalizeSection(parsed?.sports),
        casino: this.normalizeSection(parsed?.casino),
        allowedUsers: [],
      };
    } catch (error) {
      this.logger.warn(
        `Failed to parse ${MAINTENANCE_CONFIG_KEY}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return DEFAULT_MAINTENANCE_CONFIG;
    }
  }

  private normalizeSection(raw: unknown): MaintenanceSectionState {
    if (!raw || typeof raw !== 'object') {
      return { enabled: false, message: '' };
    }

    const section = raw as Partial<MaintenanceSectionState>;
    return {
      enabled: Boolean(section.enabled),
      message: String(section.message || '').trim(),
    };
  }

  private labelForScope(scope: Exclude<MaintenanceScope, 'platform'>): string {
    if (scope === 'sports') return 'Sports';
    return 'Casino';
  }
}
