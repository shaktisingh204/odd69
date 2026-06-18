import Link from "next/link";
import { getEmailTemplateSettings, getSystemConfig } from "@/actions/settings";
import { emailLaunchChecklist, emailTemplateCatalog } from "@/lib/email-catalog";
import { resolveManagedEmailTemplate, type EmailTemplateId } from "@/lib/email-template-config";
import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    Image as ImageIcon,
    Mail,
    MessageSquare,
    Settings,
    TriangleAlert,
} from "lucide-react";

function parseSmtpConfig(rawValue?: string) {
    if (!rawValue) return null;

    try {
        return JSON.parse(rawValue);
    } catch {
        return null;
    }
}

export default async function EmailCampaignsPage() {
    const [configResult, templateResult] = await Promise.all([
        getSystemConfig(),
        getEmailTemplateSettings(),
    ]);

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

    const platformName = templateResult.success ? templateResult.platformName || "Platform" : "Platform";
    const websiteUrl = templateResult.success ? templateResult.websiteUrl || "https://zeero.bet" : "https://zeero.bet";
    const templateSettings = templateResult.success && templateResult.data ? templateResult.data : null;

    const enabledCount = templateSettings
        ? emailTemplateCatalog.filter((template) => templateSettings[template.id as EmailTemplateId].enabled).length
        : 0;

    const imageCount = templateSettings
        ? emailTemplateCatalog.filter((template) => {
            const imageUrl = resolveManagedEmailTemplate(
                template.id as EmailTemplateId,
                templateSettings,
                {
                    platformName,
                    siteUrl: websiteUrl,
                    senderEmail: senderIdentity,
                    username: "Player",
                    amountLabel: "INR 5,000.00",
                    processedAt: "05 Apr 2026, 9:30 PM IST",
                    otpCode: "482913",
                    purposeAction: "verify your email address",
                    purposeLabel: "Account registration",
                },
            ).imageUrl;

            return Boolean(imageUrl.trim());
        }).length
        : 0;

    const lifecycleTemplates = templateSettings
        ? ["register-success", "deposit-success", "withdrawal-success"].filter(
            (templateId) => templateSettings[templateId as EmailTemplateId].enabled,
        ).length
        : 0;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
                        <Mail size={14} />
                        Email Campaign Hub
                    </div>
                    <h1 className="mt-3 text-3xl font-bold text-white">Email Campaigns</h1>
                    <p className="mt-1 max-w-3xl text-sm text-slate-400">
                        Manage the transactional email channel from one place: SMTP readiness, lifecycle delivery coverage, image-backed templates, and direct links into the editor.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Link
                        href="/dashboard/settings/config"
                        className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
                    >
                        <Settings size={16} />
                        Configure SMTP
                    </Link>
                    <Link
                        href="/dashboard/messaging/email/templates"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-700"
                    >
                        <BookOpen size={16} />
                        Edit Templates
                    </Link>
                    <Link
                        href="/dashboard/messaging/whatsapp/campaigns"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-700"
                    >
                        <MessageSquare size={16} />
                        WhatsApp Broadcasts
                    </Link>
                </div>
            </div>

            <div className={`rounded-2xl border p-5 ${smtpReady ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                            {smtpReady ? <CheckCircle2 size={16} className="text-emerald-400" /> : <TriangleAlert size={16} className="text-amber-400" />}
                            {smtpReady ? "SMTP is ready for delivery" : "SMTP needs setup before campaigns can go live"}
                        </div>
                        <p className="mt-1 text-sm text-slate-200">{senderIdentity}</p>
                    </div>
                    <Link
                        href="/dashboard/settings/config"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-sky-200"
                    >
                        Open Site Config
                        <ArrowRight size={14} />
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Enabled Templates</p>
                    <p className="mt-3 text-3xl font-bold text-white">{enabledCount}</p>
                    <p className="mt-2 text-sm text-slate-400">Templates currently allowed to send.</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Lifecycle Active</p>
                    <p className="mt-3 text-3xl font-bold text-white">{lifecycleTemplates}/3</p>
                    <p className="mt-2 text-sm text-slate-400">Welcome, deposit, and withdrawal coverage.</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Image Coverage</p>
                    <p className="mt-3 text-3xl font-bold text-white">{imageCount}</p>
                    <p className="mt-2 text-sm text-slate-400">Templates with preview-ready artwork.</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Campaign Mode</p>
                    <p className="mt-3 text-xl font-bold text-white">Transactional Live</p>
                    <p className="mt-2 text-sm text-slate-400">Bulk email automation is still staged behind the editor workflow.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr,1.05fr]">
                <section className="rounded-2xl border border-slate-700 bg-slate-900/80">
                    <div className="border-b border-slate-800 px-5 py-4">
                        <h2 className="text-lg font-semibold text-white">Launch Checklist</h2>
                        <p className="text-xs text-slate-400">What operations can do today to keep email delivery healthy.</p>
                    </div>
                    <div className="space-y-3 p-5">
                        {emailLaunchChecklist.map((item) => (
                            <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                <CheckCircle2 size={16} className="mt-0.5 text-emerald-400" />
                                <p className="text-sm text-slate-300">{item}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-700 bg-slate-900/80">
                    <div className="border-b border-slate-800 px-5 py-4">
                        <h2 className="text-lg font-semibold text-white">Channel Coverage</h2>
                        <p className="text-xs text-slate-400">What is currently wired and ready for the email channel.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
                        {[
                            {
                                title: "Transactional Delivery",
                                desc: `${enabledCount} templates are configured for branded transactional delivery.`,
                                tone: "text-sky-300 border-sky-500/20 bg-sky-500/10",
                            },
                            {
                                title: "Lifecycle Coverage",
                                desc: `${lifecycleTemplates} of 3 lifecycle emails are currently enabled.`,
                                tone: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10",
                            },
                            {
                                title: "Image-backed UI",
                                desc: `${imageCount} templates already have artwork configured for cards and outgoing emails.`,
                                tone: "text-orange-300 border-orange-500/20 bg-orange-500/10",
                            },
                            {
                                title: "Campaign Buildout",
                                desc: "Use the template editor to manage email content while bulk email orchestration is staged.",
                                tone: "text-violet-300 border-violet-500/20 bg-violet-500/10",
                            },
                        ].map((item) => (
                            <div key={item.title} className={`rounded-xl border p-4 ${item.tone}`}>
                                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                                <p className="mt-2 text-sm text-slate-300">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <section className="rounded-2xl border border-slate-700 bg-slate-900/80">
                <div className="flex flex-col gap-2 border-b border-slate-800 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Transactional Template Coverage</h2>
                        <p className="text-xs text-slate-400">Every template below can now be edited from the admin panel, including subject, copy, images, and lifecycle toggles.</p>
                    </div>
                    <Link href="/dashboard/messaging/email/templates" className="text-sm font-semibold text-sky-300 transition-colors hover:text-sky-200">
                        Open template editor
                    </Link>
                </div>

                <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                    {emailTemplateCatalog.map((template) => {
                        const resolvedTemplate = templateSettings
                            ? resolveManagedEmailTemplate(
                                template.id as EmailTemplateId,
                                templateSettings,
                                {
                                    platformName,
                                    siteUrl: websiteUrl,
                                    senderEmail: senderIdentity,
                                    username: "Player",
                                    amountLabel: "INR 5,000.00",
                                    processedAt: "05 Apr 2026, 9:30 PM IST",
                                    otpCode: "482913",
                                    purposeAction: "verify your email address",
                                    purposeLabel: "Account registration",
                                },
                            )
                            : null;

                        const previewImage = resolvedTemplate?.imageUrl;
                        const isEnabled = resolvedTemplate?.enabled ?? false;

                        return (
                            <div key={template.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
                                <div className="relative h-32 border-b border-slate-800 bg-slate-950">
                                    {previewImage ? (
                                        <img src={previewImage} alt={template.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.25),transparent_55%),linear-gradient(180deg,#1e1b22_0%,#131117_100%)]">
                                            <ImageIcon className="text-orange-300/70" size={28} />
                                        </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/95 via-slate-950/35 to-transparent px-3 pb-3 pt-10">
                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${template.accentClass}`}>
                                            {isEnabled ? "Enabled" : "Paused"}
                                        </span>
                                        {!template.allowDisable && (
                                            <span className="rounded-full border border-slate-600 bg-slate-950/70 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                                                Core
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3 p-4">
                                    <div>
                                        <h3 className="text-base font-semibold text-white">{template.name}</h3>
                                        <p className="mt-1 text-sm text-slate-400">{template.summary}</p>
                                    </div>

                                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Audience</p>
                                        <p className="mt-1 text-sm text-slate-300">{template.audience}</p>
                                    </div>

                                    <Link
                                        href={`/dashboard/messaging/email/templates#${template.id}`}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition-colors hover:text-sky-200"
                                    >
                                        Edit template
                                        <ArrowRight size={14} />
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
