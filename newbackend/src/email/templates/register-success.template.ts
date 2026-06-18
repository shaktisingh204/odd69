import {
    escapeHtml,
    renderBrandedEmail,
    renderButton,
    renderFeatureList,
    renderMetaRows,
    renderNotice,
} from './email-theme.template';
import type { ManagedEmailTemplateSettings } from '../email-template-config';

export function registerSuccessTemplate(
    platformName: string,
    template: ManagedEmailTemplateSettings,
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
            renderFeatureList([
                { title: 'Fund your wallet', description: 'Add funds via UPI, bank transfer, or crypto to start playing instantly.' },
                { title: 'Explore Sports & Casino', description: 'Live cricket odds, football, tennis, and hundreds of casino games in one place.' },
                { title: 'Claim your bonus', description: 'Check the promotions page for welcome offers and deposit bonuses.' },
            ]),
            renderMetaRows([
                { label: 'Account', value: template.heroValue || 'Active', tone: 'success' },
                { label: 'Platform', value: platformName, tone: 'brand' },
            ]),
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
