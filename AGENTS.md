<!-- BEGIN:nextjs-agent-rules -->
Goal: a digital system (db) to organize the Peregrinas inventary and to know who has them, replacing multiple excel files unorganized and asyncronous. I am creating a simple webapp "Base de datos Campaña del Rosario" to manage the Campaña del Rosario structure on Argentina. It has role based access with 3 roles: Asesores Nacionales (Full vision, can create any user with any rol and add Peregrinas), Responsables Diocesanos (Manage their zone: they create the "referentes locales" and add / reasign Peregrinas), Referentes locales (register Misionero and Peregrinas, and can reasign them). Each one can add users to the roles below, all of them can add misioneros. All roles can view everything; the roles are just for writing. Every rol can add 2 entities: Peregrina and Misionero. Peregrina has: Codigo: composed of [CBA JOV 1234](Provincia, Modalidad Num autoincrement) Tipo: Peregrina / Auxiliar Estado: Activa / Inactiva Region: (NOA / CENTRO / CUYO / NEA / CENTRO / BS. AS / R. PAM / R. PAT) Provincia: (JUJUY...) Diósesis/Localidad: Misionero: Foreign Key (it can be assigned to another Misionero later) A Misionero has: Nombre Apellido Tel Estado Region Provincia Diocesis/Localidad Peregrina: FK Año de consagración Centro: Santuario / Ermita / Parroquia A free field for each year, so its responsabe can write a summary of its year there Design: Much users are old people. The system will be visually clean, big words, clear buttons. Simple, step to step. Responsive. The system will have a dashboard to visualize, and to filter by region, modalidad, estado, etc.
We use Neon db (Postgres) and Neon Auth. Drizzle ORM

About roles:
Q: What do you need for roles/permissions (RBAC)?
A: Basic admin/user but there are 4 levels: Admin, Asesor Nacional, Responsable Diocesano, Referente Local. That order. The only permission added is to create users with the below roles. The entities are created only by the admin, Everything else (read) does not require a role

Use the router/service/repository architecture to have clean code. We will have a folder by entity (Peregrina, Misionero, etc.) with its roter, service, repository ts files.

UI (page / form)
  → module.router.ts    "use server" — auth check, delegates, revalidates cache
    → module.service.ts  pure TS — validation, business rules, orchestration
      → module.repository.ts  Drizzle queries only, no logic
<!-- END:nextjs-agent-rules -->
