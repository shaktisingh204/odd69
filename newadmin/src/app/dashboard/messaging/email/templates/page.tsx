import { getEmailTemplateSettings, getSystemConfig } from "@/actions/settings";
import EmailTemplatesManager from "./EmailTemplatesManager";

function parseSmtpConfig(rawValue?: string) {
    if (!rawValue) return null;

    try {
        return JSON.parse(rawValue);
    } catch {
        return null;
    }
}

export default async function EmailTemplatesPage() {
    const [configResult, templateResult] = await Promise.all([
        getSystemConfig(),
        getEmailTemplateSettings(),
    ]);

    if (!templateResult.success || !templateResult.data) {
        return (
            <div className="mx-auto max-w-4xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
                Failed to load email template settings.
            </div>
        );
    }

    const smtpConfig = parseSmtpConfig(configResult.success ? configResult.data?.SMTP_SETTINGS : undefined);
    const smtpReady = Boolean(
        smtpConfig?.host &&
        smtpConfig?.user &&
        smtpConfig?.password &&
        (smtpConfig?.fromEmail || smtpConfig?.user),
    );

    const senderIdentity = smtpReady
        ? smtpConfig?.fromName
            ? `${smtpConfig.fromName} <${smtpConfig.fromEmail || smtpConfig.user}>`
            : smtpConfig?.fromEmail || smtpConfig?.user
        : "SMTP sender not configured yet";

    return (
        <EmailTemplatesManager
            initialSettings={templateResult.data}
            platformName={templateResult.platformName || "Platform"}
            websiteUrl={templateResult.websiteUrl || "https://zeero.bet"}
            smtpReady={smtpReady}
            senderIdentity={senderIdentity}
        />
    );
}
