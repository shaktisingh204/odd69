import {
    escapeHtml,
    renderBrandedEmail,
    renderButton,
    renderCodeBlock,
    renderMetaRows,
    renderNotice,
} from './email-theme.template';
import type { ManagedEmailTemplateSettings } from '../email-template-config';

export function forgotPasswordTemplate(
    platformName: string,
    template: ManagedEmailTemplateSettings,
    resetLink: string,
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
            tone: 'warning',
        },
        bodyHtml: [
            template.bodyPrimary
                ? `<p style="margin:0 0 16px;color:#c9bfb6;font-size:14px;line-height:1.7;">${escapeHtml(template.bodyPrimary)}</p>`
                : '',
            template.bodySecondary
                ? `<p style="margin:0 0 20px;color:#9e9793;font-size:13px;line-height:1.7;">${escapeHtml(template.bodySecondary)}</p>`
                : '',
            template.ctaLabel ? renderButton(template.ctaLabel, resetLink) : '',
            renderMetaRows([
                { label: 'Action', value: 'Password reset', tone: 'warning' },
                { label: 'Expires in', value: '1 hour', tone: 'danger' },
            ]),
            template.noteBody
                ? renderNotice({
                    title: template.noteTitle || undefined,
                    body: template.noteBody,
                    tone: 'warning',
                })
                : '',
            renderCodeBlock('Reset link (copy if button does not work)', resetLink),
        ].join(''),
        footerNote: template.footerNote,
    });
}
