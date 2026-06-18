import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as nodemailer from 'nodemailer';
import { forgotPasswordTemplate } from './templates/forgot-password.template';
import { registerSuccessTemplate } from './templates/register-success.template';
import { depositSuccessTemplate } from './templates/deposit-success.template';
import { withdrawalSuccessTemplate } from './templates/withdrawal-success.template';
import { accountSuspendedTemplate } from './templates/account-suspended.template';
import { bonusCreditedTemplate } from './templates/bonus-credited.template';
import { bonusWageredTemplate } from './templates/bonus-wagered.template';
import { betRefundTemplate } from './templates/bet-refund.template';
import { otpTemplate } from './templates/otp.template';
import { smtpTestTemplate } from './templates/smtp-test.template';
import {
    EMAIL_TEMPLATE_SETTINGS_KEY,
    ManagedEmailTemplateSettings,
    ManagedEmailTemplateSettingsMap,
    mergeEmailTemplateSettings,
    resolveManagedEmailTemplate,
} from './email-template-config';
import { formatEmailTimestamp } from './templates/email-theme.template';

const SMTP_KEY = 'SMTP_SETTINGS';

interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromName: string;
    fromEmail: string;
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    constructor(private readonly prisma: PrismaService) { }

    /** Load SMTP config from SystemConfig table */
    private async getSmtpConfig(): Promise<SmtpConfig | null> {
        try {
            const record = await this.prisma.systemConfig.findUnique({ where: { key: SMTP_KEY } });
            if (!record?.value) return null;
            return JSON.parse(record.value) as SmtpConfig;
        } catch {
            return null;
        }
    }

    /** Also load platform name */
    private async getPlatformName(): Promise<string> {
        try {
            const record = await this.prisma.systemConfig.findUnique({ where: { key: 'PLATFORM_NAME' } });
            return record?.value || 'Platform';
        } catch {
            return 'Platform';
        }
    }

    private getFrontendUrl(): string {
        const siteUrl = (process.env.FRONTEND_URL || 'https://zeero.bet').trim();
        return siteUrl.replace(/\/+$/, '') || 'https://zeero.bet';
    }

    private async getEmailTemplateSettings(): Promise<ManagedEmailTemplateSettingsMap> {
        try {
            const record = await this.prisma.systemConfig.findUnique({ where: { key: EMAIL_TEMPLATE_SETTINGS_KEY } });
            return mergeEmailTemplateSettings(record?.value);
        } catch {
            return mergeEmailTemplateSettings();
        }
    }

    private async resolveEmailTemplate(
        templateId: Parameters<typeof resolveManagedEmailTemplate>[0],
        tokens: Record<string, string>,
    ): Promise<ManagedEmailTemplateSettings> {
        const settings = await this.getEmailTemplateSettings();
        return resolveManagedEmailTemplate(templateId, settings, tokens);
    }

    private getPurposeLabel(purpose: string): string {
        switch (purpose) {
            case 'REGISTER':
                return 'Account registration';
            case 'FORGOT_PASSWORD':
                return 'Password reset';
            case 'BIND_EMAIL':
                return 'Email binding';
            default:
                return 'Verification request';
        }
    }

    private getPurposeAction(purpose: string): string {
        switch (purpose) {
            case 'REGISTER':
                return 'verify your email address';
            case 'FORGOT_PASSWORD':
                return 'reset your password';
            case 'BIND_EMAIL':
                return 'link this email address to your account';
            default:
                return 'verify this request';
        }
    }

    /** Send an email using the configured SMTP transporter */
    async sendMail(to: string, subject: string, html: string): Promise<boolean> {
        const smtp = await this.getSmtpConfig();
        if (!smtp || !smtp.host || !smtp.user || !smtp.password) {
            this.logger.warn('SMTP not configured — email not sent');
            return false;
        }

        try {
            const isSecure = smtp.secure === true || String(smtp.secure) === 'true';
            const transporter = nodemailer.createTransport({
                host: smtp.host,
                port: Number(smtp.port) || 587,
                secure: isSecure,
                auth: {
                    user: smtp.user,
                    pass: smtp.password,
                },
            });

            await transporter.sendMail({
                from: `"${smtp.fromName || 'Platform'}" <${smtp.fromEmail || smtp.user}>`,
                to,
                subject,
                html,
            });

            this.logger.log(`Email sent to ${to} — Subject: ${subject}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}`, error.message);
            return false;
        }
    }

    /** Forgot-password email */
    async sendForgotPassword(to: string, resetLink: string, username?: string): Promise<boolean> {
        const platformName = await this.getPlatformName();
        const siteUrl = this.getFrontendUrl();
        const template = await this.resolveEmailTemplate('forgot-password', {
            platformName,
            username: username || 'Player',
            resetLink,
            siteUrl,
        });

        if (!template.enabled) {
            this.logger.log('Forgot-password email template is disabled; skipping send.');
            return false;
        }

        const html = forgotPasswordTemplate(platformName, template, resetLink);
        return this.sendMail(to, template.subject, html);
    }

    /** Registration welcome email */
    async sendRegisterSuccess(to: string, username: string): Promise<boolean> {
        const platformName = await this.getPlatformName();
        const siteUrl = this.getFrontendUrl();
        const template = await this.resolveEmailTemplate('register-success', {
            platformName,
            username,
            siteUrl,
        });

        if (!template.enabled) {
            this.logger.log('Register-success email template is disabled; skipping send.');
            return false;
        }

        const html = registerSuccessTemplate(platformName, template, siteUrl);
        return this.sendMail(to, template.subject, html);
    }

    /** Deposit approved email */
    async sendDepositSuccess(to: string, username: string, amount: string, currency = 'INR'): Promise<boolean> {
        const platformName = await this.getPlatformName();
        const siteUrl = this.getFrontendUrl();
        const amountLabel = `${currency} ${amount}`;
        const template = await this.resolveEmailTemplate('deposit-success', {
            platformName,
            username,
            amount,
            currency,
            amountLabel,
            processedAt: formatEmailTimestamp(),
            siteUrl,
        });

        if (!template.enabled) {
            this.logger.log('Deposit-success email template is disabled; skipping send.');
            return false;
        }

        const html = depositSuccessTemplate(platformName, template, amountLabel, siteUrl);
        return this.sendMail(to, template.subject, html);
    }

    /** Withdrawal completed email */
    async sendWithdrawalSuccess(to: string, username: string, amount: string, currency = 'INR', utr?: string): Promise<boolean> {
        return this.sendWithdrawalStatusEmail(to, username, amount, currency, 'withdrawal-success', utr);
    }

    /** Withdrawal pending email (step 1) */
    async sendWithdrawalPending(to: string, username: string, amount: string, currency = 'INR'): Promise<boolean> {
        return this.sendWithdrawalStatusEmail(to, username, amount, currency, 'withdrawal-pending');
    }

    /** Withdrawal processed email (step 2) */
    async sendWithdrawalProcessed(to: string, username: string, amount: string, currency = 'INR'): Promise<boolean> {
        return this.sendWithdrawalStatusEmail(to, username, amount, currency, 'withdrawal-processed');
    }

    /** Withdrawal approved email (step 3) */
    async sendWithdrawalApproved(to: string, username: string, amount: string, currency = 'INR'): Promise<boolean> {
        return this.sendWithdrawalStatusEmail(to, username, amount, currency, 'withdrawal-approved');
    }

    /** Account suspended/banned email */
    async sendAccountSuspended(to: string, username: string, reason = 'Policy violation'): Promise<boolean> {
        const platformName = await this.getPlatformName();
        const siteUrl = this.getFrontendUrl();
        const template = await this.resolveEmailTemplate('account-suspended', {
            platformName,
            username,
            reason,
            suspendedAt: formatEmailTimestamp(),
            siteUrl,
        });

        if (!template.enabled) {
            this.logger.log('Account-suspended email template is disabled; skipping send.');
            return false;
        }

        const html = accountSuspendedTemplate(platformName, template, username, reason, siteUrl);
        return this.sendMail(to, template.subject, html);
    }

    /** Bonus credited email */
    async sendBonusCredited(
        to: string,
        username: string,
        amount: string,
        walletLabel: string,
        wageringRequired: string,
        bonusCode: string,
        currency = 'INR',
    ): Promise<boolean> {
        const platformName = await this.getPlatformName();
        const siteUrl = this.getFrontendUrl();
        const amountLabel = `${currency} ${amount}`;
        const template = await this.resolveEmailTemplate('bonus-credited', {
            platformName,
            username,
            amountLabel,
            walletLabel,
            wageringRequired: `${currency} ${wageringRequired}`,
            bonusCode,
            creditedAt: formatEmailTimestamp(),
            siteUrl,
        });

        if (!template.enabled) {
            this.logger.log('Bonus-credited email template is disabled; skipping send.');
            return false;
        }

        const html = bonusCreditedTemplate(platformName, template, amountLabel, walletLabel, `${currency} ${wageringRequired}`, bonusCode, siteUrl);
        return this.sendMail(to, template.subject, html);
    }

    /** Bonus wagering complete email */
    async sendBonusWagered(
        to: string,
        username: string,
        bonusTitle: string,
        bonusAmount: string,
        currency = 'INR',
    ): Promise<boolean> {
        const platformName = await this.getPlatformName();
        const siteUrl = this.getFrontendUrl();
        const amountLabel = `${currency} ${bonusAmount}`;
        const template = await this.resolveEmailTemplate('bonus-wagered', {
            platformName,
            username,
            bonusTitle,
            bonusAmount: amountLabel,
            completedAt: formatEmailTimestamp(),
            siteUrl,
        });

        if (!template.enabled) {
            this.logger.log('Bonus-wagered email template is disabled; skipping send.');
            return false;
        }

        const html = bonusWageredTemplate(platformName, template, bonusTitle, amountLabel, siteUrl);
        return this.sendMail(to, template.subject, html);
    }

    /** Bet refund email (early six / market void) */
    async sendBetRefund(
        to: string,
        username: string,
        amount: string,
        eventName: string,
        marketName: string,
        currency = 'INR',
    ): Promise<boolean> {
        const platformName = await this.getPlatformName();
        const siteUrl = this.getFrontendUrl();
        const amountLabel = `${currency} ${amount}`;
        const template = await this.resolveEmailTemplate('bet-refund', {
            platformName,
            username,
            amountLabel,
            eventName,
            marketName,
            refundedAt: formatEmailTimestamp(),
            siteUrl,
        });

        if (!template.enabled) {
            this.logger.log('Bet-refund email template is disabled; skipping send.');
            return false;
        }

        const html = betRefundTemplate(platformName, template, amountLabel, eventName, marketName, siteUrl);
        return this.sendMail(to, template.subject, html);
    }

    /** Generic withdrawal status email helper */
    private async sendWithdrawalStatusEmail(
        to: string,
        username: string,
        amount: string,
        currency: string,
        templateId: 'withdrawal-success' | 'withdrawal-pending' | 'withdrawal-processed' | 'withdrawal-approved',
        utr?: string,
    ): Promise<boolean> {
        const platformName = await this.getPlatformName();
        const siteUrl = this.getFrontendUrl();
        const amountLabel = `${currency} ${amount}`;
        const template = await this.resolveEmailTemplate(templateId, {
            platformName,
            username,
            amount,
            currency,
            amountLabel,
            utr: utr || '',
            processedAt: formatEmailTimestamp(),
            siteUrl,
        });

        if (!template.enabled) {
            this.logger.log(`${templateId} email template is disabled; skipping send.`);
            return false;
        }

        const html = withdrawalSuccessTemplate(platformName, { ...template, utr: utr || '' }, amountLabel, siteUrl);
        return this.sendMail(to, template.subject, html);
    }

    async sendSmtpTestEmail(to: string): Promise<boolean> {
        const [platformName, smtp] = await Promise.all([
            this.getPlatformName(),
            this.getSmtpConfig(),
        ]);

        const senderEmail = smtp?.fromEmail || smtp?.user || 'Configured sender';
        const siteUrl = this.getFrontendUrl();
        const template = await this.resolveEmailTemplate('smtp-test', {
            platformName,
            senderEmail,
            siteUrl,
        });
        const html = smtpTestTemplate(platformName, template);
        return this.sendMail(to, template.subject, html);
    }

    /** Generate and send OTP via email */
    async sendOtpEmail(email: string, purpose: string): Promise<{ message: string }> {
        // Enforce max 10 requests per hour per email/purpose via simple cleanup
        // (For production, consider Redis rate limits here)
        const recent = await this.prisma.emailOtp.findFirst({
            where: {
                email,
                purpose,
                createdAt: { gt: new Date(Date.now() - 60 * 1000) } // 1 minute cooldown
            }
        });

        if (recent) {
            throw new BadRequestException('Please wait 60 seconds before requesting another code.');
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await this.prisma.emailOtp.create({
            data: { email, code, purpose, expiresAt }
        });

        const platformName = await this.getPlatformName();
        const siteUrl = this.getFrontendUrl();
        const purposeLabel = this.getPurposeLabel(purpose);
        const purposeAction = this.getPurposeAction(purpose);
        const template = await this.resolveEmailTemplate('otp', {
            platformName,
            otpCode: code,
            purposeLabel,
            purposeAction,
            siteUrl,
        });

        if (!template.enabled) {
            this.logger.log('OTP email template is disabled; skipping send.');
            return { message: 'OTP sent successfully to your email.' };
        }

        const html = otpTemplate(platformName, template, purposeLabel);
        
        const sent = await this.sendMail(email, template.subject, html);
        if (!sent) {
            // Delete the generated OTP so they aren't forced to wait 60 seconds for a broken request
            await this.prisma.emailOtp.deleteMany({
                where: { email, code, purpose }
            }).catch(() => {});
            throw new BadRequestException('Failed to send OTP. Please check email configuration or try again later.');
        }

        return { message: 'OTP sent successfully to your email.' };
    }
}
