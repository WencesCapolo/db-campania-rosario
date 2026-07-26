import { auth } from "@/lib/auth/server";

/**
 * Next 16 renamed the `middleware` convention to `proxy` — same hook, a name
 * that says it is about the network boundary. The runtime is Node, and is not
 * configurable; nothing here needs the edge.
 */
export const proxy = auth.middleware({ loginUrl: "/handler/sign-in" });

export const config = {
    matcher: [
        /*
         * Match all protected routes. Next.js will call this proxy for these
         * paths, but the actual auth redirect is handled server-side by
         * getCurrentUser().
         *
         * Excludes: /, /handler/**, /api/auth/**, /_next/**, and static files.
         */
        "/dashboard/:path*",
        "/peregrina/:path*",
        "/misionero/:path*",
        "/admin/:path*",
    ],
};
