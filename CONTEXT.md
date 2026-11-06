# Campaña del Rosario

Digital inventory for the Campaña del Rosario: tracks where every pilgrim image is, who holds it, and who it has been held by — replacing the spreadsheets the campaign ran on before.

## Language

### Territory

A Peregrina and a Misionero each sit at all three levels, but only one of them is stored: a record points at a Diócesis/Localidad, and its Provincia and Región follow from there. So a contradictory combination cannot be entered, because there is nothing to enter.

**Región**:
One of the campaign's seven pastoral regions: `NOA`, `CENTRO`, `CUYO`, `NEA`, `BS. AS`, `R. PAM`, `R. PAT`. A property **of a Diócesis/Localidad**, not of a Provincia — the Campaña's regions do not follow provincial borders. Santa Fe spans NEA and CENTRO; Buenos Aires spans BS. AS and R. PAM. A label the Campaña organises itself by, never a permission: no read is scoped by Región (ADR 0005).
_Avoid_: Zona, Área; treating it as an attribute of a Provincia

**Provincia**:
An Argentine province. Contributes its abbreviation to a Peregrina's Código. Carries no Región of its own.

**Diócesis/Localidad**:
The narrowest territorial level — the diocese or town a Peregrina and Misionero belong to. Carries its own Región, from which a Peregrina's and a Misionero's Región are derived.
_Avoid_: Parroquia (that is a Centro, not a territory)

### People

**Usuario**:
A person who signs in. Every Usuario holds exactly one Rol. Distinct from a Misionero, who never signs in.
_Avoid_: Cuenta, Miembro

**Actor**:
The authenticated Usuario on whose behalf an operation runs — their Rol, which decides what they may change. Every Rol sees the whole country (ADR 0016).
_Avoid_: Session, Current user

**Buzón**:
The email address a Usuario enters by. For the two Rols that load records it belongs to a **function** rather than to a person: one Buzón shared by every Responsable Diocesano, one by every Dirigente Joven (ADR 0016). Handing it on is changing the mailbox's own password. Entering means receiving a link in that mailbox, so the Buzón is the credential and not merely a name.
_Avoid_: Cuenta, Mail personal, Usuario

**Invitación**:
The record that brings a Usuario into existence: a Buzón, a Rol, and who issued it. Nobody self-registers and nothing expires — a mistaken one is revocada. The invited Rol is strictly below the inviter's (ADR 0003); no Rol carries a territory (ADR 0016).
_Avoid_: Alta, Registro, Solicitud

**Enlace de invitación**:
The address the inviter copies and sends by whatever they already use to reach the person. It opens the entering screen with the Buzón already written, so nobody types it. It carries no token and grants nothing: entering still means receiving a link in the Buzón (ADR 0011).
_Avoid_: Enlace de entrar, Enlace mágico, Token

**Rol**:
One of four: `admin`, `asesor_nacional`, `responsable_diocesano`, `dirigente_joven`. All four see the whole country. The first two **configure** — Usuarios, Invitaciones, Territorio; the last two **load** — Peregrinas, Misioneros, Asignaciones — and share a rank, so neither manages the other and neither invites anybody. A Usuario may only create and manage Usuarios of a strictly lower rank (ADR 0016).
_Avoid_: Referente Local (gone since ADR 0016)

**Asesor Nacional**:
A Usuario who configures the system and invites the Responsables Diocesanos and Dirigentes Jóvenes.
_Avoid_: Admin (that is a separate, higher Rol)

**Responsable Diocesano**:
The shared Buzón of every Responsable Diocesano in the country. Loads Peregrinas of every Modalidad, Misioneros and Asignaciones anywhere; configures nothing. The name is the people's, not a scope: it is not bounded by a Diócesis.
_Avoid_: Zone manager, Encargado diocesano

**Dirigente Joven**:
The shared Buzón of every dirigente of the Campaña joven. Sees everything, like any Rol, and **writes only `JOV` Peregrinas** — and the Asignaciones of those. Loads and edits any Misionero, because a Misionero has no Modalidad (ADR 0016).
_Avoid_: Dirigente (alone), Referente

**Misionero**:
A person who can take charge of a Peregrina, alone or as half of a Matrimonio. A tracked data entity only — a Misionero has no credentials and never signs in.
_Avoid_: Usuario, Voluntario

**Matrimonio**:
A married couple who take charge of a Peregrina together — two Misioneros, one Tenedor. The couple shares a Centro and a territory; each spouse keeps their own teléfono, email, Fecha de consagración and Resumen anual, because two people are consecrated on two different days.
A Misionero in an active Matrimonio is **never** a holder on their own: the couple replaces them in every list and every picker, so an image is never filed under one spouse while the other is invisible. Ending a Matrimonio is a **baja**, like any other — the two spouses become individual Misioneros again, and every Asignación the couple held keeps reading as the couple, because that is what was true then (ADR 0010).
Distinct from the `MAT` Modalidad, which is a property of the *image* and says nothing about who holds it.
_Avoid_: Pareja, Familia (that is the `FAM` Modalidad), Cónyuges

**Tenedor**:
Whoever a Peregrina is in the charge of: one Misionero, or one Matrimonio. The word exists because Asignación and Peregrina each point at either kind, and because a screen asking "who has this image" wants one answer rather than a choice of two questions.
_Avoid_: Responsable, Portador, Dueño

### Objects

**Peregrina**:
A pilgrim image tracked by the campaign.

**Código**:
The identifier written on a Peregrina, `[Provincia Modalidad Número]` — e.g. `CBA JOV 0001`. The Provincia and Modalidad always come from the image; the **número** may be typed — it is what is already written on many images — or left empty, and then the system takes the next after the highest for that Provincia and Modalidad. The one check is that the Código does not already exist, anywhere; nothing checks that it follows the previous one (ADR 0013). Never parsed to decide permissions. An image registered by its Numeración anterior has none until somebody gives it one. Editing the número recomposes it; nothing else does (ADR 0012, 0013).
_Avoid_: ID String

**Numeración anterior**:
What a Peregrina had written on it before the Campaña's format existed — "Peregrina 7", "Rosario-12", a number alone. Typed exactly as it reads, never parsed, and not unique: it repeats between Diócesis. Kept after the image receives a Código, so it can still be found by it (ADR 0012).
_Avoid_: Código viejo, Rótulo

**Identificación**:
How a Peregrina is named on every screen and in every message: its Código if it has one, its Numeración anterior if not. Computed, never stored (ADR 0012).
_Avoid_: Rótulo, Nombre

**Modalidad**:
The apostolate a Peregrina belongs to, as a three-letter code — the letters in the middle of its Código. Sixteen of them, in the Campaña's own order:

| | | | |
|---|---|---|---|
| `MIS` Misioneritos | `FAM` Familias | `MAT` Matrimonios | `TRA` Trabajo |
| `RIE` Niños y Bebés en riesgo | `DUL` Dulce Espera (niños por nacer) | `JOV` Jóvenes | `NVI` No Videntes |
| `SAL` De la Salud | `SER` Serenidad y Confianza | `TAX` Taxistas | `HPR` Hijo Pródigo |
| `CEN` Cenáculo | `SOR` Sordos | `SAC` María Madre y Reina de los Sacerdotes | `VOC` Vocaciones |

`INF` and `ADU` were placeholders from before this list existed and are gone from the enum outright — unlike the legacy `inactiva` Estado, which is kept because real records carry it (ADR 0005). A picker is built from the enum through `MODALIDAD_LABELS`, never from a second hand-written list.
_Avoid_: Rama, Categoría

**Tipo**:
Whether a Peregrina is a `peregrina` or an `auxiliar`. Independent of Modalidad.
_Avoid_: Modalidad

**Estado**:
The condition of a Peregrina: Activa, En reparación, or Extraviada. It describes the image and says nothing about who has it — an Extraviada Peregrina keeps its open Asignación, because the last holder is where anyone starts looking. `Inactiva` is a legacy value: still displayed on records that carry it, never offered for new entry.
**Extraviada** means lost for now, whether or not somebody had it. It is only an Estado: the image stays in every list, figure and filter, and changing it back is an edit (ADR 0014).
_Avoid_: using it to mean "not currently assigned" (that is Tenencia actual); "marcada como extraviada" or any baja of a Peregrina

**Centro**:
The place where a Peregrina is venerated — a santuario, ermita, or parroquia, recorded with its name.
_Avoid_: Ubicación, Sede

**Asignación**:
A period during which one Tenedor — a Misionero or a Matrimonio — had charge of one Peregrina. Closed when the Peregrina is returned or handed on. Recorded with the Usuario each end was registered by, and never presented as a person: a Buzón is shared by everybody doing one function, so the record cannot answer *who*. Since ADR 0016 no Rol carries a territory, so it no longer answers *where* either.
A mistaken one is **corregida**, never deleted — an edit that stamps `corregidaAt`, so a typo does not become permanent history and the correction does not become invisible history.
_Avoid_: Ubicación, Préstamo; "registrada por" followed by a person's name

**Tenencia actual**:
The single open Asignación for a Peregrina — the Tenedor responsible for it right now, whether that is one Misionero or a Matrimonio. A Peregrina has at most one, and no Asignación is ever overwritten: handing an image on closes one period and opens another.
_Avoid_: Ubicación

**De baja**:
Retired rather than deleted: a Misionero who has left the Campaña, a Matrimonio that has ended, a Usuario whose access has ended, or a territory — recorded with a timestamp, excluded from active lists, and never destroyed, because every Asignación has to keep resolving to a real name. Refused while an Asignación is still open. **A Peregrina has no baja** (ADR 0014): it is in the inventory, Extraviada or not, until it is borrada.
_Avoid_: Borrar (that destroys); any baja of a Peregrina

**Borrar**:
A Peregrina stops existing in the system, together with every Asignación it ever had — a hard delete, allowed even when it was, or is, in somebody's charge, behind a warning that says how much history goes with it. Each Misionero who had it loses that period from their page, and its Código is free again. An image that is only lost is not borrada: its Estado is Extraviada (ADR 0014). Nothing else is ever borrado.
_Avoid_: Eliminar; using it for a baja

**Planilla**:
An Excel file (`.xlsx`). Two directions: a listado of Peregrinas or Misioneros **downloaded** with the filters on screen, and a planilla of new Misioneros **loaded** — each row one person, optionally with the image assigned to them: the Código of one already in the system, or the data of a new one. Loading is all or nothing: it is *revisada* first, and one row with an error means no row is loaded. It only creates; it never changes a record that exists (ADR 0017).
_Avoid_: Excel, CSV, Importación masiva, Reporte

**Tablero**:
The screen of aggregate figures for the Actor's own territory — counts by Estado, Modalidad, Tipo and territory, plus the four lists that lead to work. Every figure links to the records behind it. It is a destination reached from the header, not the home screen: Inicio is the three things somebody came to do.
_Avoid_: Dashboard, Panel, Reportes (a report is exported; this is not)

**Estancada**:
A Peregrina that has been in the same hands longer than the Campaña's threshold — 180 days by default, and the screen always names the number. Distinct from **nunca entregada**, an image that has never been in anybody's charge, and from **libre**, one that is not in anybody's charge right now.
_Avoid_: Perdida (that is Extraviada), Inactiva

**Fecha de consagración**:
The day a Misionero was consecrated — or a Peregrina, which has its own. Optional on both. It was the Año de consagración until ADR 0013; every year recorded before became the first of January of that year.
_Avoid_: Año de consagración

**Resumen anual**:
A free-text account, kept per calendar year, of a Misionero's activity with their Peregrina.
