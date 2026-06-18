import type { ManagedEmailTemplateSettings } from '@/lib/email-template-config';

type EmailTone = 'default' | 'brand' | 'success' | 'info' | 'warning' | 'danger';

type EmailMetaRow = {
    label: string;
    value: string;
    tone?: EmailTone;
    monospace?: boolean;
};

type BrandedEmailOptions = {
    platformName: string;
    preheader: string;
    eyebrow: string;
    title: string;
    lead: string;
    heroLabel?: string;
    heroValue?: string;
    heroHelper?: string;
    heroMonospace?: boolean;
    imageUrl?: string;
    heroStatus?: {
        label: string;
        tone?: EmailTone;
    };
    bodyHtml: string;
    footerNote: string;
};

const toneClassMap: Record<EmailTone, string> = {
    default: 'tone-default',
    brand: 'tone-brand',
    success: 'tone-success',
    info: 'tone-info',
    warning: 'tone-warning',
    danger: 'tone-danger',
};

function escapeHtml(value: string): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
    return escapeHtml(value);
}

function renderMetaRows(rows: EmailMetaRow[]): string {
    if (!rows.length) return '';

    const rowsHtml = rows
        .map(({ label, value, tone = 'default', monospace = false }) => {
            const toneClass = toneClassMap[tone];
            const monoClass = monospace ? ' mono' : '';

            return `
              <div class="data-row">
                <span class="data-label">${escapeHtml(label)}</span>
                <span class="data-value ${toneClass}${monoClass}">${escapeHtml(value)}</span>
              </div>
            `;
        })
        .join('');

    return `<div class="data-card">${rowsHtml}</div>`;
}

function renderBrandedEmail(options: BrandedEmailOptions): string {
    const year = new Date().getFullYear();
    const platformName = escapeHtml(options.platformName || 'Platform');
    const preheader = escapeHtml(options.preheader);
    const eyebrow = escapeHtml(options.eyebrow);
    const title = escapeHtml(options.title);
    const lead = escapeHtml(options.lead);
    const footerNote = escapeHtml(options.footerNote);
    const imageHtml = options.imageUrl
        ? `
          <div class="hero-media">
            <img src="${escapeAttribute(options.imageUrl)}" alt="${title}" />
          </div>
        `
        : '';

    const statusHtml = options.heroStatus
        ? `<span class="status-pill ${toneClassMap[options.heroStatus.tone ?? 'brand']}">${escapeHtml(options.heroStatus.label)}</span>`
        : '';

    const heroPanelHtml = options.heroValue
        ? `
          <div class="hero-card">
            ${options.heroLabel ? `<div class="hero-label">${escapeHtml(options.heroLabel)}</div>` : ''}
            <div class="hero-value${options.heroMonospace ? ' mono' : ''}">${escapeHtml(options.heroValue)}</div>
            ${options.heroHelper ? `<div class="hero-helper">${escapeHtml(options.heroHelper)}</div>` : ''}
            ${statusHtml ? `<div class="hero-status">${statusHtml}</div>` : ''}
          </div>
        `
        : statusHtml
            ? `<div class="status-row">${statusHtml}</div>`
            : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | ${platformName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #141217;
      color: #e1c1b8;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      line-height: 1.6;
    }
    a { color: inherit; }
    .preheader {
      display: none !important;
      visibility: hidden;
      opacity: 0;
      color: transparent;
      height: 0;
      width: 0;
      overflow: hidden;
      mso-hide: all;
    }
    .email-shell {
      width: 100%;
      padding: 20px 12px;
      background:
        radial-gradient(circle at top left, rgba(227, 125, 50, 0.18), transparent 34%),
        radial-gradient(circle at top right, rgba(239, 192, 131, 0.16), transparent 28%),
        linear-gradient(180deg, #141217 0%, #1a171d 100%);
    }
    .card {
      width: 100%;
      max-width: 560px;
      margin: 0 auto;
      background: #201e22;
      border: 1px solid rgba(239, 192, 131, 0.16);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 56px rgba(0, 0, 0, 0.28);
    }
    .hero {
      padding: 24px 22px 18px;
      background:
        radial-gradient(circle at top right, rgba(239, 192, 131, 0.14), transparent 34%),
        linear-gradient(135deg, rgba(93, 64, 39, 0.95) 0%, rgba(50, 46, 47, 0.98) 42%, rgba(32, 30, 34, 1) 100%);
      border-bottom: 1px solid rgba(239, 192, 131, 0.12);
    }
    .eyebrow {
      display: inline-block;
      margin-bottom: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(239, 192, 131, 0.24);
      background: rgba(227, 125, 50, 0.12);
      color: #efc083;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .brand {
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin: 0 0 8px;
    }
    .title {
      color: #ffffff;
      font-size: 26px;
      font-weight: 800;
      line-height: 1.12;
      margin: 0 0 8px;
      letter-spacing: -0.04em;
    }
    .lead {
      color: #c9c0b8;
      font-size: 13px;
      line-height: 1.62;
      margin: 0;
    }
    .status-row {
      margin-top: 14px;
    }
    .hero-card {
      margin-top: 16px;
      padding: 14px 16px;
      border-radius: 16px;
      background: rgba(20, 18, 23, 0.52);
      border: 1px solid rgba(239, 192, 131, 0.12);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    }
    .hero-media {
      margin-top: 14px;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(239, 192, 131, 0.12);
      background: rgba(20, 18, 23, 0.5);
    }
    .hero-media img {
      display: block;
      width: 100%;
      height: 132px;
      object-fit: cover;
    }
    .hero-label,
    .data-label {
      color: #8d8a89;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .hero-value {
      margin-top: 6px;
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.04em;
      word-break: break-word;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      letter-spacing: 0.08em;
    }
    .hero-helper {
      margin-top: 6px;
      color: #c9c0b8;
      font-size: 12px;
    }
    .hero-status {
      margin-top: 12px;
    }
    .status-pill {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid transparent;
    }
    .tone-default {
      color: #e1c1b8;
    }
    .tone-brand {
      color: #efc083;
    }
    .tone-success {
      color: #8fe093;
    }
    .tone-info {
      color: #8bbcf5;
    }
    .tone-warning {
      color: #efc083;
    }
    .tone-danger {
      color: #f39a9a;
    }
    .status-pill.tone-brand,
    .notice.tone-brand {
      background: rgba(227, 125, 50, 0.14);
      border-color: rgba(239, 192, 131, 0.22);
    }
    .status-pill.tone-success,
    .notice.tone-success {
      background: rgba(76, 175, 80, 0.14);
      border-color: rgba(76, 175, 80, 0.24);
    }
    .status-pill.tone-info,
    .notice.tone-info {
      background: rgba(45, 125, 210, 0.16);
      border-color: rgba(45, 125, 210, 0.26);
    }
    .status-pill.tone-warning,
    .notice.tone-warning {
      background: rgba(227, 125, 50, 0.16);
      border-color: rgba(239, 192, 131, 0.24);
    }
    .status-pill.tone-danger,
    .notice.tone-danger {
      background: rgba(226, 76, 76, 0.14);
      border-color: rgba(226, 76, 76, 0.24);
    }
    .content {
      padding: 18px 22px 20px;
    }
    .body-text {
      margin: 0 0 12px;
      color: #c9c0b8;
      font-size: 13px;
      line-height: 1.65;
    }
    .data-card {
      margin-top: 14px;
      border-radius: 16px;
      background: #2a272c;
      border: 1px solid rgba(239, 192, 131, 0.1);
    }
    .data-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .data-row:last-child {
      border-bottom: none;
    }
    .data-value {
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      text-align: right;
      word-break: break-word;
    }
    .footer {
      padding: 16px 22px 18px;
      border-top: 1px solid rgba(239, 192, 131, 0.1);
      background: linear-gradient(180deg, rgba(32, 30, 34, 1) 0%, rgba(26, 23, 29, 1) 100%);
    }
    .footer-brand {
      margin: 0 0 8px;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
    }
    .footer-text {
      margin: 0;
      color: #8d8a89;
      font-size: 11px;
      line-height: 1.55;
    }
    .footer-text + .footer-text {
      margin-top: 6px;
    }
    @media only screen and (max-width: 640px) {
      .email-shell { padding: 14px 8px; }
      .hero, .content, .footer { padding-left: 16px; padding-right: 16px; }
      .title { font-size: 22px; }
      .hero-value { font-size: 21px; }
      .hero-media img { height: 112px; }
      .data-row {
        display: block;
      }
      .data-value {
        display: block;
        margin-top: 6px;
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <div class="email-shell">
    <div class="card">
      <div class="hero">
        <div class="eyebrow">${eyebrow}</div>
        <div class="brand">${platformName}</div>
        <h1 class="title">${title}</h1>
        <p class="lead">${lead}</p>
        ${heroPanelHtml}
        ${imageHtml}
      </div>
      <div class="content">
        ${options.bodyHtml}
      </div>
      <div class="footer">
        <p class="footer-brand">${platformName}</p>
        <p class="footer-text">${footerNote}</p>
        <p class="footer-text">© ${year} ${platformName}. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildSmtpTestEmailHtml(platformName: string, template: ManagedEmailTemplateSettings): string {
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
            `<p class="body-text">${escapeHtml(template.bodyPrimary)}</p>`,
            template.bodySecondary ? `<p class="body-text">${escapeHtml(template.bodySecondary)}</p>` : '',
            renderMetaRows([
                { label: template.noteTitle || 'Status', value: template.noteBody || 'SMTP relay connected', tone: 'success' },
                { label: 'Delivery path', value: 'SMTP relay connected', tone: 'brand' },
            ]),
        ].join(''),
        footerNote: template.footerNote,
    });
}
