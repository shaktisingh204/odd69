import {
    escapeHtml,
    formatEmailTimestamp,
    renderBrandedEmail,
    renderMetaRows,
    renderNotice,
} from './email-theme.template';
import type { ManagedEmailTemplateSettings } from '../email-template-config';

export function smtpTestTemplate(platformName: string, template: ManagedEmailTemplateSettings): string {
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
        heroStatus: {
            label: template.heroStatus,
            tone: 'success',
        },
        bodyHtml: [
            template.bodyPrimary
                ? `<p style="margin:0 0 16px;color:#c9bfb6;font-size:14px;line-height:1.7;">${escapeHtml(template.bodyPrimary)}</p>`
                : '',
            template.bodySecondary
                ? `<p style="margin:0 0 20px;color:#9e9793;font-size:13px;line-height:1.7;">${escapeHtml(template.bodySecondary)}</p>`
                : '',
            renderMetaRows([
                { label: 'SMTP status', value: 'Connected', tone: 'success' },
                { label: 'Delivery path', value: 'SMTP relay verified', tone: 'brand' },
                { label: 'Tested at', value: formatEmailTimestamp(), tone: 'default' },
            ]),
            renderNotice({
                title: template.noteTitle || 'All systems go',
                body: template.noteBody || 'SMTP relay is connected and ready for transactional delivery.',
                tone: 'success',
            }),
        ].join(''),
        footerNote: template.footerNote,
    });
}
