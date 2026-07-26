import Link from "next/link";
import { getMisionerosAction } from "@/modules/misionero/misionero.router";
import Insignia from "@/components/Insignia";
import { BotonEnlace } from "@/components/Boton";
import { Vacio } from "@/components/EstadosAsincronicos";
import { nombreCompleto } from "@/lib/formato";

/**
 * Misioneros de tu territorio.
 *
 * This route did not exist. The sidebar linked to it and got a 404, which is why
 * it is here before the visual language is finally settled — a live 404 in the
 * primary navigation is worse than a screen that gets restyled once.
 *
 * Cards rather than a table, provisionally: the Peregrina list is still being
 * chosen between three structures, and whichever wins should decide this screen
 * too. What is not provisional is the shape of the answer — a person, where they
 * are, and how to reach them — because that is what somebody is looking for when
 * they open it.
 *
 * The read is not wrapped in a try. It throws on refusal, `error.tsx` catches
 * it, and `Vacio` below is only ever reached when the query genuinely came back
 * with nothing: "no hay Misioneros" shown to somebody who was refused would tell
 * them their territory is empty and confirm to a prober that it exists.
 */

export const dynamic = "force-dynamic";

export default async function MisioneroPage() {
  const misioneros = await getMisionerosAction();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-tinta">Misioneros</h1>
          <p className="mt-1 text-base text-tinta-suave">
            {misioneros.length === 1
              ? "1 persona en tu territorio"
              : `${misioneros.length} personas en tu territorio`}
          </p>
        </div>
      </header>

      {misioneros.length === 0 ? (
        <Vacio
          titulo="Todavía no hay Misioneros cargados"
          mensaje="Cuando cargues la primera persona va a aparecer acá, y vas a poder entregarle una imagen."
        />
      ) : (
        <ul className="space-y-3">
          {misioneros.map((m) => (
            <li key={m.id}>
              <Link
                href={`/misionero/${m.id}`}
                className="block rounded-tarjeta border-2 border-borde bg-papel p-4 hover:border-borde-fuerte"
              >
                <span className="flex flex-wrap items-center gap-3">
                  <span className="text-xl font-bold text-tinta">
                    {nombreCompleto(m)}
                  </span>
                  {m.deBaja && <Insignia tono="neutro">Dado de baja</Insignia>}
                </span>

                <span className="mt-1 block text-base text-tinta-suave">
                  {m.diocesisLocalidad.nombre}, {m.provincia}
                  {m.telefono ? ` · ${m.telefono}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <BotonEnlace href="/asignacion/new" tono="secundario">
        Entregar una imagen
      </BotonEnlace>
    </main>
  );
}
