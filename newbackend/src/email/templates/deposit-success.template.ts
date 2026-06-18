import {
    escapeHtml,
    formatEmailTimestamp,
    renderBrandedEmail,
    renderButton,
    renderMetaRows,
    renderNotice,
} from './email-theme.template';
import type { ManagedEmailTemplateSettings } from '../email-template-config';

export function depositSuccessTemplate(
    platformName: string,
    template: ManagedEmailTemplateSettings,
    amountLabel: string,
    siteUrl = '#',
): string {
    return renderBrandedEmail({
        platformName,
        preheader: template.preheader,
        eyebrow: template.eyebrow,
        title: template.title,
        lead: template.lead,
        imageUrl: template.imageUrl,
        heroLabel: template.heroLabel,
        heroValue: template.heroValue,
        heroHelper: template.heroHelper || formatEmailTimestamp(),
        heroStatus: {
            label: template.heroStatus,
            tone: 'success',
        },
        bodyHtml: [
            template.bodyPrimary
                ? `<p style="margin:0 0 16px;color:#c9bfb6;font-size:14px;line-height:1.7;">${escapeHtml(template.bodyPrimary)}</p>`
                : '',
            renderMetaRows([
                { label: 'Amount credited', value: amountLabel, tone: 'success' },
                { label: 'Status', value: template.heroStatus || 'Approved', tone: 'success' },
                { label: 'Method', value: 'Auto-detected', tone: 'default' },
                { label: 'Processed at', value: formatEmailTimestamp(), tone: 'default' },
            ]),
            template.bodySecondary
                ? `<p style="margin:20px 0 0;color:#9e9793;font-size:13px;line-height:1.7;">${escapeHtml(template.bodySecondary)}</p>`
                : '',
            template.noteBody
                ? renderNotice({
                    title: template.noteTitle || undefined,
                    body: template.noteBody,
                    tone: 'success',
                })
                : '',
            template.ctaLabel ? renderButton(template.ctaLabel, siteUrl) : '',
        ].join(''),
        footerNote: template.footerNote,
    });
}
