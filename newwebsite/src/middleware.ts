import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js middleware.
 *
 * Responsibilities:
 *   1. Redirect the legacy /login path to /.
 *   2. Inject the admin API token for /api/* requests server-side so the
 *      token never ships to the browser. This replaces the previous pattern
 *      of reading NEXT_PUBLIC_ADMIN_API_TOKEN from the client bundle.
 *
 *      Configure the token via a server-only env var `ADMIN_API_TOKEN`
 *      (NOT prefixed with NEXT_PUBLIC_).
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // 1) Legacy /login redirect
    if (pathname === '/login' || pathname.startsWith('/login/')) {
        return NextResponse.redirect(new URL('/', request.url), 308)
    }

    // 2) Inject admin token for proxied API requests
    if (pathname.startsWith('/api/')) {
        const adminToken = process.env.ADMIN_API_TOKEN
        if (adminToken) {
            const headers = new Headers(request.headers)
            headers.set('x-admin-token', adminToken)
            return NextResponse.next({ request: { headers } })
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/login/:path*', '/api/:path*'],
}
