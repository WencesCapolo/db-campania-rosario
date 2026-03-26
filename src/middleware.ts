import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware — route guard
 *
 * Session validation now happens lazily inside `stackServerApp.getUser()` on first access.
 *
 * This middleware guards protected routes by checking the Stack Auth session
 * token cookie and redirecting to the sign-in page if it is absent.
 *
 * Stack Auth stores a session token in a cookie named `__client-token` (or
 * similar). Rather than reimplementing that logic here, we delegate the check
 * to the server component tree: every protected layout calls `getCurrentUser()`
 * which performs the redirect via `next/navigation` when needed.
 *
 * The middleware here only:
 *  1. Lets all requests through (no blocking at the edge).
 *  2. Keeps the matcher tight so Next.js doesn't run this for static assets.
 *
 * If you want edge-level blocking (before even hitting the server component),
 * you can read the raw cookie here and redirect early.
 */
export function middleware(_request: NextRequest) {
    // Pass through — auth checks happen in getCurrentUser() inside server components.
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all protected routes. Next.js will call this middleware for these
         * paths, but the actual auth redirect is handled server-side by getCurrentUser().
         *
         * Excludes: /, /handler/**, /api/auth/**, /_next/**, and static files.
         */
        "/dashboard/:path*",
        "/peregrina/:path*",
        "/misionero/:path*",
        "/admin/:path*",
    ],
};