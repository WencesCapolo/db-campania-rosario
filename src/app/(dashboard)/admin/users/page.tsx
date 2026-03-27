import { getCurrentUser } from "@/lib/get-current-user";
import { getUsersAction } from "@/modules/user/user.router";
import { ROLE_LABELS, creatableRoles } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import styles from "../../dashboard.module.css";
import type { Role } from "@/modules/user/user.schema";

const BADGE_CLASS: Record<Role, string> = {
  admin: styles["badge-admin"],
  asesor_nacional: styles["badge-asesor"],
  responsable_diocesano: styles["badge-diocesano"],
  referente_local: styles["badge-local"],
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`${styles.badge} ${BADGE_CLASS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

export default async function UsersPage() {
  const currentUser = await getCurrentUser();

  // Only users who can create at least one role can access this page
  const canCreate = creatableRoles(currentUser.role).length > 0;
  if (!canCreate && currentUser.role !== "admin") notFound();

  const users = await getUsersAction();

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Usuarios</h1>
          <p className={styles.pageSubtitle}>
            {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>

        {canCreate && (
          <Link href="/admin/users/new" className={`${styles.btn} ${styles.btnPrimary}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Nuevo usuario
          </Link>
        )}
      </div>

      <div className={styles.card}>
        {users.length === 0 ? (
          <div className={styles.empty}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
            <p>Todavía no hay usuarios.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Creado por</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const creator = users.find((x) => x.id === u.createdById);
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>
                      {u.displayName ?? "—"}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{u.email}</td>
                    <td>
                      <RoleBadge role={u.role} />
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {creator ? (creator.displayName ?? creator.email) : "—"}
                    </td>
                    <td style={{ color: "var(--text-faint)", fontSize: 12.5, fontFamily: "var(--font-mono)" }}>
                      {new Date(u.createdAt).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
