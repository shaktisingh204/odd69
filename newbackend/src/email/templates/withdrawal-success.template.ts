import {
    escapeHtml,
    formatEmailTimestamp,
    renderBrandedEmail,
    renderButton,
    renderMetaRows,
    renderNotice,
} from './email-theme.template';
import type { ManagedEmailTemplateSettings } from '../email-template-config';

export function withdrawalSuccessTemplate(
    platformName: string,
    template: ManagedEmailTemplateSettings & { utr?: string },
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
            tone: 'info',
        },
        bodyHtml: [
            template.bodyPrimary
                ? `<p style="margin:0 0 16px;color:#c9bfb6;font-size:14px;line-height:1.7;">${escapeHtml(template.bodyPrimary)}</p>`
                : '',
            renderMetaRows([
                { label: 'Amount', value: amountLabel, tone: 'info' },
                ...(template.utr
                    ? [{ label: 'UTR', value: template.utr, tone: 'info' as const, monospace: true }]
                    : [{ label: 'UTR', value: 'Processing — check your transactions page', tone: 'warning' as const }]),
                { label: 'Status', value: template.heroStatus || 'Processed', tone: 'info' },
                { label: 'Processed at', value: formatEmailTimestamp(), tone: 'default' },
            ]),
            !template.utr
                ? `<p style="margin:16px 0 0;color:#f5c563;font-size:13px;line-height:1.7;">Your UTR number will be available shortly. You can check it anytime at <a href="${siteUrl}/profile/transactions" style="color:#efc083;text-decoration:underline;">odd69.com/profile/transactions</a></p>`
                : '',
            template.bodySecondary
                ? `<p style="margin:20px 0 0;color:#9e9793;font-size:13px;line-height:1.7;">${escapeHtml(template.bodySecondary)}</p>`
                : '',
            template.noteBody
                ? renderNotice({
                    title: template.noteTitle || undefined,
                    body: template.noteBody,
                    tone: 'brand',
                })
                : '',
            template.ctaLabel ? renderButton(template.ctaLabel, siteUrl) : '',
        ].join(''),
        footerNote: template.footerNote,
    });
}
