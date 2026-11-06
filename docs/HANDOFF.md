# Handoff — ADR 0017: planillas (Excel export and import)

Written 2026-11-06 for the next agent. Read `CLAUDE.md`, `CONTEXT.md` (the new **Planilla** entry) and `docs/adr/0017-planillas.md` first; this file only says where things stand and what is waiting on the user.

## Where it stands

**Everything is implemented and committed** on `trabajo` (the ADR 0017 commit, on top of `ea4a303`), and pushed to `origin/trabajo`. Not deployed. No migration is involved, so deploy order does not matter.

| Check | Result |
|---|---|
| `pnpm test` (both projects), after the dialog change | 433/433 |
| typecheck, `pnpm lint` | clean |
| `pnpm build`, after the dialog change | passed |
| By hand in Chrome against a local DB | the import end to end (in the prototype) and the final dialog on both screens; see below |

The two late fixes: `planilla.libro.ts` now writes each dropdown as one explicit range (exceljs squeezes per-cell validations by sorting addresses as text, `E10` before `E2`, and wrote overlapping ranges that Excel offers to «repair»); `Campo.tsx` adds `py-3` when `type="file"` so the file picker's text is vertically centred.

## What the user asked for, and decided

A WhatsApp voice note (2026-11-01, transcribed with Whisper): the shared Buzones of ADR 0016 are fine for now. Two requests:

1. **Later, maybe:** one Responsable per Provincia, writing only that Provincia. **Not started.** It would bring back a territorial *write* bound beside `exigirModalidad`, a territory on Usuario/Invitación, and the Provincia taken from the image's Diócesis — never parsed from a Código.
2. **Now:** Excel. Decisions the user made in this session:
   - A row = one **new** Misionero, optionally with an image: the Código of one already loaded and free (it is handed to them), or the data of a new one (registered in the Misionero's Diócesis/Localidad and handed to them), or nothing. Matrimonios are formed later by hand.
   - **All or nothing.** Revisar first; one row with an error and nothing loads. Importar re-revisa against the current state and writes everything in one transaction.
   - **Only creates.** No round trip export → edit → import.
   - **Export** Peregrinas and Misioneros, with the filters on screen (not the historial of Asignaciones).

## Waiting on the user — ask before doing

**Should «same name in the same Diócesis/Localidad» be an error instead of a warning?** Found during the manual test. Today it is an *aviso* that does not block (my own choice, not the user's). Re-uploading the same planilla was blocked only because one row typed a número that now exists; a planilla with no typed números would load everybody **twice**, with only warnings on screen. My recommendation to the user was to make it an error (a genuine namesake can be loaded by hand). If they say yes: change `avisarHomonimos` in `planilla.service.ts` to push to `errores` for the «ya hay» case (keep «misma persona en más de una fila» as you see fit), update the two tests that assert `lista: true` with that aviso, the ADR's «Un aviso no frena» bullet, and the page copy that promises re-uploading «nunca duplica nada».

Also pending the user: deploy (`vercel --prod --yes`, which they run themselves — see memory), and whether to drop the local `campania_manual` database.

## Where it lives

- `src/modules/planilla/` — downstream of everything, nothing imports it.
  - `planilla.service.ts` — `peregrinas`, `misioneros` (downloads), `plantilla`, `revisar`, `importar`. `planificar` is the one function behind both revisar and importar, so what is shown and what is written cannot differ. Each row goes through `createMisioneroSchema` / `createPeregrinaSchema` — the same rules as the forms.
  - `planilla.libro.ts` — the only file that knows exceljs. Reads cell values (hyperlinks, rich text, formulas, date cells) into plain values.
  - `planilla.repository.ts` — no table; the one transaction. Calls `MisioneroRepository.insertarVariosEn`, `PeregrinaRepository.insertarVariasEn`, `AsignacionRepository.abrirEn` (the pointer is still only written by `AsignacionRepository`; `abrir` now delegates to `abrirEn`).
  - `planilla.router.ts` (two server actions), `planilla.descarga.ts` (the HTTP response), `planilla.types.ts` (column titles, limits, DTOs).
- **The UI is one dialog, not a page** (changed 2026-11-06 at the user's request): `PlanillaDeExcel.tsx` in the module, a «Planilla de Excel» button in the header of both `/peregrina` and `/misionero`. First step: «Importar Planilla» or «Exportar Planilla»; then one step at a time. Exportar offers both lists from either screen; only the current screen's list carries its filters. `RevisionDePlanilla.tsx` renders the revisión. `Dialogo` gained `amplio` and `conCerrar`. `/misionero/importar` is gone; the prototype of five variants was deleted once E won.
- Routes (file responses only): `/peregrina/planilla`, `/misionero/planilla`, `/misionero/plantilla`.
- Small changes elsewhere: `componerCodigo` moved to `peregrina.types.ts`; `PeregrinaRepository.findByCodigos`; `Transaccion` type in `src/db/index.ts`; `BotonDescarga` in `Boton.tsx`; download/import buttons on both listados; `next.config.ts` (`serverExternalPackages: ["exceljs"]`, server-action body limit 3 MB).
- Tests: `planilla.service.test.ts` (19), a block in `capacidades.test.ts` (Dirigente Joven cannot register or receive a non-`JOV` image by planilla, and nothing is written — negatives were proven failing with the guard disabled), `PlanillaDeExcel.test.tsx` in `navegador` (4 — trimmed on purpose: the user asked for no unnecessary tests).
- Docs updated: ADR 0017 (new), `CLAUDE.md`, `CONTEXT.md`, `docs/PRODUCTION-PLAN.md`.

## Manual test — what was done and how to repeat it

Never against production: `.env`'s `DATABASE_URL` **is production**. The setup used:

1. `podman exec campania-test-db psql -U postgres -c "create database campania_manual"` (the test container from `pnpm test:db:up`; the suite truncates `campania_test`, so use a separate database).
2. With `DATABASE_URL` **and** `DATABASE_URL_UNPOOLED` exported to `postgresql://postgres:postgres@localhost:55432/campania_manual` (exported variables win over `.env`): `pnpm exec drizzle-kit migrate`, `pnpm db:seed`, then `pnpm dev`.
3. The user signs in themselves in Chrome (never do it for them). They land on `/sin-autorizacion`; the dev log line `[autorizacion-denegada]` carries their `identidadId`. Insert it locally: `insert into users (id, role) values ('<identidadId>', 'admin')`. Their id is `c9d59f98-c2d7-4b8a-8ab8-d03f5c568860` and the row already exists in `campania_manual`. To test another rol, `update users set role=…` **in the local DB only**, and put it back.
4. Build planillas with a small Node script requiring the project's `exceljs` by absolute path, write them to the scratchpad, and attach them with the Chrome extension's `file_upload` (it accepted scratchpad paths).

Verified that way: plantilla downloads (200, xlsx); a planilla with errors marks each row with its reason and offers no Cargar; a good planilla loads exactly the announced totals with correct Códigos (auto `SFE JOV 0001`, typed `CBA FAM 0012`, «Peregrina 7» with none); downloads honour the filters (checked by unzipping the response in the page with `DecompressionStream`); as Dirigente Joven the page says «sólo imágenes de Jóvenes», the plantilla offers only JOV, and a planilla with one FAM row loads nothing. Not checked: opening the files in real Microsoft Excel (only LibreOffice).

## Still open from ADR 0016 (unchanged)

1. Manual check of the two shared Buzones against production auth: a non-`JOV` image shows no write controls to the dirigentes Buzón, Usuarios/Territorio absent from its header, Tablero and Peregrinas open on `?modalidad=JOV`.
2. «Registrada por» on an Asignación used to name the Usuario's territory; check the historial wording now that no Usuario has one.
3. Accepted performance: `findDisponibles` Seq Scan, and `/misionero` with the tenencia filter intersecting in memory (the planilla export of Misioneros does the same intersection). Revisit only with a measured plan (ADR 0007).

## Gotchas

- **Production reads are blocked by the auto-mode classifier** (a read-only `select` on `users` was denied this session), as are production writes unless the user explicitly says so. Ask; do not route around it.
- **The Chrome extension redacts query strings** in tool output (`[BLOCKED: Cookie/query string data]`); assert on them inside the page (`href.includes(...)`) instead of returning them.
- **Two untracked files are the user's own; leave them:** `public/Captura de pantalla_2026-07-28_17-06-06.png` and `public/inmaculata.png`.
- **7 GB RAM.** Parallel subagents must not run pnpm. `pnpm test` takes ~5 minutes: run it in the background. Do not run the build and the suite at the same time.
- **exceljs types lag its runtime:** `worksheet.dataValidations` exists but is untyped (cast, as `planilla.libro.ts` does), and `xlsx.load` is typed for its own `Buffer` = `ArrayBuffer` (pass the sliced `ArrayBuffer`).
