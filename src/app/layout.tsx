import { getCurrentUser } from "@/lib/get-current-user";
import { ROLE_LABELS } from "@/lib/permissions";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./dashboard.module.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className={styles.shell}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>◆</span>
            <span className={styles.logoText}>Panel</span>
          </div>

          <nav className={styles.nav}>
            <span className={styles.navSection}>General</span>
            <Link href="/dashboard" className={styles.navLink}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
              Inicio
            </Link>

            {(user.role === "admin" || user.role === "asesor_nacional" || user.role === "responsable_diocesano") && (
              <>
                <span className={styles.navSection}>Administración</span>
                <Link href="/admin/users" className={styles.navLink}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  Usuarios
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* ── User badge ── */}
        <div className={styles.userBadge}>
          <div className={styles.userAvatar}>
            {(user.displayName ?? user.email)[0].toUpperCase()}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {user.displayName ?? user.email.split("@")[0]}
            </span>
            <span className={styles.userRole}>{ROLE_LABELS[user.role]}</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className={styles.main}>{children}</main>
    </div>
  );
}