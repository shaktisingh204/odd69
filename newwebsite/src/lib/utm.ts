/**
 * utm.ts — Client-side UTM parameter capture utility
 *
 * Call captureUtm() on every page load (in ClientLayout) so that when a user
 * lands on the site from an ad link like:
 *   https://yourdomain.com/?utm_source=instagram&utm_medium=paid&utm_campaign=ipl2026
 * the params are saved to localStorage and later attached to the signup API call.
 */

const UTM_STORAGE_KEY = 'utm_data';
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export interface UtmData {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    referrerUrl?: string;
    landingPage?: string;
    capturedAt?: string;
}

/**
 * Read UTM params from the current URL and referrer, and persist them to
 * localStorage. Only overwrites if new UTM params are present — so the first
 * attributed landing always wins.
 */
export function captureUtm(): void {
    if (typeof window === 'undefined') return;

    try {
        const params = new URLSearchParams(window.location.search);
        const hasUtm = UTM_PARAMS.some(k => params.has(k));

        // Only capture (and overwrite) if there are UTM params in the URL
        if (!hasUtm) return;

        const data: UtmData = {};
        for (const key of UTM_PARAMS) {
            const val = params.get(key);
            if (val) (data as any)[key] = val;
        }

        // Capture referrer and landing page
        if (document.referrer) data.referrerUrl = document.referrer;
        data.landingPage = window.location.pathname + window.location.search;
        data.capturedAt = new Date().toISOString();

        localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
    } catch {
        // Silently ignore — never crash the page
    }
}

/**
 * Read the captured UTM data from localStorage.
 * Returns null if nothing was captured.
 */
export function getStoredUtm(): UtmData | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(UTM_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Clear the stored UTM data (called after a successful signup).
 */
export function clearStoredUtm(): void {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(UTM_STORAGE_KEY); } catch { }
}
