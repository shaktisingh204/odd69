import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Injects the admin API token for /api/* requests server-side so the token
 * never ships to the browser bundle. Configure via a server-only
 * `ADMIN_API_TOKEN` env var (NOT NEXT_PUBLIC_).
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
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
    matcher: ['/api/:path*'],
}
