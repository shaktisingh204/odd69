export type EmailTone = 'default' | 'brand' | 'success' | 'info' | 'warning' | 'danger';

export interface EmailMetaRow {
    label: string;
    value: string;
    tone?: EmailTone;
    monospace?: boolean;
}

export interface EmailFeature {
    title: string;
    description: string;
}

export interface EmailNotice {
    title?: string;
    body: string;
    tone?: EmailTone;
}

export interface BrandedEmailOptions {
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
}

const toneClassMap: Record<EmailTone, string> = {
    default: 'tone-default',
    brand: 'tone-brand',
    success: 'tone-success',
    info: 'tone-info',
    warning: 'tone-warning',
    danger: 'tone-danger',
};

export function escapeHtml(value: string): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function escapeAttribute(value: string): string {
    return escapeHtml(value);
}

export function formatEmailTimestamp(date: Date = new Date(), locale = 'en-IN', timeZone = 'Asia/Kolkata'): string {
    const formatter = new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone,
    });

    return `${formatter.format(date)} IST`;
}

export function renderButton(label: string, url: string): string {
    if (!url) return '';

    return `
      <div style="margin:24px 0 16px;text-align:center;">
        <a href="${escapeAttribute(url)}" style="display:inline-block;min-width:220px;padding:16px 36px;border-radius:14px;background:linear-gradient(135deg,#e37d32 0%,#f5a623 50%,#efc083 100%);color:#0f0d12!important;font-size:15px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;box-shadow:0 8px 32px rgba(227,125,50,0.35),0 2px 8px rgba(0,0,0,0.2);mso-padding-alt:16px 36px;">${escapeHtml(label)}</a>
      </div>
    `;
}

export function renderMetaRows(rows: EmailMetaRow[]): string {
    if (!rows.length) return '';

    const toneColors: Record<EmailTone, string> = {
        default: '#b8b0a8',
        brand: '#efc083',
        success: '#6ee7a0',
        info: '#7ec8f8',
        warning: '#f5c563',
        danger: '#f87171',
    };

    const rowsHtml = rows
        .map(({ label, value, tone = 'default', monospace = false }) => {
            const color = toneColors[tone];
            const fontFamily = monospace ? 'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:0.04em;' : '';

            return `
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:#8d8a89;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;white-space:nowrap;">${escapeHtml(label)}</td>
                <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.04);color:${color};font-size:14px;font-weight:700;text-align:right;${fontFamily}">${escapeHtml(value)}</td>
              </tr>
            `;
        })
        .join('');

    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-radius:16px;background:linear-gradient(135deg,rgba(40,36,44,0.95) 0%,rgba(30,27,34,0.95) 100%);border:1px solid rgba(239,192,131,0.1);overflow:hidden;">
        ${rowsHtml}
      </table>
    `;
}

export function renderNotice({ title, body, tone = 'warning' }: EmailNotice): string {
    const toneConfig: Record<EmailTone, { bg: string; border: string; icon: string; titleColor: string }> = {
        default: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', icon: '\u2139\uFE0F', titleColor: '#ffffff' },
        brand: { bg: 'rgba(227,125,50,0.08)', border: 'rgba(239,192,131,0.18)', icon: '\u2728', titleColor: '#efc083' },
        success: { bg: 'rgba(110,231,160,0.06)', border: 'rgba(110,231,160,0.16)', icon: '\u2705', titleColor: '#6ee7a0' },
        info: { bg: 'rgba(126,200,248,0.06)', border: 'rgba(126,200,248,0.16)', icon: '\uD83D\uDCA1', titleColor: '#7ec8f8' },
        warning: { bg: 'rgba(245,197,99,0.06)', border: 'rgba(245,197,99,0.16)', icon: '\u26A0\uFE0F', titleColor: '#f5c563' },
        danger: { bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.16)', icon: '\uD83D\uDEA8', titleColor: '#f87171' },
    };

    const cfg = toneConfig[tone];

    return `
      <div style="margin-top:20px;padding:18px 20px;border-radius:16px;background:${cfg.bg};border:1px solid ${cfg.border};">
        ${title ? `<div style="margin:0 0 8px;color:${cfg.titleColor};font-size:14px;font-weight:800;letter-spacing:-0.01em;">${cfg.icon} ${escapeHtml(title)}</div>` : ''}
        <div style="color:#b8b0a8;font-size:13px;line-height:1.7;">${escapeHtml(body)}</div>
      </div>
    `;
}

export function renderFeatureList(features: EmailFeature[]): string {
    if (!features.length) return '';

    const itemsHtml = features
        .map(
            (feature, index) => `
              <tr>
                <td style="padding:16px 18px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:top;">
                  <div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,rgba(227,125,50,0.2) 0%,rgba(239,192,131,0.1) 100%);border:1px solid rgba(239,192,131,0.16);color:#efc083;font-size:13px;font-weight:800;line-height:36px;text-align:center;">${String(index + 1).padStart(2, '0')}</div>
                </td>
                <td style="padding:16px 18px 16px 0;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:top;">
                  <div style="color:#ffffff;font-size:14px;font-weight:700;margin-bottom:4px;">${escapeHtml(feature.title)}</div>
                  <div style="color:#b8b0a8;font-size:13px;line-height:1.6;">${escapeHtml(feature.description)}</div>
                </td>
              </tr>
            `,
        )
        .join('');

    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-radius:16px;background:linear-gradient(135deg,rgba(40,36,44,0.95) 0%,rgba(30,27,34,0.95) 100%);border:1px solid rgba(239,192,131,0.1);overflow:hidden;">
        ${itemsHtml}
      </table>
    `;
}

export function renderCodeBlock(label: string, value: string): string {
    return `
      <div style="margin-top:20px;padding:18px 20px;border-radius:16px;background:linear-gradient(135deg,rgba(40,36,44,0.95) 0%,rgba(30,27,34,0.95) 100%);border:1px solid rgba(239,192,131,0.1);">
        <div style="color:#8d8a89;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:10px;">${escapeHtml(label)}</div>
        <div style="padding:14px 16px;border-radius:12px;background:rgba(15,13,18,0.8);border:1px solid rgba(239,192,131,0.06);color:#f0e6dc;font-size:13px;line-height:1.6;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;word-break:break-all;">${escapeHtml(value)}</div>
      </div>
    `;
}

export function renderBrandedEmail(options: BrandedEmailOptions): string {
    const year = new Date().getFullYear();
    const platformName = escapeHtml(options.platformName || 'Platform');
    const preheader = escapeHtml(options.preheader);
    const eyebrow = escapeHtml(options.eyebrow);
    const title = escapeHtml(options.title);
    const lead = escapeHtml(options.lead);
    const footerNote = escapeHtml(options.footerNote);

    const imageHtml = options.imageUrl
        ? `
          <div style="margin-top:20px;border-radius:18px;overflow:hidden;border:1px solid rgba(239,192,131,0.1);">
            <img src="${escapeAttribute(options.imageUrl)}" alt="${title}" style="display:block;width:100%;height:160px;object-fit:cover;" />
          </div>
        `
        : '';

    const statusToneColors: Record<EmailTone, { bg: string; border: string; color: string }> = {
        default: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', color: '#e1c1b8' },
        brand: { bg: 'rgba(227,125,50,0.12)', border: 'rgba(239,192,131,0.22)', color: '#efc083' },
        success: { bg: 'rgba(110,231,160,0.1)', border: 'rgba(110,231,160,0.22)', color: '#6ee7a0' },
        info: { bg: 'rgba(126,200,248,0.1)', border: 'rgba(126,200,248,0.22)', color: '#7ec8f8' },
        warning: { bg: 'rgba(245,197,99,0.1)', border: 'rgba(245,197,99,0.22)', color: '#f5c563' },
        danger: { bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.22)', color: '#f87171' },
    };

    const statusHtml = options.heroStatus
        ? (() => {
            const t = statusToneColors[options.heroStatus.tone ?? 'brand'];
            return `<span style="display:inline-block;padding:7px 16px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;background:${t.bg};border:1px solid ${t.border};color:${t.color};">${escapeHtml(options.heroStatus.label)}</span>`;
        })()
        : '';

    const heroValueStyle = options.heroMonospace
        ? 'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:0.12em;font-size:32px;'
        : 'font-size:30px;letter-spacing:-0.04em;';

    const heroPanelHtml = options.heroValue
        ? `
          <div style="margin-top:24px;padding:22px 24px;border-radius:18px;background:linear-gradient(135deg,rgba(15,13,18,0.7) 0%,rgba(20,18,23,0.6) 100%);border:1px solid rgba(239,192,131,0.1);box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);">
            ${options.heroLabel ? `<div style="color:#8d8a89;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(options.heroLabel)}</div>` : ''}
            <div style="margin-top:8px;color:#ffffff;font-weight:900;line-height:1.15;word-break:break-word;${heroValueStyle}">${escapeHtml(options.heroValue)}</div>
            ${options.heroHelper ? `<div style="margin-top:8px;color:#b8b0a8;font-size:13px;">${escapeHtml(options.heroHelper)}</div>` : ''}
            ${statusHtml ? `<div style="margin-top:14px;">${statusHtml}</div>` : ''}
          </div>
        `
        : statusHtml
            ? `<div style="margin-top:20px;">${statusHtml}</div>`
            : '';

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${title} | ${platformName}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; width: 100%; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    table { border-collapse: collapse !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    @media only screen and (max-width: 640px) {
      .email-card { margin: 0 8px !important; border-radius: 20px !important; }
      .hero-section { padding: 28px 20px 24px !important; }
      .content-section { padding: 24px 20px !important; }
      .footer-section { padding: 20px 20px !important; }
      .title-text { font-size: 24px !important; }
      .hero-value-text { font-size: 26px !important; }
      .cta-button { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0f0d12;color:#e1c1b8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,Arial,sans-serif;line-height:1.6;">
  <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0d12;">
    <tr>
      <td style="padding:32px 16px;">

        <!-- Outer glow wrapper -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
          <tr>
            <td style="padding:2px;border-radius:26px;background:linear-gradient(135deg,rgba(227,125,50,0.3) 0%,rgba(239,192,131,0.08) 40%,rgba(126,200,248,0.05) 100%);">

              <!-- Main card -->
              <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" style="border-radius:24px;overflow:hidden;background:#1a171e;box-shadow:0 32px 80px rgba(0,0,0,0.5),0 8px 24px rgba(0,0,0,0.3);">

                <!-- Hero -->
                <tr>
                  <td class="hero-section" style="padding:36px 32px 28px;background:linear-gradient(160deg,rgba(120,75,30,0.4) 0%,rgba(60,50,45,0.3) 30%,rgba(26,23,30,1) 70%);">

                    <!-- Eyebrow badge -->
                    <div style="margin-bottom:18px;">
                      <span style="display:inline-block;padding:6px 14px;border-radius:999px;border:1px solid rgba(239,192,131,0.2);background:rgba(227,125,50,0.1);color:#efc083;font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">${eyebrow}</span>
                    </div>

                    <!-- Platform name -->
                    <div style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;opacity:0.5;margin-bottom:8px;">${platformName}</div>

                    <!-- Title -->
                    <h1 class="title-text" style="margin:0 0 12px;color:#ffffff;font-size:28px;font-weight:900;line-height:1.12;letter-spacing:-0.04em;">${title}</h1>

                    <!-- Lead -->
                    <p style="margin:0;color:#c9bfb6;font-size:14px;line-height:1.7;">${lead}</p>

                    ${heroPanelHtml}
                    ${imageHtml}
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="height:1px;background:linear-gradient(90deg,rgba(239,192,131,0.0) 0%,rgba(239,192,131,0.15) 50%,rgba(239,192,131,0.0) 100%);"></td>
                </tr>

                <!-- Content -->
                <tr>
                  <td class="content-section" style="padding:28px 32px 32px;">
                    ${options.bodyHtml}
                  </td>
                </tr>

                <!-- Footer divider -->
                <tr>
                  <td style="height:1px;background:linear-gradient(90deg,rgba(239,192,131,0.0) 0%,rgba(239,192,131,0.1) 50%,rgba(239,192,131,0.0) 100%);"></td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td class="footer-section" style="padding:24px 32px 28px;background:linear-gradient(180deg,rgba(26,23,30,1) 0%,rgba(20,17,24,1) 100%);">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <div style="margin:0 0 10px;color:#ffffff;font-size:15px;font-weight:800;letter-spacing:-0.01em;">${platformName}</div>
                          <div style="margin:0 0 6px;color:#6b6870;font-size:12px;line-height:1.6;">${footerNote}</div>
                          <div style="color:#4a474e;font-size:11px;line-height:1.5;">&copy; ${year} ${platformName}. All rights reserved.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
