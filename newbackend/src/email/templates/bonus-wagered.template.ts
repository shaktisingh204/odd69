import {
    escapeHtml,
    formatEmailTimestamp,
    renderBrandedEmail,
    renderButton,
    renderMetaRows,
    renderNotice,
} from './email-theme.template';
import type { ManagedEmailTemplateSettings } from '../email-template-config';

export function bonusWageredTemplate(
    platformName: string,
    template: ManagedEmailTemplateSettings,
    bonusTitle: string,
    bonusAmount: string,
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
            tone: 'success',
        },
        bodyHtml: [
            template.bodyPrimary
                ? `<p style="margin:0 0 16px;color:#c9bfb6;font-size:14px;line-height:1.7;">${escapeHtml(template.bodyPrimary)}</p>`
                : '',
            renderMetaRows([
                { label: 'Bonus', value: bonusTitle, tone: 'brand' },
                { label: 'Bonus amount', value: bonusAmount, tone: 'success' },
                { label: 'Wagering', value: '100% Complete', tone: 'success' },
                { label: 'Status', value: 'Ready to convert', tone: 'success' },
                { label: 'Completed at', value: formatEmailTimestamp(), tone: 'default' },
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
