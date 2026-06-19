export const EMAIL_TEMPLATE_SETTINGS_KEY = 'EMAIL_TEMPLATE_SETTINGS';
export const DEFAULT_WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://odd69.com';

export const EMAIL_TEMPLATE_IDS = [
    'register-success',
    'deposit-success',
    'withdrawal-success',
    'withdrawal-pending',
    'withdrawal-processed',
    'withdrawal-approved',
    'account-suspended',
    'bonus-credited',
    'bonus-wagered',
    'forgot-password',
    'otp',
    'bet-refund',
    'smtp-test',
] as const;

export type EmailTemplateId = typeof EMAIL_TEMPLATE_IDS[number];

export interface ManagedEmailTemplateSettings {
    enabled: boolean;
    subject: string;
    imageUrl: string;
    preheader: string;
    eyebrow: string;
    title: string;
    lead: string;
    heroLabel: string;
    heroValue: string;
    heroHelper: string;
    heroStatus: string;
    bodyPrimary: string;
    bodySecondary: string;
    noteTitle: string;
    noteBody: string;
    ctaLabel: string;
    footerNote: string;
}

export type ManagedEmailTemplateSettingsMap = Record<EmailTemplateId, ManagedEmailTemplateSettings>;

export const defaultEmailTemplateSettings: ManagedEmailTemplateSettingsMap = {
    'register-success': {
        enabled: true,
        subject: 'Welcome to {{platformName}}',
        imageUrl: '{{siteUrl}}/sports-hero-banner.png',
        preheader: 'Your {{platformName}} account is ready.',
        eyebrow: 'Welcome',
        title: 'Welcome to {{platformName}}',
        lead: 'Hi {{username}}, your account is active and ready to go.',
        heroLabel: 'Account',
        heroValue: 'Ready to play',
        heroHelper: 'Open the website and continue from your dashboard.',
        heroStatus: 'Active',
        bodyPrimary: 'Your {{platformName}} profile has been created successfully. You can now sign in, fund your wallet, and explore sports and casino in one place.',
        bodySecondary: 'Use the button below to open the website and continue from your dashboard.',
        noteTitle: 'Quick start',
        noteBody: 'Complete your profile, make a deposit, and keep your account credentials secure.',
        ctaLabel: 'Open Website',
        footerNote: 'Play responsibly and keep your account credentials secure.',
    },
    'deposit-success': {
        enabled: true,
        subject: 'Deposit of {{amountLabel}} confirmed',
        imageUrl: '{{siteUrl}}/home/casino.png',
        preheader: 'Your {{amountLabel}} deposit is approved on {{platformName}}.',
        eyebrow: 'Wallet update',
        title: 'Deposit confirmed',
        lead: 'Hi {{username}}, your wallet has been credited successfully.',
        heroLabel: 'Amount credited',
        heroValue: '{{amountLabel}}',
        heroHelper: '{{processedAt}}',
        heroStatus: 'Approved',
        bodyPrimary: 'Your deposit has been processed successfully and your updated balance should already be visible.',
        bodySecondary: 'If you did not initiate this deposit, contact support immediately.',
        noteTitle: 'Funds available',
        noteBody: 'The credited amount is available now and ready to use.',
        ctaLabel: 'Open Website',
        footerNote: 'Please gamble responsibly.',
    },
    'withdrawal-success': {
        enabled: true,
        subject: 'Withdrawal of {{amountLabel}} processed',
        imageUrl: '{{siteUrl}}/sports-hero-banner.png',
        preheader: 'Your {{amountLabel}} withdrawal is being released from {{platformName}}.',
        eyebrow: 'Payout update',
        title: 'Withdrawal processed',
        lead: 'Hi {{username}}, your withdrawal request has been approved and sent for payout.',
        heroLabel: 'Amount released',
        heroValue: '{{amountLabel}}',
        heroHelper: '{{processedAt}}',
        heroStatus: 'Processed',
        bodyPrimary: 'Your withdrawal has moved successfully through processing. Most bank and UPI transfers land within a few hours.',
        bodySecondary: 'If the payout still has not arrived after 24 hours, please contact support.',
        noteTitle: 'Expected arrival',
        noteBody: 'Funds usually arrive within a few hours, depending on the destination provider.',
        ctaLabel: 'Open Website',
        footerNote: 'Please gamble responsibly.',
    },
    'withdrawal-pending': {
        enabled: true,
        subject: 'Withdrawal of {{amountLabel}} received',
        imageUrl: '{{siteUrl}}/sports-hero-banner.png',
        preheader: 'Your {{amountLabel}} withdrawal request has been received on {{platformName}}.',
        eyebrow: 'Payout update',
        title: 'Withdrawal request received',
        lead: 'Hi {{username}}, we have received your withdrawal request and it is now pending review.',
        heroLabel: 'Amount requested',
        heroValue: '{{amountLabel}}',
        heroHelper: '{{processedAt}}',
        heroStatus: 'Pending',
        bodyPrimary: 'Your withdrawal request has been placed successfully. Our team will review and process it shortly.',
        bodySecondary: 'You will receive an email notification at each step of the withdrawal process.',
        noteTitle: 'What happens next?',
        noteBody: 'Your request will be reviewed by our team. Once processed, the funds will be sent to your registered payment method.',
        ctaLabel: 'Track Status',
        footerNote: 'Please gamble responsibly.',
    },
    'withdrawal-processed': {
        enabled: true,
        subject: 'Withdrawal of {{amountLabel}} is being processed',
        imageUrl: '{{siteUrl}}/sports-hero-banner.png',
        preheader: 'Your {{amountLabel}} withdrawal is being processed on {{platformName}}.',
        eyebrow: 'Payout update',
        title: 'Withdrawal being processed',
        lead: 'Hi {{username}}, your withdrawal request is now being processed by our team.',
        heroLabel: 'Amount',
        heroValue: '{{amountLabel}}',
        heroHelper: '{{processedAt}}',
        heroStatus: 'Processed',
        bodyPrimary: 'Your withdrawal has been reviewed and is now being processed. It will be approved and sent for payout shortly.',
        bodySecondary: 'You will receive another email once the withdrawal is approved.',
        noteTitle: 'Processing',
        noteBody: 'Our team is reviewing your payment details and will approve the payout soon.',
        ctaLabel: 'Track Status',
        footerNote: 'Please gamble responsibly.',
    },
    'withdrawal-approved': {
        enabled: true,
        subject: 'Withdrawal of {{amountLabel}} approved',
        imageUrl: '{{siteUrl}}/sports-hero-banner.png',
        preheader: 'Your {{amountLabel}} withdrawal has been approved on {{platformName}}.',
        eyebrow: 'Payout update',
        title: 'Withdrawal approved',
        lead: 'Hi {{username}}, your withdrawal has been approved and payment is being initiated.',
        heroLabel: 'Amount approved',
        heroValue: '{{amountLabel}}',
        heroHelper: '{{processedAt}}',
        heroStatus: 'Approved',
        bodyPrimary: 'Your withdrawal has been approved and the funds are being sent to your registered payment method.',
        bodySecondary: 'You will receive a final confirmation email once the transfer is completed.',
        noteTitle: 'Payment initiated',
        noteBody: 'Funds are on their way. Most bank and UPI transfers land within a few hours.',
        ctaLabel: 'Track Status',
        footerNote: 'Please gamble responsibly.',
    },
    'account-suspended': {
        enabled: true,
        subject: 'Your {{platformName}} account has been suspended',
        imageUrl: '',
        preheader: 'Your {{platformName}} account has been suspended. Contact support if you believe this is an error.',
        eyebrow: 'Account alert',
        title: 'Account Suspended',
        lead: 'Hi {{username}}, your account on {{platformName}} has been suspended effective immediately.',
        heroLabel: 'Account status',
        heroValue: 'Suspended',
        heroHelper: '{{suspendedAt}}',
        heroStatus: 'Suspended',
        bodyPrimary: 'After a review of your account activity, we have determined that your account is in violation of our platform policies. As a result, your access has been restricted.',
        bodySecondary: 'If you believe this action was taken in error, you may reach out to our support team for further review.',
        noteTitle: 'What does this mean?',
        noteBody: 'Your account access, deposits, withdrawals, and betting activity have been disabled. Any pending operations may be frozen or voided.',
        ctaLabel: 'Contact Support',
        footerNote: 'This is an automated notification. If you did not expect this, contact support immediately.',
    },
    'bonus-credited': {
        enabled: true,
        subject: 'Bonus of {{amountLabel}} credited to your {{platformName}} wallet',
        imageUrl: '',
        preheader: 'A bonus of {{amountLabel}} has been added to your {{platformName}} account.',
        eyebrow: 'Bonus reward',
        title: 'Bonus Credited',
        lead: 'Hi {{username}}, a bonus of {{amountLabel}} has been credited to your {{walletLabel}} wallet.',
        heroLabel: 'Bonus amount',
        heroValue: '{{amountLabel}}',
        heroHelper: '{{creditedAt}}',
        heroStatus: 'Credited',
        bodyPrimary: 'Great news! A bonus has been added to your account. This bonus is subject to wagering requirements before it can be withdrawn. Play eligible games to unlock your bonus and convert it to withdrawable balance.',
        bodySecondary: 'Your bonus is valid for a limited time. Make sure to complete the wagering requirements before it expires to keep your winnings.',
        noteTitle: 'Wagering requirement',
        noteBody: 'You need to wager {{wageringRequired}} before this bonus can be converted to real balance. Check the My Bonuses section for live progress.',
        ctaLabel: 'Start Playing',
        footerNote: 'Bonus terms and conditions apply. Please gamble responsibly.',
    },
    'bonus-wagered': {
        enabled: true,
        subject: 'Bonus wagering complete on {{platformName}} — ready to convert!',
        imageUrl: '',
        preheader: 'Your bonus wagering requirement has been fulfilled on {{platformName}}.',
        eyebrow: 'Bonus complete',
        title: 'Wagering Complete',
        lead: 'Hi {{username}}, congratulations! You have completed the wagering requirement for your {{bonusTitle}} bonus.',
        heroLabel: 'Wagering progress',
        heroValue: '100% Complete',
        heroHelper: '{{completedAt}}',
        heroStatus: 'Fulfilled',
        bodyPrimary: 'You have successfully met the wagering requirements for your bonus. Your bonus balance is now eligible for conversion to your main withdrawable wallet. Visit the My Bonuses section to convert your bonus balance.',
        bodySecondary: 'Once converted, the funds will appear in your main balance and can be withdrawn at any time through your preferred payment method.',
        noteTitle: 'Next step',
        noteBody: 'Head to My Bonuses in your account dashboard and tap Convert to move the funds to your main wallet.',
        ctaLabel: 'Convert Bonus',
        footerNote: 'Bonus terms and conditions apply. Please gamble responsibly.',
    },
    'bet-refund': {
        enabled: true,
        subject: 'Your bet of {{amountLabel}} has been refunded on {{platformName}}',
        imageUrl: '',
        preheader: 'A bet refund of {{amountLabel}} has been credited back to your {{platformName}} wallet.',
        eyebrow: 'Bet refund',
        title: 'Bet Refunded',
        lead: 'Hi {{username}}, your bet of {{amountLabel}} on {{eventName}} has been refunded due to an early six settlement.',
        heroLabel: 'Refund amount',
        heroValue: '{{amountLabel}}',
        heroHelper: '{{refundedAt}}',
        heroStatus: 'Refunded',
        bodyPrimary: 'The market "{{marketName}}" on the event "{{eventName}}" has been voided as part of the early six settlement process. Your original stake has been returned to your wallet in full.',
        bodySecondary: 'No action is needed from your side. The refunded amount is already available in your wallet and ready to use.',
        noteTitle: 'Why was my bet refunded?',
        noteBody: 'Bets are refunded when a market is voided during settlement. This can happen due to early six conditions or other market cancellations. Your full stake is always returned in these cases.',
        ctaLabel: 'Open Website',
        footerNote: 'Please gamble responsibly.',
    },
    'forgot-password': {
        enabled: true,
        subject: 'Reset your {{platformName}} password',
        imageUrl: '{{siteUrl}}/sports-hero-banner.png',
        preheader: 'Reset your {{platformName}} password.',
        eyebrow: 'Account security',
        title: 'Reset your password',
        lead: 'A password reset was requested for {{username}}.',
        heroLabel: 'Security window',
        heroValue: '1 hour',
        heroHelper: 'The reset link stays valid for one hour.',
        heroStatus: 'Expires soon',
        bodyPrimary: 'We received a request to reset the password for your {{platformName}} account.',
        bodySecondary: 'If you did not request this reset, you can safely ignore this email and your password will remain unchanged.',
        noteTitle: 'Security reminder',
        noteBody: 'Only use the secure button in this email. The reset link expires 1 hour after it was created.',
        ctaLabel: 'Reset Password',
        footerNote: 'This is an automated security message. Please do not reply.',
    },
    otp: {
        enabled: true,
        subject: '{{otpCode}} is your {{platformName}} verification code',
        imageUrl: '{{siteUrl}}/sports-hero-banner.png',
        preheader: '{{otpCode}} is your {{platformName}} verification code.',
        eyebrow: 'Email verification',
        title: 'Your verification code',
        lead: 'Use this one-time code to {{purposeAction}}.',
        heroLabel: 'One-time code',
        heroValue: '{{otpCode}}',
        heroHelper: 'This code stays valid for 10 minutes.',
        heroStatus: 'Expires in 10 minutes',
        bodyPrimary: 'We received a request to {{purposeAction}} on {{platformName}}.',
        bodySecondary: 'If you did not request this code, you can ignore this message. Your account will remain secure.',
        noteTitle: 'Do not share',
        noteBody: 'Never share this code with anyone. Our team will never ask you for it.',
        ctaLabel: '',
        footerNote: 'This is an automated security message. Please do not reply.',
    },
    'smtp-test': {
        enabled: true,
        subject: 'SMTP Test Successful',
        imageUrl: '{{siteUrl}}/sports-hero-banner.png',
        preheader: 'Your SMTP configuration is working and ready for transactional emails.',
        eyebrow: 'SMTP setup',
        title: 'SMTP test successful',
        lead: 'Your outgoing mail server is connected and ready to deliver transactional messages using the website theme.',
        heroLabel: 'Sender email',
        heroValue: '{{senderEmail}}',
        heroHelper: 'Transactional emails like OTPs, password resets, deposits, and withdrawals will use this sender profile.',
        heroStatus: 'Verified',
        bodyPrimary: 'This automated message confirms the current SMTP credentials can authenticate and deliver email successfully.',
        bodySecondary: 'Review delivery setup from the admin panel before turning on live messaging.',
        noteTitle: 'Status',
        noteBody: 'SMTP relay connected and ready for transactional delivery.',
        ctaLabel: '',
        footerNote: 'This is an automated system test message.',
    },
};

const alwaysEnabledTemplateIds: EmailTemplateId[] = ['forgot-password', 'otp', 'smtp-test'];

export const emailTemplateSampleTokens: Record<EmailTemplateId, Record<string, string>> = {
    'register-success': {
        platformName: 'odd69.com',
        username: 'Harsh',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    'deposit-success': {
        platformName: 'odd69.com',
        username: 'Harsh',
        amountLabel: 'INR 5,000.00',
        processedAt: '05 Apr 2026, 9:30 PM IST',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    'withdrawal-success': {
        platformName: 'odd69.com',
        username: 'Harsh',
        amountLabel: 'INR 2,500.00',
        processedAt: '05 Apr 2026, 9:30 PM IST',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    'withdrawal-pending': {
        platformName: 'odd69.com',
        username: 'Harsh',
        amountLabel: 'INR 2,500.00',
        processedAt: '07 Apr 2026, 3:00 PM IST',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    'withdrawal-processed': {
        platformName: 'odd69.com',
        username: 'Harsh',
        amountLabel: 'INR 2,500.00',
        processedAt: '07 Apr 2026, 3:30 PM IST',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    'withdrawal-approved': {
        platformName: 'odd69.com',
        username: 'Harsh',
        amountLabel: 'INR 2,500.00',
        processedAt: '07 Apr 2026, 4:00 PM IST',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    'account-suspended': {
        platformName: 'odd69.com',
        username: 'Harsh',
        reason: 'Multiple account violations',
        suspendedAt: '07 Apr 2026, 2:15 PM IST',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    'bonus-credited': {
        platformName: 'odd69.com',
        username: 'Harsh',
        amountLabel: 'INR 500.00',
        walletLabel: 'Casino Bonus',
        wageringRequired: 'INR 5,000.00',
        bonusCode: 'WELCOME500',
        creditedAt: '08 Apr 2026, 11:00 AM IST',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    'bonus-wagered': {
        platformName: 'odd69.com',
        username: 'Harsh',
        bonusTitle: 'Welcome Bonus',
        bonusAmount: 'INR 500.00',
        completedAt: '08 Apr 2026, 5:30 PM IST',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    'bet-refund': {
        platformName: 'odd69.com',
        username: 'Harsh',
        amountLabel: 'INR 1,000.00',
        eventName: 'India v Australia',
        marketName: 'Match Odds',
        refundedAt: '08 Apr 2026, 2:00 PM IST',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    'forgot-password': {
        platformName: 'odd69.com',
        username: 'Harsh',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    otp: {
        platformName: 'odd69.com',
        otpCode: '482913',
        purposeAction: 'verify your email address',
        purposeLabel: 'Account registration',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
    'smtp-test': {
        platformName: 'odd69.com',
        senderEmail: 'support@odd69.com',
        siteUrl: DEFAULT_WEBSITE_URL,
    },
};

const templateFieldKeys = Object.keys(defaultEmailTemplateSettings['register-success']) as (keyof ManagedEmailTemplateSettings)[];

export function replaceEmailTemplateTokens(value: string, tokens: Record<string, string>): string {
    return String(value ?? '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, rawKey: string) => {
        const key = rawKey.trim();
        return tokens[key] ?? '';
    });
}

export function mergeEmailTemplateSettings(rawValue?: string | null): ManagedEmailTemplateSettingsMap {
    let parsed: unknown = null;

    if (rawValue) {
        try {
            parsed = JSON.parse(rawValue);
        } catch {
            parsed = null;
        }
    }

    const source = parsed && typeof parsed === 'object' ? parsed as Partial<Record<EmailTemplateId, Partial<ManagedEmailTemplateSettings>>> : {};

    return EMAIL_TEMPLATE_IDS.reduce((acc, templateId) => {
        const defaults = defaultEmailTemplateSettings[templateId];
        const overrides = source[templateId];

        const nextTemplate = templateFieldKeys.reduce((templateAcc, fieldKey) => {
            const defaultValue = defaults[fieldKey];
            const overrideValue = overrides?.[fieldKey];

            if (fieldKey === 'enabled') {
                templateAcc.enabled = alwaysEnabledTemplateIds.includes(templateId)
                    ? true
                    : typeof overrideValue === 'boolean'
                      ? overrideValue
                      : defaults.enabled;
                return templateAcc;
            }

            (templateAcc as unknown as Record<string, string | boolean>)[fieldKey] =
                typeof overrideValue === 'string' ? overrideValue : String(defaultValue);
            return templateAcc;
        }, { ...defaults } as ManagedEmailTemplateSettings);

        acc[templateId] = nextTemplate;
        return acc;
    }, {} as ManagedEmailTemplateSettingsMap);
}

export function resolveManagedEmailTemplate(
    templateId: EmailTemplateId,
    settings: ManagedEmailTemplateSettingsMap,
    tokens: Record<string, string>,
): ManagedEmailTemplateSettings {
    const template = settings[templateId];

    return templateFieldKeys.reduce((acc, fieldKey) => {
        if (fieldKey === 'enabled') {
            acc.enabled = template.enabled;
            return acc;
        }

        (acc as unknown as Record<string, string | boolean>)[fieldKey] = replaceEmailTemplateTokens(
            template[fieldKey],
            tokens,
        );
        return acc;
    }, { ...template } as ManagedEmailTemplateSettings);
}
