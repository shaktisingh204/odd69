import { cache } from 'react';

/**
 * Server-side helpers for fetching public site configuration during SSR.
 *
 * Wrapped in React.cache so multiple places in a single request render
 * tree (e.g. generateMetadata, RootLayout, page.tsx) can call the same
 * helper and share a single fetch. The fetches also use Next.js's Data
 * Cache with a short revalidate window + tag so subsequent requests
 * within the window hit memory instead of the origin.
 *
 * Use `INTERNAL_API_URL` server-side (e.g. http://127.0.0.1:9828/api) to
 * avoid looping through Cloudflare back to origin — saves ~100–200ms of
 * TLS handshake per SSR miss.
 */

export type PublicSettings = Record<string, unknown>;

function resolveApiUrl(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.API_URL ||
    'https://zeero.bet/api'
  );
}

export const getTrackerConfig = cache(async (): Promise<PublicSettings> => {
  try {
    const res = await fetch(`${resolveApiUrl()}/settings/public`, {
      next: { revalidate: 60, tags: ['public-settings'] },
    });
    if (!res.ok) return {};
    return (await res.json()) as PublicSettings;
  } catch {
    return {};
  }
});

// ─── Hero slider ──────────────────────────────────────────────────────────────
//
// The `/api/page-sliders` endpoint returns the admin-configured CMS hero
// slides for a given page. Fetching this during SSR lets us ship the
// first slide's HTML directly in the initial payload — no client-side
// fetch, no Suspense fallback spinner, no "hydrate before paint" gap.
// This closes most of the desktop FCP→LCP delta (2.9 s in RUM data).

export interface SliderSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  tag: string;
  imageUrl: string;
  mobileImageUrl: string;
  charImage: string;
  gradient: string;
  overlayOpacity: number;
  overlayGradient: string;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  ctaText: string;
  ctaLink: string;
  ctaStyle: string;
  gameCode: string;
  gameProvider: string;
  ctaSecondaryText: string;
  ctaSecondaryLink: string;
  isActive: boolean;
  order: number;
}

export interface SliderConfig {
  heightDesktop: number;
  heightMobile: number;
  autoplay: boolean;
  autoplayInterval: number;
  transitionEffect: 'fade' | 'slide';
  borderRadius: number;
  slides: SliderSlide[];
}

export type SliderPage = 'HOME' | 'CASINO' | 'SPORTS';

export const getSliderConfig = cache(
  async (page: SliderPage): Promise<SliderConfig | null> => {
    try {
      const res = await fetch(
        `${resolveApiUrl()}/page-sliders?page=${page}`,
        {
          next: {
            revalidate: 60,
            tags: ['page-sliders', `page-sliders:${page}`],
          },
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as SliderConfig | null;
      if (!data || !Array.isArray(data.slides)) return null;
      // Only return active slides, ordered — matches client component
      // behavior so hydration doesn't mismatch.
      const slides = data.slides
        .filter((s) => s && s.isActive !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return { ...data, slides };
    } catch {
      return null;
    }
  },
);
