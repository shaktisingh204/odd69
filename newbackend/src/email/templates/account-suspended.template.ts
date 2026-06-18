import {
    escapeHtml,
    formatEmailTimestamp,
    renderBrandedEmail,
    renderButton,
    renderFeatureList,
    renderMetaRows,
    renderNotice,
} from './email-theme.template';
import type { ManagedEmailTemplateSettings } from '../email-template-config';

export function accountSuspendedTemplate(
    platformName: string,
    template: ManagedEmailTemplateSettings,
    username: string,
    reason: string,
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
            tone: 'danger',
        },
        bodyHtml: [
            template.bodyPrimary
                ? `<p style="margin:0 0 16px;color:#c9bfb6;font-size:14px;line-height:1.7;">${escapeHtml(template.bodyPrimary)}</p>`
                : '',
            renderMetaRows([
                { label: 'Account', value: username, tone: 'default' },
                { label: 'Status', value: 'Suspended', tone: 'danger' },
                { label: 'Reason', value: reason || 'Policy violation', tone: 'warning' },
                { label: 'Effective', value: formatEmailTimestamp(), tone: 'default' },
            ]),
            template.bodySecondary
                ? `<p style="margin:20px 0 0;color:#9e9793;font-size:13px;line-height:1.7;">${escapeHtml(template.bodySecondary)}</p>`
                : '',
            renderNotice({
                title: template.noteTitle || undefined,
                body: template.noteBody,
                tone: 'danger',
            }),
            renderFeatureList([
                { title: 'Login disabled', description: 'You will not be able to sign in to your account until the suspension is lifted.' },
                { title: 'Withdrawals frozen', description: 'All pending withdrawals have been put on hold pending review.' },
                { title: 'Bets voided', description: 'Open bets may be settled or voided per platform policy.' },
            ]),
            template.ctaLabel ? renderButton(template.ctaLabel, `${siteUrl}/support`) : '',
        ].join(''),
        footerNote: template.footerNote,
    });
}
