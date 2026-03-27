import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/handler/sign-in" });

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