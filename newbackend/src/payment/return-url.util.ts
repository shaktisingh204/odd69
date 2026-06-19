import type { PrismaService } from '../prisma.service';

/**
 * Allowlist-based validation for user-supplied returnUrl parameters passed
 * through to payment gateways. Prevents open-redirect via returnUrl.
 *
 * Allowlist sources (in order of precedence):
 *   1. SystemConfig key `PAYMENT_RETURN_URL_ALLOWED_HOSTS` (comma-separated
 *      hostnames) — managed from the admin panel.
 *   2. Env var `PAYMENT_RETURN_URL_ALLOWED_HOSTS` (same format).
 *   3. DEFAULT_ALLOWED_HOSTS baked into code.
 */

const DEFAULT_ALLOWED_HOSTS = [
  'odd69.com',
  'www.odd69.com',
  'admin.odd69.com',
  'kuberexchange.com',
  'www.kuberexchange.com',
  'admin.kuberexchange.com',
  'odd69.com',
  'www.odd69.com',
  'localhost',
  '127.0.0.1',
];

function parseHostList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Normalizes an entry from the admin config. Accepts either bare hostnames
 * ("odd69.com") or full URLs ("https://odd69.com/profile/transactions") and
 * returns the lowercased hostname so the allowlist comparison is consistent.
 */
function normalizeHostEntry(entry: string): string {
  const trimmed = entry.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).hostname;
    } catch {
      return '';
    }
  }
  // Strip any path / port noise defensively
  return trimmed.split('/')[0].split(':')[0];
}

async function getAllowedHosts(prisma?: PrismaService): Promise<string[]> {
  if (prisma) {
    try {
      const cfg = await (prisma as any).systemConfig.findUnique({
        where: { key: 'PAYMENT_RETURN_URL_ALLOWED_HOSTS' },
      });
      const list = parseHostList(cfg?.value).map(normalizeHostEntry).filter(Boolean);
      if (list.length > 0) return list;
    } catch {
      /* fall through to env / defaults */
    }
  }
  const envList = parseHostList(process.env.PAYMENT_RETURN_URL_ALLOWED_HOSTS)
    .map(normalizeHostEntry)
    .filter(Boolean);
  if (envList.length > 0) return envList;
  return DEFAULT_ALLOWED_HOSTS;
}

/**
 * Returns a safe returnUrl string if the provided URL's host is in the
 * admin-managed allowlist; otherwise returns a safe default (empty string
 * by default). Pass `prisma` so the allowlist can be loaded from SystemConfig.
 */
export async function sanitizeReturnUrl(
  returnUrl: unknown,
  prisma?: PrismaService,
  fallback: string = '',
): Promise<string> {
  if (!returnUrl || typeof returnUrl !== 'string') return fallback;
  try {
    const u = new URL(returnUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return fallback;
    const host = u.hostname.toLowerCase();
    const allowed = await getAllowedHosts(prisma);
    const ok = allowed.some((h) => host === h || host.endsWith('.' + h));
    return ok ? u.toString() : fallback;
  } catch {
    return fallback;
  }
}
