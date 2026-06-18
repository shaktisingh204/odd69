'use server'

import { prisma } from '@/lib/db';
import { cookies, headers } from 'next/headers';
import bcrypt from 'bcryptjs'; // Need to install bcryptjs as dev dependency or dependency
import { SignJWT } from 'jose';
import connectMongo from '@/lib/mongo';
import { AdminLoginLog } from '@/models/MongoModels';

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY || SECRET_KEY.length < 16) {
    throw new Error('JWT_SECRET env var is required and must be at least 16 characters');
}

export async function login(currentState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    if (!email || !password) {
        return { error: 'Email and password are required' };
    }

    try {
        const user = await prisma.user.findFirst({
            where: { email },
        });

        if (!user || !user.password) {
            return { error: 'Invalid credentials' };
        }

        // Check password
        // Using bcryptjs because backend uses bcrypt, format should be compatible
        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return { error: 'Invalid credentials' };
        }

        // Check Role
        if (!['TECH_MASTER', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
            return { error: 'Unauthorized access' };
        }

        // Create Session
        const secret = new TextEncoder().encode(SECRET_KEY);
        const alg = 'HS256';

        // SECURITY: 8h expiry (single working day). Shorter than before to
        // reduce the blast radius if a session token is leaked. Admins can
        // re-login at the start of each shift.
        const jwt = await new SignJWT({ sub: user.id.toString(), role: user.role, email: user.email })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime('8h')
            .sign(secret);

        // Set Cookie
        (await cookies()).set('token', jwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 8, // 8 hours
            path: '/',
        });

        // Save AdminLoginLog using MongoDB
        try {
            await connectMongo();
            const reqHeaders = await headers();
            const ipAddress = reqHeaders.get('x-forwarded-for')?.split(',')[0] || reqHeaders.get('x-real-ip') || 'Unknown';
            const userAgent = reqHeaders.get('user-agent') || 'Unknown';

            await AdminLoginLog.create({
                adminId: user.id,
                email: user.email!,
                ipAddress,
                userAgent,
            });
        } catch (logErr) {
            console.error('Failed to log admin login to MongoDB:', logErr);
            // Optionally decide if login should fail when logging fails. Usually, we allow login.
        }

        return { success: true, user: { id: user.id, email: user.email, role: user.role, username: user.username } };

    } catch (error) {
        console.error('Login error:', error);
        return { error: 'Something went wrong' };
    }
}

export async function logout() {
    (await cookies()).delete('token');
    return { success: true };
}
