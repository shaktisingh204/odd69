export type MaintenanceScope = 'platform' | 'sports' | 'casino';

export type MaintenanceSectionState = {
    enabled: boolean;
    message: string;
};

export type MaintenanceConfig = Record<MaintenanceScope, MaintenanceSectionState> & { allowedUsers: string[] };

export const defaultMaintenanceConfig: MaintenanceConfig = {
    platform: { enabled: false, message: '' },
    sports: { enabled: false, message: '' },
    casino: { enabled: false, message: '' },
    allowedUsers: [],
};

const normalizeSection = (input: unknown): MaintenanceSectionState => {
    if (!input || typeof input !== 'object') {
        return { enabled: false, message: '' };
    }

    const section = input as Partial<MaintenanceSectionState>;
    return {
        enabled: Boolean(section.enabled),
        message: String(section.message || '').trim(),
    };
};

export const extractMaintenanceConfig = (settings: unknown): MaintenanceConfig => {
    const source = settings && typeof settings === 'object'
        ? settings as Record<string, unknown>
        : {};

    let parsedConfig: Partial<MaintenanceConfig> = {};

    if (source.maintenanceConfig && typeof source.maintenanceConfig === 'object') {
        parsedConfig = source.maintenanceConfig as Partial<MaintenanceConfig>;
    } else if (typeof source.MAINTENANCE_CONFIG === 'string') {
        try {
            parsedConfig = JSON.parse(source.MAINTENANCE_CONFIG) as Partial<MaintenanceConfig>;
        } catch {
            parsedConfig = {};
        }
    }

    const platform = normalizeSection(parsedConfig.platform);
    const sports = normalizeSection(parsedConfig.sports);
    const casino = normalizeSection(parsedConfig.casino);

    if (source.MAINTENANCE_MODE === 'true') {
        platform.enabled = true;
    }
    if (!platform.message && typeof source.MAINTENANCE_MESSAGE === 'string') {
        platform.message = source.MAINTENANCE_MESSAGE.trim();
    }

    const allowedUsersStr = typeof source.MAINTENANCE_ALLOWED_USERS === 'string' ? source.MAINTENANCE_ALLOWED_USERS : '';
    const allowedUsers = allowedUsersStr.split(',').filter(Boolean).map(u => u.trim());

    return {
        platform,
        sports,
        casino,
        allowedUsers,
    };
};

export const isScopeBlocked = (config: MaintenanceConfig, scope: MaintenanceScope): boolean => {
    if (scope === 'platform') {
        return config.platform.enabled;
    }

    return config.platform.enabled || config[scope].enabled;
};

export const getMaintenanceMessage = (
    config: MaintenanceConfig,
    scope: MaintenanceScope,
    fallbackMessage: string,
): string => {
    if (config.platform.enabled) {
        return config.platform.message || fallbackMessage;
    }

    return config[scope].message || fallbackMessage;
};
