import {
    escapeHtml,
    renderBrandedEmail,
    renderMetaRows,
    renderNotice,
} from './email-theme.template';
import type { ManagedEmailTemplateSettings } from '../email-template-config';

export function otpTemplate(
    platformName: string,
    template: ManagedEmailTemplateSettings,
    purposeLabel: string,
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
        heroHelper: template.heroHelper,
        heroMonospace: true,
        heroStatus: {
            label: template.heroStatus,
            tone: 'brand',
        },
        bodyHtml: [
            template.bodyPrimary
                ? `<p style="margin:0 0 16px;color:#c9bfb6;font-size:14px;line-height:1.7;">${escapeHtml(template.bodyPrimary)}</p>`
                : '',
            template.bodySecondary
                ? `<p style="margin:0 0 20px;color:#9e9793;font-size:13px;line-height:1.7;">${escapeHtml(template.bodySecondary)}</p>`
                : '',
            renderMetaRows([
                { label: 'Purpose', value: purposeLabel, tone: 'brand' },
                { label: 'Expires in', value: '10 minutes', tone: 'warning' },
                { label: 'Attempts', value: 'Single use', tone: 'default' },
            ]),
            template.noteBody
                ? renderNotice({
                    title: template.noteTitle || undefined,
                    body: template.noteBody,
                    tone: 'danger',
                })
                : '',
        ].join(''),
        footerNote: template.footerNote,
    });
}
