import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    // Server-side proxy for client /api/* requests. Prefer the server-only
    // BACKEND_URL / NEXT_PUBLIC_API_PROXY_URL; default to prod as a last resort.
    const backend =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_PROXY_URL ||
      'https://odd69.com/api';
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
