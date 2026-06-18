'use server'

import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY || SECRET_KEY.length < 16) {
    throw new Error('JWT_SECRET env var is required and must be at least 16 characters');
}

export async function updateProfile(currentState: any, formData: FormData) {
    const newEmail = formData.get('email') as string;
    const newPassword = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (newPassword && newPassword !== confirmPassword) {
        return { error: 'Passwords do not match.' };
    }

    try {
        const token = (await cookies()).get('token')?.value;
        if (!token) return { error: 'Unauthorized.' };

        const secret = new TextEncoder().encode(SECRET_KEY);
        const { payload } = await jose.jwtVerify(token, secret);
        const userId = parseInt(payload.sub as string, 10);

        if (!userId) return { error: 'Invalid user session.' };

        const updateData: any = {};
        
        if (newEmail) {
            updateData.email = newEmail;
        }

        if (newPassword) {
            updateData.password = await bcrypt.hash(newPassword, 10);
        }

        if (Object.keys(updateData).length === 0) {
            return { error: 'Nothing to update.' };
        }

        // Check if email is taken
        if (newEmail) {
            const existing = await prisma.user.findFirst({ where: { email: newEmail, id: { not: userId } } });
            if (existing) {
                return { error: 'Email already in use.' };
            }
        }

        await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        return { success: true, message: 'Profile updated successfully. Please log in again if you changed your password.' };

    } catch (error) {
        console.error('Update profile error:', error);
        return { error: 'Failed to update profile.' };
    }
}
