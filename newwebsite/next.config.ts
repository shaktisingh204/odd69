import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'spribe.co',
      },
      {
        protocol: 'https',
        hostname: 'ezugi.com',
      },
      {
        protocol: 'https',
        hostname: 'files.worldcasinoonline.com', // Added based on user SQL dump request
      },
      {
        protocol: 'https',
        hostname: 'kuberexchange.com',
      },
      {
        protocol: 'https',
        hostname: 'imagedelivery.net', // Cloudflare Images CDN
      },
    ],
  },
  async redirects() {
    return [
      // /sportsbook is now merged into /sports
      { source: '/sportsbook', destination: '/sports', permanent: true },
      { source: '/sportsbook/:path*', destination: '/sports', permanent: true },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];
    return [
      {
        source: '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
        headers: [
          {
            // Cache HTML shells publicly at the Cloudflare edge.
            //   max-age=0            → browsers always revalidate (they hit CF,
            //                          not origin)
            //   s-maxage=60          → CF caches the rendered HTML for 60 s
            //   stale-while-revalidate=300
            //                        → CF serves stale up to 5 min while
            //                          refreshing in background, so origin is
            //                          only touched once per 60 s per edge
            //
            // SAFETY: every app route is a client component — the server-
            // rendered HTML shell contains no user-specific data. User state
            // (auth, wallet, bets) is fetched client-side via /api/* calls
            // after hydration, and those API routes are excluded from this
            // rule by the negated source match above.
            key: 'Cache-Control',
            value:
              'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
          },
          ...securityHeaders,
        ],
      },
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      // Internal Next.js API routes — must NOT be proxied to backend
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_PROXY_URL || 'https://odd69.com/api'}/:path*`, // Proxy to Backend
      },
      {
        source: '/api/auth/:path*',
        destination: 'https://odd69.com/api/auth/:path*',
      },
      {
        source: '/api/seamless-casino/:path*',
        destination: 'https://odd69.com/api/seamless-casino/:path*',
      },
      {
        source: '/api/bets/:path*',
        destination: 'https://odd69.com/api/bets/:path*',
      },
    ];
  },
};

export default nextConfig;
