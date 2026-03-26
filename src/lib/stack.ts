import { StackServerApp } from "@stackframe/stack";

/**
 * Server-side Stack Auth app instance.
 *
 * Used in:
 *  - middleware.ts  → stackServerApp.getMiddlewareResponse(request)
 *  - get-current-user.ts → stackServerApp.getUser(...)
 *
 * Environment variables required (set in .env.local):
 *   NEXT_PUBLIC_STACK_PROJECT_ID
 *   NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
 *   STACK_SECRET_SERVER_KEY
 */
export const stackServerApp = new StackServerApp({
  tokenStore: "nextjs-cookie",
});
