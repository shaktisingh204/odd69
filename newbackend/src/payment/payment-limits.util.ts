import type { PrismaService } from '../prisma.service';

/**
 * Server-side minimum deposit enforcement. Reads the same `MIN_DEPOSIT` key
 * from SystemConfig that the frontend uses via /settings/public, so clients
 * can't bypass the limit by calling the API directly.
 *
 * Returns null if the amount is acceptable, or an error message string.
 */
export async function assertMinDeposit(
  prisma: PrismaService,
  amount: number,
  opts: { gatewayKey?: string; defaultMin?: number } = {},
): Promise<string | null> {
  const defaultMin = opts.defaultMin ?? 100;
  if (!amount || isNaN(amount) || amount <= 0) {
    return 'Invalid deposit amount';
  }
  try {
    // Try gateway-specific key first, then global
    const keys = opts.gatewayKey
      ? [opts.gatewayKey, 'MIN_DEPOSIT']
      : ['MIN_DEPOSIT'];
    let min = defaultMin;
    for (const key of keys) {
      const cfg = await (prisma as any).systemConfig.findUnique({
        where: { key },
      });
      if (cfg) {
        const parsed = parseFloat(cfg.value);
        if (!isNaN(parsed) && parsed > 0) {
          min = parsed;
          break;
        }
      }
    }
    if (amount < min) {
      return `Minimum deposit amount is ₹${min}`;
    }
    return null;
  } catch {
    if (amount < defaultMin) return `Minimum deposit amount is ₹${defaultMin}`;
    return null;
  }
}
