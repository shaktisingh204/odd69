import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY || SECRET_KEY.length < 16) {
    throw new Error('JWT_SECRET env var is required and must be at least 16 characters');
}
const secretBytes = new TextEncoder().encode(SECRET_KEY);

export interface VerifiedAdmin {
    id: number;
    role: string;
    email?: string;
}

/**
 * Extract + cryptographically verify the admin JWT from the httpOnly cookie.
 * Returns null if missing, invalid, expired, or the caller lacks an admin role.
 *
 * SECURITY: All mutating server actions MUST call this (or requireAdmin) —
 * never trust client-supplied adminId parameters. `jose.decodeJwt` does NOT
 * verify the signature and must not be used for auth decisions.
 */
export async function verifyAdmin(): Promise<VerifiedAdmin | null> {
    try {
        const token = (await cookies()).get('token')?.value;
        if (!token) return null;

        const { payload } = await jwtVerify(token, secretBytes);
        const id = Number(payload.sub);
        const role = String((payload as any).role || '');
        if (!Number.isFinite(id) || id <= 0) return null;
        if (!['TECH_MASTER', 'SUPER_ADMIN', 'MANAGER', 'MASTER', 'AGENT'].includes(role)) {
            return null;
        }
        return { id, role, email: (payload as any).email };
    } catch {
        return null;
    }
}

/**
 * Like verifyAdmin but restricts to specific roles.
 * Returns null if the caller's role is not in the allowed list.
 */
export async function requireRole(
    allowed: string[],
): Promise<VerifiedAdmin | null> {
    const admin = await verifyAdmin();
    if (!admin) return null;
    if (!allowed.includes(admin.role)) return null;
    return admin;
}
