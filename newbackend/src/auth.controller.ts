import { Controller, Post, Body, UseGuards, Get, Request, Logger, UnauthorizedException, Query } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { AuthService } from './auth.service';
import { UsersService } from './users/users.service';
import { LoginDto, LoginOtpDto, SignupDto, ForgotPasswordDto, ResetPasswordDto, SendOtpDto, VerifyOtpDto, PhoneForgotPasswordDto, PhoneResetPasswordDto, SendEmailOtpDto, VerifyEmailOtpDto, EmailForgotPasswordDto, EmailResetPasswordDto } from './auth/dto/auth.dto';
import { EmailService } from './email/email.service';
import { BruteForceGuard } from './auth/brute-force.guard';
import { RedisService } from './redis/redis.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(
        private authService: AuthService,
        private usersService: UsersService,
        private emailService: EmailService,
        private redisService: RedisService,
    ) { }

    @Public()
    @UseGuards(BruteForceGuard)
    @Post('login')
    async login(@Body() loginDto: LoginDto, @Request() req: any) {
        try {
            const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
            const userAgent = req.headers['user-agent'] || '';

            this.logger.log(`Attempting login for user: ${loginDto.identifier}`);
            const result = await this.authService.validateUser(loginDto.identifier, loginDto.password);

            if (result?.__reason === 'NOT_FOUND') {
                // Record failure even for unknown identifiers to prevent user enumeration timing attacks
                await BruteForceGuard.recordFailure(this.redisService, loginDto.identifier);
                throw new UnauthorizedException('No account found with this email/phone. Please register first.');
            }
            if (result?.__reason === 'WRONG_PASSWORD') {
                const { locked, attemptsLeft } = await BruteForceGuard.recordFailure(this.redisService, loginDto.identifier);
                if (locked) {
                    throw new UnauthorizedException(
                        'Account locked for 1 hour due to too many failed attempts. Please try again later or reset your password.'
                    );
                }
                const suffix = attemptsLeft === 1 ? '1 attempt' : `${attemptsLeft} attempts`;
                throw new UnauthorizedException(`Incorrect password. Please try again. (${suffix} left before lockout)`);
            }
            if (result?.__reason === 'BANNED') {
                throw new UnauthorizedException('Your account has been suspended. Please contact support for assistance.');
            }
            if (!result) {
                await BruteForceGuard.recordFailure(this.redisService, loginDto.identifier);
                throw new UnauthorizedException('Invalid credentials. Please try again.');
            }

            // ✅ Successful login — clear any failure counters
            await BruteForceGuard.clearAttempts(this.redisService, loginDto.identifier);
            this.logger.log(`Login successful for user: ${loginDto.identifier}`);
            return await this.authService.login(result, ip, userAgent);
        } catch (error) {
            this.logger.error(`Login error for user: ${loginDto.identifier}`, error.stack);
            throw error;
        }
    }

    @Public()
    @UseGuards(BruteForceGuard)
    @Post('login-otp')
    async loginOtp(@Body() loginOtpDto: LoginOtpDto, @Request() req: any) {
        try {
            const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
            const userAgent = req.headers['user-agent'] || '';

            this.logger.log(`Attempting OTP login for user: ${loginOtpDto.identifier}`);
            const result = await this.authService.loginWithOtp(loginOtpDto.identifier, loginOtpDto.code, ip, userAgent);
            
            // ✅ Successful login — clear any failure counters
            await BruteForceGuard.clearAttempts(this.redisService, loginOtpDto.identifier);
            this.logger.log(`OTP Login successful for user: ${loginOtpDto.identifier}`);
            return result;
        } catch (error) {
            // Assume unauthorized exception is thrown by the service if it fails
            await BruteForceGuard.recordFailure(this.redisService, loginOtpDto.identifier);
            this.logger.error(`OTP Login error for user: ${loginOtpDto.identifier}`, error.stack);
            throw error;
        }
    }

    @Public()
    @Post('signup')
    async signup(@Body() signUpDto: SignupDto, @Request() req) {
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
        const userAgent = req.headers['user-agent'] || '';
        return this.authService.signup(signUpDto, ip, userAgent);
    }

    @Post('refresh')
    @UseGuards(JwtAuthGuard)
    async refresh(@Request() req) {
        return this.authService.refreshToken(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    async getProfile(@Request() req) {
        const user = await this.usersService.findOneById(req.user.userId);
        if (!user) {
            throw new UnauthorizedException('Account no longer exists.');
        }

        const { password, ...result } = user as any;
        return result;
    }

    // ─── Forgot / Reset Password ─────────────────────────────────────────────────

    @Public()
    @Post('forgot-password')
    async forgotPassword(@Body() dto: ForgotPasswordDto, @Request() req) {
        const frontendUrl = req.headers['x-frontend-url'] || process.env.FRONTEND_URL || '';
        return this.authService.forgotPassword(dto.email, frontendUrl as string);
    }

    @Public()
    @Post('reset-password')
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }

    // ─── Admin: Test Email ───────────────────────────────────────────────────────

    @Public()
    @Post('test-email')
    async testEmail(@Body() body: { to: string }) {
        const sent = await this.emailService.sendSmtpTestEmail(body.to);
        if (sent) return { success: true, message: 'Test email sent successfully.' };
        return { success: false, message: 'Failed to send. Check SMTP settings.' };
    }

    // ─── SMS OTP: Send ──────────────────────────────────────────────────────────────

    /**
     * POST /auth/send-otp
     * Generates a 6-digit OTP and delivers it via LAAFFIC SMS.
     * purpose: "REGISTER" | "FORGOT_PASSWORD"
     */
    @Public()
    @Post('send-otp')
    async sendOtp(@Body() dto: SendOtpDto) {
        return this.authService.sendPhoneOtp(dto.phoneNumber, dto.purpose);
    }

    /**
     * POST /auth/verify-otp
     * Verifies a 6-digit OTP for the given phone number and purpose.
     * Returns { verified: true } on success.
     */
    @Public()
    @Post('verify-otp')
    async verifyOtp(@Body() dto: VerifyOtpDto) {
        return this.authService.verifyPhoneOtp(dto.phoneNumber, dto.code, dto.purpose);
    }

    /**
     * POST /auth/bind-mobile
     * Used by logged-in users to bind a mobile number explicitly via OTP.
     */
    @UseGuards(JwtAuthGuard)
    @Post('bind-mobile')
    async bindMobile(@Request() req, @Body() dto: VerifyOtpDto) {
        if (dto.purpose !== 'BIND_MOBILE') {
            throw new UnauthorizedException('Invalid purpose for mobile binding.');
        }
        return this.authService.bindMobileNumber(req.user.userId, dto.phoneNumber, dto.code);
    }

    /**
     * POST /auth/bind-email
     * Used by logged-in users to bind an email explicitly via OTP.
     */
    @UseGuards(JwtAuthGuard)
    @Post('bind-email')
    async bindEmail(@Request() req, @Body() dto: VerifyEmailOtpDto) {
        if (dto.purpose !== 'BIND_EMAIL') {
            throw new UnauthorizedException('Invalid purpose for email binding.');
        }
        return this.authService.bindEmailAddress(req.user.userId, dto.email, dto.code);
    }

    // ─── SMS OTP: Forgot Password ─────────────────────────────────────────────────

    /**
     * POST /auth/forgot-password-phone
     * Checks if a user with the given phoneNumber exists, then sends a
     * FORGOT_PASSWORD OTP.  Always returns the same generic message.
     */
    @Public()
    @Post('forgot-password-phone')
    async forgotPasswordPhone(@Body() dto: PhoneForgotPasswordDto) {
        return this.authService.phoneForgotPassword(dto.phoneNumber);
    }

    /**
     * POST /auth/reset-password-phone
     * Verifies the FORGOT_PASSWORD OTP and resets the user's password in one call.
     */
    @Public()
    @Post('reset-password-phone')
    async resetPasswordPhone(@Body() dto: PhoneResetPasswordDto) {
        return this.authService.resetPasswordByPhone(dto.phoneNumber, dto.code, dto.newPassword);
    }

    // ─── Email OTP: Send ────────────────────────────────────────────────────────

    @Public()
    @Post('send-email-otp')
    async sendEmailOtp(@Body() dto: SendEmailOtpDto) {
        return this.authService.sendEmailOtp(dto.email, dto.purpose);
    }

    // ─── Email OTP: Verify ──────────────────────────────────────────────────────

    @Public()
    @Post('verify-email-otp')
    async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
        return this.authService.verifyEmailOtp(dto.email, dto.code, dto.purpose);
    }

    // ─── Email OTP: Forgot Password ─────────────────────────────────────────────

    @Public()
    @Post('forgot-password-email')
    async forgotPasswordEmail(@Body() dto: EmailForgotPasswordDto) {
        return this.authService.emailForgotPassword(dto.email);
    }

    @Public()
    @Post('reset-password-email')
    async resetPasswordEmail(@Body() dto: EmailResetPasswordDto) {
        return this.authService.resetPasswordByEmail(dto.email, dto.code, dto.newPassword);
    }
}
