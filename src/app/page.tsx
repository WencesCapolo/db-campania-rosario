import { redirect } from "next/navigation";

/**
 * Root page — redirects authenticated users to the dashboard.
 * Unauthenticated users are redirected by getCurrentUser() inside the
 * dashboard layout before they ever reach any content.
 */
export default function RootPage() {
  redirect("/dashboard");
}