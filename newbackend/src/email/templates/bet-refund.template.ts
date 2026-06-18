import {
    escapeHtml,
    formatEmailTimestamp,
    renderBrandedEmail,
    renderButton,
    renderMetaRows,
    renderNotice,
} from './email-theme.template';
import type { ManagedEmailTemplateSettings } from '../email-template-config';

export function betRefundTemplate(
    platformName: string,
    template: ManagedEmailTemplateSettings,
    amountLabel: string,
    eventName: string,
    marketName: string,
    siteUrl = '#',
): string {
    return renderBrandedEmail({
        platformName,
        preheader: template.preheader,
        eyebrow: template.eyebrow,
        title: template.title,
        lead: template.lead,
        heroLabel: template.heroLabel,
        heroValue: template.heroValue,
        heroHelper: template.heroHelper || formatEmailTimestamp(),
        heroStatus: {
            label: template.heroStatus,
            tone: 'info',
        },
        bodyHtml: [
            template.bodyPrimary
                ? `<p style="margin:0 0 16px;color:#c9bfb6;font-size:14px;line-height:1.7;">${escapeHtml(template.bodyPrimary)}</p>`
                : '',
            renderMetaRows([
                { label: 'Refund amount', value: amountLabel, tone: 'success' },
                { label: 'Event', value: eventName, tone: 'default' },
                { label: 'Market', value: marketName, tone: 'default' },
                { label: 'Status', value: 'Refunded', tone: 'info' },
                { label: 'Refunded at', value: formatEmailTimestamp(), tone: 'default' },
            ]),
            template.bodySecondary
                ? `<p style="margin:20px 0 0;color:#9e9793;font-size:13px;line-height:1.7;">${escapeHtml(template.bodySecondary)}</p>`
                : '',
            template.noteBody
                ? renderNotice({
                    title: template.noteTitle || undefined,
                    body: template.noteBody,
                    tone: 'info',
                })
                : '',
            template.ctaLabel ? renderButton(template.ctaLabel, siteUrl) : '',
        ].join(''),
        footerNote: template.footerNote,
    });
}
