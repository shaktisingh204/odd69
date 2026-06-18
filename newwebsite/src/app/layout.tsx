import type { Metadata, Viewport } from 'next';
import { Sora, DM_Sans, Mulish } from 'next/font/google';
import './globals.css';
import ClientLayout from '@/components/layout/ClientLayout';
import Script from 'next/script';
import MaintenanceState from '@/components/maintenance/MaintenanceState';
import { extractMaintenanceConfig, getMaintenanceMessage, isScopeBlocked } from '@/lib/maintenance';
import { getTrackerConfig, type PublicSettings } from '@/lib/siteConfig';
import { cfImage } from '@/utils/cfImages';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const mulish = Mulish({
  subsets: ['latin'],
  variable: '--font-mulish',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const revalidate = 60;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

const getStringSetting = (settings: PublicSettings, key: string) =>
  typeof settings[key] === 'string' ? (settings[key] as string) : '';

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getTrackerConfig();
  const faviconUrl = getStringSetting(cfg, 'FAVICON_URL').trim();

  // Parse SEO meta data from admin-configured SITE_META
  let siteMeta: Record<string, string> = {};
  try {
    const raw = getStringSetting(cfg, 'SITE_META');
    if (raw) siteMeta = JSON.parse(raw);
  } catch {}

  const siteTitle = siteMeta.siteTitle || 'Zeero - Premium Sports Betting & Casino';
  const siteDescription = siteMeta.siteDescription || 'Experience the thrill of victory with Zeero.';
  const ogTitle = siteMeta.ogTitle || siteTitle;
  const ogDescription = siteMeta.ogDescription || siteDescription;
  const ogImage = siteMeta.ogImage || '';
  const canonicalUrl = siteMeta.canonicalUrl || '';
  const robots = siteMeta.robots || 'index, follow';
  const metaKeywords = siteMeta.metaKeywords || '';
  const twitterCard = (siteMeta.twitterCard as 'summary' | 'summary_large_image') || 'summary_large_image';

  return {
    title: siteTitle,
    description: siteDescription,
    ...(metaKeywords && { keywords: metaKeywords }),
    ...(robots && { robots }),
    ...(canonicalUrl && { alternates: { canonical: canonicalUrl } }),
    icons: faviconUrl ? {
      icon: [{ url: faviconUrl, type: "image/png", sizes: "any" }],
      apple: [{ url: faviconUrl }],
      shortcut: [{ url: faviconUrl }]
    } : undefined,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'website',
      ...(ogImage && { images: [{ url: ogImage, width: 1200, height: 630 }] }),
      ...(canonicalUrl && { url: canonicalUrl }),
    },
    twitter: {
      card: twitterCard,
      title: ogTitle,
      description: ogDescription,
      ...(ogImage && { images: [ogImage] }),
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cfg = await getTrackerConfig();
  const maintenanceConfig = extractMaintenanceConfig(cfg);

  const ga4Id = getStringSetting(cfg, 'GA4_MEASUREMENT_ID').trim();
  const metaPixelId = getStringSetting(cfg, 'META_PIXEL_ID').trim();
  const tiktokPixelId = getStringSetting(cfg, 'TIKTOK_PIXEL_ID').trim();
  const headScripts = getStringSetting(cfg, 'CUSTOM_HEAD_SCRIPTS').trim();
  const bodyScripts = getStringSetting(cfg, 'CUSTOM_BODY_SCRIPTS').trim();
  const platformBlocked = isScopeBlocked(maintenanceConfig, 'platform');
  const platformMessage = getMaintenanceMessage(
    maintenanceConfig,
    'platform',
    'The platform is currently under maintenance. Please check back shortly.',
  );
  const maintenanceAllowedUsersStr = getStringSetting(cfg, 'MAINTENANCE_ALLOWED_USERS') || '';
  const maintenanceAllowedUsers = maintenanceAllowedUsersStr.split(',').filter(Boolean);

  // Pull the header logo URL from the same SSR-cached config so we can emit
  // a <link rel="preload"> hint. This lets the browser start downloading the
  // logo image at TTFB+5ms in parallel with the JS bundle, so by the time
  // <Header> hydrates and renders its <img>, the bytes are already cached.
  //
  // Field RUM data had this logo as a top-5 LCP element (~3.5s) because
  // Header fetches /settings/public client-side and then renders the logo —
  // the image download didn't start until ~3s into the page load.
  let headerLogoUrl = '';
  try {
    const rawHeaderLogo = getStringSetting(cfg, 'HEADER_LOGO');
    if (rawHeaderLogo) {
      const parsed = JSON.parse(rawHeaderLogo);
      if (typeof parsed?.imageUrl === 'string' && parsed.imageUrl.trim()) {
        headerLogoUrl = parsed.imageUrl.trim();
      }
    }
  } catch {
    /* ignore parse errors — falls back to no preload */
  }

  return (
    <html lang="en">
      <head>
        {/* Preload the admin-configured header logo so it hits the network
            immediately, in parallel with the JS bundle download. We preload
            the exact sized variant the Header renders (320w via CF Images
            flex variants) so the preload and actual request reference the
            same URL and the browser reuses the bytes without a second
            fetch. Dropping this hint saves ~300–500ms of LCP when the logo
            is the largest above-the-fold element.
            imageSrcSet + imageSizes let the browser pick the right size
            variant from the preload hint itself. */}
        {headerLogoUrl && (
          // biome-ignore lint/a11y/useButtonType: <link> has no type prop
          <link
            rel="preload"
            as="image"
            href={cfImage(headerLogoUrl, { width: 320, fit: 'contain' })}
            imageSrcSet={`${cfImage(headerLogoUrl, { width: 160, fit: 'contain' })} 160w, ${cfImage(headerLogoUrl, { width: 320, fit: 'contain' })} 320w, ${cfImage(headerLogoUrl, { width: 480, fit: 'contain' })} 480w`}
            imageSizes="(max-width: 768px) 110px, 160px"
            fetchPriority="high"
          />
        )}
      </head>
      <body className={`${sora.variable} ${dmSans.variable} ${mulish.variable}`}>
        {/* ── Google Analytics 4 ───────────────────────────────── */}
        {ga4Id && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                                window.dataLayer = window.dataLayer || [];
                                function gtag(){dataLayer.push(arguments);}
                                gtag('js', new Date());
                                gtag('config', '${ga4Id}');
                            `}
            </Script>
          </>
        )}

        {/* ── Meta (Facebook) Pixel ────────────────────────────── */}
        {metaPixelId && (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
                            !function(f,b,e,v,n,t,s)
                            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                            n.queue=[];t=b.createElement(e);t.async=!0;
                            t.src=v;s=b.getElementsByTagName(e)[0];
                            s.parentNode.insertBefore(t,s)}(window, document,'script',
                            'https://connect.facebook.net/en_US/fbevents.js');
                            fbq('init', '${metaPixelId}');
                            fbq('track', 'PageView');
                        `}
          </Script>
        )}

        {/* ── TikTok Pixel ─────────────────────────────────────── */}
        {tiktokPixelId && (
          <Script id="tiktok-pixel" strategy="afterInteractive">
            {`
                            !function (w, d, t) {
                            w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
                            ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
                            ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
                            for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
                            ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
                            ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
                            ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
                            ttq._o=ttq._o||{};ttq._o[e]=n||{};
                            var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
                            var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                            ttq.load('${tiktokPixelId}');ttq.page();}(window, document, 'ttq');
                        `}
          </Script>
        )}

        {/* ── Custom head/body scripts (verbatim) ─────────────────── */}
        {headScripts && (
          <div
            // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-controlled only
            dangerouslySetInnerHTML={{ __html: headScripts }}
            suppressHydrationWarning
          />
        )}
        
        {/* ── OneSignal Web SDK ─────────────────────────────────── */}
        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          defer
          strategy="afterInteractive"
        />
        <Script id="onesignal-init" strategy="afterInteractive">
          {`
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            OneSignalDeferred.push(async function(OneSignal) {
              await OneSignal.init({
                appId: "e15ae046-8207-4d8b-9588-5a37c6128dc3",
                safari_web_id: "web.onesignal.auto.44daf2d6-544c-403f-a3b6-3ab51abe3e37",
                notifyButton: { enable: false },
                welcomeNotification: { disable: true },
              });
            });
          `}
        </Script>

        {bodyScripts && (
          <div
            // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-controlled only
            dangerouslySetInnerHTML={{ __html: bodyScripts }}
            suppressHydrationWarning
          />
        )}
        
        <ClientLayout maintenanceConfig={{ platformBlocked, platformMessage, allowedUsers: maintenanceAllowedUsers }}>
            {children}
        </ClientLayout>
      </body>
    </html>
  );
}
