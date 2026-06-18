import { Injectable, UnauthorizedException, ConflictException, Logger, BadRequestException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './auth/dto/auth.dto';
import { v4 as uuidv4 } from 'uuid';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserTrafficEvent, UserTrafficEventDocument } from './auth/schemas/user-traffic-event.schema';

import { ReferralService } from './referral/referral.service';
import { EmailService } from './email/email.service';
import { SmsService } from './sms/sms.service';
import { RedisService } from './redis/redis.service';

// ─── Random username generator ───────────────────────────────────────────────

const USERNAME_WORDS = [
    'ace', 'apex', 'arch', 'arrow', 'axe', 'bear', 'blade', 'blaze', 'bolt', 'brave',
    'chief', 'claw', 'cobra', 'coin', 'dart', 'dawn', 'dash', 'dusk', 'eagle', 'echo',
    'elite', 'ember', 'falcon', 'flame', 'flash', 'fox', 'frost', 'fury', 'gale',
    'ghost', 'glide', 'gold', 'grave', 'grit', 'hawk', 'haze', 'hero', 'high', 'hunt',
    'iron', 'jade', 'jaguar', 'jet', 'keen', 'king', 'knight', 'lance', 'legend',
    'lion', 'lure', 'lynx', 'mace', 'mark', 'maven', 'might', 'monk', 'moon', 'nova',
    'onyx', 'orion', 'peak', 'phantom', 'pilot', 'pulse', 'quick', 'raven', 'razor',
    'reef', 'rogue', 'rush', 'sage', 'savage', 'scout', 'shadow', 'shark', 'shield',
    'silver', 'sky', 'slate', 'smoke', 'snake', 'sonic', 'spark', 'spike', 'spirit',
    'star', 'steel', 'storm', 'striker', 'swift', 'thor', 'tiger', 'titan', 'torch',
    'tribe', 'turbo', 'ultra', 'valor', 'venom', 'vibe', 'victor', 'viking', 'viper',
    'void', 'volt', 'wave', 'wild', 'wolf', 'wrath', 'yeti', 'zeal', 'zen', 'zephyr',
];

function generateUsername(): string {
    const word = USERNAME_WORDS[Math.floor(Math.random() * USERNAME_WORDS.length)];
    const digits = String(Math.floor(1000 + Math.random() * 9000)); // 1000–9999
    const suffix = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a–z
    return `${word}${digits}${suffix}`;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private referralService: ReferralService,
        private emailService: EmailService,
        private smsService: SmsService,
        private redisService: RedisService,
        @InjectModel(UserTrafficEvent.name)
        private trafficEventModel: Model<UserTrafficEventDocument>,
    ) { }

    private normalizeEmail(email?: string | null) {
        const value = String(email || '').trim().toLowerCase();
        return value || undefined;
    }

    private normalizePhoneNumber(phoneNumber?: string | null) {
        const value = String(phoneNumber || '').trim();
        return value || undefined;
    }

    async validateUser(identifier: string, pass: string): Promise<any> {
        try {
            const normalizedIdentifier = String(identifier || '').trim();
            const normalizedEmail = normalizedIdentifier.includes('@')
                ? this.normalizeEmail(normalizedIdentifier)
                : undefined;
            const orConditions: any[] = [
                { phoneNumber: normalizedIdentifier },
                { username: normalizedIdentifier },
            ];

            if (normalizedEmail) {
                orConditions.unshift({
                    email: { equals: normalizedEmail, mode: 'insensitive' },
                });
            } else {
                orConditions.unshift({ email: normalizedIdentifier });
            }

            const user = await this.prisma.user.findFirst({
                where: {
                    OR: orConditions,
                },
            });

            if (!user) {
                this.logger.warn(`User not found: ${normalizedIdentifier}`);
                return { __reason: 'NOT_FOUND' };
            }

            const isMatch = await bcrypt.compare(pass, user.password);
            if (!isMatch) {
                this.logger.warn(`Password mismatch for user: ${normalizedIdentifier}`);
                return { __reason: 'WRONG_PASSWORD' };
            }

            // Block banned users from logging in
            if ((user as any).isBanned) {
                this.logger.warn(`Banned user attempted login: ${normalizedIdentifier}`);
                return { __reason: 'BANNED' };
            }

            const { password, ...result } = user;
            return result;
        } catch (error) {
            this.logger.error(`Error validating user: ${identifier}`, error.stack);
            throw error;
        }
    }

    async login(user: any, ip: string = '', userAgent: string = '') {
        try {
            const payload = { username: user.username, sub: user.id, role: user.role };
            
            // Log traffic event mapped to login
            if (ip) {
                this.trafficEventModel.create({
                    userId: user.id,
                    utm_source: 'login',
                    ip: ip || null,
                    userAgent: userAgent || null,
                }).catch(e => this.logger.warn('Traffic event save failed on login', e?.message));
            }

            return {
                access_token: this.jwtService.sign(payload),
                user: user,
            };
        } catch (error) {
            this.logger.error(`Error signing JWT for user: ${user.username}`, error.stack);
            throw error;
        }
    }

    async loginWithOtp(identifier: string, code: string, ip: string = '', userAgent: string = '') {
        try {
            const normalizedIdentifier = String(identifier || '').trim();
            const normalizedEmail = normalizedIdentifier.includes('@')
                ? this.normalizeEmail(normalizedIdentifier)
                : undefined;
            const orConditions: any[] = [
                { phoneNumber: normalizedIdentifier },
                { username: normalizedIdentifier },
            ];

            if (normalizedEmail) {
                orConditions.unshift({
                    email: { equals: normalizedEmail, mode: 'insensitive' },
                });
            } else {
                orConditions.unshift({ email: normalizedIdentifier });
            }

            const user = await this.prisma.user.findFirst({
                where: { OR: orConditions },
            });

            if (!user) {
                this.logger.warn(`User not found for OTP login: ${normalizedIdentifier}`);
                throw new UnauthorizedException('No account found with this identifier.');
            }

            if ((user as any).isBanned) {
                this.logger.warn(`Banned user attempted OTP login: ${normalizedIdentifier}`);
                throw new UnauthorizedException('Your account has been suspended. Please contact support.');
            }

            // Verify OTP
            let verifiedOtp = null;
            if (normalizedEmail || (user.email && identifier === user.email)) {
                verifiedOtp = await (this.prisma as any).emailOtp.findFirst({
                    where: {
                        email: user.email,
                        code: code,
                        purpose: 'LOGIN',
                        used: false,
                        expiresAt: { gt: new Date() },
                    },
                });
                if (verifiedOtp) {
                    await (this.prisma as any).emailOtp.update({
                        where: { id: verifiedOtp.id },
                        data: { used: true },
                    });
                }
            }
            
            if (!verifiedOtp && (user.phoneNumber && (identifier === user.phoneNumber || !normalizedEmail))) {
                verifiedOtp = await (this.prisma as any).phoneOtp.findFirst({
                    where: {
                        phoneNumber: user.phoneNumber,
                        code: code,
                        purpose: 'LOGIN',
                        used: false,
                        expiresAt: { gt: new Date() },
                    },
                });
                if (verifiedOtp) {
                    await (this.prisma as any).phoneOtp.update({
                        where: { id: verifiedOtp.id },
                        data: { used: true },
                    });
                }
            }

            if (!verifiedOtp) {
                throw new UnauthorizedException('Invalid or expired OTP.');
            }

            const { password, ...result } = user;
            return this.login(result, ip, userAgent);
        } catch (error) {
            this.logger.error(`Error validating OTP login for: ${identifier}`, error.stack);
            throw error;
        }
    }

    async signup(data: SignupDto & { referralCode?: string }, ip = '', userAgent = '') {
        // ── Guard: IP registration rate limit (max 3 accounts per IP per 24h) ────────────
        /*
        if (ip && ip !== 'unknown') {
            const normalizedIp = ip.split(',')[0].trim().replace(/^::ffff:/, '');
            if (normalizedIp) {
                const rateLimitKey = `auth:signup:ip:${normalizedIp}`;
                try {
                    const allowed = await this.redisService.checkRateLimit(rateLimitKey, 3, 60 * 60 * 24);
                    if (!allowed) {
                        this.logger.warn(`[Auth] Registration blocked — IP ${normalizedIp} exceeded daily account limit`);
                        throw new HttpException(
                            'Too many accounts created from this network. Please try again tomorrow or contact support.',
                            HttpStatus.TOO_MANY_REQUESTS,
                        );
                    }
                } catch (e) {
                    if (e instanceof HttpException) throw e;
                    // Redis unavailable — allow signup to proceed (fail-open)
                    this.logger.warn('[Auth] Redis unavailable for IP rate limit check — allowing signup');
                }
            }
        }
        */

        const normalizedEmail = this.normalizeEmail(data.email);
        const normalizedPhoneNumber = this.normalizePhoneNumber(data.phoneNumber);

        if (!normalizedEmail && !normalizedPhoneNumber) {
            throw new ConflictException('Email or Phone Number is required');
        }

        // ── Phone signup: require a verified OTP ─────────────────────────────────
        if (normalizedPhoneNumber) {
            const verifiedOtp = await (this.prisma as any).phoneOtp.findFirst({
                where: {
                    phoneNumber: normalizedPhoneNumber,
                    purpose: 'REGISTER',
                    used: true,
                    expiresAt: { gt: new Date(Date.now() - 2 * 60 * 1000) }, // 2-min grace for phone OTP
                },
                orderBy: { createdAt: 'desc' },
            });
            if (!verifiedOtp) {
                throw new BadRequestException(
                    'Phone number not verified. Please complete OTP verification before signing up.'
                );
            }
        }

        // ── Email signup: require a verified OTP ─────────────────────────────────
        if (normalizedEmail) {
            const verifiedOtp = await (this.prisma as any).emailOtp.findFirst({
                where: {
                    email: normalizedEmail,
                    purpose: 'REGISTER',
                    used: true,
                    expiresAt: { gt: new Date(Date.now() - 10 * 60 * 1000) }, // 10-min grace for email OTP
                },
                orderBy: { createdAt: 'desc' },
            });
            if (!verifiedOtp) {
                throw new BadRequestException(
                    'Email not verified. Please complete OTP verification before signing up.'
                );
            }
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);

        // Generate a new referral code for this user
        const myReferralCode = await this.referralService.generateReferralCode();

        try {
            // Accept client-supplied username if available
            const {
                referralCode: _inRef,
                promoCode: _inPromo,
                username: _clientUsername,
                utm_source, utm_medium, utm_campaign, utm_content, utm_term,
                referrerUrl, landingPage,
                ...prismaData
            } = data as any;

            if (normalizedEmail) {
                const existingEmailUser = await this.prisma.user.findFirst({
                    where: {
                        email: { equals: normalizedEmail, mode: 'insensitive' },
                    },
                    select: { id: true },
                });
                if (existingEmailUser) {
                    throw new ConflictException('User with this Email already exists');
                }
            }

            if (normalizedPhoneNumber) {
                const existingPhoneUser = await this.prisma.user.findUnique({
                    where: { phoneNumber: normalizedPhoneNumber },
                    select: { id: true },
                });
                if (existingPhoneUser) {
                    throw new ConflictException('User with this Phone Number already exists');
                }
            }

            let username = _clientUsername ? _clientUsername.trim() : generateUsername();
            
            if (_clientUsername) {
                const usernameRegex = /^[a-zA-Z0-9_]{3,15}$/;
                if (!usernameRegex.test(username)) {
                    throw new BadRequestException('Username must be 3-15 characters and contain only letters, numbers, and underscores');
                }
                const exists = await this.prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } });
                if (exists) throw new ConflictException('Username is already taken');
            } else {
                for (let i = 0; i < 4; i++) {
                    const exists = await this.prisma.user.findUnique({ where: { username } });
                    if (!exists) break;
                    username = generateUsername();
                }
            }

            const user = await this.prisma.user.create({
                data: {
                    ...prismaData,
                    email: normalizedEmail,
                    phoneNumber: normalizedPhoneNumber,
                    username,
                    password: hashedPassword,
                    balance: 0,
                    role: data.role || 'USER',
                    referralCode: myReferralCode,
                },
            });

            // ── Write traffic attribution to MongoDB (fire & forget) ───────────────────────
            if (utm_source || referrerUrl || landingPage || ip) {
                this.trafficEventModel.create({
                    userId: user.id,
                    utm_source: utm_source || null,
                    utm_medium: utm_medium || null,
                    utm_campaign: utm_campaign || null,
                    utm_content: utm_content || null,
                    utm_term: utm_term || null,
                    referrerUrl: referrerUrl || null,
                    landingPage: landingPage || null,
                    ip: ip || null,
                    userAgent: userAgent || null,
                }).catch(e => this.logger.warn('Traffic event save failed', e?.message));
            }

            // Apply referral code if provided (separate from promoCode)
            if (data.referralCode) {
                try {
                    await this.referralService.applyReferral(user.id, data.referralCode.trim().toUpperCase());
                } catch (e) {
                    console.log('Failed to apply referral code', e);
                    // Don't block signup
                }
            }

            // Note: data.promoCode is for bonus redemption — handled separately by the bonus system

            // Send welcome email (non-blocking)
            if (user.email) {
                this.emailService.sendRegisterSuccess(user.email, user.username || user.email).catch(e =>
                    this.logger.warn('Register welcome email failed', e?.message)
                );
            }

            const { password, ...result } = user;
            return this.login(result);
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('User with this Email or Phone already exists');
            }
            throw error;
        }
    }

    // ─── Refresh Token ─────────────────────────────────────────────────────────

    async refreshToken(userId: number): Promise<{ access_token: string }> {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || (user as any).isBanned) {
            throw new UnauthorizedException('Cannot refresh token');
        }
        const payload = { username: user.username, sub: user.id, role: user.role };
        return { access_token: this.jwtService.sign(payload) };
    }

    // ─── Forgot Password ────────────────────────────────────────────────────────

    async forgotPassword(email: string, frontendUrl: string = ''): Promise<{ message: string }> {
        // Always return the same message to avoid user enumeration
        const genericMsg = { message: 'If an account with that email exists, a reset link has been sent.' };
        const normalizedEmail = this.normalizeEmail(email);
        if (!normalizedEmail) return genericMsg;

        const user = await this.prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (!user) return genericMsg;

        // Invalidate any existing tokens for this user
        await this.prisma.passwordResetToken.updateMany({
            where: { userId: user.id, used: false },
            data: { used: true },
        });

        // Create a new token (expires 1 hour)
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await this.prisma.passwordResetToken.create({
            data: { userId: user.id, token, expiresAt },
        });

        // Build reset link
        const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetLink = `${baseUrl}/reset-password?token=${token}`;

        // Send email (non-blocking)
        this.emailService.sendForgotPassword(normalizedEmail, resetLink, user.username || undefined).catch(e =>
            this.logger.warn('Forgot password email failed', e?.message)
        );

        return genericMsg;
    }

    // ─── Reset Password ─────────────────────────────────────────────────────────

    async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
        const record = await this.prisma.passwordResetToken.findUnique({ where: { token } });

        if (!record) throw new BadRequestException('Invalid or expired reset link.');
        if (record.used) throw new BadRequestException('This reset link has already been used.');
        if (new Date() > record.expiresAt) throw new BadRequestException('This reset link has expired. Please request a new one.');

        const hashed = await bcrypt.hash(newPassword, 10);

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: record.userId },
                data: { password: hashed },
            }),
            this.prisma.passwordResetToken.update({
                where: { id: record.id },
                data: { used: true },
            }),
        ]);

        this.logger.log(`Password reset successful for userId: ${record.userId}`);

        return { message: 'Password has been reset successfully. You can now log in.' };
    }

    // ─── Email OTP: Send ────────────────────────────────────────────────────────

    async sendEmailOtp(email: string, purpose: string): Promise<{ message: string }> {
        return this.emailService.sendOtpEmail(this.normalizeEmail(email) || email, purpose);
    }

    // ─── Email OTP: Verify ──────────────────────────────────────────────────────

    async verifyEmailOtp(email: string, code: string, purpose: string): Promise<{ verified: boolean }> {
        const normalizedEmail = this.normalizeEmail(email) || email;
        const otpRecord = await this.prisma.emailOtp.findFirst({
            where: { email: normalizedEmail, purpose, used: false },
            orderBy: { createdAt: 'desc' },
        });

        if (!otpRecord) throw new BadRequestException('No pending OTP found. Please request a new one.');
        if (new Date() > otpRecord.expiresAt) throw new BadRequestException('OTP has expired. Please request a new one.');
        if (otpRecord.attempts >= 5) throw new BadRequestException('Too many failed attempts. Please request a new OTP.');
        if (otpRecord.code !== code) {
            await this.prisma.emailOtp.update({
                where: { id: otpRecord.id },
                data: { attempts: { increment: 1 } },
            });
            throw new BadRequestException('Invalid OTP.');
        }

        await this.prisma.emailOtp.update({
            where: { id: otpRecord.id },
            data: { used: true },
        });

        return { verified: true };
    }

    // ─── Email Forgot Password: Send OTP ────────────────────────────────────────

    async emailForgotPassword(email: string): Promise<{ message: string }> {
        const genericMsg = { message: 'If an account with that email exists, an OTP has been sent.' };
        const normalizedEmail = this.normalizeEmail(email);
        if (!normalizedEmail) return genericMsg;

        const user = await this.prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (!user) return genericMsg; // don't reveal existence

        await this.emailService.sendOtpEmail(normalizedEmail, 'FORGOT_PASSWORD');
        return genericMsg;
    }

    // ─── Email Reset Password ───────────────────────────────────────────────────

    async resetPasswordByEmail(email: string, code: string, newPassword: string): Promise<{ message: string }> {
        const normalizedEmail = this.normalizeEmail(email);
        if (!normalizedEmail) throw new BadRequestException('Invalid email.');

        const verifiedOtp = await (this.prisma as any).emailOtp.findFirst({
            where: {
                email: normalizedEmail,
                code,
                purpose: 'FORGOT_PASSWORD',
                used: true,
                expiresAt: { gt: new Date(Date.now() - 10 * 60 * 1000) }, // 10-min grace for email OTP
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!verifiedOtp) {
            throw new BadRequestException('OTP verification required. Please verify your OTP first.');
        }

        const user = await this.prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (!user) throw new BadRequestException('No account found with this email.');

        const hashed = await bcrypt.hash(newPassword, 10);

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: user.id },
                data: { password: hashed },
            }),
            this.prisma.passwordResetToken.updateMany({
                where: { userId: user.id, used: false },
                data: { used: true },
            }),
        ]);

        this.logger.log(`Email-OTP password reset for userId: ${user.id}`);
        return { message: 'Password has been reset successfully. You can now log in.' };
    }

    // ─── Phone OTP: Send ────────────────────────────────────────────────────────

    async sendPhoneOtp(phoneNumber: string, purpose: string): Promise<{ message: string }> {
        return this.smsService.sendOtp(phoneNumber, purpose);
    }

    // ─── Phone OTP: Verify ──────────────────────────────────────────────────────

    async verifyPhoneOtp(phoneNumber: string, code: string, purpose: string): Promise<{ verified: boolean }> {
        await this.smsService.verifyOtp(phoneNumber, code, purpose);
        return { verified: true };
    }

    // ─── Bind Mobile Number ─────────────────────────────────────────────────────

    async bindMobileNumber(userId: number, phoneNumber: string, code: string): Promise<{ message: string }> {
        // 1. Verify OTP
        await this.verifyPhoneOtp(phoneNumber, code, 'BIND_MOBILE');

        // 2. Check if the phone number is already taken
        const existingToken = await this.prisma.user.findFirst({
            where: { phoneNumber }
        });
        
        if (existingToken && existingToken.id !== userId) {
            throw new ConflictException('This phone number is already registered to another account.');
        }

        // 3. Update User
        await this.prisma.user.update({
            where: { id: userId },
            data: { phoneNumber }
        });

        return { message: 'Mobile number bound successfully.' };
    }

    // ─── Bind Email Address ─────────────────────────────────────────────────────

    async bindEmailAddress(userId: number, email: string, code: string): Promise<{ message: string }> {
        // 1. Normalize and Verify OTP
        const normalizedEmail = this.normalizeEmail(email);
        if (!normalizedEmail) throw new BadRequestException('Invalid email address.');
        await this.verifyEmailOtp(email, code, 'BIND_EMAIL');

        // 2. Check if the email is already taken
        const existing = await this.prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
        });
        
        if (existing && existing.id !== userId) {
            throw new ConflictException('This email is already registered to another account.');
        }

        // 3. Update User
        await this.prisma.user.update({
            where: { id: userId },
            data: { email: normalizedEmail }
        });

        return { message: 'Email bound successfully.' };
    }

    // ─── Phone Forgot Password: Send OTP ────────────────────────────────────────

    async phoneForgotPassword(phoneNumber: string): Promise<{ message: string }> {
        const genericMsg = { message: 'If an account with that phone number exists, an OTP has been sent.' };

        const user = await this.prisma.user.findUnique({ where: { phoneNumber } });
        if (!user) return genericMsg; // don't reveal existence

        await this.smsService.sendOtp(phoneNumber, 'FORGOT_PASSWORD');
        return genericMsg;
    }

    // ─── Phone Reset Password ───────────────────────────────────────────────────
    /**
     * Confirms the OTP was already verified (used=true) and resets the password.
     * We do NOT call verifyOtp again because the caller already went through
     * /auth/verify-otp which marked the record used=true.
     */
    async resetPasswordByPhone(phoneNumber: string, code: string, newPassword: string): Promise<{ message: string }> {
        // Confirm the OTP was actually verified for this phone+code (used = true, within 15-min grace window)
        const verifiedOtp = await (this.prisma as any).phoneOtp.findFirst({
            where: {
                phoneNumber,
                code,
                purpose: 'FORGOT_PASSWORD',
                used: true,
                expiresAt: { gt: new Date(Date.now() - 2 * 60 * 1000) }, // 2-min grace for phone OTP
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!verifiedOtp) {
            throw new BadRequestException('OTP verification required. Please verify your OTP first.');
        }

        // Find user
        const user = await this.prisma.user.findUnique({ where: { phoneNumber } });
        if (!user) throw new BadRequestException('No account found with this phone number.');

        // Hash new password
        const hashed = await bcrypt.hash(newPassword, 10);

        // Update password + invalidate any existing email reset tokens
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: user.id },
                data: { password: hashed },
            }),
            this.prisma.passwordResetToken.updateMany({
                where: { userId: user.id, used: false },
                data: { used: true },
            }),
        ]);

        this.logger.log(`Phone-OTP password reset for userId: ${user.id}`);
        return { message: 'Password has been reset successfully. You can now log in.' };
    }
}
