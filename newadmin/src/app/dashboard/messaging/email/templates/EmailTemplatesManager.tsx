"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    CheckCircle2,
    Eye,
    Image as ImageIcon,
    ImagePlus,
    Lock,
    Mail,
    RotateCcw,
    Save,
    ShieldCheck,
    TriangleAlert,
    Upload,
} from "lucide-react";
import { uploadPublicImage } from "@/actions/settings";
import { saveEmailTemplateSettings } from "@/actions/settings";
import { emailTemplateCatalog } from "@/lib/email-catalog";
import {
    defaultEmailTemplateSettings,
    emailTemplateSampleTokens,
    resolveManagedEmailTemplate,
    type EmailTemplateId,
    type ManagedEmailTemplateSettings,
    type ManagedEmailTemplateSettingsMap,
} from "@/lib/email-template-config";

type Props = {
    initialSettings: ManagedEmailTemplateSettingsMap;
    platformName: string;
    websiteUrl: string;
    smtpReady: boolean;
    senderIdentity: string;
};

const textFieldClassName =
    "w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-orange-400";

function buildPreviewTokens(
    templateId: EmailTemplateId,
    platformName: string,
    websiteUrl: string,
    senderIdentity: string,
) {
    const sample = emailTemplateSampleTokens[templateId];

    return {
        ...sample,
        platformName,
        siteUrl: websiteUrl,
        senderEmail: senderIdentity,
    };
}

export default function EmailTemplatesManager({
    initialSettings,
    platformName,
    websiteUrl,
    smtpReady,
    senderIdentity,
}: Props) {
    const [templates, setTemplates] = useState<ManagedEmailTemplateSettingsMap>(initialSettings);
    const [selectedId, setSelectedId] = useState<EmailTemplateId>("register-success");
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const selectedMeta = emailTemplateCatalog.find((item) => item.id === selectedId)!;
    const selectedTemplate = templates[selectedId];
    const previewTemplate = useMemo(
        () =>
            resolveManagedEmailTemplate(
                selectedId,
                templates,
                buildPreviewTokens(selectedId, platformName, websiteUrl, senderIdentity),
            ),
        [platformName, selectedId, senderIdentity, templates, websiteUrl],
    );

    const enabledCount = useMemo(
        () => emailTemplateCatalog.filter((template) => templates[template.id as EmailTemplateId].enabled).length,
        [templates],
    );

    useEffect(() => {
        const syncSelectedTemplateFromHash = () => {
            const hash = window.location.hash.replace(/^#/, "");
            const foundTemplate = emailTemplateCatalog.find((template) => template.id === hash);
            if (foundTemplate) {
                setSelectedId(foundTemplate.id as EmailTemplateId);
            }
        };

        syncSelectedTemplateFromHash();
        window.addEventListener("hashchange", syncSelectedTemplateFromHash);

        return () => window.removeEventListener("hashchange", syncSelectedTemplateFromHash);
    }, []);

    const imageCount = useMemo(
        () =>
            emailTemplateCatalog.filter((template) => {
                const imageUrl = templates[template.id as EmailTemplateId].imageUrl?.trim();
                return Boolean(imageUrl);
            }).length,
        [templates],
    );

    const updateField = (field: keyof ManagedEmailTemplateSettings, value: string | boolean) => {
        setTemplates((prev) => ({
            ...prev,
            [selectedId]: {
                ...prev[selectedId],
                [field]: value,
            },
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setToast(null);

        try {
            const result = await saveEmailTemplateSettings(templates);
            if (!result.success) {
                setToast({ type: "error", message: result.error || "Failed to save email template settings." });
                return;
            }

            setToast({ type: "success", message: "Email templates saved successfully." });
        } catch (error: any) {
            setToast({ type: "error", message: error?.message || "Failed to save email template settings." });
        } finally {
            setSaving(false);
        }
    };

    const handleResetSelected = () => {
        setTemplates((prev) => ({
            ...prev,
            [selectedId]: { ...defaultEmailTemplateSettings[selectedId] },
        }));
        setToast({ type: "success", message: "Selected template reset to defaults." });
    };

    const handleImageUpload = async (file: File | null) => {
        if (!file) return;

        setUploading(true);
        setToast(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", "email-templates");

            const result = await uploadPublicImage(formData);
            if (!result.success || !result.url) {
                setToast({ type: "error", message: result.error || "Image upload failed." });
                return;
            }

            updateField("imageUrl", result.url);
            setToast({ type: "success", message: "Template image uploaded. Save to publish it." });
        } catch (error: any) {
            setToast({ type: "error", message: error?.message || "Image upload failed." });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
                        <Mail size={14} />
                        Template Editor
                    </div>
                    <h1 className="mt-3 text-3xl font-bold text-white">Email Templates</h1>
                    <p className="mt-1 max-w-3xl text-sm text-slate-400">
                        Edit transactional email copy, switch lifecycle messages on or off, upload artwork, and preview a compact branded layout before it goes out.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={handleResetSelected}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
                    >
                        <RotateCcw size={16} />
                        Reset Selected
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Save size={16} />
                        {saving ? "Saving..." : "Save Templates"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">SMTP</p>
                    <div className="mt-3 flex items-center gap-2">
                        {smtpReady ? <CheckCircle2 size={18} className="text-emerald-400" /> : <TriangleAlert size={18} className="text-amber-400" />}
                        <span className="text-lg font-semibold text-white">{smtpReady ? "Ready" : "Needs attention"}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{senderIdentity}</p>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Enabled Templates</p>
                    <div className="mt-3 text-3xl font-bold text-white">{enabledCount}</div>
                    <p className="mt-2 text-sm text-slate-400">Welcome, deposit, and withdrawal can be managed from here.</p>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Images Configured</p>
                    <div className="mt-3 text-3xl font-bold text-white">{imageCount}</div>
                    <p className="mt-2 text-sm text-slate-400">Each template can use its own artwork while keeping the same compact shell.</p>
                </div>
            </div>

            {toast && (
                <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${toast.type === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-red-500/25 bg-red-500/10 text-red-400"}`}>
                    {toast.type === "success" ? <CheckCircle2 size={16} /> : <TriangleAlert size={16} />}
                    <span>{toast.message}</span>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px,minmax(0,1fr),360px]">
                <aside className="space-y-3">
                    {emailTemplateCatalog.map((template) => {
                        const templateSettings = templates[template.id as EmailTemplateId];
                        const resolvedImage = resolveManagedEmailTemplate(
                            template.id as EmailTemplateId,
                            templates,
                            buildPreviewTokens(template.id as EmailTemplateId, platformName, websiteUrl, senderIdentity),
                        ).imageUrl;

                        return (
                            <button
                                key={template.id}
                                type="button"
                                onClick={() => {
                                    setSelectedId(template.id as EmailTemplateId);
                                    window.history.replaceState(null, "", `#${template.id}`);
                                }}
                                className={`w-full overflow-hidden rounded-2xl border text-left transition-all ${selectedId === template.id ? "border-orange-400 bg-slate-900 shadow-[0_0_0_1px_rgba(251,146,60,0.35)]" : "border-slate-700 bg-slate-900/70 hover:border-slate-600 hover:bg-slate-900"}`}
                            >
                                <div className="relative h-28 w-full overflow-hidden border-b border-slate-800 bg-slate-950">
                                    {resolvedImage ? (
                                        <img src={resolvedImage} alt={template.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.25),transparent_55%),linear-gradient(180deg,#1e1b22_0%,#131117_100%)]">
                                            <ImageIcon className="text-orange-300/80" size={28} />
                                        </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/95 via-slate-950/35 to-transparent px-3 pb-3 pt-8">
                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${template.accentClass}`}>
                                            {templateSettings.enabled ? "Enabled" : "Paused"}
                                        </span>
                                        {!template.allowDisable && (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-950/70 px-2 py-1 text-[10px] font-semibold text-slate-300">
                                                <Lock size={10} />
                                                Core
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h2 className="text-sm font-semibold text-white">{template.name}</h2>
                                    <p className="mt-1 text-xs text-slate-400">{template.summary}</p>
                                </div>
                            </button>
                        );
                    })}
                </aside>

                <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
                    <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 md:flex-row md:items-start md:justify-between">
                        <div>
                            <div className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${selectedMeta.accentClass}`}>
                                {selectedMeta.trigger}
                            </div>
                            <h2 className="mt-3 text-2xl font-bold text-white">{selectedMeta.name}</h2>
                            <p className="mt-1 max-w-2xl text-sm text-slate-400">{selectedMeta.summary}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Delivery</p>
                            {selectedMeta.allowDisable ? (
                                <label className="mt-3 flex cursor-pointer items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedTemplate.enabled}
                                        onChange={(event) => updateField("enabled", event.target.checked)}
                                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-400"
                                    />
                                    <span className="text-sm font-semibold text-white">
                                        {selectedTemplate.enabled ? "Email enabled" : "Email paused"}
                                    </span>
                                </label>
                            ) : (
                                <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
                                    <ShieldCheck size={16} className="text-emerald-400" />
                                    Always enabled for core security or setup flows
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                        <div className="space-y-5">
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Image</p>
                                        <p className="mt-1 text-sm text-slate-400">Upload or paste a full image URL for this email.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        {uploading ? <Upload size={15} className="animate-pulse" /> : <ImagePlus size={15} />}
                                        {uploading ? "Uploading..." : "Upload"}
                                    </button>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(event) => handleImageUpload(event.target.files?.[0] || null)}
                                />
                                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                                    {previewTemplate.imageUrl ? (
                                        <img src={previewTemplate.imageUrl} alt={selectedMeta.name} className="h-36 w-full object-cover" />
                                    ) : (
                                        <div className="flex h-36 w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.25),transparent_55%),linear-gradient(180deg,#1e1b22_0%,#131117_100%)]">
                                            <ImageIcon className="text-orange-300/80" size={30} />
                                        </div>
                                    )}
                                </div>
                                <input
                                    value={selectedTemplate.imageUrl}
                                    onChange={(event) => updateField("imageUrl", event.target.value)}
                                    placeholder="https://..."
                                    className={`${textFieldClassName} mt-4`}
                                />
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Headers</p>
                                <div className="mt-4 space-y-4">
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Subject</label>
                                        <input value={selectedTemplate.subject} onChange={(event) => updateField("subject", event.target.value)} className={textFieldClassName} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Preheader</label>
                                        <textarea value={selectedTemplate.preheader} onChange={(event) => updateField("preheader", event.target.value)} rows={2} className={textFieldClassName} />
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-300">Eyebrow</label>
                                            <input value={selectedTemplate.eyebrow} onChange={(event) => updateField("eyebrow", event.target.value)} className={textFieldClassName} />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-300">Hero Status</label>
                                            <input value={selectedTemplate.heroStatus} onChange={(event) => updateField("heroStatus", event.target.value)} className={textFieldClassName} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Title</label>
                                        <input value={selectedTemplate.title} onChange={(event) => updateField("title", event.target.value)} className={textFieldClassName} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Lead</label>
                                        <textarea value={selectedTemplate.lead} onChange={(event) => updateField("lead", event.target.value)} rows={2} className={textFieldClassName} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Hero Panel</p>
                                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Hero Label</label>
                                        <input value={selectedTemplate.heroLabel} onChange={(event) => updateField("heroLabel", event.target.value)} className={textFieldClassName} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Hero Value</label>
                                        <input value={selectedTemplate.heroValue} onChange={(event) => updateField("heroValue", event.target.value)} className={textFieldClassName} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Hero Helper</label>
                                        <input value={selectedTemplate.heroHelper} onChange={(event) => updateField("heroHelper", event.target.value)} className={textFieldClassName} />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Body</p>
                                <div className="mt-4 space-y-4">
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Primary Body Copy</label>
                                        <textarea value={selectedTemplate.bodyPrimary} onChange={(event) => updateField("bodyPrimary", event.target.value)} rows={3} className={textFieldClassName} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Secondary Body Copy</label>
                                        <textarea value={selectedTemplate.bodySecondary} onChange={(event) => updateField("bodySecondary", event.target.value)} rows={3} className={textFieldClassName} />
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-300">Note Title</label>
                                            <input value={selectedTemplate.noteTitle} onChange={(event) => updateField("noteTitle", event.target.value)} className={textFieldClassName} />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-300">CTA Label</label>
                                            <input value={selectedTemplate.ctaLabel} onChange={(event) => updateField("ctaLabel", event.target.value)} className={textFieldClassName} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Note Body</label>
                                        <textarea value={selectedTemplate.noteBody} onChange={(event) => updateField("noteBody", event.target.value)} rows={3} className={textFieldClassName} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Footer Note</label>
                                        <textarea value={selectedTemplate.footerNote} onChange={(event) => updateField("footerNote", event.target.value)} rows={2} className={textFieldClassName} />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <Eye size={16} className="text-orange-300" />
                                    Supported Tokens
                                </div>
                                <p className="mt-2 text-sm text-slate-400">
                                    Use these placeholders anywhere in the fields above. They will be replaced when the email is sent.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {selectedMeta.variables.map((token) => (
                                        <span key={token} className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs text-orange-200">
                                            {`{{${token}}}`}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <aside className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
                    <div className="flex items-center gap-2">
                        <Eye size={16} className="text-orange-300" />
                        <h3 className="text-lg font-semibold text-white">Live Preview</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">Matches the actual email your users receive — with sample tokens filled in.</p>

                    {/* Subject line preview */}
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Subject</p>
                        <p className="mt-1 truncate text-sm font-semibold text-white">{previewTemplate.subject}</p>
                    </div>

                    {/* Email card — mirrors new inline-style theme */}
                    <div className="mt-4 overflow-hidden rounded-[24px] bg-gradient-to-br from-orange-500/20 via-orange-400/5 to-blue-400/5 p-[2px] shadow-[0_32px_80px_rgba(0,0,0,0.5)]">
                        <div className="overflow-hidden rounded-[22px] bg-[#1a171e]">

                            {/* Hero section */}
                            <div className="bg-[linear-gradient(160deg,rgba(120,75,30,0.4)_0%,rgba(60,50,45,0.3)_30%,rgba(26,23,30,1)_70%)] px-5 pb-5 pt-6">

                                {/* Eyebrow */}
                                <div className="mb-4">
                                    <span className="inline-block rounded-full border border-orange-300/20 bg-orange-500/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-200">
                                        {previewTemplate.eyebrow}
                                    </span>
                                </div>

                                {/* Platform name */}
                                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">{platformName}</p>

                                {/* Title */}
                                <h2 className="text-[22px] font-black leading-tight tracking-tight text-white">{previewTemplate.title}</h2>

                                {/* Lead */}
                                <p className="mt-2 text-[13px] leading-relaxed text-[#c9bfb6]">{previewTemplate.lead}</p>

                                {/* Hero panel */}
                                {previewTemplate.heroValue ? (
                                    <div className="mt-5 rounded-2xl border border-white/5 bg-gradient-to-br from-black/40 to-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                        {previewTemplate.heroLabel ? (
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{previewTemplate.heroLabel}</p>
                                        ) : null}
                                        <p className="mt-1.5 text-2xl font-black tracking-tight text-white">{previewTemplate.heroValue}</p>
                                        {previewTemplate.heroHelper ? (
                                            <p className="mt-1.5 text-xs text-[#b8b0a8]">{previewTemplate.heroHelper}</p>
                                        ) : null}
                                        {previewTemplate.heroStatus ? (
                                            <div className="mt-3">
                                                <span className={`inline-block rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.04em] ${selectedMeta.accentClass}`}>
                                                    {previewTemplate.heroStatus}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : previewTemplate.heroStatus ? (
                                    <div className="mt-4">
                                        <span className={`inline-block rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.04em] ${selectedMeta.accentClass}`}>
                                            {previewTemplate.heroStatus}
                                        </span>
                                    </div>
                                ) : null}

                                {/* Image */}
                                {previewTemplate.imageUrl ? (
                                    <div className="mt-4 overflow-hidden rounded-2xl border border-white/5">
                                        <img src={previewTemplate.imageUrl} alt={previewTemplate.title} className="h-32 w-full object-cover" />
                                    </div>
                                ) : null}
                            </div>

                            {/* Gradient divider */}
                            <div className="h-px bg-gradient-to-r from-transparent via-orange-400/15 to-transparent" />

                            {/* Content section */}
                            <div className="space-y-4 px-5 py-5">
                                {previewTemplate.bodyPrimary ? (
                                    <p className="text-[13px] leading-relaxed text-[#c9bfb6]">{previewTemplate.bodyPrimary}</p>
                                ) : null}

                                {previewTemplate.bodySecondary ? (
                                    <p className="text-[13px] leading-relaxed text-[#9e9793]">{previewTemplate.bodySecondary}</p>
                                ) : null}

                                {/* Notice block */}
                                {previewTemplate.noteBody ? (
                                    <div className={`rounded-2xl border p-3.5 ${selectedMeta.accentClass.replace(/text-\S+/, "").trim()} bg-opacity-40`}>
                                        {previewTemplate.noteTitle ? (
                                            <p className="mb-1.5 text-xs font-extrabold text-white">{previewTemplate.noteTitle}</p>
                                        ) : null}
                                        <p className="text-xs leading-relaxed text-[#b8b0a8]">{previewTemplate.noteBody}</p>
                                    </div>
                                ) : null}

                                {/* CTA button */}
                                {previewTemplate.ctaLabel ? (
                                    <div className="pt-2 text-center">
                                        <span className="inline-block min-w-[180px] rounded-[14px] bg-gradient-to-r from-orange-500 via-orange-400 to-amber-300 px-7 py-3 text-[13px] font-extrabold uppercase tracking-wide text-[#0f0d12] shadow-[0_8px_32px_rgba(227,125,50,0.35)]">
                                            {previewTemplate.ctaLabel}
                                        </span>
                                    </div>
                                ) : null}
                            </div>

                            {/* Footer divider */}
                            <div className="h-px bg-gradient-to-r from-transparent via-orange-400/10 to-transparent" />

                            {/* Footer */}
                            <div className="bg-gradient-to-b from-[#1a171e] to-[#141118] px-5 py-4">
                                <p className="text-[13px] font-extrabold text-white">{platformName}</p>
                                <p className="mt-1.5 text-[11px] leading-relaxed text-[#6b6870]">{previewTemplate.footerNote}</p>
                                <p className="mt-1 text-[10px] text-[#4a474e]">&copy; {new Date().getFullYear()} {platformName}. All rights reserved.</p>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
