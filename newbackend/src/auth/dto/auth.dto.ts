import { IsString, IsEmail, IsOptional, MinLength, IsNotEmpty, IsIn, ValidateIf } from 'class-validator';


export class SignupDto {
    @ValidateIf(o => !o.phoneNumber)
    @IsEmail({}, { message: 'Invalid email format' })
    email?: string;

    @ValidateIf(o => !o.email)
    @IsString()
    @MinLength(10, { message: 'Phone number must be at least 10 digits' })
    phoneNumber?: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password: string;

    @IsOptional()
    @IsString()
    username?: string;

    @IsOptional()
    @IsString()
    currency?: string;

    @IsOptional()
    @IsString()
    country?: string;

    @IsOptional()
    @IsString()
    bonus_id?: string;

    @IsOptional()
    @IsString()
    role?: 'TECH_MASTER' | 'SUPER_ADMIN' | 'MANAGER' | 'USER';

    /** Referral code from a referral link (?ref=CODE) */
    @IsOptional()
    @IsString()
    referralCode?: string;

    /** Alias used by the register modal's promoCode field — treated as referralCode */
    @IsOptional()
    @IsString()
    promoCode?: string;

    /** UTM + referrer tracking — captured client-side on landing */
    @IsOptional()
    @IsString()
    utm_source?: string;

    @IsOptional()
    @IsString()
    utm_medium?: string;

    @IsOptional()
    @IsString()
    utm_campaign?: string;

    @IsOptional()
    @IsString()
    utm_content?: string;

    @IsOptional()
    @IsString()
    utm_term?: string;

    @IsOptional()
    @IsString()
    referrerUrl?: string;

    @IsOptional()
    @IsString()
    landingPage?: string;
}

export class LoginDto {
    @IsNotEmpty()
    @IsString()
    identifier: string;

    @IsNotEmpty()
    @IsString()
    password: string;
}

export class LoginOtpDto {
    @IsNotEmpty()
    @IsString()
    identifier: string;

    @IsNotEmpty()
    @IsString()
    code: string;
}

export class ForgotPasswordDto {
    @IsNotEmpty()
    @IsEmail({}, { message: 'Invalid email address' })
    email: string;
}

export class ResetPasswordDto {
    @IsNotEmpty()
    @IsString()
    token: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    newPassword: string;
}

// ─── SMS OTP DTOs ────────────────────────────────────────────────────────────

export class SendOtpDto {
    @IsNotEmpty()
    @IsString()
    phoneNumber: string;

    @IsNotEmpty()
    @IsIn(['REGISTER', 'FORGOT_PASSWORD', 'BIND_MOBILE', 'LOGIN'])
    purpose: 'REGISTER' | 'FORGOT_PASSWORD' | 'BIND_MOBILE' | 'LOGIN';
}

export class VerifyOtpDto {
    @IsNotEmpty()
    @IsString()
    phoneNumber: string;

    @IsNotEmpty()
    @IsString()
    code: string;

    @IsNotEmpty()
    @IsIn(['REGISTER', 'FORGOT_PASSWORD', 'BIND_MOBILE', 'LOGIN'])
    purpose: 'REGISTER' | 'FORGOT_PASSWORD' | 'BIND_MOBILE' | 'LOGIN';
}

export class PhoneForgotPasswordDto {
    @IsNotEmpty()
    @IsString()
    phoneNumber: string;
}

export class PhoneResetPasswordDto {
    @IsNotEmpty()
    @IsString()
    phoneNumber: string;

    @IsNotEmpty()
    @IsString()
    code: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    newPassword: string;
}

// ─── Email OTP DTOs ────────────────────────────────────────────────────────────

export class SendEmailOtpDto {
    @IsNotEmpty()
    @IsEmail({}, { message: 'Invalid email address' })
    email: string;

    @IsNotEmpty()
    @IsIn(['REGISTER', 'FORGOT_PASSWORD', 'BIND_EMAIL', 'LOGIN'])
    purpose: 'REGISTER' | 'FORGOT_PASSWORD' | 'BIND_EMAIL' | 'LOGIN';
}

export class VerifyEmailOtpDto {
    @IsNotEmpty()
    @IsEmail({}, { message: 'Invalid email address' })
    email: string;

    @IsNotEmpty()
    @IsString()
    code: string;

    @IsNotEmpty()
    @IsIn(['REGISTER', 'FORGOT_PASSWORD', 'BIND_EMAIL', 'LOGIN'])
    purpose: 'REGISTER' | 'FORGOT_PASSWORD' | 'BIND_EMAIL' | 'LOGIN';
}

export class EmailForgotPasswordDto {
    @IsNotEmpty()
    @IsEmail({}, { message: 'Invalid email address' })
    email: string;
}

export class EmailResetPasswordDto {
    @IsNotEmpty()
    @IsEmail({}, { message: 'Invalid email address' })
    email: string;

    @IsNotEmpty()
    @IsString()
    code: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    newPassword: string;
}
