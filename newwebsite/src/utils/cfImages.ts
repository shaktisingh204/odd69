/**
 * Cloudflare Images URL helpers.
 *
 * Every image on the site that's hosted on `imagedelivery.net` can be
 * served at an appropriate size by rewriting the variant segment of the
 * URL. This saves ~1.6 MB of image bandwidth per mobile pageload per
 * Lighthouse — the single biggest remaining performance win after TTFB.
 *
 * Two variant modes are supported:
 *
 * 1. **Flexible Variants** (preferred). Cloudflare Images lets you encode
 *    a variant inline via URL parameters:
 *
 *        https://imagedelivery.net/<account>/<image_id>/w=800,fit=cover,format=auto
 *
 *    Requires "Flexible Variants" to be enabled in the CF Images dashboard.
 *    Set `NEXT_PUBLIC_CF_IMAGES_FLEX_VARIANTS=1` to opt in.
 *
 * 2. **Named Variants** (fallback). The URL keeps whatever variant was
 *    originally stored (usually `public`) — no transform is applied.
 *    Use this if the account doesn't have Flexible Variants enabled yet.
 *
 * The helper returns the source URL unchanged for non-imagedelivery hosts
 * (flagcdn.com, kuberexchange.com, local /public assets, etc.) so it's
 * safe to wrap every image src with it.
 */

const IMAGEDELIVERY_HOST = 'imagedelivery.net';

const FLEX_VARIANTS_ENABLED =
  process.env.NEXT_PUBLIC_CF_IMAGES_FLEX_VARIANTS === '1' ||
  process.env.NEXT_PUBLIC_CF_IMAGES_FLEX_VARIANTS === 'true';

export interface CfImageOptions {
  /** Target render width in CSS pixels. Use 2x for retina srcset entries. */
  width?: number;
  /** Target render height in CSS pixels. Omit for width-only resizing. */
  height?: number;
  /** How to fit the image into the box. Defaults to "cover". */
  fit?: 'cover' | 'contain' | 'scale-down' | 'crop' | 'pad';
  /** Quality 1–100. Defaults to CF's auto (~85). */
  quality?: number;
}

/**
 * Rewrite a Cloudflare Images URL to a sized variant.
 *
 * - Non-imagedelivery URLs are returned unchanged.
 * - If FLEX_VARIANTS_ENABLED is false, the input URL is returned unchanged.
 * - `format=auto` is always appended so CF negotiates WebP/AVIF via the
 *   browser's Accept header.
 *
 * @example
 *   cfImage('https://imagedelivery.net/abc/xyz/public', { width: 400 })
 *   // → 'https://imagedelivery.net/abc/xyz/w=400,fit=cover,format=auto'
 */
export function cfImage(
  src: string | null | undefined,
  opts: CfImageOptions = {},
): string {
  if (!src) return '';
  if (!FLEX_VARIANTS_ENABLED) return src;

  try {
    const url = new URL(src);
    if (url.hostname !== IMAGEDELIVERY_HOST) return src;

    const parts = url.pathname.split('/').filter(Boolean);
    // Need at least: /<account>/<image_id>/<variant>
    if (parts.length < 3) return src;

    const transformTokens: string[] = [];
    if (opts.width) transformTokens.push(`w=${opts.width}`);
    if (opts.height) transformTokens.push(`h=${opts.height}`);
    transformTokens.push(`fit=${opts.fit || 'cover'}`);
    transformTokens.push('format=auto');
    if (opts.quality) transformTokens.push(`q=${opts.quality}`);

    // Replace the last path segment (the variant name, usually `public`)
    // with our transform string. Everything else in the image id path
    // stays intact — CF Images supports multi-segment custom IDs.
    const nextParts = [...parts.slice(0, -1), transformTokens.join(',')];
    return `https://${IMAGEDELIVERY_HOST}/${nextParts.join('/')}`;
  } catch {
    return src;
  }
}

/**
 * Build a srcset attribute for responsive image delivery.
 *
 * Returns an empty string if the source isn't on CF Images or if Flexible
 * Variants is disabled — in that case the caller's plain `src` alone is
 * the only usable form, and the browser will pick it.
 *
 * @example
 *   <img
 *     src={cfImage(url, { width: 800 })}
 *     srcSet={cfImageSrcSet(url, [400, 800, 1200])}
 *     sizes="(max-width: 640px) 100vw, 800px"
 *   />
 */
export function cfImageSrcSet(
  src: string | null | undefined,
  widths: number[],
  opts: Omit<CfImageOptions, 'width'> = {},
): string {
  if (!src || !FLEX_VARIANTS_ENABLED) return '';
  try {
    const url = new URL(src);
    if (url.hostname !== IMAGEDELIVERY_HOST) return '';
  } catch {
    return '';
  }
  return widths
    .map((w) => `${cfImage(src, { ...opts, width: w })} ${w}w`)
    .join(', ');
}
